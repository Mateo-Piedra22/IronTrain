import { and, eq, gt, inArray } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';

export const runtime = 'nodejs';

const toSnakeCase = (camelObj: Record<string, unknown>): Record<string, unknown> => {
    if (!camelObj || typeof camelObj !== 'object') return camelObj;
    const snakeObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(camelObj)) {
        if (value instanceof Date) {
            snakeObj[key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)] = value.getTime();
            continue;
        }
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        snakeObj[snakeKey] = typeof value === 'boolean' ? (value ? 1 : 0) : value;
    }
    // Remove internal fields that should not leak to offline clients
    delete snakeObj.user_id;
    return snakeObj;
};

const unscopedSettingsKey = (userId: string, key: unknown): string => {
    if (typeof key !== 'string') return '';
    const prefix = `${userId}:`;
    if (key.startsWith(prefix)) return key.slice(prefix.length);
    return key;
};

export async function GET(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(req.url);
        const sinceParam = url.searchParams.get('since') || '0';
        const sinceMs = parseInt(sinceParam, 10);
        if (isNaN(sinceMs) || sinceMs < 0) {
            return NextResponse.json({ error: 'Invalid since parameter' }, { status: 400 });
        }
        const timestampMarker = new Date(sinceMs);

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
        };

        // Get friend IDs for the activity feed pull
        const friendsA = await db.select({ id: schema.friendships.friendId }).from(schema.friendships).where(and(eq(schema.friendships.userId, userId), eq(schema.friendships.status, 'accepted')));
        const friendsB = await db.select({ id: schema.friendships.userId }).from(schema.friendships).where(and(eq(schema.friendships.friendId, userId), eq(schema.friendships.status, 'accepted')));
        const friendIds = [...new Set([...friendsA.map(f => f.id), ...friendsB.map(f => f.id)])];
        const allRelevantUserIdsForFeed = [userId, ...friendIds];

        const changes: Array<{ table: string; operation: string; payload: Record<string, unknown> }> = [];

        for (const [tableName, tableSchema] of Object.entries(tableMap)) {
            const query = db.select().from(tableSchema);

            let whereClause;
            if (tableName === 'user_profiles') {
                whereClause = eq(tableSchema.id, userId);
            } else if (tableName === 'changelogs') {
                whereClause = eq(tableSchema.isUnreleased, 0);
            } else if (tableName === 'changelog_reactions') {
                whereClause = eq(tableSchema.userId, userId);
            } else if (tableName === 'kudos') {
                // Pull kudos where I am the giver OR kudos on MY feed items
                whereClause = eq(tableSchema.giverId, userId);
                // Note: For full social sync, we might need a more complex OR here, 
                // but let's stick to items owned/created by user for now to keep it simple and secure.
            } else if (tableName === 'activity_feed') {
                // Pull feed items for self and friends
                if (allRelevantUserIdsForFeed.length > 0) {
                    whereClause = inArray(tableSchema.userId, allRelevantUserIdsForFeed);
                } else {
                    // If no relevant users (e.g., no friends and userId is not in the list for some reason),
                    // default to just the current user to avoid an empty IN clause error.
                    whereClause = eq(tableSchema.userId, userId);
                }
            } else {
                whereClause = eq(tableSchema.userId, userId);
            }

            const records = await query.where(
                and(
                    whereClause,
                    gt(tableSchema.updatedAt, timestampMarker)
                )
            );

            for (const record of records) {
                if (record.deletedAt && new Date(record.deletedAt) > timestampMarker) {
                    changes.push({
                        table: tableName,
                        operation: 'DELETE',
                        payload: {
                            id: record.id,
                            updated_at: record.updatedAt instanceof Date ? record.updatedAt.getTime() : Date.now(),
                            deleted_at: record.deletedAt instanceof Date ? record.deletedAt.getTime() : (record.updatedAt instanceof Date ? record.updatedAt.getTime() : Date.now()),
                        },
                    });
                } else if (!record.deletedAt) {
                    const payloadRecord =
                        tableName === 'settings'
                            ? { ...(record as Record<string, unknown>), key: unscopedSettingsKey(userId, (record as Record<string, unknown>).key) }
                            : (record as Record<string, unknown>);
                    changes.push({
                        table: tableName,
                        operation: 'UPDATE',
                        payload: toSnakeCase(payloadRecord),
                    });
                }
            }
        }

        const serverTime = Date.now();
        return NextResponse.json({ success: true, changes, serverTime });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        console.error('Sync Pull Error:', message);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
