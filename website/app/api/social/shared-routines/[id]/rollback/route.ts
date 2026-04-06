import { and, eq, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../../../src/db';
import * as schema from '../../../../../../src/db/schema';
import { verifyAuth } from '../../../../../../src/lib/auth';
import { recordEndpointMetric } from '../../../../../../src/lib/endpoint-metrics';
import { captureServerEvent } from '../../../../../../src/lib/posthog-server';
import { RATE_LIMITS } from '../../../../../../src/lib/rate-limit';
import { buildSharedRoutineForbiddenPayload, buildSharedRoutineNotFoundPayload, buildSharedRoutineRevisionConflictPayload } from '../../../../../../src/lib/shared-routine-http-errors';
import { lockSharedRoutineWorkspace } from '../../../../../../src/lib/shared-routine-lock';
import { checkSharedRoutineRevision } from '../../../../../../src/lib/shared-routine-sync-policy';

const rollbackSchema = z.object({
    targetRevision: z.number().int().positive(),
    baseRevision: z.number().int().positive().optional(),
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
            recordEndpointMetric({ endpoint: 'social.shared_routines.rollback', outcome: 'error', statusCode: 401, event: 'unauthorized' });
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rateLimit = await RATE_LIMITS.SOCIAL_SHARED_ROUTINES_WRITE(userId);
        if (!rateLimit.ok) {
            recordEndpointMetric({ endpoint: 'social.shared_routines.rollback', outcome: 'error', statusCode: 429, event: 'rate_limited' });
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }

        const { id } = await context.params;
        const body = await req.json().catch(() => null);
        const parsed = rollbackSchema.safeParse(body ?? {});
        if (!parsed.success) {
            recordEndpointMetric({ endpoint: 'social.shared_routines.rollback', outcome: 'error', statusCode: 400, event: 'invalid_body' });
            return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 });
        }

        const now = new Date();
        const rollbackSnapshotId = crypto.randomUUID();
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

            if (!membership || membership.role !== 'owner') {
                throw new Error('Only owner can rollback shared routine');
            }

            const baseRevision = parsed.data.baseRevision ?? workspace.currentRevision;
            const revisionCheck = checkSharedRoutineRevision({
                baseRevision,
                serverRevision: workspace.currentRevision,
                force: parsed.data.force,
            });

            if (!revisionCheck.ok) {
                throw new RevisionConflictError(revisionCheck.baseRevision, revisionCheck.serverRevision);
            }

            const [targetSnapshot] = await tx
                .select()
                .from(schema.sharedRoutineSnapshots)
                .where(
                    and(
                        eq(schema.sharedRoutineSnapshots.sharedRoutineId, id),
                        eq(schema.sharedRoutineSnapshots.revision, parsed.data.targetRevision),
                        isNull(schema.sharedRoutineSnapshots.deletedAt),
                    ),
                )
                .limit(1);

            if (!targetSnapshot) {
                throw new Error('Target revision not found');
            }

            nextRevision = workspace.currentRevision + 1;

            await tx.insert(schema.sharedRoutineSnapshots).values({
                id: rollbackSnapshotId,
                sharedRoutineId: id,
                revision: nextRevision,
                payload: targetSnapshot.payload,
                createdBy: userId,
                createdAt: now,
                updatedAt: now,
            });

            await tx.update(schema.sharedRoutines).set({
                currentSnapshotId: rollbackSnapshotId,
                currentRevision: nextRevision,
                updatedAt: now,
            }).where(eq(schema.sharedRoutines.id, id));

            await tx.insert(schema.sharedRoutineChanges).values({
                id: crypto.randomUUID(),
                sharedRoutineId: id,
                snapshotId: rollbackSnapshotId,
                actorId: userId,
                actionType: 'rollback',
                metadata: {
                    fromRevision: workspace.currentRevision,
                    targetRevision: parsed.data.targetRevision,
                    revision: nextRevision,
                    force: parsed.data.force,
                },
                createdAt: now,
                updatedAt: now,
            });
        });

        recordEndpointMetric({ endpoint: 'social.shared_routines.rollback', outcome: 'success', statusCode: 200, event: 'rollback_applied' });
        void captureServerEvent(userId, 'workspace_rollback_executed', {
            sharedRoutineId: id,
            targetRevision: parsed.data.targetRevision,
            resultingRevision: nextRevision,
            forced: parsed.data.force,
        });

        return NextResponse.json({
            success: true,
            sharedRoutineId: id,
            revision: nextRevision,
            targetRevision: parsed.data.targetRevision,
            snapshotId: rollbackSnapshotId,
            forced: parsed.data.force,
        });
    } catch (error) {
        if (error instanceof RevisionConflictError) {
            recordEndpointMetric({ endpoint: 'social.shared_routines.rollback', outcome: 'conflict', statusCode: 409, event: 'revision_conflict' });
            return NextResponse.json(
                buildSharedRoutineRevisionConflictPayload(error.baseRevision, error.serverRevision, error.message),
                { status: 409 },
            );
        }

        const message = error instanceof Error ? error.message : 'Internal server error';
        if (message === 'Shared routine not found') {
            recordEndpointMetric({ endpoint: 'social.shared_routines.rollback', outcome: 'error', statusCode: 404, event: 'not_found' });
            return NextResponse.json(buildSharedRoutineNotFoundPayload('workspace', message), { status: 404 });
        }
        if (message === 'Only owner can rollback shared routine') {
            recordEndpointMetric({ endpoint: 'social.shared_routines.rollback', outcome: 'error', statusCode: 403, event: 'forbidden' });
            return NextResponse.json(buildSharedRoutineForbiddenPayload(message), { status: 403 });
        }
        if (message === 'Target revision not found') {
            recordEndpointMetric({ endpoint: 'social.shared_routines.rollback', outcome: 'error', statusCode: 404, event: 'target_not_found' });
            return NextResponse.json(buildSharedRoutineNotFoundPayload('target_revision', message), { status: 404 });
        }

        recordEndpointMetric({ endpoint: 'social.shared_routines.rollback', outcome: 'error', statusCode: 500, event: 'internal_error' });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
