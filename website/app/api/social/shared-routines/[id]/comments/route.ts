import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../../../src/db';
import * as schema from '../../../../../../src/db/schema';
import { verifyAuth } from '../../../../../../src/lib/auth';
import { RATE_LIMITS } from '../../../../../../src/lib/rate-limit';

const createCommentSchema = z.object({
    message: z.string().trim().min(1).max(1200),
    snapshotId: z.string().trim().min(1).optional(),
});

async function ensureMembership(sharedRoutineId: string, userId: string) {
    const [membership] = await db
        .select()
        .from(schema.sharedRoutineMembers)
        .where(
            and(
                eq(schema.sharedRoutineMembers.sharedRoutineId, sharedRoutineId),
                eq(schema.sharedRoutineMembers.userId, userId),
                isNull(schema.sharedRoutineMembers.deletedAt),
            ),
        )
        .limit(1);

    return !!membership;
}

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const rateLimit = await RATE_LIMITS.SOCIAL_SHARED_ROUTINES_READ(userId);
        if (!rateLimit.ok) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }

        const { id } = await context.params;
        const allowed = await ensureMembership(id, userId);
        if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const comments = await db
            .select()
            .from(schema.sharedRoutineComments)
            .where(
                and(
                    eq(schema.sharedRoutineComments.sharedRoutineId, id),
                    isNull(schema.sharedRoutineComments.deletedAt),
                ),
            )
            .orderBy(asc(schema.sharedRoutineComments.createdAt))
            .limit(200);

        const actorIds = Array.from(
            new Set(comments.map((comment) => comment.actorId).filter((id): id is string => typeof id === 'string' && id.length > 0)),
        );

        const snapshotIds = Array.from(
            new Set(comments.map((comment) => comment.snapshotId).filter((id): id is string => typeof id === 'string' && id.length > 0)),
        );

        const [profiles, snapshots] = await Promise.all([
            actorIds.length > 0
                ? db
                    .select({
                        id: schema.userProfiles.id,
                        displayName: schema.userProfiles.displayName,
                        username: schema.userProfiles.username,
                    })
                    .from(schema.userProfiles)
                    .where(inArray(schema.userProfiles.id, actorIds))
                : Promise.resolve([]),
            snapshotIds.length > 0
                ? db
                    .select({
                        id: schema.sharedRoutineSnapshots.id,
                        revision: schema.sharedRoutineSnapshots.revision,
                    })
                    .from(schema.sharedRoutineSnapshots)
                    .where(inArray(schema.sharedRoutineSnapshots.id, snapshotIds))
                : Promise.resolve([]),
        ]);

        const profileById = new Map(
            profiles.map((profile) => [
                profile.id,
                { displayName: profile.displayName, username: profile.username },
            ]),
        );

        const revisionBySnapshotId = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot.revision]));

        return NextResponse.json({
            success: true,
            items: comments.map((comment) => ({
                id: comment.id,
                actorId: comment.actorId,
                actorDisplayName: profileById.get(comment.actorId)?.displayName ?? null,
                actorUsername: profileById.get(comment.actorId)?.username ?? null,
                snapshotId: comment.snapshotId,
                snapshotRevision:
                    comment.snapshotId && revisionBySnapshotId.has(comment.snapshotId)
                        ? revisionBySnapshotId.get(comment.snapshotId)
                        : null,
                message: comment.message,
                createdAt: comment.createdAt,
                updatedAt: comment.updatedAt,
            })),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const rateLimit = await RATE_LIMITS.SOCIAL_SHARED_ROUTINES_WRITE(userId);
        if (!rateLimit.ok) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }

        const { id } = await context.params;
        const allowed = await ensureMembership(id, userId);
        if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const body = await req.json().catch(() => null);
        const parsed = createCommentSchema.safeParse(body ?? {});
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 });
        }

        const now = new Date();
        const commentId = crypto.randomUUID();

        await db.transaction(async (tx) => {
            await tx.insert(schema.sharedRoutineComments).values({
                id: commentId,
                sharedRoutineId: id,
                actorId: userId,
                snapshotId: parsed.data.snapshotId,
                message: parsed.data.message,
                createdAt: now,
                updatedAt: now,
            });

            await tx.insert(schema.sharedRoutineChanges).values({
                id: crypto.randomUUID(),
                sharedRoutineId: id,
                actorId: userId,
                actionType: 'comment_added',
                metadata: {
                    commentId,
                    snapshotId: parsed.data.snapshotId ?? null,
                    messageLength: parsed.data.message.length,
                },
                createdAt: now,
                updatedAt: now,
            });
        });

        return NextResponse.json({
            success: true,
            item: {
                id: commentId,
                actorId: userId,
                snapshotId: parsed.data.snapshotId ?? null,
                message: parsed.data.message,
                createdAt: now,
                updatedAt: now,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
