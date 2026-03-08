import { eq, getTableColumns, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';
import { applyWorkoutScoring } from '../../../../src/lib/social-scoring';

export const runtime = 'nodejs';

// Config
const MAX_OPERATIONS_PER_REQUEST = 500;
const SUPPORTED_OPERATIONS = new Set(['INSERT', 'UPDATE', 'DELETE']);

export async function POST(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let body;
        try {
            body = await req.json();
        } catch (e) {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const operations = body?.operations;

        if (!Array.isArray(operations)) {
            return NextResponse.json({ error: 'Invalid payload: operations must be an array' }, { status: 400 });
        }

        if (operations.length > MAX_OPERATIONS_PER_REQUEST) {
            return NextResponse.json({ error: 'Too many operations' }, { status: 413 });
        }

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
            'changelogs': schema.changelogs,
            'changelog_reactions': schema.changelogReactions,
            'kudos': schema.kudos,
            'activity_feed': schema.activityFeed,
            'score_events': schema.scoreEvents,
            'user_exercise_prs': schema.userExercisePrs,
            'friendships': schema.friendships,
        };

        const results = [];
        let processedCount = 0;

        // BigInt columns in DB (snake_case from app)
        const knownBigIntColumns = new Set(['date', 'start_time', 'end_time', 'duration', 'time', 'order_index']);

        for (const op of operations) {
            const opId = op.id || crypto.randomUUID();
            const tableName = op.table;
            const operation = op.operation?.toUpperCase();
            const rawPayload = op.payload || {};

            if (!tableMap[tableName] || !SUPPORTED_OPERATIONS.has(operation)) {
                results.push({ id: opId, status: 'ignored', reason: 'unsupported_table_or_op' });
                continue;
            }

            const tableSchema = tableMap[tableName];

            try {
                // Determine valid columns and map snake_case (app) -> camelCase (Drizzle)
                const columnsMap = getTableColumns(tableSchema);
                const dbToPropMap: Record<string, string> = {};
                for (const [propName, col] of Object.entries(columnsMap)) {
                    dbToPropMap[(col as any).name] = propName;
                }

                if (operation === 'INSERT' || operation === 'UPDATE') {
                    const filteredData: Record<string, any> = {};

                    for (const [key, value] of Object.entries(rawPayload as any)) {
                        const propName = dbToPropMap[key];
                        if (propName) {
                            let convertedValue = value;

                            // Timestamp mapping
                            if (key.endsWith('_at') && typeof value === 'number') {
                                convertedValue = new Date(value);
                            }
                            // BigInt handling for timestamps and metadata
                            else if (knownBigIntColumns.has(key) && (value !== null && value !== undefined)) {
                                convertedValue = BigInt(Math.floor(Number(value)));
                            }

                            filteredData[propName] = convertedValue;
                        }
                    }

                    // Security: Scoping & Ownership
                    if (tableName === 'user_profiles') {
                        filteredData.id = userId;
                    } else if (tableName === 'settings') {
                        const rawKey = (filteredData.key || '').toString();
                        if (rawKey && !rawKey.startsWith(`${userId}:`)) {
                            filteredData.key = `${userId}:${rawKey}`;
                        }
                        filteredData.userId = userId;
                    } else if (columnsMap.userId && tableName !== 'friendships') {
                        // For everything except friendships/shared tables, enforce own userId
                        filteredData.userId = userId;
                    } else if (tableName === 'friendships') {
                        // Enforce participant identity
                        if (filteredData.userId !== userId && filteredData.friendId !== userId) {
                            throw new Error('Forbidden friendship party');
                        }
                    }

                    const pkPropName = tableName === 'settings' ? 'key' : 'id';
                    let pkValue = filteredData[pkPropName];

                    if (!pkValue && op.recordId) {
                        pkValue = op.recordId;
                        filteredData[pkPropName] = pkValue;
                    }

                    const pkCol = tableName === 'settings' ? tableSchema.key : tableSchema.id;

                    if (!pkValue) {
                        throw new Error('Missing primary key (id/key)');
                    }

                    await db.transaction(async (tx) => {
                        // Conflict resolution
                        const existing = await tx.select().from(tableSchema).where(eq(pkCol, pkValue)).limit(1);
                        const existingRecord = existing[0] as any;

                        if (existingRecord) {
                            // Check ownership if available
                            const ownerId = existingRecord.userId || existingRecord.id;
                            const isSystemRecord = existingRecord.isSystem === 1 || existingRecord.is_system === 1;

                            if (ownerId && ownerId !== userId && !['friendships', 'activity_feed', 'kudos', 'changelog_reactions'].includes(tableName)) {
                                // Industrial Rule: Allow "Public/System" records with deterministic IDs to be shared/merged
                                if (!isSystemRecord) {
                                    throw new Error('Ownership mismatch');
                                }
                            }

                            // Stale check
                            const incomingTs = (filteredData.updatedAt instanceof Date ? filteredData.updatedAt.getTime() : 0);
                            const existingTs = (existingRecord.updatedAt instanceof Date ? existingRecord.updatedAt.getTime() : 0);
                            if (incomingTs > 0 && existingTs > 0 && incomingTs < existingTs) {
                                return; // Ignore stale update
                            }
                        }

                        // Perform UPSERT
                        await tx.insert(tableSchema)
                            .values(filteredData)
                            .onConflictDoUpdate({
                                target: pkCol,
                                set: filteredData
                            });

                        // Special side effects for counts
                        if (operation !== 'DELETE') {
                            const isNewActive = !existingRecord || (existingRecord.deletedAt && !filteredData.deletedAt);
                            if (isNewActive) {
                                if (tableName === 'kudos' && filteredData.feedId) {
                                    await tx.update(schema.activityFeed).set({ kudoCount: sql`${schema.activityFeed.kudoCount} + 1`, updatedAt: new Date() }).where(eq(schema.activityFeed.id, filteredData.feedId));
                                } else if (tableName === 'changelog_reactions' && filteredData.changelogId) {
                                    await tx.update(schema.changelogs).set({ reactionCount: sql`${schema.changelogs.reactionCount} + 1`, updatedAt: new Date() }).where(eq(schema.changelogs.id, filteredData.changelogId));
                                }
                            }
                        }

                        // Score Processing
                        if (tableName === 'workouts' && filteredData.status === 'completed' && (!existingRecord || existingRecord.status !== 'completed')) {
                            await applyWorkoutScoring(tx, userId, pkValue);
                        }
                    });

                    results.push({ id: opId, status: 'success' });
                    processedCount++;

                } else if (operation === 'DELETE') {
                    const recordId = op.recordId || rawPayload?.id;
                    if (!recordId) throw new Error('Missing record id for delete');

                    const pkCol = tableName === 'settings' ? tableSchema.key : tableSchema.id;
                    const finalId: string = (tableName === 'settings' && !recordId.startsWith(`${userId}:`)) ? `${userId}:${recordId}` : recordId;

                    await db.transaction(async (tx) => {
                        // Verify ownership
                        const existing: any[] = await tx.select().from(tableSchema).where(eq(pkCol, finalId)).limit(1);
                        const record = existing[0];
                        if (record) {
                            const ownerId: string | null = (record as any).userId || (record as any).id;
                            if (ownerId === userId || ['friendships', 'changelog_reactions', 'kudos'].includes(tableName)) {
                                const alreadyDeleted = !!(record as any).deletedAt;
                                await tx.update(tableSchema).set({ deletedAt: new Date(), updatedAt: new Date() } as any).where(eq(pkCol, finalId));

                                // Side effect: Decrement count if it wasn't already deleted
                                if (!alreadyDeleted) {
                                    if (tableName === 'kudos' && record.feedId) {
                                        await tx.update(schema.activityFeed).set({ kudoCount: sql`${schema.activityFeed.kudoCount} - 1`, updatedAt: new Date() }).where(eq(schema.activityFeed.id, record.feedId));
                                    } else if (tableName === 'changelog_reactions' && record.changelogId) {
                                        await tx.update(schema.changelogs).set({ reactionCount: sql`${schema.changelogs.reactionCount} - 1`, updatedAt: new Date() }).where(eq(schema.changelogs.id, record.changelogId));
                                    }
                                }
                            }
                        }
                    });
                    results.push({ id: opId, status: 'success' });
                    processedCount++;
                }

            } catch (err: any) {
                console.error(`[Push] Error in ${tableName}:${opId}: ${err.message}`);
                results.push({ id: opId, status: 'error', reason: err.message });
            }
        }

        return NextResponse.json({ success: true, processed: processedCount, results });

    } catch (error: any) {
        console.error('Push Sync Fatal:', error);
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
    }
}
