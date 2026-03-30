import { and, eq, isNull, or } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';
import { runDbTransaction } from '../../../../src/lib/db-transaction';
import { setDbUserContext } from '../../../../src/lib/db-user-context';
import { RATE_LIMITS } from '../../../../src/lib/rate-limit';

export const runtime = 'nodejs';

function normalizeHeaders(req: NextRequest) {
    const requestedWith = req.headers.get('x-requested-with');
    const isFromOurApp = req.headers.get('user-agent')?.includes('IronTrain');
    return { requestedWith, isFromOurApp };
}

export async function GET(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { requestedWith, isFromOurApp } = normalizeHeaders(req);
        if (!requestedWith && !isFromOurApp) {
            return NextResponse.json({ error: 'Forbidden: Missing X-Requested-With header' }, { status: 403 });
        }

        const rateLimit = await RATE_LIMITS.SYNC_SNAPSHOT(userId);
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

        const [
            categories,
            exercises,
            workouts,
            workoutSets,
            routines,
            routineDays,
            routineExercises,
            measurements,
            goals,
            bodyMetrics,
            plateInventory,
            settingsRows,
            badges,
            exerciseBadges,
            changelogReactions,
            kudos,
            userProfiles,
            activityFeed,
            friendships,
            sharesInbox,
            scoreEvents,
            userExercisePrs,
            weatherLogs,
            notificationReactions,
            activitySeen,
        ] = await runDbTransaction(async (trx) => {
            await setDbUserContext(trx, userId);
            return Promise.all([
                trx.select().from(schema.categories).where(eq(schema.categories.userId, userId)),
                trx.select().from(schema.exercises).where(eq(schema.exercises.userId, userId)),
                trx.select().from(schema.workouts).where(eq(schema.workouts.userId, userId)),
                trx.select().from(schema.workoutSets).where(eq(schema.workoutSets.userId, userId)),
                trx.select().from(schema.routines).where(eq(schema.routines.userId, userId)),
                trx.select().from(schema.routineDays).where(eq(schema.routineDays.userId, userId)),
                trx.select().from(schema.routineExercises).where(eq(schema.routineExercises.userId, userId)),
                trx.select().from(schema.measurements).where(eq(schema.measurements.userId, userId)),
                trx.select().from(schema.goals).where(eq(schema.goals.userId, userId)),
                trx.select().from(schema.bodyMetrics).where(eq(schema.bodyMetrics.userId, userId)),
                trx.select().from(schema.plateInventory).where(eq(schema.plateInventory.userId, userId)),
                trx.select().from(schema.settings).where(eq(schema.settings.userId, userId)),
                trx.select().from(schema.badges).where(eq(schema.badges.userId, userId)),
                trx.select().from(schema.exerciseBadges).where(eq(schema.exerciseBadges.userId, userId)),
                trx.select().from(schema.changelogReactions).where(eq(schema.changelogReactions.userId, userId)),
                trx.select().from(schema.kudos).where(eq(schema.kudos.giverId, userId)),
                trx.select().from(schema.userProfiles).where(eq(schema.userProfiles.id, userId)),
                trx.select().from(schema.activityFeed).where(eq(schema.activityFeed.userId, userId)),
                trx.select().from(schema.friendships).where(or(eq(schema.friendships.userId, userId), eq(schema.friendships.friendId, userId))),
                trx.select().from(schema.sharesInbox).where(or(eq(schema.sharesInbox.senderId, userId), eq(schema.sharesInbox.receiverId, userId))),
                trx.select().from(schema.scoreEvents).where(eq(schema.scoreEvents.userId, userId)),
                trx.select().from(schema.userExercisePrs).where(eq(schema.userExercisePrs.userId, userId)),
                trx.select().from(schema.weatherLogs).where(and(eq(schema.weatherLogs.userId, userId), isNull(schema.weatherLogs.deletedAt))),
                trx.select().from(schema.notificationReactions).where(eq(schema.notificationReactions.userId, userId)),
                trx.select().from(schema.activitySeen).where(eq(schema.activitySeen.userId, userId)),
            ]);
        });

        const payload = {
            exportedAt: new Date().toISOString(),
            userId,
            data: {
                userProfiles,
                categories,
                exercises,
                workouts,
                workoutSets,
                routines,
                routineDays,
                routineExercises,
                measurements,
                goals,
                bodyMetrics,
                plateInventory,
                settingsRows,
                badges,
                exerciseBadges,
                changelogReactions,
                kudos,
                activityFeed,
                friendships,
                sharesInbox,
                scoreEvents,
                userExercisePrs,
                weatherLogs,
                notificationReactions,
                activitySeen,
            },
            summary: {
                categories: categories.length,
                exercises: exercises.length,
                workouts: workouts.length,
                workoutSets: workoutSets.length,
                routines: routines.length,
                routineDays: routineDays.length,
                routineExercises: routineExercises.length,
                measurements: measurements.length,
                goals: goals.length,
                bodyMetrics: bodyMetrics.length,
                plateInventory: plateInventory.length,
                settingsRows: settingsRows.length,
                badges: badges.length,
                exerciseBadges: exerciseBadges.length,
                changelogReactions: changelogReactions.length,
                kudos: kudos.length,
                activityFeed: activityFeed.length,
                friendships: friendships.length,
                sharesInbox: sharesInbox.length,
                scoreEvents: scoreEvents.length,
                userExercisePrs: userExercisePrs.length,
                weatherLogs: weatherLogs.length,
                notificationReactions: notificationReactions.length,
                activitySeen: activitySeen.length,
            },
        };

        const fileName = `irontrain_privacy_export_${userId}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

        return new NextResponse(JSON.stringify(payload, null, 2), {
            status: 200,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
