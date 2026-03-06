import { eq, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';
import { applyWorkoutScoring } from '../../../../src/lib/social-scoring';

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
        };

        const processedIds: string[] = [];
        const results: any[] = [];

        await db.transaction(async (trx) => {
            for (const op of operations) {
                const { table: tableName, operation, payload: rawPayload, id: opId } = op;
                const tableSchema = tableMap[tableName];

                if (!tableSchema) {
                    results.push({ id: opId, status: 'ignored_unsupported_table' });
                    continue;
                }

                const payload = toCamelCase(rawPayload);

                // Strip sensitive fields
                delete (payload as any).isModerated;
                delete (payload as any).moderationMessage;

                try {
                    // Normalize updatedAt
                    const updatedAt = payload.updatedAt ? new Date(payload.updatedAt) : new Date();
                    const shouldEvaluateWorkoutScore = tableName === 'workouts' && operation !== 'DELETE' && payload.status === 'completed' && typeof (payload.id || payload.key) === 'string';

                    const pkCol = tableName === 'settings' ? tableSchema.key : tableSchema.id;
                    const recordId = payload.id || payload.key;

                    let existingRecord;
                    if (recordId) {
                        const queryKey = tableName.replace(/_([a-z])/g, (g: string) => g[1].toUpperCase());
                        existingRecord = await (trx.query as any)[queryKey].findFirst({ where: eq(pkCol, recordId) });
                    }

                    if (existingRecord) {
                        const existingUpdatedAtValue = (existingRecord as any)?.updatedAt;
                        const existingUpdatedAtMs = existingUpdatedAtValue instanceof Date ? existingUpdatedAtValue.getTime() : Number(existingUpdatedAtValue);
                        const incomingUpdatedAtMs = updatedAt.getTime();
                        const hasComparableTimestamps = Number.isFinite(existingUpdatedAtMs) && Number.isFinite(incomingUpdatedAtMs);
                        if (hasComparableTimestamps && incomingUpdatedAtMs < existingUpdatedAtMs) {
                            results.push({ id: opId, status: 'ignored_stale' });
                            continue;
                        }

                        // UPDATE or DELETE existing record
                        if (operation === 'DELETE') {
                            await trx.update(tableSchema).set({ deletedAt: new Date(), updatedAt }).where(eq(pkCol, recordId));

                            // Update counts
                            if (tableName === 'kudos' && !existingRecord.deletedAt) {
                                await trx.update(schema.activityFeed).set({ kudoCount: sql`${schema.activityFeed.kudoCount} - 1`, updatedAt: new Date() }).where(eq(schema.activityFeed.id, existingRecord.feedId));
                            } else if (tableName === 'changelog_reactions' && !existingRecord.deletedAt) {
                                await trx.update(schema.changelogs).set({ reactionCount: sql`${schema.changelogs.reactionCount} - 1`, updatedAt: new Date() }).where(eq(schema.changelogs.id, existingRecord.changelogId));
                            }
                        } else {
                            await trx.update(tableSchema).set({ ...payload, updatedAt, deletedAt: null }).where(eq(pkCol, recordId));

                            // If it was deleted and now it's not (undelete)
                            if (existingRecord.deletedAt && !payload.deletedAt) {
                                if (tableName === 'kudos') {
                                    await trx.update(schema.activityFeed).set({ kudoCount: sql`${schema.activityFeed.kudoCount} + 1`, updatedAt: new Date() }).where(eq(schema.activityFeed.id, existingRecord.feedId));
                                } else if (tableName === 'changelog_reactions') {
                                    await trx.update(schema.changelogs).set({ reactionCount: sql`${schema.changelogs.reactionCount} + 1`, updatedAt: new Date() }).where(eq(schema.changelogs.id, existingRecord.changelogId));
                                }
                            }
                        }
                    } else {
                        // INSERT
                        if (operation !== 'DELETE') {
                            // Ensure the record being inserted belongs to the user
                            if (tableName === 'user_profiles') payload.id = userId;
                            else if (tableName === 'kudos') payload.giverId = userId;
                            else if (tableName === 'changelog_reactions') payload.userId = userId;
                            else if (tableName === 'settings') payload.userId = userId;
                            else if (tableName !== 'changelogs') payload.userId = userId;

                            await trx.insert(tableSchema).values({ ...payload, updatedAt });

                            // Update counts
                            if (tableName === 'kudos') {
                                await trx.update(schema.activityFeed).set({ kudoCount: sql`${schema.activityFeed.kudoCount} + 1`, updatedAt: new Date() }).where(eq(schema.activityFeed.id, payload.feedId));
                            } else if (tableName === 'changelog_reactions') {
                                await trx.update(schema.changelogs).set({ reactionCount: sql`${schema.changelogs.reactionCount} + 1`, updatedAt: new Date() }).where(eq(schema.changelogs.id, payload.changelogId));
                            }
                        }
                    }

                    const statusTransitionedToCompleted =
                        tableName === 'workouts' &&
                        operation !== 'DELETE' &&
                        payload.status === 'completed' &&
                        (
                            !existingRecord ||
                            (existingRecord as any)?.status !== 'completed'
                        );

                    if (shouldEvaluateWorkoutScore && statusTransitionedToCompleted) {
                        await applyWorkoutScoring(trx, userId, payload.id || payload.key);
                    }
                    processedIds.push(opId);
                    results.push({ id: opId, status: 'success' });
                } catch (err: any) {
                    console.error(`[Push] Error processing ${tableName}:${opId}:`, err);
                    results.push({ id: opId, status: 'error', reason: err.message });
                }
            }
        });

        return NextResponse.json({ success: true, processed: processedIds.length, results });

    } catch (error: any) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        console.error('Fatal Sync Push Error:', message);
        return NextResponse.json({ error: 'Internal server error', message }, { status: 500 });
    }
}
