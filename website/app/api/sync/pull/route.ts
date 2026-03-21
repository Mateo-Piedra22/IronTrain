import { and, eq, gt, inArray, or, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { SYNC_TABLES } from '../../../../src/constants/sync';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';
import {
    collectMissingParentIdsFromChanges,
    type SyncChange,
    type SyncParentRelation,
} from '../../../../src/lib/sync-parent-workouts';

export const runtime = 'nodejs';

const toSnakeCase = (camelObj: Record<string, unknown>): Record<string, unknown> => {
    if (!camelObj || typeof camelObj !== 'object') return camelObj;
    const snakeObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(camelObj)) {
        const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
        if (value instanceof Date) {
            snakeObj[snakeKey] = value.getTime();
        } else if (typeof value === 'bigint') {
            snakeObj[snakeKey] = Number(value);
        } else {
            snakeObj[snakeKey] = typeof value === 'boolean' ? (value ? 1 : 0) : value;
        }
    }
    return snakeObj;
};

const unscopedSettingsKey = (userId: string, key: string): string => {
    const prefix = `${userId}:`;
    if (key.startsWith(prefix)) return key.slice(prefix.length);
    return key;
};

export async function GET(req: NextRequest) {
    const userId = await verifyAuth(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sp = req.nextUrl.searchParams;
    const sinceParam = sp.get('since');
    const sinceDate = sinceParam ? new Date(parseInt(sinceParam)) : new Date(0);

    try {
        const tableMap: Record<string, any> = {
            categories: schema.categories,
            exercises: schema.exercises,
            workouts: schema.workouts,
            workout_sets: schema.workoutSets,
            routines: schema.routines,
            routine_days: schema.routineDays,
            routine_exercises: schema.routineExercises,
            measurements: schema.measurements,
            goals: schema.goals,
            body_metrics: schema.bodyMetrics,
            plate_inventory: schema.plateInventory,
            settings: schema.settings,
            badges: schema.badges,
            exercise_badges: schema.exerciseBadges,
            user_profiles: schema.userProfiles,
            activity_feed: schema.activityFeed,
            shares_inbox: schema.sharesInbox,
            changelogs: schema.changelogs,
            changelog_reactions: schema.changelogReactions,
            kudos: schema.kudos,
            score_events: schema.scoreEvents,
            user_exercise_prs: schema.userExercisePrs,
            friendships: schema.friendships,
        };

        const MAX_PULL_RECORDS = 1000;
        const changes: SyncChange[] = [];
        let totalCount = 0;

        // Fetch data for each table in shared list
        for (const tableName of SYNC_TABLES) {
            if (totalCount >= MAX_PULL_RECORDS) break;

            const tableSchema = tableMap[tableName];
            if (!tableSchema) continue;

            const conditions = [];
            conditions.push(gt(tableSchema.updatedAt, sinceDate));

            const SYSTEM_ASSET_TABLES = ['categories', 'badges', 'exercises', 'exercise_badges'];
            const PURE_GLOBAL_TABLES = ['changelogs'];
            const PRIVACY_SENSITIVE_GLOBAL = ['user_profiles', 'social_scoring_config', 'global_events'];

            if (SYSTEM_ASSET_TABLES.includes(tableName)) {
                if ('userId' in tableSchema && 'isSystem' in tableSchema) {
                    conditions.push(sql`(${tableSchema.isSystem} = 1 OR ${tableSchema.userId} = ${userId})`);
                } else if ('isSystem' in tableSchema) {
                    conditions.push(eq(tableSchema.isSystem, 1));
                } else if ('userId' in tableSchema) {
                    conditions.push(eq(tableSchema.userId, userId));
                }
            } else if (tableName === 'user_profiles') {
                // EXCEPTION: Users need other people's Display Names/Usernames for Social Feed & Ranking
                // We pull our own profile OR any profile that is public AND has changed.
                // Strict PII removal below ensures no sensitive data leaks.
                conditions.push(or(eq(tableSchema.id, userId), eq(tableSchema.isPublic, true)));
            } else if (!PURE_GLOBAL_TABLES.includes(tableName)) {
                // USER-SPECIFIC DATA (Workouts, PRs, Friends, Activity, etc.)
                if (tableName === 'activity_feed' || tableName === 'kudos') {
                    // Global/Social Tables: Allow visibility for public activities
                    // The app filters what the user sees, but sync provides the data pool
                    const userCol = tableName === 'kudos' ? tableSchema.giverId : tableSchema.userId;

                    // Direct qualification for friendships tables to avoid ambiguity with outer query columns
                    conditions.push(sql`(${userCol} = ${userId} OR EXISTS (
                        SELECT 1 FROM friendships f 
                        WHERE ((f.user_id = ${userId} AND f.friend_id = ${userCol}) 
                           OR (f.user_id = ${userCol} AND f.friend_id = ${userId})) 
                        AND f.status = 'accepted'
                        AND f.deleted_at IS NULL
                    ))`);
                } else if (tableName === 'friendships') {
                    conditions.push(sql`(${tableSchema.userId} = ${userId} OR ${tableSchema.friendId} = ${userId})`);
                } else if (tableName === 'shares_inbox') {
                    conditions.push(sql`(${tableSchema.senderId} = ${userId} OR ${tableSchema.receiverId} = ${userId})`);
                } else if ('userId' in tableSchema) {
                    conditions.push(eq(tableSchema.userId, userId));
                }
            }

            const rows = await db.select().from(tableSchema)
                .where(and(...conditions))
                .limit(MAX_PULL_RECORDS - totalCount);

            const SENSITIVE_FIELDS = ['push_token', 'password', 'token', 'secret', 'ip_hash'];

            for (const row of rows) {
                const snakeRow = toSnakeCase(row as Record<string, unknown>);

                // Sanitization
                for (const field of SENSITIVE_FIELDS) {
                    if (field in snakeRow) delete snakeRow[field];
                }

                // Settings unscoping
                if (tableName === 'settings') {
                    snakeRow.key = unscopedSettingsKey(userId, String(snakeRow.key || ''));
                }

                changes.push({
                    table: tableName,
                    operation: snakeRow.deleted_at ? 'DELETE' : 'UPDATE', // Standard sync protocol
                    payload: snakeRow
                });
                totalCount++;
            }
        }

        const relations: SyncParentRelation[] = [
            { childTable: 'workout_sets', parentTable: 'workouts', fkField: 'workout_id' },
            { childTable: 'workout_sets', parentTable: 'exercises', fkField: 'exercise_id' },
            { childTable: 'exercises', parentTable: 'categories', fkField: 'category_id' },
            { childTable: 'routine_days', parentTable: 'routines', fkField: 'routine_id' },
            { childTable: 'routine_exercises', parentTable: 'routine_days', fkField: 'routine_day_id' },
            { childTable: 'routine_exercises', parentTable: 'exercises', fkField: 'exercise_id' },
            { childTable: 'exercise_badges', parentTable: 'exercises', fkField: 'exercise_id' },
            { childTable: 'exercise_badges', parentTable: 'badges', fkField: 'badge_id' },
            { childTable: 'user_exercise_prs', parentTable: 'exercises', fkField: 'exercise_id' },
            { childTable: 'score_events', parentTable: 'workouts', fkField: 'workout_id' },
            { childTable: 'kudos', parentTable: 'activity_feed', fkField: 'feed_id' },
            { childTable: 'changelog_reactions', parentTable: 'changelogs', fkField: 'changelog_id' },
        ];

        const fetchParents = async (parentTable: string, ids: string[]): Promise<void> => {
            if (totalCount >= MAX_PULL_RECORDS) return;
            if (ids.length === 0) return;
            const tableSchema = tableMap[parentTable];
            if (!tableSchema) return;

            const remaining = MAX_PULL_RECORDS - totalCount;
            const limited = ids.slice(0, remaining);
            const pkField = parentTable === 'settings' ? tableSchema.key : tableSchema.id;

            const SYSTEM_ASSET_TABLES = ['categories', 'badges', 'exercises', 'exercise_badges'];
            const PURE_GLOBAL_TABLES = ['changelogs'];

            const baseConditions: any[] = [];

            if (parentTable === 'activity_feed') {
                baseConditions.push(inArray(pkField, limited));
                baseConditions.push(sql`(${tableSchema.userId} = ${userId} OR EXISTS (
                    SELECT 1 FROM friendships f
                    WHERE ((f.user_id = ${userId} AND f.friend_id = ${tableSchema.userId})
                       OR (f.user_id = ${tableSchema.userId} AND f.friend_id = ${userId}))
                    AND f.status = 'accepted'
                    AND f.deleted_at IS NULL
                ))`);
            } else if (SYSTEM_ASSET_TABLES.includes(parentTable)) {
                baseConditions.push(inArray(pkField, limited));
                if ('userId' in tableSchema && 'isSystem' in tableSchema) {
                    baseConditions.push(sql`(${tableSchema.isSystem} = 1 OR ${tableSchema.userId} = ${userId})`);
                } else if ('isSystem' in tableSchema) {
                    baseConditions.push(eq(tableSchema.isSystem, 1));
                } else if ('userId' in tableSchema) {
                    baseConditions.push(eq(tableSchema.userId, userId));
                }
            } else if (parentTable === 'user_profiles') {
                baseConditions.push(inArray(pkField, limited));
                baseConditions.push(or(eq(tableSchema.id, userId), eq(tableSchema.isPublic, true)));
            } else if (!PURE_GLOBAL_TABLES.includes(parentTable)) {
                baseConditions.push(inArray(pkField, limited));
                if (parentTable === 'friendships') {
                    baseConditions.push(sql`(${tableSchema.userId} = ${userId} OR ${tableSchema.friendId} = ${userId})`);
                } else if (parentTable === 'shares_inbox') {
                    baseConditions.push(sql`(${tableSchema.senderId} = ${userId} OR ${tableSchema.receiverId} = ${userId})`);
                } else if (parentTable === 'kudos') {
                    baseConditions.push(eq(tableSchema.giverId, userId));
                } else if ('userId' in tableSchema) {
                    baseConditions.push(eq(tableSchema.userId, userId));
                }
            } else {
                baseConditions.push(inArray(pkField, limited));
            }

            const rows = await db.select().from(tableSchema).where(and(...baseConditions));

            const SENSITIVE_FIELDS = ['push_token', 'password', 'token', 'secret', 'ip_hash'];
            for (const row of rows) {
                const snakeRow = toSnakeCase(row as Record<string, unknown>);
                for (const field of SENSITIVE_FIELDS) {
                    if (field in snakeRow) delete (snakeRow as any)[field];
                }
                if (parentTable === 'settings') {
                    (snakeRow as any).key = unscopedSettingsKey(userId, String((snakeRow as any).key || ''));
                }
                changes.push({
                    table: parentTable,
                    operation: (snakeRow as any).deleted_at ? 'DELETE' : 'UPDATE',
                    payload: snakeRow,
                });
                totalCount++;
                if (totalCount >= MAX_PULL_RECORDS) break;
            }
        };

        for (let pass = 0; pass < 3 && totalCount < MAX_PULL_RECORDS; pass++) {
            const missingByTable = collectMissingParentIdsFromChanges(changes, relations);
            const entries = Object.entries(missingByTable);
            if (entries.length === 0) break;
            for (const [parentTable, ids] of entries) {
                await fetchParents(parentTable, ids);
                if (totalCount >= MAX_PULL_RECORDS) break;
            }
        }

        return NextResponse.json({
            success: true,
            serverTime: new Date().getTime(),
            changes,
            hasMore: totalCount >= MAX_PULL_RECORDS
        });
    } catch (e: any) {
        console.error(`[Sync/Pull] Error pulling for user ${userId}:`, e);
        return NextResponse.json({
            error: e.message || 'Internal Server Error',
            details: e.toString()
        }, { status: 500 });
    }
}
