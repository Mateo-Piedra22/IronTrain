import { and, eq, getTableColumns, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';
import { recordEndpointMetric } from '../../../../src/lib/endpoint-metrics';
import { logger } from '../../../../src/lib/logger';
import { RATE_LIMITS } from '../../../../src/lib/rate-limit';
import { applyWorkoutScoring, revertWorkoutScoring } from '../../../../src/lib/social-scoring';
import { collectIncomingRecordIdsByTable, shouldDeferWorkoutSetUpsert, type PushOperation } from '../../../../src/lib/sync-push-defer';
import { isClientSyncReadOnlyTable } from '../../../../src/lib/sync/sync-write-policy';
import { SyncMapper } from '../../../../src/lib/sync/SyncMapper';

export const runtime = 'nodejs';

const MAX_OPERATIONS_PER_REQUEST = 500;
const SUPPORTED_OPERATIONS = new Set(['INSERT', 'UPDATE', 'DELETE']);

const syncPushOperationSchema = z.object({
    id: z.string().min(1).max(128).optional(),
    table: z.string().min(1).max(64),
    operation: z.string().min(1).max(16),
    recordId: z.string().min(1).max(256).optional(),
    payload: z.unknown().optional(),
});

const syncPushPayloadSchema = z.object({
    operations: z.array(syncPushOperationSchema).max(MAX_OPERATIONS_PER_REQUEST),
});

type IncomingPushOperation = z.infer<typeof syncPushOperationSchema>;

type ExistingSyncRow = {
    userId?: string;
    giverId?: string;
    id?: string;
    isSystem?: number | null;
    is_system?: number | null;
    updatedAt?: Date | null;
    deletedAt?: Date | null;
    status?: string;
};

/**
 * AsyncMutex to prevent race conditions during concurrent syncs for the same user
 */
const userMutexes = new Map<string, Promise<void>>();

async function acquireMutex(userId: string): Promise<() => void> {
    while (userMutexes.has(userId)) {
        await userMutexes.get(userId)!;
    }
    let resolveFunc: (() => void) | null = null;
    const waitPromise = new Promise<void>((resolve) => { resolveFunc = resolve; });
    userMutexes.set(userId, waitPromise);
    return () => { if (resolveFunc) resolveFunc(); userMutexes.delete(userId); };
}

export async function POST(req: NextRequest) {
    const userId = await verifyAuth(req).catch(() => null);
    if (!userId) {
        recordEndpointMetric({ endpoint: 'sync.push', outcome: 'error', statusCode: 401, event: 'unauthorized' });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const releaseMutex = await acquireMutex(userId);
    
    try {
        const rateLimit = await RATE_LIMITS.SYNC_PUSH(userId);
        if (!rateLimit.ok) {
            recordEndpointMetric({ endpoint: 'sync.push', outcome: 'error', statusCode: 429, event: 'rate_limited' });
            return NextResponse.json(
                { error: 'Too many sync requests. Please try again later.' },
                { 
                    status: 429,
                    headers: { 
                        'Retry-After': String(Math.ceil((rateLimit.resetAtMs - Date.now()) / 1000)),
                        'X-RateLimit-Remaining': String(rateLimit.remaining),
                    }
                }
            );
        }

        const body = await req.json().catch(() => null);
        const parsed = syncPushPayloadSchema.safeParse(body);

        if (!parsed.success) {
            recordEndpointMetric({ endpoint: 'sync.push', outcome: 'error', statusCode: 400, event: 'invalid_body' });
            return NextResponse.json({
                error: 'Invalid payload: operations must be a valid array',
                details: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), code: issue.code })),
            }, { status: 400 });
        }

        const operations = parsed.data.operations;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tableMap: Record<string, any> = {
            'categories': schema.categories,
            'badges': schema.badges,
            'exercise_badges': schema.exerciseBadges,
            'exercises': schema.exercises,
            'workouts': schema.workouts,
            'workout_sets': schema.workoutSets,
            'routines': schema.routines,
            'routine_days': schema.routineDays,
            'routine_exercises': schema.routineExercises,
            'measurements': schema.measurements,
            'goals': schema.goals,
            'body_metrics': schema.bodyMetrics,
            'plate_inventory': schema.plateInventory,
            'settings': schema.settings,
            'user_profiles': schema.userProfiles,
            'kudos': schema.kudos,
            'activity_feed': schema.activityFeed,
            'shares_inbox': schema.sharesInbox,
            'score_events': schema.scoreEvents,
            'user_exercise_prs': schema.userExercisePrs,
            'friendships': schema.friendships,
            'weather_logs': schema.weatherLogs,
            'notification_reactions': schema.notificationReactions,
            'activity_seen': schema.activitySeen,
            'changelogs': schema.changelogs,
            'changelog_reactions': schema.changelogReactions,
        };

        let netPointsChange = 0; 

        // Initial dependency check
        const normalizedIncomingOps: PushOperation[] = operations
            .map((op): PushOperation | null => {
                const normalizedOperation = op.operation.toUpperCase();
                if (!SUPPORTED_OPERATIONS.has(normalizedOperation)) return null;

                return {
                    id: op.id ?? crypto.randomUUID(),
                    table: op.table,
                    operation: normalizedOperation as PushOperation['operation'],
                    recordId: op.recordId,
                    payload: op.payload,
                };
            })
            .filter((op): op is PushOperation => op !== null);

        const incomingIdsByTable = collectIncomingRecordIdsByTable(normalizedIncomingOps);
        const incomingWorkouts = incomingIdsByTable.get('workouts') ?? new Set<string>();
        const deferredOps: IncomingPushOperation[] = [];

        // Efficient single transaction for the entire batch
        const finalResults = await db.transaction(async (tx) => {
            const processOp = async (op: IncomingPushOperation) => {
                const opId = op.id || crypto.randomUUID();
                const tableName = op.table;
                const operation = op.operation?.toUpperCase();
                const rawPayload = (op.payload && typeof op.payload === 'object')
                    ? (op.payload as Record<string, unknown>)
                    : {};

                if (isClientSyncReadOnlyTable(tableName)) {
                    logger.warnSampled('[Sync/Push] Read-only table mutation ignored', {
                        sampleRate: 0.1,
                        sampleKey: `${userId}:${tableName}:${operation}`,
                        context: {
                            userId,
                            tableName,
                            operation,
                            opId,
                        },
                    });
                    recordEndpointMetric({ endpoint: 'sync.push', outcome: 'ignored', statusCode: 200, event: 'read_only_table' });
                    return { id: opId, status: 'ignored', reason: 'read_only_table' };
                }

                if (!tableMap[tableName] || !SUPPORTED_OPERATIONS.has(operation)) {
                    return { id: opId, status: 'ignored', reason: 'unsupported_table_or_op' };
                }

                const tableSchema = tableMap[tableName];
                const columnsMap = getTableColumns(tableSchema);

                try {
                    if (operation === 'INSERT' || operation === 'UPDATE') {
                        const filteredData = SyncMapper.mapObject(rawPayload, tableName, 'TO_DRIZZLE');
                        
                        // Scoping & Ownership logic
                        if (tableName === 'user_profiles') filteredData.id = userId;
                        else if (tableName === 'settings') {
                            const rawKey = (filteredData.key || '').toString();
                            if (rawKey && !rawKey.startsWith(`${userId}:`)) filteredData.key = `${userId}:${rawKey}`;
                            filteredData.userId = userId;
                        } else if (tableName === 'kudos') filteredData.giverId = userId;
                        else if (tableName === 'activity_feed') filteredData.userId = userId;
                        else if (tableName === 'friendships') {
                            if (filteredData.userId !== userId && filteredData.friendId !== userId) throw new Error('Forbidden friendship access');
                        } else if (columnsMap.userId) filteredData.userId = userId;

                        // Zero Trust System field blocking
                        const sysKey = columnsMap.isSystem ? 'isSystem' : (columnsMap.is_system ? 'is_system' : null);
                        if (sysKey) filteredData[sysKey] = 0;

                        const pkPropName = tableName === 'settings' ? 'key' : 'id';
                        const pkRaw = filteredData[pkPropName] ?? op.recordId;
                        let pkValue = typeof pkRaw === 'string' && pkRaw.length > 0 ? pkRaw : undefined;

                        if (!pkValue && tableName === 'changelog_reactions') {
                            const changelogId = typeof filteredData.changelogId === 'string' ? filteredData.changelogId : '';
                            if (changelogId) pkValue = `${changelogId}_${userId}`;
                        }
                        if (!pkValue && tableName === 'kudos') {
                            const feedId = typeof filteredData.feedId === 'string' ? filteredData.feedId : '';
                            if (feedId) pkValue = `${feedId}_${userId}`;
                        }
                        
                        if (!pkValue) throw new Error(`Missing primary key for ${tableName}`);
                        filteredData[pkPropName] = pkValue;

                        const pkCol = tableName === 'settings' ? tableSchema.key : tableSchema.id;

                        // Special case: Workout Sets check
                        if (tableName === 'workout_sets') {
                            const wId = typeof filteredData.workoutId === 'string' ? filteredData.workoutId : '';
                            if (!wId) throw new Error('Missing workoutId');
                            const parentExists = (await tx.select({ id: schema.workouts.id }).from(schema.workouts).where(and(eq(schema.workouts.id, wId), eq(schema.workouts.userId, userId))).limit(1)).length > 0;
                            
                            if (!parentExists && shouldDeferWorkoutSetUpsert({ workoutId: wId, parentExistsInDb: false, incomingWorkouts })) {
                                deferredOps.push(op);
                                return null; // Process later
                            }
                        }

                        // Atomic Check & Upsert
                        const existing = (await tx.select().from(tableSchema).where(eq(pkCol, pkValue)).limit(1))[0] as ExistingSyncRow | undefined;
                        if (existing) {
                            // Ownership re-verify
                            const ownerId = existing.userId || existing.giverId || (tableName === 'user_profiles' ? existing.id : undefined);
                            if (ownerId && ownerId !== userId && !['friendships', 'kudos', 'shares_inbox'].includes(tableName)) {
                                if (!(existing.isSystem === 1 || existing.is_system === 1)) throw new Error('Ownership mismatch');
                            }

                            // TS conflict resolution
                            const remoteTs = (filteredData.updatedAt instanceof Date ? filteredData.updatedAt.getTime() : 0);
                            const localTs = (existing.updatedAt instanceof Date ? existing.updatedAt.getTime() : 0);
                            if (remoteTs > 0 && localTs >= remoteTs) return { id: opId, status: 'skipped_stale' };
                        }

                        // Upsert with ON CONFLICT
                        await tx.insert(tableSchema).values({ ...existing, ...filteredData }).onConflictDoUpdate({ target: pkCol, set: filteredData });

                        // Triggers & Scoring
                        if (tableName === 'workouts') {
                            const wasComp = existing?.status === 'completed' && !existing.deletedAt;
                            const isComp = filteredData.status === 'completed' && !filteredData.deletedAt;
                            if (isComp && !wasComp) {
                                const { totalAwarded } = await applyWorkoutScoring(tx, userId, pkValue);
                                netPointsChange += totalAwarded;
                            }
                            else if (!isComp && wasComp) {
                                const { totalReverted } = await revertWorkoutScoring(tx, userId, pkValue);
                                netPointsChange -= totalReverted;
                            }
                        }

                        return { id: opId, status: 'success' };

                    } else if (operation === 'DELETE') {
                        const pkCol = tableName === 'settings' ? tableSchema.key : tableSchema.id;
                        const payloadRecordId = typeof rawPayload === 'object' && rawPayload !== null && 'id' in rawPayload
                            ? (rawPayload as { id?: unknown }).id
                            : undefined;
                        const recordId = op.recordId || (typeof payloadRecordId === 'string' ? payloadRecordId : undefined);
                        if (!recordId) throw new Error('Missing recordId');
                        const finalId = (tableName === 'settings' && !recordId.startsWith(`${userId}:`)) ? `${userId}:${recordId}` : recordId;

                        const existing = (await tx.select().from(tableSchema).where(eq(pkCol, finalId)).limit(1))[0] as ExistingSyncRow | undefined;
                        if (existing) {
                            const ownerId = existing.userId || existing.giverId || (tableName === 'user_profiles' ? existing.id : undefined);
                            if (ownerId === userId || tableName === 'friendships' || tableName === 'shares_inbox') {
                                if (!existing.deletedAt) {
                                    await tx.update(tableSchema).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(pkCol, finalId));
                                    if (tableName === 'workouts') await revertWorkoutScoring(tx, userId, finalId);
                                }
                            }
                        }
                        return { id: opId, status: 'success' };
                    }
                } catch (e: unknown) {
                    const reason = e instanceof Error ? e.message : 'unknown_error';
                    return { id: opId, status: 'error', reason };
                }
                return { id: opId, status: 'ignored' };
            };

            const results: Array<{ id: string; status: string; reason?: string }> = [];
            for (const op of operations) {
                const res = await processOp(op);
                if (res) results.push(res);
            }

            // Process deferred
            if (deferredOps.length > 0) {
                for (const op of deferredOps) {
                    const res = await processOp(op);
                    if (res) results.push(res);
                }
            }

            // Batch update user score incrementally if needed
            if (netPointsChange !== 0) {
                await tx.update(schema.userProfiles)
                    .set({
                        scoreLifetime: sql`GREATEST(0, ${schema.userProfiles.scoreLifetime} + ${netPointsChange})`,
                        updatedAt: new Date(),
                    })
                    .where(eq(schema.userProfiles.id, userId));
            }

            return results;
        });

        const summary = finalResults.reduce((acc, item) => {
            const key = item.status || 'unknown';
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        if ((summary.error ?? 0) > 0) {
            recordEndpointMetric({ endpoint: 'sync.push', outcome: 'error', statusCode: 200, event: 'batch_contains_errors' });
        }
        if ((summary.ignored ?? 0) > 0) {
            recordEndpointMetric({ endpoint: 'sync.push', outcome: 'ignored', statusCode: 200, event: 'batch_contains_ignored' });
        }
        if ((summary.success ?? 0) > 0) {
            recordEndpointMetric({ endpoint: 'sync.push', outcome: 'success', statusCode: 200, event: 'batch_success' });
        }

        return NextResponse.json({ success: true, processed: finalResults.length, results: finalResults });

    } catch (error: unknown) {
        logger.captureException(error, { scope: 'api.sync.push' });
        recordEndpointMetric({ endpoint: 'sync.push', outcome: 'error', statusCode: 500, event: 'internal_error' });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    } finally {
        releaseMutex();
    }
}
