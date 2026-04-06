import { and, eq, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../../../src/db';
import * as schema from '../../../../../../src/db/schema';
import { verifyAuth } from '../../../../../../src/lib/auth';
import { recordEndpointMetric } from '../../../../../../src/lib/endpoint-metrics';
import { RATE_LIMITS } from '../../../../../../src/lib/rate-limit';
import { summarizeSharedRoutinePayload } from '../../../../../../src/lib/shared-routine-diff';
import { buildSharedRoutineForbiddenPayload, buildSharedRoutineNotFoundPayload, buildSharedRoutineRevisionConflictPayload } from '../../../../../../src/lib/shared-routine-http-errors';
import { lockSharedRoutineWorkspace } from '../../../../../../src/lib/shared-routine-lock';
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
        if (!userId) {
            recordEndpointMetric({ endpoint: 'social.shared_routines.owner_sync', outcome: 'error', statusCode: 401, event: 'unauthorized' });
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rateLimit = await RATE_LIMITS.SOCIAL_SHARED_ROUTINES_WRITE(userId);
        if (!rateLimit.ok) {
            recordEndpointMetric({ endpoint: 'social.shared_routines.owner_sync', outcome: 'error', statusCode: 429, event: 'rate_limited' });
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }

        const { id } = await context.params;
        const body = await req.json().catch(() => null);
        const parsed = ownerSyncSchema.safeParse(body ?? {});
        if (!parsed.success) {
            recordEndpointMetric({ endpoint: 'social.shared_routines.owner_sync', outcome: 'error', statusCode: 400, event: 'invalid_body' });
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
            recordEndpointMetric({ endpoint: 'social.shared_routines.owner_sync', outcome: 'error', statusCode: 404, event: 'not_found' });
            return NextResponse.json(buildSharedRoutineNotFoundPayload('workspace', 'Shared routine not found'), { status: 404 });
        }

        if (workspace.ownerId !== userId) {
            recordEndpointMetric({ endpoint: 'social.shared_routines.owner_sync', outcome: 'error', statusCode: 403, event: 'forbidden' });
            return NextResponse.json(buildSharedRoutineForbiddenPayload('Only owner can sync updates'), { status: 403 });
        }

        const sourceRoutineId = parsed.data.sourceRoutineId ?? workspace.sourceRoutineId;
        const baseRevision = parsed.data.baseRevision;
        if (!sourceRoutineId) {
            recordEndpointMetric({ endpoint: 'social.shared_routines.owner_sync', outcome: 'error', statusCode: 400, event: 'missing_source_routine_id' });
            return NextResponse.json({ error: 'Missing source routine id' }, { status: 400 });
        }

        const payload = await buildRoutineSharePayloadForUser(db, userId, sourceRoutineId);
        const payloadSummary = summarizeSharedRoutinePayload(payload as Record<string, unknown>);

        if (!Array.isArray(payload.routine_exercises) || payload.routine_exercises.length === 0) {
            recordEndpointMetric({ endpoint: 'social.shared_routines.owner_sync', outcome: 'error', statusCode: 400, event: 'empty_routine' });
            return NextResponse.json({ error: 'Routine must contain at least one exercise' }, { status: 400 });
        }

        const now = new Date();
        const snapshotId = crypto.randomUUID();

        let nextRevision = workspace.currentRevision + 1;

        await db.transaction(async (tx) => {
            await lockSharedRoutineWorkspace(tx, id);

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

        recordEndpointMetric({ endpoint: 'social.shared_routines.owner_sync', outcome: 'success', statusCode: 200, event: 'owner_published' });

        return NextResponse.json({
            success: true,
            sharedRoutineId: id,
            snapshotId,
            revision: nextRevision,
        });
    } catch (error) {
        if (error instanceof RevisionConflictError) {
            recordEndpointMetric({ endpoint: 'social.shared_routines.owner_sync', outcome: 'conflict', statusCode: 409, event: 'revision_conflict' });
            return NextResponse.json(
                buildSharedRoutineRevisionConflictPayload(error.baseRevision, error.serverRevision, error.message),
                { status: 409 },
            );
        }

        const message = error instanceof Error ? error.message : 'Internal server error';
        recordEndpointMetric({ endpoint: 'social.shared_routines.owner_sync', outcome: 'error', statusCode: 500, event: 'internal_error' });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
