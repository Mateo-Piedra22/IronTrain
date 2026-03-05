import { and, eq, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';

export async function GET(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const friendId = searchParams.get('friendId');

        if (!friendId) return NextResponse.json({ error: 'Missing friendId' }, { status: 400 });

        // Ensure friendship
        const friendship = await db.select().from(schema.friendships).where(
            and(
                sql`(${schema.friendships.userId} = ${userId} AND ${schema.friendships.friendId} = ${friendId}) OR (${schema.friendships.userId} = ${friendId} AND ${schema.friendships.friendId} = ${userId})`,
                eq(schema.friendships.status, 'accepted')
            )
        ).limit(1);

        if (friendship.length === 0) {
            return NextResponse.json({ error: 'Not friends' }, { status: 403 });
        }

        // Calculate 1RM for each user, mapped by LOWER(exercise.name)
        // PostgreSQL: max(weight * (1 + (reps / 30.0)))
        const query = sql`
            WITH UserStats AS (
                SELECT 
                    LOWER(e.name) as exercise_name,
                    MAX(e.name) as display_name,
                    MAX(s.weight * (1.0 + (s.reps / 30.0))) as max_1rm
                FROM workout_sets s
                JOIN exercises e ON s.exercise_id = e.id
                WHERE s.user_id = ${userId} AND s.weight > 0 AND s.reps > 0 AND s.completed = 1 AND s.deleted_at IS NULL
                GROUP BY LOWER(e.name)
            ),
            FriendStats AS (
                SELECT 
                    LOWER(e.name) as exercise_name,
                    MAX(e.name) as display_name,
                    MAX(s.weight * (1.0 + (s.reps / 30.0))) as max_1rm
                FROM workout_sets s
                JOIN exercises e ON s.exercise_id = e.id
                WHERE s.user_id = ${friendId} AND s.weight > 0 AND s.reps > 0 AND s.completed = 1 AND s.deleted_at IS NULL
                GROUP BY LOWER(e.name)
            )
            SELECT 
                COALESCE(u.display_name, f.display_name) as "exerciseName",
                FLOOR(u.max_1rm) as "user1RM",
                FLOOR(f.max_1rm) as "friend1RM"
            FROM UserStats u
            JOIN FriendStats f ON u.exercise_name = f.exercise_name
            ORDER BY u.exercise_name ASC;
        `;

        const result = await db.execute(query);
        // Sometimes db.execute returns array of rows, sometimes an object with `rows` property (depending on postgres driver wrapper)
        const rows = (result as any).rows || result;

        return NextResponse.json({ success: true, comparison: rows });

    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error'; return NextResponse.json({ error: message }, { status: 500 });
    }
}
