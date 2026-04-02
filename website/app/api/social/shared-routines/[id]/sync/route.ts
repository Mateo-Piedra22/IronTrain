import { and, eq, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../../../src/db';
import * as schema from '../../../../../../src/db/schema';
import { verifyAuth } from '../../../../../../src/lib/auth';
import { recordEndpointMetric } from '../../../../../../src/lib/endpoint-metrics';
import { RATE_LIMITS } from '../../../../../../src/lib/rate-limit';
import { diffSharedRoutinePayload, summarizeSharedRoutinePayload } from '../../../../../../src/lib/shared-routine-diff';
import { lockSharedRoutineWorkspace } from '../../../../../../src/lib/shared-routine-lock';
import { sharedRoutinePayloadSchema } from '../../../../../../src/lib/shared-routine-payload';
import { canEditSharedRoutine, checkSharedRoutineRevision } from '../../../../../../src/lib/shared-routine-sync-policy';

const syncSharedRoutineSchema = z.object({
    payload: sharedRoutinePayloadSchema,
    baseRevision: z.number().int().positive(),
    sourceRoutineId: z.string().trim().min(1).optional(),
    force: z.boolean().default(false),
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
            recordEndpointMetric({ endpoint: 'social.shared_routines.sync', outcome: 'error', statusCode: 401, event: 'unauthorized' });
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rateLimit = await RATE_LIMITS.SOCIAL_SHARED_ROUTINES_WRITE(userId);
        if (!rateLimit.ok) {
            recordEndpointMetric({ endpoint: 'social.shared_routines.sync', outcome: 'error', statusCode: 429, event: 'rate_limited' });
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }

        const { id } = await context.params;
        const body = await req.json().catch(() => null);
        const parsed = syncSharedRoutineSchema.safeParse(body ?? {});
        if (!parsed.success) {
            recordEndpointMetric({ endpoint: 'social.shared_routines.sync', outcome: 'error', statusCode: 400, event: 'invalid_body' });
            return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 });
        }

        const now = new Date();
        const snapshotId = crypto.randomUUID();
        const reviewRequestId = crypto.randomUUID();

        let nextRevision = 0;
        let reviewRequired = false;

        await db.transaction(async (tx) => {
            await lockSharedRoutineWorkspace(tx, id);

            const [workspace] = await tx
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
                throw new Error('Shared routine not found');
            }

            const [membership] = await tx
                .select()
                .from(schema.sharedRoutineMembers)
                .where(
                    and(
                        eq(schema.sharedRoutineMembers.sharedRoutineId, id),
                        eq(schema.sharedRoutineMembers.userId, userId),
                        isNull(schema.sharedRoutineMembers.deletedAt),
                    ),
                )
                .limit(1);

            if (!membership) {
                throw new Error('Forbidden');
            }

            const canEdit = canEditSharedRoutine({
                role: membership.role,
                canEditFlag: membership.canEdit,
                editMode: workspace.editMode,
            });

            if (!canEdit) {
                throw new Error('You do not have permission to update this shared routine');
            }

            const revisionCheck = checkSharedRoutineRevision({
                baseRevision: parsed.data.baseRevision,
                serverRevision: workspace.currentRevision,
                force: parsed.data.force,
            });

            if (!revisionCheck.ok) {
                throw new RevisionConflictError(revisionCheck.baseRevision, revisionCheck.serverRevision);
            }

            if (workspace.approvalMode === 'owner_review' && membership.role !== 'owner') {
                reviewRequired = true;

                await tx.insert(schema.sharedRoutineReviewRequests).values({
                    id: reviewRequestId,
                    sharedRoutineId: id,
                    requesterId: userId,
                    requestedBaseRevision: parsed.data.baseRevision,
                    candidatePayload: parsed.data.payload,
                    sourceRoutineId: parsed.data.sourceRoutineId ?? workspace.sourceRoutineId,
                    status: 'pending',
                    createdAt: now,
                    updatedAt: now,
                });

                await tx.insert(schema.sharedRoutineChanges).values({
                    id: crypto.randomUUID(),
                    sharedRoutineId: id,
                    actorId: userId,
                    actionType: 'review_requested',
                    metadata: {
                        baseRevision: parsed.data.baseRevision,
                        serverRevisionBeforeWrite: workspace.currentRevision,
                        sourceRoutineId: parsed.data.sourceRoutineId ?? workspace.sourceRoutineId,
                        force: parsed.data.force,
                        reviewRequestId,
                        entities: summarizeSharedRoutinePayload(parsed.data.payload as Record<string, unknown>),
                    },
                    createdAt: now,
                    updatedAt: now,
                });

                return;
            }

            const [previousSnapshot] = await tx
                .select()
                .from(schema.sharedRoutineSnapshots)
                .where(
                    and(
                        eq(schema.sharedRoutineSnapshots.sharedRoutineId, id),
                        eq(schema.sharedRoutineSnapshots.revision, workspace.currentRevision),
                        isNull(schema.sharedRoutineSnapshots.deletedAt),
                    ),
                )
                .limit(1);

            nextRevision = workspace.currentRevision + 1;

            await tx.insert(schema.sharedRoutineSnapshots).values({
                id: snapshotId,
                sharedRoutineId: id,
                revision: nextRevision,
                payload: parsed.data.payload,
                createdBy: userId,
                createdAt: now,
                updatedAt: now,
            });

            await tx.update(schema.sharedRoutines).set({
                currentSnapshotId: snapshotId,
                currentRevision: nextRevision,
                sourceRoutineId: parsed.data.sourceRoutineId ?? workspace.sourceRoutineId,
                updatedAt: now,
            }).where(eq(schema.sharedRoutines.id, id));

            await tx.insert(schema.sharedRoutineChanges).values({
                id: crypto.randomUUID(),
                sharedRoutineId: id,
                snapshotId,
                actorId: userId,
                actionType: parsed.data.force ? 'forced_member_sync' : 'member_sync',
                metadata: {
                    baseRevision: parsed.data.baseRevision,
                    serverRevisionBeforeWrite: workspace.currentRevision,
                    revision: nextRevision,
                    sourceRoutineId: parsed.data.sourceRoutineId ?? workspace.sourceRoutineId,
                    force: parsed.data.force,
                    entities: summarizeSharedRoutinePayload(parsed.data.payload as Record<string, unknown>),
                    entityDelta: previousSnapshot?.payload && typeof previousSnapshot.payload === 'object'
                        ? diffSharedRoutinePayload(
                            previousSnapshot.payload as Record<string, unknown>,
                            parsed.data.payload as Record<string, unknown>,
                        )
                        : null,
                },
                createdAt: now,
                updatedAt: now,
            });
        });

        recordEndpointMetric({
            endpoint: 'social.shared_routines.sync',
            outcome: 'success',
            statusCode: 200,
            event: reviewRequired ? 'review_requested' : 'published',
        });

        return NextResponse.json({
            success: true,
            sharedRoutineId: id,
            snapshotId: reviewRequired ? null : snapshotId,
            revision: reviewRequired ? null : nextRevision,
            forced: parsed.data.force,
            reviewRequired,
            reviewRequestId: reviewRequired ? reviewRequestId : null,
        });
    } catch (error) {
        if (error instanceof RevisionConflictError) {
            recordEndpointMetric({ endpoint: 'social.shared_routines.sync', outcome: 'conflict', statusCode: 409, event: 'revision_conflict' });
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
        if (message === 'Forbidden') {
            recordEndpointMetric({ endpoint: 'social.shared_routines.sync', outcome: 'error', statusCode: 403, event: 'forbidden' });
            return NextResponse.json({ error: message }, { status: 403 });
        }
        if (message === 'Shared routine not found') {
            recordEndpointMetric({ endpoint: 'social.shared_routines.sync', outcome: 'error', statusCode: 404, event: 'not_found' });
            return NextResponse.json({ error: message }, { status: 404 });
        }
        if (message === 'You do not have permission to update this shared routine') {
            recordEndpointMetric({ endpoint: 'social.shared_routines.sync', outcome: 'error', statusCode: 403, event: 'insufficient_permissions' });
            return NextResponse.json({ error: message }, { status: 403 });
        }

        recordEndpointMetric({ endpoint: 'social.shared_routines.sync', outcome: 'error', statusCode: 500, event: 'internal_error' });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
