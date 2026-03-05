import { and, count, eq, gte, isNull, or } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';

interface IronScoreResult {
    id: string;
    displayName: string;
    scores: {
        lifetime: number;
        monthly: number;
        weekly: number;
    };
    stats: {
        workoutsLifetime: number;
        workoutsMonthly: number;
        workoutsWeekly: number;
        routines: number;
        shares: number;
        currentStreak: number;
        highestStreak: number;
    };
}

async function calculateIronScores(userId: string): Promise<IronScoreResult> {
    const nowSecs = Math.floor(Date.now() / 1000);
    const startOfWeek = nowSecs - (7 * 24 * 60 * 60);
    const startOfMonth = nowSecs - (30 * 24 * 60 * 60);

    const [wLifeRes, wMonthRes, wWeekRes, rotRes, profRes] = await Promise.all([
        db.select({ count: count(schema.workouts.id) }).from(schema.workouts)
            .where(and(eq(schema.workouts.userId, userId), isNull(schema.workouts.deletedAt))),
        db.select({ count: count(schema.workouts.id) }).from(schema.workouts)
            .where(and(eq(schema.workouts.userId, userId), gte(schema.workouts.date, startOfMonth), isNull(schema.workouts.deletedAt))),
        db.select({ count: count(schema.workouts.id) }).from(schema.workouts)
            .where(and(eq(schema.workouts.userId, userId), gte(schema.workouts.date, startOfWeek), isNull(schema.workouts.deletedAt))),
        db.select({ count: count(schema.routines.id) }).from(schema.routines)
            .where(and(eq(schema.routines.userId, userId), isNull(schema.routines.deletedAt))),
        db.select().from(schema.userProfiles).where(eq(schema.userProfiles.id, userId)),
    ]);

    const wLife = wLifeRes[0]?.count || 0;
    const wMonth = wMonthRes[0]?.count || 0;
    const wWeek = wWeekRes[0]?.count || 0;
    const rLife = rotRes[0]?.count || 0;

    const profile = profRes[0] || {};
    const shareStats = profile.shareStats || 0;
    const currentStreak = profile.currentStreak || 0;
    const highestStreak = profile.highestStreak || 0;

    // A.3 Multiplier system based on streaks
    let streakMultiplier = 1.0;
    if (currentStreak >= 10) streakMultiplier = 1.5;
    else if (currentStreak >= 5) streakMultiplier = 1.25;
    else if (currentStreak >= 3) streakMultiplier = 1.1;

    // Score formulas
    // Lifetime: All workouts + routines + shares
    const lifetimeScore = Math.floor(((wLife * 10) + (rLife * 5) + (shareStats * 20)) * streakMultiplier);
    // Monthly: Workouts in last 30d (approx routines + shares logic mapped to workouts for simplicity)
    const monthlyScore = Math.floor((wMonth * 10) * streakMultiplier);
    // Weekly: Workouts in last 7d
    const weeklyScore = Math.floor((wWeek * 10) * streakMultiplier);

    return {
        id: userId,
        displayName: profile.displayName || 'Unknown',
        scores: {
            lifetime: lifetimeScore,
            monthly: monthlyScore,
            weekly: weeklyScore,
        },
        stats: {
            workoutsLifetime: wLife,
            workoutsMonthly: wMonth,
            workoutsWeekly: wWeek,
            routines: rLife,
            shares: shareStats,
            currentStreak,
            highestStreak,
        }
    };
}

export async function GET(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Get accepted friends
        const records = await db.select().from(schema.friendships).where(
            and(
                or(eq(schema.friendships.userId, userId), eq(schema.friendships.friendId, userId)),
                eq(schema.friendships.status, 'accepted'),
                isNull(schema.friendships.deletedAt)
            )
        );

        const friendIds = records.map(r => r.userId === userId ? r.friendId : r.userId);
        const usersToAnalyze = [userId, ...friendIds];

        // Calculate scores concurrently
        const leaderboard = await Promise.all(usersToAnalyze.map(id => calculateIronScores(id)));

        // Default sort by lifetime score descending
        leaderboard.sort((a, b) => b.scores.lifetime - a.scores.lifetime || b.stats.workoutsLifetime - a.stats.workoutsLifetime);

        return NextResponse.json({ success: true, leaderboard });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
