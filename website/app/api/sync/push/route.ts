import { eq, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';
import { runDbTransaction } from '../../../../src/lib/db-transaction';
import { applyWorkoutScoring } from '../../../../src/lib/social-scoring';

export const runtime = 'nodejs';

// Convert snake_case from SQLite payload to camelCase for Drizzle
const toCamelCase = (snakeObj: any) => {
    if (!snakeObj || typeof snakeObj !== 'object') return snakeObj;
    const camelObj: any = {};
    for (const [key, value] of Object.entries(snakeObj)) {
        const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
        camelObj[camelKey] = value;
    }
    return camelObj;
};

const MAX_OPERATIONS_PER_REQUEST = 500;
const SUPPORTED_OPERATIONS = new Set(['INSERT', 'UPDATE', 'DELETE']);
const SOFT_DELETE_TABLES = new Set([
    'categories',
    'exercises',
    'workouts',
    'workout_sets',
    'routines',
    'routine_days',
    'routine_exercises',
    'measurements',
    'goals',
    'body_metrics',
    'badges',
    'exercise_badges',
    'changelog_reactions',
    'kudos',
    'activity_feed',
    'score_events',
    'user_exercise_prs',
]);

const scopeSettingsKey = (userId: string, key: string): string => {
    const trimmed = key.trim();
    if (trimmed.startsWith(`${userId}:`)) return trimmed;
    return `${userId}:${trimmed}`;
};

const getOwnerIdForRecord = (tableName: string, record: Record<string, unknown>): string | null => {
    if (tableName === 'user_profiles') return typeof record.id === 'string' ? record.id : null;
    if (tableName === 'kudos') return typeof record.giverId === 'string' ? record.giverId : null;
    if (tableName === 'changelog_reactions') return typeof record.userId === 'string' ? record.userId : null;
    if (tableName === 'settings') return typeof record.userId === 'string' ? record.userId : null;
    return typeof record.userId === 'string' ? record.userId : null;
};

// Main POST handler
export async function POST(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let body: any;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const operations = body?.operations;
        if (!Array.isArray(operations)) {
            return NextResponse.json({ error: 'Invalid payload: operations must be an array' }, { status: 400 });
        }
        if (operations.length > MAX_OPERATIONS_PER_REQUEST) {
            return NextResponse.json({ error: `Too many operations (max ${MAX_OPERATIONS_PER_REQUEST})` }, { status: 413 });
        }

        const tableMap: Record<string, any> = {
            'categories': schema.categories,
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
            'badges': schema.badges,
            'exercise_badges': schema.exerciseBadges,
            'user_profiles': schema.userProfiles,
            'changelog_reactions': schema.changelogReactions,
            'kudos': schema.kudos,
            'activity_feed': schema.activityFeed,
            'score_events': schema.scoreEvents,
            'user_exercise_prs': schema.userExercisePrs,
        };

        const processedIds: string[] = [];
        const results: any[] = [];

        await runDbTransaction(async (trx) => {
            for (const op of operations) {
                const tableName = typeof op?.table === 'string' ? op.table : '';
                const operation = typeof op?.operation === 'string' ? op.operation.toUpperCase() : '';
                const rawPayload = op?.payload;
                const opId = typeof op?.id === 'string' && op.id.length > 0 ? op.id : crypto.randomUUID();
                const tableSchema = tableMap[tableName];

                if (!SUPPORTED_OPERATIONS.has(operation)) {
                    results.push({ id: opId, status: 'error', reason: 'invalid_operation' });
                    continue;
                }
                if (!tableSchema) {
                    results.push({ id: opId, status: 'ignored_unsupported_table' });
                    continue;
                }
                if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
                    results.push({ id: opId, status: 'error', reason: 'invalid_payload' });
                    continue;
                }

                const payload = toCamelCase(rawPayload);
                if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
                    results.push({ id: opId, status: 'error', reason: 'invalid_payload' });
                    continue;
                }

                // Strip sensitive fields
                delete (payload as any).isModerated;
                delete (payload as any).moderationMessage;

                // Robust filtering: Only keep keys that exist in the Drizzle table schema
                const validKeys = new Set(Object.keys(tableSchema));
                for (const key of Object.keys(payload)) {
                    if (!validKeys.has(key)) {
                        delete (payload as any)[key];
                        continue;
                    }

                    // Safety check: Postgres bigint columns must receive BigInt in JS to avoid driver integer overflow.
                    // We check both the metadata and known overflow-prone columns.
                    const columnMetadata = (tableSchema as any)[key];
                    const isBigIntColumn =
                        columnMetadata?.columnType === 'PgBigInt53' ||
                        columnMetadata?.dataType === 'bigint' ||
                        (tableName === 'workouts' && ['date', 'startTime', 'endTime', 'duration'].includes(key)) ||
                        (tableName === 'workout_sets' && ['time', 'orderIndex'].includes(key));

                    if (isBigIntColumn) {
                        const val = (payload as any)[key];
                        if (val !== null && val !== undefined) {
                            if (typeof val === 'string' || typeof val === 'number') {
                                (payload as any)[key] = BigInt(Math.floor(Number(val)));
                            }
                        }
                    }
                }

                try {
                    await trx.transaction(async (innerTrx: any) => {
                        // Normalize updatedAt
                        const candidateUpdatedAt = payload.updatedAt ? new Date(payload.updatedAt as any) : new Date();
                        const updatedAt = Number.isNaN(candidateUpdatedAt.getTime()) ? new Date() : candidateUpdatedAt;
                        const shouldEvaluateWorkoutScore = tableName === 'workouts' && operation !== 'DELETE' && payload.status === 'completed' && typeof (payload.id || payload.key) === 'string';

                        const pkCol = tableName === 'settings' ? tableSchema.key : tableSchema.id;
                        if (tableName === 'user_profiles') {
                            payload.id = userId;
                        }
                        if (tableName === 'settings') {
                            const rawKey = typeof payload.key === 'string' ? payload.key : '';
                            if (!rawKey.trim()) {
                                results.push({ id: opId, status: 'error', reason: 'invalid_settings_key' });
                                return;
                            }
                            payload.key = scopeSettingsKey(userId, rawKey);
                            payload.userId = userId;
                        }
                        const recordId = payload.id || payload.key;
                        if ((operation === 'UPDATE' || operation === 'DELETE') && (typeof recordId !== 'string' || recordId.length === 0)) {
                            results.push({ id: opId, status: 'error', reason: 'missing_record_id' });
                            return;
                        }

                        let existingRecord;
                        if (recordId) {
                            const queryKey = tableName.replace(/_([a-z])/g, (g: string) => g[1].toUpperCase());
                            if (innerTrx.query && (innerTrx.query as any)[queryKey]) {
                                existingRecord = await (innerTrx.query as any)[queryKey].findFirst({ where: eq(pkCol, recordId) });
                            } else {
                                const selectRes = await innerTrx.select().from(tableSchema).where(eq(pkCol, recordId)).limit(1);
                                existingRecord = selectRes[0];
                            }
                        }

                        if (existingRecord) {
                            const ownerId = getOwnerIdForRecord(tableName, existingRecord as Record<string, unknown>);
                            if (ownerId && ownerId !== userId) {
                                results.push({ id: opId, status: 'error', reason: 'forbidden_owner_mismatch' });
                                return;
                            }

                            const existingUpdatedAtValue = (existingRecord as any)?.updatedAt;
                            const existingUpdatedAtMs = existingUpdatedAtValue instanceof Date ? existingUpdatedAtValue.getTime() : Number(existingUpdatedAtValue);
                            const incomingUpdatedAtMs = updatedAt.getTime();
                            const hasComparableTimestamps = Number.isFinite(existingUpdatedAtMs) && Number.isFinite(incomingUpdatedAtMs);
                            if (hasComparableTimestamps && incomingUpdatedAtMs < existingUpdatedAtMs) {
                                results.push({ id: opId, status: 'ignored_stale' });
                                return;
                            }

                            if (operation === 'DELETE') {
                                if (SOFT_DELETE_TABLES.has(tableName)) {
                                    await innerTrx.update(tableSchema).set({ deletedAt: new Date(), updatedAt }).where(eq(pkCol, recordId));
                                } else {
                                    await innerTrx.delete(tableSchema).where(eq(pkCol, recordId));
                                }

                                if (tableName === 'kudos' && (existingRecord as any).deletedAt == null) {
                                    await innerTrx.update(schema.activityFeed).set({ kudoCount: sql`${schema.activityFeed.kudoCount} - 1`, updatedAt: new Date() }).where(eq(schema.activityFeed.id, existingRecord.feedId));
                                } else if (tableName === 'changelog_reactions' && (existingRecord as any).deletedAt == null) {
                                    await innerTrx.update(schema.changelogs).set({ reactionCount: sql`${schema.changelogs.reactionCount} - 1`, updatedAt: new Date() }).where(eq(schema.changelogs.id, existingRecord.changelogId));
                                }
                            } else {
                                const updatePayload: Record<string, unknown> = { ...payload, updatedAt };
                                if (SOFT_DELETE_TABLES.has(tableName)) {
                                    updatePayload.deletedAt = null;
                                }
                                await innerTrx.update(tableSchema).set(updatePayload as any).where(eq(pkCol, recordId));

                                if ((existingRecord as any).deletedAt && !payload.deletedAt) {
                                    if (tableName === 'kudos') {
                                        await innerTrx.update(schema.activityFeed).set({ kudoCount: sql`${schema.activityFeed.kudoCount} + 1`, updatedAt: new Date() }).where(eq(schema.activityFeed.id, existingRecord.feedId));
                                    } else if (tableName === 'changelog_reactions') {
                                        await innerTrx.update(schema.changelogs).set({ reactionCount: sql`${schema.changelogs.reactionCount} + 1`, updatedAt: new Date() }).where(eq(schema.changelogs.id, existingRecord.changelogId));
                                    }
                                }
                            }
                        } else {
                            if (operation !== 'DELETE') {
                                if (tableName === 'user_profiles') payload.id = userId;
                                else if (tableName === 'kudos') payload.giverId = userId;
                                else if (tableName === 'changelog_reactions') payload.userId = userId;
                                else if (tableName === 'settings') payload.userId = userId;
                                else payload.userId = userId;

                                await innerTrx.insert(tableSchema).values({ ...payload, updatedAt });

                                if (tableName === 'kudos') {
                                    await innerTrx.update(schema.activityFeed).set({ kudoCount: sql`${schema.activityFeed.kudoCount} + 1`, updatedAt: new Date() }).where(eq(schema.activityFeed.id, payload.feedId));
                                } else if (tableName === 'changelog_reactions') {
                                    await innerTrx.update(schema.changelogs).set({ reactionCount: sql`${schema.changelogs.reactionCount} + 1`, updatedAt: new Date() }).where(eq(schema.changelogs.id, payload.changelogId));
                                }
                            }
                        }

                        const statusTransitionedToCompleted =
                            tableName === 'workouts' &&
                            operation !== 'DELETE' &&
                            payload.status === 'completed' &&
                            (!existingRecord || (existingRecord as any)?.status !== 'completed');

                        if (shouldEvaluateWorkoutScore && statusTransitionedToCompleted) {
                            try {
                                await applyWorkoutScoring(innerTrx, userId, payload.id || payload.key);
                            } catch (scoringError: any) {
                                console.warn(`[Sync] Social scoring failed for workout=${payload.id || payload.key}, error: ${scoringError.message}`);
                            }
                        }
                        processedIds.push(opId);
                        results.push({ id: opId, status: 'success' });
                    });
                } catch (err: any) {
                    console.error(`[Push] Error processing ${tableName}:${opId}:`, err);
                    results.push({ id: opId, status: 'error', reason: err.message });
                }
            }
        });

        return NextResponse.json({ success: true, processed: processedIds.length, results });

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown fatal error';
        const stack = error instanceof Error ? error.stack : undefined;
        console.error('Fatal Sync Push Error:', message, stack);
        return NextResponse.json({
            error: 'Internal server error',
            message: message,
            stack: process.env.NODE_ENV === 'development' ? stack : undefined
        }, { status: 500 });
    }
}
