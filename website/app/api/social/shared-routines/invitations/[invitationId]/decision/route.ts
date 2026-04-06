import { and, eq, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../../../../src/db';
import * as schema from '../../../../../../../src/db/schema';
import { verifyAuth } from '../../../../../../../src/lib/auth';
import { captureServerEvent } from '../../../../../../../src/lib/posthog-server';
import { RATE_LIMITS } from '../../../../../../../src/lib/rate-limit';
import { buildSharedRoutineInvalidStatePayload, buildSharedRoutineNotFoundPayload } from '../../../../../../../src/lib/shared-routine-http-errors';

const decideInvitationSchema = z.object({
    decision: z.enum(['accept', 'reject']),
});

class InvalidStateError extends Error {
    resource: 'invitation';
    expectedStatus: string;
    currentStatus: string;

    constructor(resource: 'invitation', expectedStatus: string, currentStatus: string, message: string) {
        super(message);
        this.name = 'InvalidStateError';
        this.resource = resource;
        this.expectedStatus = expectedStatus;
        this.currentStatus = currentStatus;
    }
}

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ invitationId: string }> },
) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const rateLimit = await RATE_LIMITS.SOCIAL_SHARED_ROUTINES_WRITE(userId);
        if (!rateLimit.ok) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }

        const body = await req.json().catch(() => null);
        const parsed = decideInvitationSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 });
        }

        const { invitationId } = await context.params;
        const now = new Date();

        const [invitation] = await db
            .select()
            .from(schema.sharedRoutineInvitations)
            .where(
                and(
                    eq(schema.sharedRoutineInvitations.id, invitationId),
                    eq(schema.sharedRoutineInvitations.invitedUserId, userId),
                    isNull(schema.sharedRoutineInvitations.deletedAt),
                ),
            )
            .limit(1);

        if (!invitation) {
            return NextResponse.json(buildSharedRoutineNotFoundPayload('invitation', 'Invitation not found'), { status: 404 });
        }

        if (invitation.status !== 'pending') {
            const requestedStatus = parsed.data.decision === 'accept' ? 'accepted' : 'rejected';
            if (invitation.status === requestedStatus) {
                void captureServerEvent(
                    userId,
                    parsed.data.decision === 'accept' ? 'workspace_invitation_accepted' : 'workspace_invitation_rejected',
                    {
                        sharedRoutineId: invitation.sharedRoutineId,
                        invitationId: invitation.id,
                        idempotent: true,
                    },
                );

                return NextResponse.json({
                    success: true,
                    decision: parsed.data.decision,
                    invitationId: invitation.id,
                    sharedRoutineId: invitation.sharedRoutineId,
                    idempotent: true,
                });
            }

            throw new InvalidStateError('invitation', 'pending', String(invitation.status), 'Invitation is not pending');
        }

        const [workspace] = await db
            .select()
            .from(schema.sharedRoutines)
            .where(
                and(
                    eq(schema.sharedRoutines.id, invitation.sharedRoutineId),
                    isNull(schema.sharedRoutines.deletedAt),
                ),
            )
            .limit(1);

        if (!workspace) {
            return NextResponse.json(buildSharedRoutineNotFoundPayload('workspace', 'Shared routine not found'), { status: 404 });
        }

        await db.transaction(async (tx) => {
            await tx.update(schema.sharedRoutineInvitations).set({
                status: parsed.data.decision === 'accept' ? 'accepted' : 'rejected',
                respondedAt: now,
                updatedAt: now,
            }).where(eq(schema.sharedRoutineInvitations.id, invitation.id));

            if (parsed.data.decision === 'accept') {
                const [existingMember] = await tx
                    .select()
                    .from(schema.sharedRoutineMembers)
                    .where(
                        and(
                            eq(schema.sharedRoutineMembers.sharedRoutineId, invitation.sharedRoutineId),
                            eq(schema.sharedRoutineMembers.userId, userId),
                        ),
                    )
                    .limit(1);

                const role = invitation.proposedRole === 'editor' ? 'editor' : 'viewer';
                const canEdit = role === 'editor';

                if (existingMember) {
                    await tx.update(schema.sharedRoutineMembers).set({
                        role,
                        canEdit,
                        invitedBy: invitation.invitedBy,
                        deletedAt: null,
                        updatedAt: now,
                    }).where(eq(schema.sharedRoutineMembers.id, existingMember.id));
                } else {
                    await tx.insert(schema.sharedRoutineMembers).values({
                        id: crypto.randomUUID(),
                        sharedRoutineId: invitation.sharedRoutineId,
                        userId,
                        role,
                        canEdit,
                        invitedBy: invitation.invitedBy,
                        joinedAt: now,
                        updatedAt: now,
                    });
                }
            }

            await tx.insert(schema.sharedRoutineChanges).values({
                id: crypto.randomUUID(),
                sharedRoutineId: invitation.sharedRoutineId,
                actorId: userId,
                actionType: parsed.data.decision === 'accept' ? 'member_invitation_accepted' : 'member_invitation_rejected',
                metadata: {
                    invitationId: invitation.id,
                    invitedBy: invitation.invitedBy,
                    proposedRole: invitation.proposedRole,
                },
                createdAt: now,
                updatedAt: now,
            });
        });

        void captureServerEvent(
            userId,
            parsed.data.decision === 'accept' ? 'workspace_invitation_accepted' : 'workspace_invitation_rejected',
            {
                sharedRoutineId: invitation.sharedRoutineId,
                invitationId: invitation.id,
                idempotent: false,
            },
        );

        return NextResponse.json({
            success: true,
            decision: parsed.data.decision,
            invitationId: invitation.id,
            sharedRoutineId: invitation.sharedRoutineId,
        });
    } catch (error) {
        if (error instanceof InvalidStateError) {
            return NextResponse.json(
                buildSharedRoutineInvalidStatePayload(error.resource, error.currentStatus, error.expectedStatus, error.message),
                { status: 409 },
            );
        }

        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
