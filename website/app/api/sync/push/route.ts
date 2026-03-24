import { and, eq, getTableColumns, like, or, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';
import { applyWorkoutScoring, revertWorkoutScoring } from '../../../../src/lib/social-scoring';
import { collectIncomingRecordIdsByTable, shouldDeferWorkoutSetUpsert, type PushOperation } from '../../../../src/lib/sync-push-defer';

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

        const operations = body?.operations as unknown;

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
            // NOTE: changelogs and changelog_reactions are READ-ONLY via pull.
            // They are managed exclusively by admin actions and server-side triggers.
            // Removing them from tableMap prevents client injection.
            'kudos': schema.kudos,
            'activity_feed': schema.activityFeed,
            'shares_inbox': schema.sharesInbox,
            'score_events': schema.scoreEvents,
            'user_exercise_prs': schema.userExercisePrs,
            'friendships': schema.friendships,
        };

        const results: Array<{ id: string; status: string; reason?: string }> = [];
        let processedCount = 0;
        let hasScoreImpact = false; // Only recalc lifetime score if workout-related ops were processed

        const knownBigIntColumns = new Set(['date', 'start_time', 'end_time', 'duration', 'time', 'order_index']);
        const knownBooleanColumns = new Set(['is_public', 'is_moderated', 'is_unreleased', 'weather_bonus_enabled', 'is_active', 'push_sent']);

        const incomingIdsByTable = collectIncomingRecordIdsByTable(operations as PushOperation[]);
        const incomingWorkouts = incomingIdsByTable.get('workouts') ?? new Set<string>();

        const deferredWorkoutSetOps: any[] = [];

        const handleOperation = async (op: any): Promise<void> => {
            const opId = op.id || crypto.randomUUID();
            const tableName = op.table;
            const operation = op.operation?.toUpperCase();
            const rawPayload = op.payload || {};

            if (!tableMap[tableName] || !SUPPORTED_OPERATIONS.has(operation)) {
                results.push({ id: opId, status: 'ignored', reason: 'unsupported_table_or_op' });
                return;
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
                            // Boolean handling (SQLite 0/1 -> Postgres true/false)
                            else if (knownBooleanColumns.has(key) && (value !== null && value !== undefined)) {
                                convertedValue = value === 1 || value === '1' || value === true || value === 'true';
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
                    } else if (tableName === 'changelogs') {
                        // Industrial Rule: sanitize items to prevent client-side injection in system tables
                        if (filteredData.items) {
                            try {
                                const parsed = typeof filteredData.items === 'string' ? JSON.parse(filteredData.items) : filteredData.items;
                                filteredData.items = parsed;
                            } catch {
                                filteredData.items = [];
                            }
                        }
                        // Changelogs don't have a userId, they are system-wide
                    } else if (tableName === 'kudos') {
                        filteredData.giverId = userId;
                    } else if (tableName === 'shares_inbox') {
                        // RECEIVER can only update seenAt and status. SENDER can update payload if needed.
                        // We check this in the ownership logic below.
                    } else if (tableName === 'activity_feed') {
                        filteredData.userId = userId;
                    } else if (tableName === 'friendships') {
                        // Enforce participant identity: one side MUST be the current user
                        if (filteredData.userId !== userId && filteredData.friendId !== userId) {
                            throw new Error('Forbidden friendship party: Current user must be a participant');
                        }
                    } else if (columnsMap.userId) {
                        // General Rule: Enforce user context for all user-owned rows
                        filteredData.userId = userId;
                    }

                    // Zero Trust: Users cannot push system status
                    if (columnsMap.isSystem) {
                        filteredData.isSystem = 0;
                    }

                    const pkPropName = tableName === 'settings' ? 'key' : 'id';
                    let pkValue = filteredData[pkPropName];

                    if (!pkValue && op.recordId) {
                        pkValue = op.recordId;
                        filteredData[pkPropName] = pkValue;
                    }

                    // Special Rule: Auto-generate deterministic IDs for social reactions if missing
                    if (!pkValue) {
                        if (tableName === 'changelog_reactions' && filteredData.changelogId) {
                            pkValue = `${filteredData.changelogId}_${userId}`;
                            filteredData.id = pkValue;
                        } else if (tableName === 'kudos' && filteredData.feedId) {
                            pkValue = `${filteredData.feedId}_${userId}`;
                            filteredData.id = pkValue;
                        }
                    }

                    const pkCol = tableName === 'settings' ? tableSchema.key : tableSchema.id;

                    if (!pkValue) {
                        throw new Error(`Missing primary key (id/key) for table ${tableName}`);
                    }

                    if (tableName === 'workout_sets' && (operation === 'INSERT' || operation === 'UPDATE')) {
                        const workoutId = filteredData.workoutId;
                        if (typeof workoutId !== 'string' || workoutId.length === 0) {
                            throw new Error('Missing workout_id for workout_sets');
                        }
                        const existingWorkout = await db.select({ id: schema.workouts.id })
                            .from(schema.workouts)
                            .where(and(eq(schema.workouts.id, workoutId), eq(schema.workouts.userId, userId)))
                            .limit(1);
                        if (!existingWorkout[0]?.id) {
                            const defer = shouldDeferWorkoutSetUpsert({
                                workoutId,
                                parentExistsInDb: false,
                                incomingWorkouts,
                            });
                            if (defer) {
                                deferredWorkoutSetOps.push({ ...op, id: opId });
                                return;
                            }
                            results.push({ id: opId, status: 'error', reason: 'missing_parent_workout' });
                            return;
                        }
                    }

                    await db.transaction(async (tx) => {
                        // Conflict resolution
                        const existing = await tx.select().from(tableSchema).where(eq(pkCol, pkValue)).limit(1);
                        const existingRecord = existing[0] as any;

                        if (existingRecord) {
                            // Check ownership if available
                            // Check ownership if available across different possible owner columns
                            const ownerId = existingRecord.userId ||
                                existingRecord.giverId ||
                                existingRecord.senderId ||
                                (tableName === 'user_profiles' ? existingRecord.id : undefined);
                            const isSystemRecord = existingRecord.isSystem === 1 || existingRecord.is_system === 1;

                            if (ownerId && ownerId !== userId && !['friendships', 'activity_feed', 'kudos', 'changelog_reactions', 'shares_inbox'].includes(tableName)) {
                                if (isSystemRecord) {
                                    // Zero Trust: Ignore sync attempts to modify official system records
                                    return;
                                }
                                throw new Error('Ownership mismatch');
                            }

                            // ZERO TRUST: shares_inbox specific checks
                            if (tableName === 'shares_inbox') {
                                if (existingRecord.receiverId === userId) {
                                    // Receiver can ONLY update seenAt and status
                                    const allowedFields = new Set(['seenAt', 'status', 'updatedAt']);
                                    for (const key of Object.keys(filteredData)) {
                                        if (!allowedFields.has(key)) {
                                            delete filteredData[key];
                                        }
                                    }
                                } else if (existingRecord.senderId !== userId) {
                                    throw new Error('Forbidden: Not sender or receiver of this share');
                                }
                            }

                            // ZERO TRUST: user_profiles social stats are server-authoritative
                            if (tableName === 'user_profiles') {
                                const socialFields = new Set(['score_lifetime', 'streak_weeks', 'streak_multiplier', 'current_streak', 'highest_streak', 'streak_week_evaluated_at']);
                                for (const key of Object.keys(filteredData)) {
                                    if (socialFields.has(key)) {
                                        delete filteredData[key];
                                    }
                                }
                            }

                            // ZERO TRUST: Specifically for friendships, block status changes via sync
                            if (tableName === 'friendships') {
                                if (filteredData.status && filteredData.status !== existingRecord.status) {
                                    throw new Error('Forbidden: Cannot change friendship status via sync');
                                }
                            }

                            if (isSystemRecord && tableName !== 'user_profiles') {
                                // Double protection: even if the user IS the owner (e.g. an admin syncing), 
                                // we block system record modification through standard client sync 
                                // to force use of the Admin Panel or specific tools.
                                return;
                            }

                            // Stale check
                            const incomingTs = (filteredData.updatedAt instanceof Date ? filteredData.updatedAt.getTime() : 0);
                            const existingTs = (existingRecord.updatedAt instanceof Date ? existingRecord.updatedAt.getTime() : 0);
                            if (incomingTs > 0 && existingTs > 0 && incomingTs < existingTs) {
                                return; // Ignore stale update
                            }
                        }

                        // Hydrate insertion payload to satisfy PostgreSQL NOT NULL constraints 
                        // when performing partial updates on existing records (deltas).
                        const insertPayload = existingRecord
                            ? { ...existingRecord, ...filteredData }
                            : filteredData;

                        // ZERO TRUST: Friendships cannot be created as 'accepted' via sync
                        if (tableName === 'friendships' && !existingRecord && insertPayload.status !== 'pending') {
                            throw new Error('Forbidden: New friendships must start as pending');
                        }

                        // perform a custom de-duplication for score_events by eventKey
                        if (tableName === 'score_events' && (operation === 'INSERT' || !existingRecord)) {
                            const eventKey = filteredData.eventKey;
                            if (eventKey) {
                                const foundByEventKey = await tx
                                    .select({ id: schema.scoreEvents.id })
                                    .from(schema.scoreEvents)
                                    .where(eq(schema.scoreEvents.eventKey, eventKey))
                                    .limit(1);

                                if (foundByEventKey[0]) {
                                    await tx.update(schema.scoreEvents)
                                        .set(filteredData)
                                        .where(eq(schema.scoreEvents.id, foundByEventKey[0].id));
                                    return;
                                }
                            }
                        }

                        // Perform UPSERT
                        // Note: .values() uses the hydrated payload for the INSERT phase.
                        // .onConflictDoUpdate.set uses ONLY filteredData for the UPDATE phase to avoid 
                        // overwriting with stale data and for write efficiency.
                        await tx.insert(tableSchema)
                            .values(insertPayload)
                            .onConflictDoUpdate({
                                target: pkCol,
                                set: filteredData
                            });

                        // Special side effects for counts (handle active <-> deleted transitions)
                        if (operation !== 'DELETE') {
                            const wasActive = !!existingRecord && !existingRecord.deletedAt;
                            const willBeActive = !insertPayload.deletedAt;
                            const becameActive = (!existingRecord && willBeActive) || (!!existingRecord && !wasActive && willBeActive);
                            const becameDeleted = !!existingRecord && wasActive && !willBeActive;

                            if (becameActive) {
                                if (tableName === 'kudos' && insertPayload.feedId) {
                                    await tx.update(schema.activityFeed)
                                        .set({ kudoCount: sql`${schema.activityFeed.kudoCount} + 1`, updatedAt: new Date() })
                                        .where(eq(schema.activityFeed.id, insertPayload.feedId));
                                } else if (tableName === 'changelog_reactions' && insertPayload.changelogId) {
                                    await tx.update(schema.changelogs)
                                        .set({ reactionCount: sql`${schema.changelogs.reactionCount} + 1`, updatedAt: new Date() })
                                        .where(eq(schema.changelogs.id, insertPayload.changelogId));
                                }
                            }

                            if (becameDeleted) {
                                if (tableName === 'kudos' && existingRecord.feedId) {
                                    await tx.update(schema.activityFeed)
                                        .set({ kudoCount: sql`GREATEST(0, ${schema.activityFeed.kudoCount} - 1)`, updatedAt: new Date() })
                                        .where(eq(schema.activityFeed.id, existingRecord.feedId));
                                } else if (tableName === 'changelog_reactions' && existingRecord.changelogId) {
                                    await tx.update(schema.changelogs)
                                        .set({ reactionCount: sql`GREATEST(0, ${schema.changelogs.reactionCount} - 1)`, updatedAt: new Date() })
                                        .where(eq(schema.changelogs.id, existingRecord.changelogId));
                                }
                            }
                        }

                        // Score Processing & Invalidation Side Effects
                        if (tableName === 'workouts') {
                            const wasCompleted = existingRecord?.status === 'completed' && !existingRecord.deletedAt;
                            const isCompleted = insertPayload.status === 'completed' && !insertPayload.deletedAt;

                            if (isCompleted && !wasCompleted) {
                                // Activation (Finished or Restored)
                                await applyWorkoutScoring(tx, userId, pkValue);
                                // Re-activate feed entries and reset seen status for everyone so it pops up as new
                                await tx.update(schema.activityFeed)
                                    .set({ deletedAt: null, updatedAt: new Date(), seenAt: null })
                                    .where(
                                        and(
                                            eq(schema.activityFeed.userId, userId),
                                            or(
                                                eq(schema.activityFeed.id, `activity-workout-${pkValue}`),
                                                like(schema.activityFeed.id, `activity-pr-${pkValue}-%`)
                                            )
                                        )
                                    );

                                // Reset per-user seen status for everyone so it pops up as new
                                // (Implementation note: This was previously handled by activity_seen table, now handled via activityFeed.seenAt)
                            } else if (!isCompleted && wasCompleted) {
                                // Deactivation (Resumed or Soft-deleted)
                                await revertWorkoutScoring(tx, userId, pkValue);
                                // Soft-delete feed entries
                                await tx.update(schema.activityFeed)
                                    .set({ deletedAt: new Date(), updatedAt: new Date() })
                                    .where(
                                        and(
                                            eq(schema.activityFeed.userId, userId),
                                            or(
                                                eq(schema.activityFeed.id, `activity-workout-${pkValue}`),
                                                like(schema.activityFeed.id, `activity-pr-${pkValue}-%`)
                                            )
                                        )
                                    );
                            }
                        }
                    });

                    results.push({ id: opId, status: 'success' });
                    processedCount++;
                    // Track if any workout-related operation was processed for score recalc
                    if (tableName === 'workouts' || tableName === 'workout_sets' || tableName === 'score_events') {
                        hasScoreImpact = true;
                    }

                } else if (operation === 'DELETE') {
                    const recordId = op.recordId || rawPayload?.id;
                    if (!recordId) throw new Error('Missing record id for delete');

                    const pkCol = tableName === 'settings' ? tableSchema.key : tableSchema.id;
                    const finalId: string = (tableName === 'settings' && !recordId.startsWith(`${userId}:`)) ? `${userId}:${recordId}` : recordId;

                    await db.transaction(async (tx) => {
                        // Verify ownership
                        const existing: any[] = await tx.select().from(tableSchema).where(eq(pkCol, finalId)).limit(1);
                        const record = existing[0] as any;
                        if (record) {
                            const ownerId = record.userId || record.giverId || record.senderId || (tableName === 'user_profiles' ? record.id : undefined);
                            const isSystemRecord = record.isSystem === 1 || record.is_system === 1;

                            // Allow deletion if the user is the owner OR it's a shared interaction table they participated in
                            // For system records, users cannot trigger deletes via sync (Zero Trust)
                            const isParticipant =
                                ownerId === userId ||
                                (tableName === 'friendships' && (record.userId === userId || record.friendId === userId)) ||
                                (tableName === 'kudos' && record.giverId === userId) ||
                                (tableName === 'shares_inbox' && (record.senderId === userId || record.receiverId === userId));

                            if (!isSystemRecord && isParticipant) {
                                const alreadyDeleted = !!(record as any).deletedAt;
                                await tx.update(tableSchema).set({ deletedAt: new Date(), updatedAt: new Date() } as any).where(eq(pkCol, finalId));

                                // Side effect: Decrement count if it wasn't already deleted
                                if (!alreadyDeleted) {
                                    if (tableName === 'kudos' && record.feedId) {
                                        await tx.update(schema.activityFeed).set({ kudoCount: sql`GREATEST(0, ${schema.activityFeed.kudoCount} - 1)`, updatedAt: new Date() }).where(eq(schema.activityFeed.id, record.feedId));
                                    } else if (tableName === 'changelog_reactions' && record.changelogId) {
                                        await tx.update(schema.changelogs).set({ reactionCount: sql`GREATEST(0, ${schema.changelogs.reactionCount} - 1)`, updatedAt: new Date() }).where(eq(schema.changelogs.id, record.changelogId));
                                    }

                                    if (tableName === 'workouts') {
                                        await revertWorkoutScoring(tx, userId, finalId);
                                        await tx.update(schema.activityFeed)
                                            .set({ deletedAt: new Date(), updatedAt: new Date() })
                                            .where(
                                                and(
                                                    eq(schema.activityFeed.userId, userId),
                                                    or(
                                                        eq(schema.activityFeed.id, `activity-workout-${finalId}`),
                                                        like(schema.activityFeed.id, `activity-pr-${finalId}-%`)
                                                    )
                                                )
                                            );
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
        };

        for (const op of operations) {
            await handleOperation(op);
        }

        if (deferredWorkoutSetOps.length > 0) {
            for (const op of deferredWorkoutSetOps) {
                await handleOperation(op);
            }
        }

        // Final Social Scoring Integrity Check: Recalculate lifetime score from events.
        // Only runs when workout-related data changed to avoid unnecessary DB load.
        if (hasScoreImpact) {
            await db.update(schema.userProfiles)
                .set({
                    scoreLifetime: sql`(
                        SELECT COALESCE(SUM(${schema.scoreEvents.pointsAwarded}), 0)
                        FROM ${schema.scoreEvents}
                        WHERE ${schema.scoreEvents.userId} = ${schema.userProfiles.id}
                          AND ${schema.scoreEvents.deletedAt} IS NULL
                    )`,
                    updatedAt: new Date(),
                })
                .where(eq(schema.userProfiles.id, userId));
        }

        return NextResponse.json({ success: true, processed: processedCount, results });

    } catch (error: any) {
        console.error('Push Sync Fatal:', error);
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
    }
}
