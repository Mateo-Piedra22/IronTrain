import { and, eq, gt, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { SYNC_TABLES } from '../../../../src/constants/sync';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';

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

    const searchParams = req.nextUrl.searchParams;
    const sinceParam = searchParams.get('since');
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
            changelogs: schema.changelogs,
            changelog_reactions: schema.changelogReactions,
            notification_reactions: schema.notificationReactions,
            kudos: schema.kudos,
            activity_feed: schema.activityFeed,
            score_events: schema.scoreEvents,
            user_exercise_prs: schema.userExercisePrs,
            friendships: schema.friendships,
        };

        const MAX_PULL_RECORDS = 1000;
        const changes: any[] = [];
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
                conditions.push(sql`(${tableSchema.id} = ${userId} OR ${tableSchema.isPublic} = 1)`);
            } else if (!PURE_GLOBAL_TABLES.includes(tableName)) {
                // USER-SPECIFIC DATA (Workouts, PRs, Friends, Activity, etc.)
                if (tableName === 'activity_feed' || tableName === 'kudos') {
                    // Global/Social Tables: Allow visibility for public activities
                    // The app filters what the user sees, but sync provides the data pool
                    conditions.push(sql`(${tableSchema.userId} = ${userId} OR EXISTS (SELECT 1 FROM friendships WHERE ((user_id = ${userId} AND friend_id = ${tableSchema.userId}) OR (user_id = ${tableSchema.userId} AND friend_id = ${userId})) AND status = 'accepted'))`);
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
