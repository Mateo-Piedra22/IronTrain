import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';
import { RATE_LIMITS } from '../../../../src/lib/rate-limit';

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

        const rateLimit = await RATE_LIMITS.SOCIAL_COMPARE(userId);
        if (!rateLimit.ok) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(Math.ceil((rateLimit.resetAtMs - Date.now()) / 1000)),
                    },
                }
            );
        }

        const { searchParams } = new URL(req.url);
        const friendId = searchParams.get('friendId');

        if (!friendId) return NextResponse.json({ error: 'Missing friendId' }, { status: 400 });

        // Ensure friendship
        const [directFriendship, reverseFriendship] = await Promise.all([
            db.select({ id: schema.friendships.id })
                .from(schema.friendships)
                .where(
                    and(
                        eq(schema.friendships.userId, userId),
                        eq(schema.friendships.friendId, friendId),
                        eq(schema.friendships.status, 'accepted'),
                        isNull(schema.friendships.deletedAt)
                    )
                )
                .limit(1),
            db.select({ id: schema.friendships.id })
                .from(schema.friendships)
                .where(
                    and(
                        eq(schema.friendships.userId, friendId),
                        eq(schema.friendships.friendId, userId),
                        eq(schema.friendships.status, 'accepted'),
                        isNull(schema.friendships.deletedAt)
                    )
                )
                .limit(1),
        ]);

        const isFriend = directFriendship.length > 0 || reverseFriendship.length > 0;

        if (!isFriend) {
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
        const userWeightToKgFactor = userUnit === 'lbs' ? KG_PER_LB : 1;
        const friendWeightToKgFactor = friendUnit === 'lbs' ? KG_PER_LB : 1;

        const query = sql`
            WITH exercise_badges_map AS (
                SELECT
                    eb.exercise_id,
                    STRING_AGG(b.name, ', ' ORDER BY b.name) AS badge_names
                FROM exercise_badges eb
                JOIN badges b ON eb.badge_id = b.id
                WHERE eb.deleted_at IS NULL AND b.deleted_at IS NULL
                GROUP BY eb.exercise_id
            ),
            user_raw AS (
                SELECT
                    s.exercise_id,
                    LOWER(e.name) AS exercise_name,
                    MAX(e.name) AS display_name,
                    MAX(
                        (s.weight * ${userWeightToKgFactor}) * (1.0 + (s.reps / 30.0))
                    ) AS max_1rm_kg
                FROM workout_sets s
                JOIN exercises e ON s.exercise_id = e.id
                WHERE s.user_id = ${userId}
                  AND s.weight > 0
                  AND s.reps > 0
                  AND s.completed = 1
                  AND s.deleted_at IS NULL
                GROUP BY s.exercise_id, LOWER(e.name)
            ),
            friend_raw AS (
                SELECT
                    s.exercise_id,
                    LOWER(e.name) AS exercise_name,
                    MAX(e.name) AS display_name,
                    MAX(
                        (s.weight * ${friendWeightToKgFactor}) * (1.0 + (s.reps / 30.0))
                    ) AS max_1rm_kg
                FROM workout_sets s
                JOIN exercises e ON s.exercise_id = e.id
                WHERE s.user_id = ${friendId}
                  AND s.weight > 0
                  AND s.reps > 0
                  AND s.completed = 1
                  AND s.deleted_at IS NULL
                GROUP BY s.exercise_id, LOWER(e.name)
            ),
            UserStats AS (
                SELECT
                    ur.exercise_name,
                    ur.display_name,
                    ur.max_1rm_kg,
                    ebm.badge_names
                FROM user_raw ur
                LEFT JOIN exercise_badges_map ebm ON ebm.exercise_id = ur.exercise_id
            ),
            FriendStats AS (
                SELECT
                    fr.exercise_name,
                    fr.display_name,
                    fr.max_1rm_kg,
                    ebm.badge_names
                FROM friend_raw fr
                LEFT JOIN exercise_badges_map ebm ON ebm.exercise_id = fr.exercise_id
            )
            SELECT
                COALESCE(u.display_name, f.display_name) AS "exerciseName",
                COALESCE(u.badge_names, '') AS "badgeNames",
                FLOOR(u.max_1rm_kg) AS "user1RMKg",
                FLOOR(f.max_1rm_kg) AS "friend1RMKg"
            FROM UserStats u
            JOIN FriendStats f
              ON u.exercise_name = f.exercise_name
             AND COALESCE(u.badge_names, '') = COALESCE(f.badge_names, '')
            ORDER BY u.exercise_name ASC, COALESCE(u.badge_names, '') ASC;
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

            const baseName = String(data.exerciseName || 'Ejercicio');
            const badgesText = data.badgeNames ? ` (${data.badgeNames})` : '';

            return {
                exerciseName: `${baseName}${badgesText}`,
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
