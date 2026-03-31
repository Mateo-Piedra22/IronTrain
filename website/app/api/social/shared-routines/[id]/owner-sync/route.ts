import { and, eq, isNull, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../../../src/db';
import * as schema from '../../../../../../src/db/schema';
import { verifyAuth } from '../../../../../../src/lib/auth';
import { RATE_LIMITS } from '../../../../../../src/lib/rate-limit';
import { summarizeSharedRoutinePayload } from '../../../../../../src/lib/shared-routine-diff';
import { checkSharedRoutineRevision } from '../../../../../../src/lib/shared-routine-sync-policy';
import { buildRoutineSharePayloadForUser } from '../../../../../../src/lib/social-routine-share-payload';

const ownerSyncSchema = z.object({
    sourceRoutineId: z.string().trim().min(1).optional(),
    baseRevision: z.number().int().positive().optional(),
});

class RevisionConflictError extends Error {
    baseRevision: number;
    serverRevision: number;

    constructor(baseRevision: number, serverRevision: number) {
        super('Shared routine has a newer revision. Refresh and retry.');
        this.name = 'RevisionConflictError';
        this.baseRevision = baseRevision;
        this.serverRevision = serverRevision;
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
        const body = await req.json().catch(() => null);
        const parsed = ownerSyncSchema.safeParse(body ?? {});
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 });
        }

        const [workspace] = await db
            .select()
            .from(schema.sharedRoutines)
            .where(
                and(
                    eq(schema.sharedRoutines.id, id),
                    isNull(schema.sharedRoutines.deletedAt),
                ),
            )
            .limit(1);

        if (!workspace) {
            return NextResponse.json({ error: 'Shared routine not found' }, { status: 404 });
        }

        if (workspace.ownerId !== userId) {
            return NextResponse.json({ error: 'Only owner can sync updates' }, { status: 403 });
        }

        const sourceRoutineId = parsed.data.sourceRoutineId ?? workspace.sourceRoutineId;
        const baseRevision = parsed.data.baseRevision;
        if (!sourceRoutineId) {
            return NextResponse.json({ error: 'Missing source routine id' }, { status: 400 });
        }

        const payload = await buildRoutineSharePayloadForUser(db, userId, sourceRoutineId);
        const payloadSummary = summarizeSharedRoutinePayload(payload as Record<string, unknown>);

        if (!Array.isArray(payload.routine_exercises) || payload.routine_exercises.length === 0) {
            return NextResponse.json({ error: 'Routine must contain at least one exercise' }, { status: 400 });
        }

        const now = new Date();
        const snapshotId = crypto.randomUUID();

        let nextRevision = workspace.currentRevision + 1;

        await db.transaction(async (tx) => {
            await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${id}))`);

            const [freshWorkspace] = await tx
                .select()
                .from(schema.sharedRoutines)
                .where(
                    and(
                        eq(schema.sharedRoutines.id, id),
                        isNull(schema.sharedRoutines.deletedAt),
                    ),
                )
                .limit(1);

            if (!freshWorkspace) {
                throw new Error('Shared routine not found');
            }

            const revisionCheck = typeof baseRevision === 'number'
                ? checkSharedRoutineRevision({
                    baseRevision,
                    serverRevision: freshWorkspace.currentRevision,
                    force: false,
                })
                : ({ ok: true } as const);

            if (!revisionCheck.ok) {
                throw new RevisionConflictError(revisionCheck.baseRevision, revisionCheck.serverRevision);
            }

            nextRevision = freshWorkspace.currentRevision + 1;

            await tx.insert(schema.sharedRoutineSnapshots).values({
                id: snapshotId,
                sharedRoutineId: id,
                revision: nextRevision,
                payload: payload,
                createdBy: userId,
                createdAt: now,
                updatedAt: now,
            });

            await tx.update(schema.sharedRoutines).set({
                currentSnapshotId: snapshotId,
                currentRevision: nextRevision,
                sourceRoutineId,
                updatedAt: now,
            }).where(eq(schema.sharedRoutines.id, id));

            await tx.insert(schema.sharedRoutineChanges).values({
                id: crypto.randomUUID(),
                sharedRoutineId: id,
                snapshotId,
                actorId: userId,
                actionType: 'owner_sync',
                metadata: {
                    sourceRoutineId,
                    revision: nextRevision,
                    entities: payloadSummary,
                },
                createdAt: now,
                updatedAt: now,
            });
        });

        return NextResponse.json({
            success: true,
            sharedRoutineId: id,
            snapshotId,
            revision: nextRevision,
        });
    } catch (error) {
        if (error instanceof RevisionConflictError) {
            return NextResponse.json(
                {
                    error: error.message,
                    code: 'SHARED_ROUTINE_REVISION_CONFLICT',
                    baseRevision: error.baseRevision,
                    serverRevision: error.serverRevision,
                },
                { status: 409 },
            );
        }

        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
