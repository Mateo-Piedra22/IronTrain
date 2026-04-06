import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';
import { captureServerEvent } from '../../../../src/lib/posthog-server';
import { RATE_LIMITS } from '../../../../src/lib/rate-limit';
import { summarizeSharedRoutinePayload } from '../../../../src/lib/shared-routine-diff';
import { buildRoutineSharePayloadForUser } from '../../../../src/lib/social-routine-share-payload';

const createSharedRoutineSchema = z.object({
    routineId: z.string().trim().min(1),
    title: z.string().trim().min(2).max(120).optional(),
    memberIds: z.array(z.string().trim().min(1)).max(12).default([]),
    memberRoles: z.record(z.string().trim().min(1), z.enum(['editor', 'viewer'])).default({}),
    removeMissingMembers: z.boolean().default(true),
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

        const sharedSpaces = await db
            .select()
            .from(schema.sharedRoutines)
            .where(
                and(
                    inArray(schema.sharedRoutines.id, sharedRoutineIds),
                    isNull(schema.sharedRoutines.deletedAt),
                ),
            );

        const sharedSpaceById = new Map(sharedSpaces.map((sharedSpace) => [sharedSpace.id, sharedSpace]));
        const pendingRows = sharedRoutineIds.length > 0
            ? await db
                .select({
                    sharedRoutineId: schema.sharedRoutineReviewRequests.sharedRoutineId,
                    pendingCount: sql<number>`count(*)::int`,
                })
                .from(schema.sharedRoutineReviewRequests)
                .where(
                    and(
                        inArray(schema.sharedRoutineReviewRequests.sharedRoutineId, sharedRoutineIds),
                        eq(schema.sharedRoutineReviewRequests.status, 'pending'),
                        isNull(schema.sharedRoutineReviewRequests.deletedAt),
                    ),
                )
                .groupBy(schema.sharedRoutineReviewRequests.sharedRoutineId)
            : [];

        const pendingInviteRows = sharedRoutineIds.length > 0
            ? await db
                .select({
                    sharedRoutineId: schema.sharedRoutineInvitations.sharedRoutineId,
                    pendingCount: sql<number>`count(*)::int`,
                })
                .from(schema.sharedRoutineInvitations)
                .where(
                    and(
                        inArray(schema.sharedRoutineInvitations.sharedRoutineId, sharedRoutineIds),
                        eq(schema.sharedRoutineInvitations.status, 'pending'),
                        isNull(schema.sharedRoutineInvitations.deletedAt),
                    ),
                )
                .groupBy(schema.sharedRoutineInvitations.sharedRoutineId)
            : [];

        const pendingBySharedSpaceId = new Map(
            pendingRows.map((row) => [row.sharedRoutineId, Number(row.pendingCount) || 0]),
        );
        const pendingInvitesBySharedSpaceId = new Map(
            pendingInviteRows.map((row) => [row.sharedRoutineId, Number(row.pendingCount) || 0]),
        );

        const items = memberships
            .map((membership) => {
                const sharedSpace = sharedSpaceById.get(membership.sharedRoutineId);
                if (!sharedSpace) return null;

                const derivedCanEdit =
                    membership.role === 'owner' ||
                    membership.canEdit ||
                    (sharedSpace.editMode === 'collaborative' && membership.role === 'editor');

                return {
                    id: sharedSpace.id,
                    title: sharedSpace.title,
                    ownerId: sharedSpace.ownerId,
                    editMode: sharedSpace.editMode,
                    approvalMode: sharedSpace.approvalMode,
                    currentRevision: sharedSpace.currentRevision,
                    sourceRoutineId: sharedSpace.sourceRoutineId,
                    membership: {
                        role: membership.role,
                        canEdit: derivedCanEdit,
                    },
                    pendingReviewsCount: pendingBySharedSpaceId.get(sharedSpace.id) ?? 0,
                    pendingInvitationsCount: pendingInvitesBySharedSpaceId.get(sharedSpace.id) ?? 0,
                    updatedAt: sharedSpace.updatedAt,
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
        const memberRoles = parsed.data.memberRoles ?? {};
        const removeMissingMembers = parsed.data.removeMissingMembers ?? true;

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

        const now = new Date();

        const [existingSharedSpace] = await db
            .select()
            .from(schema.sharedRoutines)
            .where(
                and(
                    eq(schema.sharedRoutines.ownerId, userId),
                    eq(schema.sharedRoutines.sourceRoutineId, routineId),
                    isNull(schema.sharedRoutines.deletedAt),
                ),
            )
            .limit(1);

        if (existingSharedSpace) {
            const normalizedTitle = title?.trim() || (payload.routine as Record<string, unknown>)?.name as string || existingSharedSpace.title;

            await db.transaction(async (tx) => {
                await tx.update(schema.sharedRoutines).set({
                    title: normalizedTitle,
                    editMode,
                    approvalMode,
                    updatedAt: now,
                }).where(eq(schema.sharedRoutines.id, existingSharedSpace.id));

                const [ownerMembership] = await tx
                    .select()
                    .from(schema.sharedRoutineMembers)
                    .where(
                        and(
                            eq(schema.sharedRoutineMembers.sharedRoutineId, existingSharedSpace.id),
                            eq(schema.sharedRoutineMembers.userId, userId),
                        ),
                    )
                    .limit(1);

                if (ownerMembership) {
                    await tx.update(schema.sharedRoutineMembers).set({
                        role: 'owner',
                        canEdit: true,
                        invitedBy: userId,
                        deletedAt: null,
                        updatedAt: now,
                    }).where(eq(schema.sharedRoutineMembers.id, ownerMembership.id));
                } else {
                    await tx.insert(schema.sharedRoutineMembers).values({
                        id: crypto.randomUUID(),
                        sharedRoutineId: existingSharedSpace.id,
                        userId,
                        role: 'owner',
                        canEdit: true,
                        invitedBy: userId,
                        joinedAt: now,
                        updatedAt: now,
                    });
                }

                for (const memberId of memberIds) {
                    const [activeMember] = await tx
                        .select()
                        .from(schema.sharedRoutineMembers)
                        .where(
                            and(
                                eq(schema.sharedRoutineMembers.sharedRoutineId, existingSharedSpace.id),
                                eq(schema.sharedRoutineMembers.userId, memberId),
                                isNull(schema.sharedRoutineMembers.deletedAt),
                            ),
                        )
                        .limit(1);

                    const requestedRole = memberRoles[memberId];
                    const targetRole = requestedRole ?? 'viewer';
                    const targetCanEdit = targetRole === 'editor';

                    if (activeMember) {
                        await tx.update(schema.sharedRoutineMembers).set({
                            role: targetRole,
                            canEdit: targetCanEdit,
                            invitedBy: userId,
                            updatedAt: now,
                        }).where(eq(schema.sharedRoutineMembers.id, activeMember.id));
                    } else {
                        const [existingInvite] = await tx
                            .select()
                            .from(schema.sharedRoutineInvitations)
                            .where(
                                and(
                                    eq(schema.sharedRoutineInvitations.sharedRoutineId, existingSharedSpace.id),
                                    eq(schema.sharedRoutineInvitations.invitedUserId, memberId),
                                ),
                            )
                            .limit(1);

                        if (existingInvite) {
                            await tx.update(schema.sharedRoutineInvitations).set({
                                invitedBy: userId,
                                proposedRole: targetRole,
                                status: 'pending',
                                respondedAt: null,
                                deletedAt: null,
                                updatedAt: now,
                            }).where(eq(schema.sharedRoutineInvitations.id, existingInvite.id));
                        } else {
                            await tx.insert(schema.sharedRoutineInvitations).values({
                                id: crypto.randomUUID(),
                                sharedRoutineId: existingSharedSpace.id,
                                invitedUserId: memberId,
                                invitedBy: userId,
                                proposedRole: targetRole,
                                status: 'pending',
                                createdAt: now,
                                updatedAt: now,
                            });
                        }
                    }
                }

                if (removeMissingMembers) {
                    const existingMembers = await tx
                        .select()
                        .from(schema.sharedRoutineMembers)
                        .where(
                            and(
                                eq(schema.sharedRoutineMembers.sharedRoutineId, existingSharedSpace.id),
                                isNull(schema.sharedRoutineMembers.deletedAt),
                            ),
                        );

                    for (const existingMember of existingMembers) {
                        if (existingMember.userId === userId) continue;
                        if (memberIds.includes(existingMember.userId)) continue;

                        await tx.update(schema.sharedRoutineMembers).set({
                            canEdit: false,
                            deletedAt: now,
                            updatedAt: now,
                        }).where(eq(schema.sharedRoutineMembers.id, existingMember.id));
                    }

                    const pendingInvites = await tx
                        .select()
                        .from(schema.sharedRoutineInvitations)
                        .where(
                            and(
                                eq(schema.sharedRoutineInvitations.sharedRoutineId, existingSharedSpace.id),
                                eq(schema.sharedRoutineInvitations.status, 'pending'),
                                isNull(schema.sharedRoutineInvitations.deletedAt),
                            ),
                        );

                    for (const invite of pendingInvites) {
                        if (memberIds.includes(invite.invitedUserId)) continue;

                        await tx.update(schema.sharedRoutineInvitations).set({
                            status: 'cancelled',
                            respondedAt: now,
                            updatedAt: now,
                        }).where(eq(schema.sharedRoutineInvitations.id, invite.id));
                    }
                }

                await tx.insert(schema.sharedRoutineChanges).values({
                    id: crypto.randomUUID(),
                    sharedRoutineId: existingSharedSpace.id,
                    actorId: userId,
                    actionType: 'reconfigured',
                    metadata: {
                        routineId,
                        requestedMemberCount: memberIds.length + 1,
                        invitationRequiredForNewMembers: true,
                        removeMissingMembers,
                        editMode,
                        approvalMode,
                        entities: payloadSummary,
                    },
                    createdAt: now,
                    updatedAt: now,
                });
            });

            const [memberCountRow] = await db
                .select({
                    memberCount: sql<number>`count(*)::int`,
                })
                .from(schema.sharedRoutineMembers)
                .where(
                    and(
                        eq(schema.sharedRoutineMembers.sharedRoutineId, existingSharedSpace.id),
                        isNull(schema.sharedRoutineMembers.deletedAt),
                    ),
                );

            const [pendingInvitesRow] = await db
                .select({
                    pendingInvites: sql<number>`count(*)::int`,
                })
                .from(schema.sharedRoutineInvitations)
                .where(
                    and(
                        eq(schema.sharedRoutineInvitations.sharedRoutineId, existingSharedSpace.id),
                        eq(schema.sharedRoutineInvitations.status, 'pending'),
                        isNull(schema.sharedRoutineInvitations.deletedAt),
                    ),
                );

            return NextResponse.json({
                success: true,
                sharedRoutineId: existingSharedSpace.id,
                revision: existingSharedSpace.currentRevision,
                members: Number(memberCountRow?.memberCount) || 1,
                pendingInvitations: Number(pendingInvitesRow?.pendingInvites) || 0,
                reused: true,
            });
        }

        const sharedRoutineId = crypto.randomUUID();
        const snapshotId = crypto.randomUUID();

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
                const requestedRole = memberRoles[memberId];
                const targetRole = requestedRole ?? 'viewer';
                await tx.insert(schema.sharedRoutineInvitations).values({
                    id: crypto.randomUUID(),
                    sharedRoutineId,
                    invitedUserId: memberId,
                    invitedBy: userId,
                    proposedRole: targetRole,
                    status: 'pending',
                    respondedAt: null,
                    createdAt: now,
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
                    memberCount: 1,
                    pendingInvitations: memberIds.length,
                    editMode,
                    approvalMode,
                    entities: payloadSummary,
                },
                createdAt: now,
                updatedAt: now,
            });
        });

        if (memberIds.length > 0) {
            void captureServerEvent(userId, 'workspace_invitation_sent', {
                sharedRoutineId,
                invitationsCount: memberIds.length,
            });
        }

        return NextResponse.json({
            success: true,
            sharedRoutineId,
            revision: 1,
            members: 1,
            pendingInvitations: memberIds.length,
            reused: false,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
