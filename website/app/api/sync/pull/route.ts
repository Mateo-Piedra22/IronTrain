import { and, eq, gt } from 'drizzle-orm';
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

        const result: Record<string, any[]> = {};

        // Fetch data for each table in shared list
        await Promise.all(SYNC_TABLES.map(async (tableName) => {
            const tableSchema = tableMap[tableName];
            if (!tableSchema) return;

            // Base query filters by userId (if restricted) and updatedAt
            let query = db.select().from(tableSchema);

            const conditions = [];

            // Add since condition
            conditions.push(gt(tableSchema.updatedAt, sinceDate));

            // Policy: Only pull rows belonging to the user for most tables
            // EXCEPT for global/shared tables
            const GLOBAL_TABLES = ['categories', 'badges', 'exercise_badges', 'exercises', 'changelogs', 'changelog_reactions', 'notification_reactions', 'kudos', 'activity_feed', 'score_events', 'user_exercise_prs', 'user_profiles', 'friendships'];

            if (!GLOBAL_TABLES.includes(tableName)) {
                if ('userId' in tableSchema) {
                    conditions.push(eq(tableSchema.userId, userId));
                }
            }

            // Special case for friend-related data or feed
            // (Handled by global tables for now but could be refined)

            const rows = await query.where(and(...conditions));
            let finalRows = rows.map(toSnakeCase);

            // Industrial Rule: Unscope settings keys for the client
            if (tableName === 'settings') {
                finalRows = finalRows.map(row => ({
                    ...row,
                    key: unscopedSettingsKey(userId, String(row.key || ''))
                }));
            }

            result[tableName] = finalRows;
        }));

        return NextResponse.json({
            success: true,
            timestamp: new Date().getTime(),
            changes: result
        });

    } catch (e: any) {
        console.error(`[Sync/Pull] Error pulling for user ${userId}:`, e);
        return NextResponse.json({
            error: e.message || 'Internal Server Error',
            details: e.toString()
        }, { status: 500 });
    }
}
