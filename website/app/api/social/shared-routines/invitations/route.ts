import { and, desc, eq, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../src/db';
import * as schema from '../../../../../src/db/schema';
import { verifyAuth } from '../../../../../src/lib/auth';
import { RATE_LIMITS } from '../../../../../src/lib/rate-limit';

export async function GET(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const rateLimit = await RATE_LIMITS.SOCIAL_SHARED_ROUTINES_READ(userId);
        if (!rateLimit.ok) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }

        const invitations = await db
            .select({
                id: schema.sharedRoutineInvitations.id,
                sharedRoutineId: schema.sharedRoutineInvitations.sharedRoutineId,
                invitedUserId: schema.sharedRoutineInvitations.invitedUserId,
                invitedBy: schema.sharedRoutineInvitations.invitedBy,
                proposedRole: schema.sharedRoutineInvitations.proposedRole,
                status: schema.sharedRoutineInvitations.status,
                createdAt: schema.sharedRoutineInvitations.createdAt,
                workspaceTitle: schema.sharedRoutines.title,
                ownerId: schema.sharedRoutines.ownerId,
                editMode: schema.sharedRoutines.editMode,
                approvalMode: schema.sharedRoutines.approvalMode,
                currentRevision: schema.sharedRoutines.currentRevision,
                sourceRoutineId: schema.sharedRoutines.sourceRoutineId,
            })
            .from(schema.sharedRoutineInvitations)
            .innerJoin(schema.sharedRoutines, eq(schema.sharedRoutines.id, schema.sharedRoutineInvitations.sharedRoutineId))
            .where(
                and(
                    eq(schema.sharedRoutineInvitations.invitedUserId, userId),
                    eq(schema.sharedRoutineInvitations.status, 'pending'),
                    isNull(schema.sharedRoutineInvitations.deletedAt),
                    isNull(schema.sharedRoutines.deletedAt),
                ),
            )
            .orderBy(desc(schema.sharedRoutineInvitations.createdAt));

        return NextResponse.json({
            success: true,
            items: invitations.map((invitation) => ({
                id: invitation.id,
                sharedRoutineId: invitation.sharedRoutineId,
                invitedUserId: invitation.invitedUserId,
                invitedBy: invitation.invitedBy,
                proposedRole: invitation.proposedRole,
                status: invitation.status,
                createdAt: invitation.createdAt,
                workspace: {
                    id: invitation.sharedRoutineId,
                    title: invitation.workspaceTitle,
                    ownerId: invitation.ownerId,
                    editMode: invitation.editMode,
                    approvalMode: invitation.approvalMode,
                    currentRevision: invitation.currentRevision,
                    sourceRoutineId: invitation.sourceRoutineId,
                },
            })),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
