import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';

const KG_PER_LB = 0.45359237;
const LB_PER_KG = 2.2046226218;

type WeightUnit = 'kg' | 'lbs';

const toWeightUnit = (value: string | null | undefined): WeightUnit => {
    const normalized = (value || '').trim().toLowerCase().replace(/"/g, '');
    return normalized === 'lbs' ? 'lbs' : 'kg';
};

const toSafeNumber = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

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
                eq(schema.friendships.status, 'accepted'),
                isNull(schema.friendships.deletedAt)
            )
        ).limit(1);

        if (friendship.length === 0) {
            return NextResponse.json({ error: 'Not friends' }, { status: 403 });
        }

        const units = await db
            .select({
                userId: schema.settings.userId,
                value: schema.settings.value,
            })
            .from(schema.settings)
            .where(
                and(
                    inArray(schema.settings.userId, [userId, friendId]),
                    eq(schema.settings.key, 'weightUnit')
                )
            );

        const unitByUserId = new Map<string, WeightUnit>();
        for (const item of units) {
            unitByUserId.set(item.userId, toWeightUnit(item.value));
        }
        const userUnit = unitByUserId.get(userId) || 'kg';
        const friendUnit = unitByUserId.get(friendId) || 'kg';
        const responseUnit: WeightUnit = userUnit;

        const userWeightExpr = userUnit === 'lbs'
            ? sql`(s.weight * ${KG_PER_LB})`
            : sql`s.weight`;
        const friendWeightExpr = friendUnit === 'lbs'
            ? sql`(s.weight * ${KG_PER_LB})`
            : sql`s.weight`;

        const query = sql`
            WITH UserStats AS (
                SELECT 
                    LOWER(e.name) as exercise_name,
                    MAX(e.name) as display_name,
                    MAX((${userWeightExpr}) * (1.0 + (s.reps / 30.0))) as max_1rm_kg
                FROM workout_sets s
                JOIN exercises e ON s.exercise_id = e.id
                WHERE s.user_id = ${userId} AND s.weight > 0 AND s.reps > 0 AND s.completed = 1 AND s.deleted_at IS NULL
                GROUP BY LOWER(e.name)
            ),
            FriendStats AS (
                SELECT 
                    LOWER(e.name) as exercise_name,
                    MAX(e.name) as display_name,
                    MAX((${friendWeightExpr}) * (1.0 + (s.reps / 30.0))) as max_1rm_kg
                FROM workout_sets s
                JOIN exercises e ON s.exercise_id = e.id
                WHERE s.user_id = ${friendId} AND s.weight > 0 AND s.reps > 0 AND s.completed = 1 AND s.deleted_at IS NULL
                GROUP BY LOWER(e.name)
            )
            SELECT 
                COALESCE(u.display_name, f.display_name) as "exerciseName",
                FLOOR(u.max_1rm_kg) as "user1RMKg",
                FLOOR(f.max_1rm_kg) as "friend1RMKg"
            FROM UserStats u
            JOIN FriendStats f ON u.exercise_name = f.exercise_name
            ORDER BY u.exercise_name ASC;
        `;

        const result = await db.execute(query);
        const rawRows = (result as { rows?: unknown[] }).rows ?? (Array.isArray(result) ? result : []);
        const comparison = rawRows.map((row) => {
            const data = row as Record<string, unknown>;
            const user1RMKg = toSafeNumber(data.user1RMKg);
            const friend1RMKg = toSafeNumber(data.friend1RMKg);
            const convert = responseUnit === 'lbs' ? LB_PER_KG : 1;
            const user1RM = Math.round(user1RMKg * convert);
            const friend1RM = Math.round(friend1RMKg * convert);

            return {
                exerciseName: String(data.exerciseName || 'Ejercicio'),
                user1RM,
                friend1RM,
                unit: responseUnit,
                user1RMKg: Math.round(user1RMKg),
                friend1RMKg: Math.round(friend1RMKg),
                diff: Math.abs(user1RM - friend1RM),
            };
        });

        return NextResponse.json({ success: true, comparison });

    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error'; return NextResponse.json({ error: message }, { status: 500 });
    }
}
