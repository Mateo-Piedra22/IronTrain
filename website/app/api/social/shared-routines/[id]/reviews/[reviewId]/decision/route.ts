import { and, eq, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../../../../../src/db';
import * as schema from '../../../../../../../../src/db/schema';
import { verifyAuth } from '../../../../../../../../src/lib/auth';
import { recordEndpointMetric } from '../../../../../../../../src/lib/endpoint-metrics';
import { captureServerEvent } from '../../../../../../../../src/lib/posthog-server';
import { RATE_LIMITS } from '../../../../../../../../src/lib/rate-limit';
import { buildSharedRoutineForbiddenPayload, buildSharedRoutineInvalidStatePayload, buildSharedRoutineNotFoundPayload, buildSharedRoutineRevisionConflictPayload } from '../../../../../../../../src/lib/shared-routine-http-errors';
import { lockSharedRoutineWorkspace } from '../../../../../../../../src/lib/shared-routine-lock';
import { checkSharedRoutineRevision } from '../../../../../../../../src/lib/shared-routine-sync-policy';

const decisionSchema = z.object({
    decision: z.enum(['approve', 'reject']),
    note: z.string().trim().max(500).optional(),
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

class InvalidStateError extends Error {
    resource: 'review_request';
    expectedStatus: string;
    currentStatus: string;

    constructor(resource: 'review_request', expectedStatus: string, currentStatus: string, message: string) {
        super(message);
        this.name = 'InvalidStateError';
        this.resource = resource;
        this.expectedStatus = expectedStatus;
        this.currentStatus = currentStatus;
    }
}

class IdempotentDecisionError extends Error {
    decision: 'approve' | 'reject';
    reviewId: string;
    revision: number | null;
    snapshotId: string | null;

    constructor(
        decision: 'approve' | 'reject',
        reviewId: string,
        revision: number | null,
        snapshotId: string | null,
    ) {
        super('Review decision already applied');
        this.name = 'IdempotentDecisionError';
        this.decision = decision;
        this.reviewId = reviewId;
        this.revision = revision;
        this.snapshotId = snapshotId;
    }
}

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string; reviewId: string }> },
) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) {
            recordEndpointMetric({ endpoint: 'social.shared_routines.review_decision', outcome: 'error', statusCode: 401, event: 'unauthorized' });
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rateLimit = await RATE_LIMITS.SOCIAL_SHARED_ROUTINES_WRITE(userId);
        if (!rateLimit.ok) {
            recordEndpointMetric({ endpoint: 'social.shared_routines.review_decision', outcome: 'error', statusCode: 429, event: 'rate_limited' });
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }

        const { id, reviewId } = await context.params;
        const body = await req.json().catch(() => null);
        const parsed = decisionSchema.safeParse(body ?? {});
        if (!parsed.success) {
            recordEndpointMetric({ endpoint: 'social.shared_routines.review_decision', outcome: 'error', statusCode: 400, event: 'invalid_body' });
            return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 });
        }

        const now = new Date();
        const snapshotId = crypto.randomUUID();
        let nextRevision = 0;

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

            if (!workspace) throw new Error('Shared routine not found');
            if (workspace.ownerId !== userId) throw new Error('Only owner can decide reviews');

            const [review] = await tx
                .select()
                .from(schema.sharedRoutineReviewRequests)
                .where(
                    and(
                        eq(schema.sharedRoutineReviewRequests.id, reviewId),
                        eq(schema.sharedRoutineReviewRequests.sharedRoutineId, id),
                        isNull(schema.sharedRoutineReviewRequests.deletedAt),
                    ),
                )
                .limit(1);

            if (!review) throw new Error('Review request not found');
            if (review.status !== 'pending') {
                const requestedStatus = parsed.data.decision === 'approve' ? 'approved' : 'rejected';
                if (review.status === requestedStatus) {
                    throw new IdempotentDecisionError(
                        parsed.data.decision,
                        reviewId,
                        workspace.currentRevision ?? null,
                        workspace.currentSnapshotId ?? null,
                    );
                }

                throw new InvalidStateError('review_request', 'pending', String(review.status), 'Review request is not pending');
            }

            const revisionCheck = checkSharedRoutineRevision({
                baseRevision: review.requestedBaseRevision,
                serverRevision: workspace.currentRevision,
                force: parsed.data.force,
            });

            if (!revisionCheck.ok && parsed.data.decision === 'approve') {
                throw new RevisionConflictError(revisionCheck.baseRevision, revisionCheck.serverRevision);
            }

            if (parsed.data.decision === 'approve') {
                nextRevision = workspace.currentRevision + 1;

                await tx.insert(schema.sharedRoutineSnapshots).values({
                    id: snapshotId,
                    sharedRoutineId: id,
                    revision: nextRevision,
                    payload: review.candidatePayload,
                    createdBy: review.requesterId,
                    createdAt: now,
                    updatedAt: now,
                });

                await tx.update(schema.sharedRoutines).set({
                    currentSnapshotId: snapshotId,
                    currentRevision: nextRevision,
                    sourceRoutineId: review.sourceRoutineId ?? workspace.sourceRoutineId,
                    updatedAt: now,
                }).where(eq(schema.sharedRoutines.id, id));
            }

            await tx.update(schema.sharedRoutineReviewRequests)
                .set({
                    status: parsed.data.decision === 'approve' ? 'approved' : 'rejected',
                    decidedBy: userId,
                    decidedAt: now,
                    decisionNote: parsed.data.note,
                    updatedAt: now,
                })
                .where(eq(schema.sharedRoutineReviewRequests.id, reviewId));

            await tx.insert(schema.sharedRoutineChanges).values({
                id: crypto.randomUUID(),
                sharedRoutineId: id,
                snapshotId: parsed.data.decision === 'approve' ? snapshotId : null,
                actorId: userId,
                actionType: parsed.data.decision === 'approve' ? 'review_approved' : 'review_rejected',
                metadata: {
                    reviewRequestId: reviewId,
                    requesterId: review.requesterId,
                    requestedBaseRevision: review.requestedBaseRevision,
                    decision: parsed.data.decision,
                    note: parsed.data.note,
                    revision: parsed.data.decision === 'approve' ? nextRevision : workspace.currentRevision,
                    force: parsed.data.force,
                },
                createdAt: now,
                updatedAt: now,
            });
        });

        recordEndpointMetric({
            endpoint: 'social.shared_routines.review_decision',
            outcome: 'success',
            statusCode: 200,
            event: parsed.data.decision === 'approve' ? 'approved' : 'rejected',
        });

        void captureServerEvent(
            userId,
            parsed.data.decision === 'approve' ? 'workspace_review_approved' : 'workspace_review_rejected',
            {
                sharedRoutineId: id,
                reviewId,
                revision: parsed.data.decision === 'approve' ? nextRevision : null,
            },
        );

        return NextResponse.json({
            success: true,
            decision: parsed.data.decision,
            reviewId,
            revision: parsed.data.decision === 'approve' ? nextRevision : null,
            snapshotId: parsed.data.decision === 'approve' ? snapshotId : null,
        });
    } catch (error) {
        if (error instanceof RevisionConflictError) {
            recordEndpointMetric({ endpoint: 'social.shared_routines.review_decision', outcome: 'conflict', statusCode: 409, event: 'revision_conflict' });
            return NextResponse.json(
                buildSharedRoutineRevisionConflictPayload(error.baseRevision, error.serverRevision, error.message),
                { status: 409 },
            );
        }

        if (error instanceof InvalidStateError) {
            recordEndpointMetric({ endpoint: 'social.shared_routines.review_decision', outcome: 'conflict', statusCode: 409, event: 'review_not_pending' });
            return NextResponse.json(
                buildSharedRoutineInvalidStatePayload(error.resource, error.currentStatus, error.expectedStatus, error.message),
                { status: 409 },
            );
        }

        if (error instanceof IdempotentDecisionError) {
            recordEndpointMetric({ endpoint: 'social.shared_routines.review_decision', outcome: 'success', statusCode: 200, event: 'idempotent_replay' });
            return NextResponse.json({
                success: true,
                decision: error.decision,
                reviewId: error.reviewId,
                revision: error.revision,
                snapshotId: error.snapshotId,
                idempotent: true,
            });
        }

        const message = error instanceof Error ? error.message : 'Internal server error';
        if (message === 'Shared routine not found') {
            recordEndpointMetric({ endpoint: 'social.shared_routines.review_decision', outcome: 'error', statusCode: 404, event: 'workspace_not_found' });
            return NextResponse.json(buildSharedRoutineNotFoundPayload('workspace', message), { status: 404 });
        }
        if (message === 'Only owner can decide reviews') {
            recordEndpointMetric({ endpoint: 'social.shared_routines.review_decision', outcome: 'error', statusCode: 403, event: 'forbidden' });
            return NextResponse.json(buildSharedRoutineForbiddenPayload(message), { status: 403 });
        }
        if (message === 'Review request not found') {
            recordEndpointMetric({ endpoint: 'social.shared_routines.review_decision', outcome: 'error', statusCode: 404, event: 'review_not_found' });
            return NextResponse.json(buildSharedRoutineNotFoundPayload('review_request', message), { status: 404 });
        }
        recordEndpointMetric({ endpoint: 'social.shared_routines.review_decision', outcome: 'error', statusCode: 500, event: 'internal_error' });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
