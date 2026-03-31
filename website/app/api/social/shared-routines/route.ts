import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';
import { RATE_LIMITS } from '../../../../src/lib/rate-limit';
import { summarizeSharedRoutinePayload } from '../../../../src/lib/shared-routine-diff';
import { buildRoutineSharePayloadForUser } from '../../../../src/lib/social-routine-share-payload';

const createSharedRoutineSchema = z.object({
    routineId: z.string().trim().min(1),
    title: z.string().trim().min(2).max(120).optional(),
    memberIds: z.array(z.string().trim().min(1)).max(12).default([]),
    editMode: z.enum(['owner_only', 'collaborative']).default('owner_only'),
    approvalMode: z.enum(['none', 'owner_review']).default('none'),
});

export async function GET(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const rateLimit = await RATE_LIMITS.SOCIAL_SHARED_ROUTINES_READ(userId);
        if (!rateLimit.ok) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }

        const memberships = await db
            .select()
            .from(schema.sharedRoutineMembers)
            .where(
                and(
                    eq(schema.sharedRoutineMembers.userId, userId),
                    isNull(schema.sharedRoutineMembers.deletedAt),
                ),
            );

        if (memberships.length === 0) {
            return NextResponse.json({ success: true, items: [] });
        }

        const sharedRoutineIds = memberships.map((membership) => membership.sharedRoutineId);

        const workspaces = await db
            .select()
            .from(schema.sharedRoutines)
            .where(
                and(
                    inArray(schema.sharedRoutines.id, sharedRoutineIds),
                    isNull(schema.sharedRoutines.deletedAt),
                ),
            );

        const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]));

        const items = memberships
            .map((membership) => {
                const workspace = workspaceById.get(membership.sharedRoutineId);
                if (!workspace) return null;

                const derivedCanEdit =
                    membership.role === 'owner' ||
                    membership.canEdit ||
                    (workspace.editMode === 'collaborative' && membership.role === 'editor');

                return {
                    id: workspace.id,
                    title: workspace.title,
                    ownerId: workspace.ownerId,
                    editMode: workspace.editMode,
                    approvalMode: workspace.approvalMode,
                    currentRevision: workspace.currentRevision,
                    sourceRoutineId: workspace.sourceRoutineId,
                    membership: {
                        role: membership.role,
                        canEdit: derivedCanEdit,
                    },
                    updatedAt: workspace.updatedAt,
                };
            })
            .filter(Boolean);

        return NextResponse.json({ success: true, items });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const rateLimit = await RATE_LIMITS.SOCIAL_SHARED_ROUTINES_WRITE(userId);
        if (!rateLimit.ok) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }

        const body = await req.json().catch(() => null);
        const parsed = createSharedRoutineSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 });
        }

        const routineId = parsed.data.routineId;
        const title = parsed.data.title;
        const editMode = parsed.data.editMode;
        const approvalMode = parsed.data.approvalMode;
        const memberIds = Array.from(new Set(parsed.data.memberIds.filter((id) => id !== userId)));

        const payload = await buildRoutineSharePayloadForUser(db, userId, routineId);
        const payloadSummary = summarizeSharedRoutinePayload(payload as Record<string, unknown>);

        if (!Array.isArray(payload.routine_exercises) || payload.routine_exercises.length === 0) {
            return NextResponse.json({ error: 'Routine must contain at least one exercise' }, { status: 400 });
        }

        if (memberIds.length > 0) {
            const friendships = await db
                .select({ userId: schema.friendships.userId, friendId: schema.friendships.friendId })
                .from(schema.friendships)
                .where(
                    and(
                        eq(schema.friendships.status, 'accepted'),
                        isNull(schema.friendships.deletedAt),
                        or(
                            and(
                                eq(schema.friendships.userId, userId),
                                inArray(schema.friendships.friendId, memberIds),
                            ),
                            and(
                                inArray(schema.friendships.userId, memberIds),
                                eq(schema.friendships.friendId, userId),
                            ),
                        ),
                    ),
                );

            const acceptedMemberIds = new Set<string>();
            friendships.forEach((row) => {
                if (row.userId === userId) acceptedMemberIds.add(row.friendId);
                if (row.friendId === userId) acceptedMemberIds.add(row.userId);
            });

            const missingMembers = memberIds.filter((id) => !acceptedMemberIds.has(id));
            if (missingMembers.length > 0) {
                return NextResponse.json({ error: 'Some members are not accepted friends', missingMembers }, { status: 403 });
            }
        }

        const sharedRoutineId = crypto.randomUUID();
        const snapshotId = crypto.randomUUID();
        const now = new Date();

        await db.transaction(async (tx) => {
            await tx.insert(schema.sharedRoutines).values({
                id: sharedRoutineId,
                ownerId: userId,
                title: title?.trim() || (payload.routine as Record<string, unknown>)?.name as string || 'Rutina compartida',
                sourceRoutineId: routineId,
                editMode,
                approvalMode,
                currentSnapshotId: snapshotId,
                currentRevision: 1,
                createdAt: now,
                updatedAt: now,
            });

            await tx.insert(schema.sharedRoutineMembers).values({
                id: crypto.randomUUID(),
                sharedRoutineId,
                userId,
                role: 'owner',
                canEdit: true,
                invitedBy: userId,
                joinedAt: now,
                updatedAt: now,
            });

            for (const memberId of memberIds) {
                await tx.insert(schema.sharedRoutineMembers).values({
                    id: crypto.randomUUID(),
                    sharedRoutineId,
                    userId: memberId,
                    role: editMode === 'collaborative' ? 'editor' : 'viewer',
                    canEdit: editMode === 'collaborative',
                    invitedBy: userId,
                    joinedAt: now,
                    updatedAt: now,
                });
            }

            await tx.insert(schema.sharedRoutineSnapshots).values({
                id: snapshotId,
                sharedRoutineId,
                revision: 1,
                payload: payload,
                createdBy: userId,
                createdAt: now,
                updatedAt: now,
            });

            await tx.insert(schema.sharedRoutineChanges).values({
                id: crypto.randomUUID(),
                sharedRoutineId,
                snapshotId,
                actorId: userId,
                actionType: 'created',
                metadata: {
                    routineId,
                    memberCount: memberIds.length + 1,
                    editMode,
                    approvalMode,
                    entities: payloadSummary,
                },
                createdAt: now,
                updatedAt: now,
            });
        });

        return NextResponse.json({
            success: true,
            sharedRoutineId,
            revision: 1,
            members: memberIds.length + 1,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
