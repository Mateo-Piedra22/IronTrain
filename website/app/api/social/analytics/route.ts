import { and, count, eq, isNull, or } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';

interface IronScoreResult {
    score: number;
    workouts: number;
    routines: number;
    shares: number;
    displayName: string;
    id: string;
}

async function calculateIronScore(userId: string): Promise<IronScoreResult> {
    // Score Formula:
    // - 10 points per workout session
    // - 5 points per routine created
    // - 20 points per routine shared

    const [workoutsResult, routinesResult, profileResult] = await Promise.all([
        db.select({ count: count(schema.workouts.id) })
            .from(schema.workouts)
            .where(and(eq(schema.workouts.userId, userId), isNull(schema.workouts.deletedAt))),
        db.select({ count: count(schema.routines.id) })
            .from(schema.routines)
            .where(and(eq(schema.routines.userId, userId), isNull(schema.routines.deletedAt))),
        db.select().from(schema.userProfiles).where(eq(schema.userProfiles.id, userId)),
    ]);

    const workoutsCount = workoutsResult[0]?.count || 0;
    const routinesCount = routinesResult[0]?.count || 0;
    const shareStats = profileResult[0]?.shareStats || 0;

    const totalScore = (workoutsCount * 10) + (routinesCount * 5) + (shareStats * 20);

    return {
        score: totalScore,
        workouts: workoutsCount,
        routines: routinesCount,
        shares: shareStats,
        displayName: profileResult[0]?.displayName || 'Unknown',
        id: userId,
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
        const leaderboard = await Promise.all(usersToAnalyze.map(id => calculateIronScore(id)));

        // Sort descending by score, tie-break by workouts
        leaderboard.sort((a, b) => b.score - a.score || b.workouts - a.workouts);

        return NextResponse.json({ success: true, leaderboard });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
