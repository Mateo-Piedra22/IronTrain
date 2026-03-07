import { and, eq, gt, inArray, or } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
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

export async function GET(req: NextRequest) {
    const userId = await verifyAuth(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const sinceParam = searchParams.get('since');
    const sinceDate = sinceParam ? new Date(parseInt(sinceParam)) : new Date(0);

    try {
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
            'changelogs': schema.changelogs,
            'changelog_reactions': schema.changelogReactions,
            'kudos': schema.kudos,
            'activity_feed': schema.activityFeed,
            'score_events': schema.scoreEvents,
            'user_exercise_prs': schema.userExercisePrs,
            'friendships': schema.friendships,
        };

        // Get friend IDs for the activity feed pull
        const friendsA = await db.select({ id: schema.friendships.friendId }).from(schema.friendships).where(and(eq(schema.friendships.userId, userId), eq(schema.friendships.status, 'accepted')));
        const friendsB = await db.select({ id: schema.friendships.userId }).from(schema.friendships).where(and(eq(schema.friendships.friendId, userId), eq(schema.friendships.status, 'accepted')));
        const friendIds = [...new Set([...friendsA.map(f => f.id), ...friendsB.map(f => f.id)])];
        const allRelevantUserIdsForFeed = [userId, ...friendIds];

        const changes: Array<{ table: string; operation: string; payload: Record<string, unknown> }> = [];

        for (const [tableName, table] of Object.entries(tableMap)) {
            let queryResult;
            if (tableName === 'activity_feed') {
                queryResult = await db.select()
                    .from(table)
                    .where(and(
                        inArray(table.userId, allRelevantUserIdsForFeed),
                        gt(table.updatedAt, sinceDate)
                    ));
            } else if (tableName === 'changelogs' || tableName === 'badges' || tableName === 'categories') {
                // Public or Global tables
                queryResult = await db.select()
                    .from(table)
                    .where(gt(table.updatedAt, sinceDate));
            } else if (tableName === 'friendships') {
                // Friendship tables - both sides
                queryResult = await db.select()
                    .from(table)
                    .where(and(
                        or(eq(table.userId, userId), eq(table.friendId, userId)),
                        gt(table.updatedAt, sinceDate)
                    ));
            } else if (tableName === 'kudos') {
                // User's own kudos pull (giver_id)
                queryResult = await db.select()
                    .from(table)
                    .where(and(
                        eq(table.giverId, userId),
                        gt(table.updatedAt, sinceDate)
                    ));
            } else if (tableName === 'changelog_reactions' || tableName === 'user_profiles') {
                // Tables where the ID field or a specific 'userId' field is used
                const idCol = tableName === 'user_profiles' ? table.id : table.userId;
                queryResult = await db.select()
                    .from(table)
                    .where(and(
                        eq(idCol, userId),
                        gt(table.updatedAt, sinceDate)
                    ));
            } else {
                // Standard user-owned tables
                queryResult = await db.select()
                    .from(table)
                    .where(and(
                        eq(table.userId, userId),
                        gt(table.updatedAt, sinceDate)
                    ));
            }

            for (const record of queryResult) {
                const operation = (record.deletedAt && record.deletedAt > sinceDate) ? 'DELETE' : (record.createdAt > sinceDate ? 'INSERT' : 'UPDATE');
                changes.push({
                    table: tableName,
                    operation,
                    payload: toSnakeCase(record as Record<string, unknown>)
                });
            }
        }

        return NextResponse.json({
            timestamp: Date.now(),
            changes
        });

    } catch (error: any) {
        console.error('[Sync Pull] Error:', error);
        return NextResponse.json({
            error: 'Internal server error',
            message: error.message
        }, { status: 500 });
    }
}
