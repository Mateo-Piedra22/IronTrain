import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { and, asc, eq, isNull } from 'drizzle-orm';
import * as schema from '../src/db/schema';

function weekStartUtcSeconds(epochTimestamp: number): number {
    const epochSeconds = epochTimestamp > 10000000000 ? Math.floor(epochTimestamp / 1000) : epochTimestamp;
    const d = new Date(epochSeconds * 1000);
    const day = d.getUTCDay();
    const mondayOffset = (day + 6) % 7;
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - mondayOffset);
    return Math.floor(d.getTime() / 1000);
}

function weekKeyFromSeconds(epochTimestamp: number): string {
    const epochSeconds = epochTimestamp > 10000000000 ? Math.floor(epochTimestamp / 1000) : epochTimestamp;
    const start = weekStartUtcSeconds(epochSeconds);
    const d = new Date(start * 1000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function resolveStreakMultiplier(weeks: number): number {
    if (weeks >= 10) return 1.5; // tier 4
    if (weeks >= 5) return 1.25; // tier 3
    if (weeks >= 3) return 1.1; // tier 2
    return 1;
}

async function fixAllStreaks() {
    const { db } = await import('../src/db');
    console.log("Starting global streak fix and rescore...");
    const users = await db.select().from(schema.userProfiles);
    let fixedProfiles = 0;

    for (const user of users) {
        console.log(`Processing user: ${user.username || user.id}`);

        // 1. Get weekly goal days
        const [goalSetting] = await db
            .select({ value: schema.settings.value })
            .from(schema.settings)
            .where(and(eq(schema.settings.userId, user.id), eq(schema.settings.key, `${user.id}:training_days`)))
            .limit(1);

        let goalDays = 3;
        try {
            if (goalSetting?.value) {
                const parsed = JSON.parse(goalSetting.value);
                if (Array.isArray(parsed)) goalDays = Math.max(1, parsed.filter(x => Number.isInteger(x) && x >= 0 && x <= 6).length);
            }
        } catch (e) { }

        // 2. Load workouts chronologically
        const workouts = await db.select().from(schema.workouts)
            .where(and(eq(schema.workouts.userId, user.id), eq(schema.workouts.status, 'completed'), isNull(schema.workouts.deletedAt)))
            .orderBy(asc(schema.workouts.date));

        if (workouts.length === 0) {
            console.log(`  No workouts found. Expected State: Streak 0, Score 0.`);
            await db.update(schema.userProfiles).set({
                currentStreak: 0,
                highestStreak: 0,
                streakWeeks: 0,
                streakMultiplier: 1,
                streakWeekEvaluatedAt: null,
                scoreLifetime: 0
            }).where(eq(schema.userProfiles.id, user.id));
            continue;
        }

        // 3. Calculate chronological streak
        let currentStreakWeeks = 0;
        let highestStreak = 0;

        const weeklyWorkouts = new Map<number, Set<number>>(); // weekStartTs -> Set of unique days
        const workoutToMultiplier = new Map<string, number>();

        for (const w of workouts) {
            const timestampMs = Number(w.date);
            const dayId = Math.floor(timestampMs / 86400000); // UTC day integer
            const weekStart = weekStartUtcSeconds(timestampMs);

            if (!weeklyWorkouts.has(weekStart)) {
                weeklyWorkouts.set(weekStart, new Set());
            }
            weeklyWorkouts.get(weekStart)!.add(dayId);
        }

        const sortedWeeks = Array.from(weeklyWorkouts.keys()).sort((a, b) => a - b);
        let expectedNextWeek = -1;
        let latestEvaluatedWeekKey = null;

        for (const weekStart of sortedWeeks) {
            // Did they miss a week entirely?
            if (expectedNextWeek !== -1 && weekStart > expectedNextWeek) {
                currentStreakWeeks = 0;
            }

            // Validate the week's goal
            const daysTrained = weeklyWorkouts.get(weekStart)!.size;
            if (daysTrained >= goalDays) {
                currentStreakWeeks++;
                highestStreak = Math.max(highestStreak, currentStreakWeeks);
            } else {
                currentStreakWeeks = 0; // Broke streak by missing goal count
            }

            // The multiplier for events happening internally in this week
            const stringMultiplier = resolveStreakMultiplier(currentStreakWeeks);
            for (const w of workouts) {
                if (weekStartUtcSeconds(Number(w.date)) === weekStart) {
                    workoutToMultiplier.set(w.id, stringMultiplier);
                }
            }

            expectedNextWeek = weekStart + (7 * 86400); // 1 week later in seconds
            latestEvaluatedWeekKey = weekKeyFromSeconds(weekStart * 1000);
        }

        // 4. Update score events
        const scoreEvents = await db.select().from(schema.scoreEvents).where(and(eq(schema.scoreEvents.userId, user.id), isNull(schema.scoreEvents.deletedAt)));
        let totalScoreLifetime = 0;

        for (const ev of scoreEvents) {
            let mult = 1;

            if (ev.workoutId && workoutToMultiplier.has(ev.workoutId)) {
                mult = workoutToMultiplier.get(ev.workoutId)!;
            } else if (ev.eventKey && ev.eventKey.includes(':')) {
                const parts = ev.eventKey.split(':');
                if (parts.length > 1 && workoutToMultiplier.has(parts[1])) {
                    mult = workoutToMultiplier.get(parts[1])!;
                }
            }

            const pointsAwarded = Math.max(0, Math.round(Number(ev.pointsBase) * mult * Number(ev.globalMultiplier)));
            totalScoreLifetime += pointsAwarded;

            if (Number(ev.streakMultiplier) !== mult || Number(ev.pointsAwarded) !== pointsAwarded) {
                await db.update(schema.scoreEvents).set({
                    streakMultiplier: mult,
                    pointsAwarded: pointsAwarded,
                    updatedAt: new Date()
                }).where(eq(schema.scoreEvents.id, ev.id));
            }
        }

        // 5. Finalize user profile
        const activeMultiplier = resolveStreakMultiplier(currentStreakWeeks);
        await db.update(schema.userProfiles).set({
            currentStreak: currentStreakWeeks,
            streakWeeks: currentStreakWeeks,
            highestStreak: highestStreak,
            streakMultiplier: activeMultiplier,
            streakWeekEvaluatedAt: latestEvaluatedWeekKey,
            scoreLifetime: totalScoreLifetime,
            updatedAt: new Date()
        }).where(eq(schema.userProfiles.id, user.id));

        console.log(`  -> Final State: Streak=${currentStreakWeeks}, Highest=${highestStreak}, Mult=${activeMultiplier}, Score=${totalScoreLifetime}`);
        fixedProfiles++;
    }

    console.log(`Global streak fix completed successfully. Profiles Processed: ${fixedProfiles}`);
    process.exit(0);
}

fixAllStreaks().catch((e) => {
    console.error(e);
    process.exit(1);
});
