import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '../db/schema';
import { logger } from './logger';

type ScoreConfig = {
    workoutCompletePoints: number;
    extraDayPoints: number;
    extraDayWeeklyCap: number;
    prNormalPoints: number;
    prBig3Points: number;
    adverseWeatherPoints: number;
    weekTier2Min: number;
    weekTier3Min: number;
    weekTier4Min: number;
    tier2Multiplier: number;
    tier3Multiplier: number;
    tier4Multiplier: number;
    coldThresholdC: number;
    weatherBonusEnabled: number;
};

const DEFAULT_SCORE_CONFIG: ScoreConfig = {
    workoutCompletePoints: 20,
    extraDayPoints: 10,
    extraDayWeeklyCap: 2,
    prNormalPoints: 10,
    prBig3Points: 25,
    adverseWeatherPoints: 15,
    weekTier2Min: 3,
    weekTier3Min: 5,
    weekTier4Min: 10,
    tier2Multiplier: 1.1,
    tier3Multiplier: 1.25,
    tier4Multiplier: 1.5,
    coldThresholdC: 3,
    weatherBonusEnabled: 1,
};

function weekStartUtcSeconds(epochSeconds: number): number {
    const d = new Date(epochSeconds * 1000);
    const day = d.getUTCDay();
    const mondayOffset = (day + 6) % 7;
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - mondayOffset);
    return Math.floor(d.getTime() / 1000);
}

function weekKeyFromSeconds(epochSeconds: number): string {
    const start = weekStartUtcSeconds(epochSeconds);
    const d = new Date(start * 1000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function parseTrainingDays(raw: string | null | undefined): number {
    if (!raw) return 3;
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            const valid = parsed.filter((x) => Number.isInteger(x) && x >= 0 && x <= 6);
            return Math.max(1, valid.length);
        }
    } catch { }
    return 3;
}

function resolveStreakMultiplier(cfg: ScoreConfig, streakWeeks: number): number {
    if (streakWeeks >= cfg.weekTier4Min) return cfg.tier4Multiplier;
    if (streakWeeks >= cfg.weekTier3Min) return cfg.tier3Multiplier;
    if (streakWeeks >= cfg.weekTier2Min) return cfg.tier2Multiplier;
    return 1;
}

export async function getOrCreateScoreConfig(trx: any): Promise<ScoreConfig> {
    const [row] = await trx.select().from(schema.socialScoringConfig).where(eq(schema.socialScoringConfig.id, 'default')).limit(1);
    if (row) return row as ScoreConfig;
    await trx.insert(schema.socialScoringConfig).values({ id: 'default' });
    return DEFAULT_SCORE_CONFIG;
}

async function getWeeklyGoalDays(trx: any, userId: string): Promise<number> {
    const [goalSetting] = await trx
        .select({ value: schema.settings.value })
        .from(schema.settings)
        .where(and(eq(schema.settings.userId, userId), eq(schema.settings.key, `${userId}:training_days`)))
        .limit(1);
    return parseTrainingDays(goalSetting?.value);
}

async function getActiveGlobalMultiplier(trx: any, now: Date): Promise<number> {
    const [row] = await trx
        .select({ multiplier: schema.globalEvents.multiplier })
        .from(schema.globalEvents)
        .where(
            and(
                eq(schema.globalEvents.isActive, 1),
                lte(schema.globalEvents.startDate, now),
                gte(schema.globalEvents.endDate, now)
            )
        )
        .orderBy(desc(schema.globalEvents.multiplier))
        .limit(1);
    if (!row?.multiplier || row.multiplier <= 0) return 1;
    return Number(row.multiplier);
}

function isBigThreeExercise(name: string): boolean {
    const n = name.toLowerCase();
    if (n.includes('bench') || n.includes('banca') || n.includes('press banca')) return true;
    if (n.includes('deadlift') || n.includes('peso muerto')) return true;
    if ((n.includes('squat') || n.includes('sentadilla')) && !n.includes('front') && !n.includes('frontal') && !n.includes('hack') && !n.includes('split') && !n.includes('bulgar')) return true;
    return false;
}

export async function isAdverseWeather(lat: number, lon: number, coldThresholdC: number): Promise<{ adverse: boolean; reason: string | null; tempC: number | null }> {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) return { adverse: false, reason: null, tempC: null };
    try {
        const params = new URLSearchParams({
            lat: String(lat),
            lon: String(lon),
            appid: apiKey,
            units: 'metric',
        });
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) return { adverse: false, reason: null, tempC: null };
        const data = await res.json();
        const weatherMain = String(data?.weather?.[0]?.main || '').toLowerCase();
        const tempC = Number(data?.main?.temp);
        if (weatherMain.includes('rain')) return { adverse: true, reason: 'rain', tempC: Number.isFinite(tempC) ? tempC : null };
        if (weatherMain.includes('snow')) return { adverse: true, reason: 'snow', tempC: Number.isFinite(tempC) ? tempC : null };
        if (weatherMain.includes('thunderstorm')) return { adverse: true, reason: 'storm', tempC: Number.isFinite(tempC) ? tempC : null };
        if (Number.isFinite(tempC) && tempC <= coldThresholdC) return { adverse: true, reason: 'cold', tempC };
        return { adverse: false, reason: null, tempC: Number.isFinite(tempC) ? tempC : null };
    } catch {
        return { adverse: false, reason: null, tempC: null };
    }
}

async function ensureStreakState(trx: any, userId: string, workoutDateSeconds: number, cfg: ScoreConfig): Promise<{ streakWeeks: number; multiplier: number }> {
    const [profile] = await trx.select().from(schema.userProfiles).where(eq(schema.userProfiles.id, userId)).limit(1);
    if (!profile) {
        await trx.insert(schema.userProfiles).values({
            id: userId,
            scoreLifetime: 0,
            streakWeeks: 0,
            streakMultiplier: 1,
            currentStreak: 0,
            highestStreak: 0,
            streakWeekEvaluatedAt: weekKeyFromSeconds(workoutDateSeconds),
            updatedAt: new Date(),
        });
        return { streakWeeks: 0, multiplier: 1 };
    }

    const currentWeekKey = weekKeyFromSeconds(workoutDateSeconds);
    if (profile.streakWeekEvaluatedAt === currentWeekKey) {
        const weeks = Number(profile.streakWeeks || 0);
        const multiplier = Number(profile.streakMultiplier || resolveStreakMultiplier(cfg, weeks) || 1);
        return { streakWeeks: weeks, multiplier };
    }

    const previousWeekStart = weekStartUtcSeconds(workoutDateSeconds) - 7 * 86400;
    const previousWeekEnd = previousWeekStart + (7 * 86400) - 1;
    const goalDays = await getWeeklyGoalDays(trx, userId);

    const [countRow] = await trx
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(schema.workouts)
        .where(and(
            eq(schema.workouts.userId, userId),
            eq(schema.workouts.status, 'completed'),
            gte(schema.workouts.date, previousWeekStart),
            lte(schema.workouts.date, previousWeekEnd),
            isNull(schema.workouts.deletedAt)
        ));

    const completedDays = Number(countRow?.count || 0);
    const metGoal = completedDays >= goalDays;
    const nextWeeks = metGoal ? Number(profile.streakWeeks || 0) + 1 : 0;
    const nextMultiplier = resolveStreakMultiplier(cfg, nextWeeks);
    const nextHighest = Math.max(Number(profile.highestStreak || 0), nextWeeks);

    await trx.update(schema.userProfiles).set({
        streakWeeks: nextWeeks,
        streakMultiplier: nextMultiplier,
        currentStreak: nextWeeks,
        highestStreak: nextHighest,
        streakWeekEvaluatedAt: currentWeekKey,
        updatedAt: new Date(),
    }).where(eq(schema.userProfiles.id, userId));

    return { streakWeeks: nextWeeks, multiplier: nextMultiplier };
}

type AwardArgs = {
    trx: any;
    userId: string;
    workoutId: string | null;
    eventType: string;
    eventKey: string;
    pointsBase: number;
    streakMultiplier: number;
    globalMultiplier: number;
    metadata?: Record<string, unknown>;
};

async function awardEvent(args: AwardArgs): Promise<number> {
    const [existing] = await args.trx.select({ id: schema.scoreEvents.id }).from(schema.scoreEvents).where(eq(schema.scoreEvents.eventKey, args.eventKey)).limit(1);
    if (existing) return 0;

    const pointsAwarded = Math.max(0, Math.round(args.pointsBase * args.streakMultiplier * args.globalMultiplier));
    if (pointsAwarded <= 0) return 0;

    await args.trx.insert(schema.scoreEvents).values({
        id: crypto.randomUUID(),
        userId: args.userId,
        workoutId: args.workoutId,
        eventType: args.eventType,
        eventKey: args.eventKey,
        pointsBase: args.pointsBase,
        streakMultiplier: args.streakMultiplier,
        globalMultiplier: args.globalMultiplier,
        pointsAwarded,
        metadata: args.metadata ? JSON.stringify(args.metadata) : null,
    });

    await args.trx
        .update(schema.userProfiles)
        .set({
            scoreLifetime: sql`${schema.userProfiles.scoreLifetime} + ${pointsAwarded}`,
            updatedAt: new Date(),
        })
        .where(eq(schema.userProfiles.id, args.userId));

    return pointsAwarded;
}

export async function applyWorkoutScoring(trx: any, userId: string, workoutId: string): Promise<{ totalAwarded: number }> {
    const [workout] = await trx
        .select()
        .from(schema.workouts)
        .where(and(eq(schema.workouts.id, workoutId), eq(schema.workouts.userId, userId), eq(schema.workouts.status, 'completed'), isNull(schema.workouts.deletedAt)))
        .limit(1);

    if (!workout) return { totalAwarded: 0 };

    logger.info('[Scoring] Applying score', { userId, workoutId });
    const cfg = await getOrCreateScoreConfig(trx).catch(e => {
        logger.captureException(e, { scope: 'social-scoring.getOrCreateScoreConfig', message: '[Scoring] Failed to fetch config, using defaults' });
        return DEFAULT_SCORE_CONFIG;
    });
    const now = new Date();
    let streak;
    try {
        streak = await ensureStreakState(trx, userId, Number(workout.date), cfg);
    } catch (e) {
        logger.captureException(e, { scope: 'social-scoring.ensureStreakState', userId, workoutId });
        // Fallback to minimal streak state to avoid crashing
        streak = { multiplier: 1, currentStreak: 1, highestStreak: 1 };
    }
    let globalMultiplier = 1;
    try {
        globalMultiplier = await getActiveGlobalMultiplier(trx, now);
    } catch (e) {
        logger.captureException(e, { scope: 'social-scoring.getActiveGlobalMultiplier', userId, workoutId });
    }

    let goalDays = 3;
    try {
        goalDays = await getWeeklyGoalDays(trx, userId);
    } catch (e) {
        logger.captureException(e, { scope: 'social-scoring.getWeeklyGoalDays', userId, workoutId });
    }
    let totalAwarded = 0;

    totalAwarded += await awardEvent({
        trx,
        userId,
        workoutId,
        eventType: 'workout_complete',
        eventKey: `workout_complete:${workoutId}`,
        pointsBase: cfg.workoutCompletePoints,
        streakMultiplier: streak.multiplier,
        globalMultiplier,
        metadata: { workoutId },
    });

    const weekStart = weekStartUtcSeconds(Number(workout.date));
    const weekEnd = weekStart + (7 * 86400) - 1;

    const [weekCountRow] = await trx
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(schema.workouts)
        .where(and(
            eq(schema.workouts.userId, userId),
            eq(schema.workouts.status, 'completed'),
            gte(schema.workouts.date, weekStart),
            lte(schema.workouts.date, weekEnd),
            isNull(schema.workouts.deletedAt)
        ));

    const [weekExtraRow] = await trx
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(schema.scoreEvents)
        .where(and(
            eq(schema.scoreEvents.userId, userId),
            eq(schema.scoreEvents.eventType, 'extra_day'),
            gte(schema.scoreEvents.createdAt, new Date(weekStart * 1000)),
            lte(schema.scoreEvents.createdAt, new Date(weekEnd * 1000))
        ));

    const completedThisWeek = Number(weekCountRow?.count || 0);
    const awardedExtraThisWeek = Number(weekExtraRow?.count || 0);

    if (completedThisWeek > goalDays && awardedExtraThisWeek < cfg.extraDayWeeklyCap) {
        totalAwarded += await awardEvent({
            trx,
            userId,
            workoutId,
            eventType: 'extra_day',
            eventKey: `extra_day:${workoutId}`,
            pointsBase: cfg.extraDayPoints,
            streakMultiplier: streak.multiplier,
            globalMultiplier,
            metadata: { workoutId, weekStart, goalDays, completedThisWeek },
        });
    }

    const setRows = await trx
        .select({
            exerciseId: schema.workoutSets.exerciseId,
            exerciseName: schema.exercises.name,
            weight: schema.workoutSets.weight,
            reps: schema.workoutSets.reps,
        })
        .from(schema.workoutSets)
        .innerJoin(schema.exercises, eq(schema.exercises.id, schema.workoutSets.exerciseId))
        .where(and(
            eq(schema.workoutSets.workoutId, workoutId),
            eq(schema.workoutSets.userId, userId),
            eq(schema.workoutSets.completed, 1),
            gte(schema.workoutSets.weight, 0.00001),
            gte(schema.workoutSets.reps, 1),
            or(isNull(schema.workoutSets.type), sql`${schema.workoutSets.type} != 'warmup'`),
            isNull(schema.workoutSets.deletedAt)
        ));

    const bestByExercise = new Map<string, { exerciseName: string; oneRmKg: number }>();
    for (const row of setRows) {
        const exerciseId = String(row.exerciseId);
        const exerciseName = String(row.exerciseName || 'Exercise');
        const weight = Number(row.weight);
        const reps = Number(row.reps);
        if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight <= 0 || reps <= 0) continue;
        const oneRmKg = weight * (1 + (reps / 30));
        if (!Number.isFinite(oneRmKg) || oneRmKg <= 0) continue;
        const prev = bestByExercise.get(exerciseId);
        if (!prev || oneRmKg > prev.oneRmKg) {
            bestByExercise.set(exerciseId, { exerciseName, oneRmKg });
        }
    }

    for (const [exerciseId, cur] of bestByExercise.entries()) {
        const prId = `${userId}:${exerciseId}`;
        const [existingPr] = await trx.select().from(schema.userExercisePrs).where(eq(schema.userExercisePrs.id, prId)).limit(1);
        const oldOneRm = Number(existingPr?.best1RmKg || 0);
        if (cur.oneRmKg <= oldOneRm) continue;

        if (existingPr) {
            await trx.update(schema.userExercisePrs).set({
                exerciseName: cur.exerciseName,
                best1RmKg: cur.oneRmKg,
                updatedAt: new Date(),
            }).where(eq(schema.userExercisePrs.id, prId));
        } else {
            await trx.insert(schema.userExercisePrs).values({
                id: prId,
                userId,
                exerciseId,
                exerciseName: cur.exerciseName,
                best1RmKg: cur.oneRmKg,
            });
        }

        const pointsBase = isBigThreeExercise(cur.exerciseName) ? cfg.prBig3Points : cfg.prNormalPoints;
        totalAwarded += await awardEvent({
            trx,
            userId,
            workoutId,
            eventType: 'pr_break',
            eventKey: `pr:${workoutId}:${exerciseId}`,
            pointsBase,
            streakMultiplier: streak.multiplier,
            globalMultiplier,
            metadata: {
                workoutId,
                exerciseId,
                exerciseName: cur.exerciseName,
                oldOneRmKg: oldOneRm,
                newOneRmKg: cur.oneRmKg,
                isBig3: pointsBase === cfg.prBig3Points,
            },
        });
    }

    if (cfg.weatherBonusEnabled === 1 && Number.isFinite(workout.finishLat) && Number.isFinite(workout.finishLon)) {
        try {
            const weather = await isAdverseWeather(Number(workout.finishLat), Number(workout.finishLon), cfg.coldThresholdC);
            if (weather.adverse) {
                totalAwarded += await awardEvent({
                    trx,
                    userId,
                    workoutId,
                    eventType: 'weather_bonus',
                    eventKey: `weather:${workoutId}`,
                    pointsBase: cfg.adverseWeatherPoints,
                    streakMultiplier: streak.multiplier,
                    globalMultiplier,
                    metadata: {
                        workoutId,
                        lat: Number(workout.finishLat),
                        lon: Number(workout.finishLon),
                        reason: weather.reason,
                        tempC: weather.tempC,
                    },
                });
            }
        } catch (e) {
            logger.captureException(e, { scope: 'social-scoring.weatherCheck', userId, workoutId, message: '[Scoring] Weather check failed for workout, skipping' });
        }
    }

    return { totalAwarded };
}

export async function revertWorkoutScoring(trx: any, userId: string, workoutId: string): Promise<{ totalReverted: number }> {
    logger.info('[Scoring] Reverting score', { userId, workoutId });

    // 1. Find all score events for this workout
    const events = await trx
        .select({
            id: schema.scoreEvents.id,
            pointsAwarded: schema.scoreEvents.pointsAwarded,
            eventType: schema.scoreEvents.eventType,
            eventKey: schema.scoreEvents.eventKey
        })
        .from(schema.scoreEvents)
        .where(and(
            eq(schema.scoreEvents.userId, userId),
            eq(schema.scoreEvents.workoutId, workoutId)
        ));

    if (events.length === 0) return { totalReverted: 0 };

    const totalPoints = events.reduce((sum: number, e: any) => sum + (e.pointsAwarded || 0), 0);

    // 2. Subtract from user profile (ensure we don't go below 0)
    await trx
        .update(schema.userProfiles)
        .set({
            scoreLifetime: sql`GREATEST(0, ${schema.userProfiles.scoreLifetime} - ${totalPoints})`,
            updatedAt: new Date(),
        })
        .where(eq(schema.userProfiles.id, userId));

    // 3. Revert PR records if necessary
    const prEvents = events.filter((e: any) => e.eventType === 'pr_break');
    for (const event of prEvents) {
        // eventKey format: pr:${workoutId}:${exerciseId}
        const parts = (event as any).eventKey?.split(':');
        const exerciseId = parts?.[2];
        if (!exerciseId) continue;

        const prId = `${userId}:${exerciseId}`;

        // Find the next best 1RM (excluding this workout)
        const [nextBest] = await trx
            .select({
                oneRm: sql<number>`${schema.workoutSets.weight} * (1.0 + (${schema.workoutSets.reps} / 30.0))`.mapWith(Number),
                exerciseName: schema.exercises.name
            })
            .from(schema.workoutSets)
            .innerJoin(schema.workouts, eq(schema.workouts.id, schema.workoutSets.workoutId))
            .innerJoin(schema.exercises, eq(schema.exercises.id, schema.workoutSets.exerciseId))
            .where(and(
                eq(schema.workoutSets.userId, userId),
                eq(schema.workoutSets.exerciseId, exerciseId),
                eq(schema.workoutSets.completed, 1),
                eq(schema.workouts.status, 'completed'),
                isNull(schema.workouts.deletedAt),
                isNull(schema.workoutSets.deletedAt),
                sql`${schema.workouts.id} != ${workoutId}`,
                sql`${schema.workoutSets.weight} > 0`,
                sql`${schema.workoutSets.reps} > 0`,
                or(isNull(schema.workoutSets.type), sql`${schema.workoutSets.type} != 'warmup'`)
            ))
            .orderBy(desc(sql`${schema.workoutSets.weight} * (1.0 + (${schema.workoutSets.reps} / 30.0))`))
            .limit(1);

        if (nextBest) {
            await trx.update(schema.userExercisePrs)
                .set({
                    best1RmKg: nextBest.oneRm,
                    exerciseName: nextBest.exerciseName,
                    updatedAt: new Date(),
                })
                .where(eq(schema.userExercisePrs.id, prId));
        } else {
            // No other PRs for this exercise, delete the PR record
            await trx.delete(schema.userExercisePrs).where(eq(schema.userExercisePrs.id, prId));
        }
    }

    // 4. Delete the score events to allow re-awarding later
    await trx
        .delete(schema.scoreEvents)
        .where(and(
            eq(schema.scoreEvents.userId, userId),
            eq(schema.scoreEvents.workoutId, workoutId)
        ));

    return { totalReverted: totalPoints };
}

export async function buildLeaderboard(userId: string) {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const monthAgo = new Date(now.getTime() - 30 * 86400000);

    const records = await db.select().from(schema.friendships).where(
        and(
            or(eq(schema.friendships.userId, userId), eq(schema.friendships.friendId, userId)),
            eq(schema.friendships.status, 'accepted'),
            isNull(schema.friendships.deletedAt)
        )
    );

    const friendIds = records.map((r) => r.userId === userId ? r.friendId : r.userId);
    const userIds = [...new Set([userId, ...friendIds])];
    if (userIds.length === 0) return [];

    const [profiles, monthScores, weekScores, workoutsLife, workoutsMonth, workoutsWeek] = await Promise.all([
        db.select().from(schema.userProfiles).where(inArray(schema.userProfiles.id, userIds)),
        db.select({
            userId: schema.scoreEvents.userId,
            total: sql<number>`coalesce(sum(${schema.scoreEvents.pointsAwarded}), 0)`.mapWith(Number),
        }).from(schema.scoreEvents).where(and(inArray(schema.scoreEvents.userId, userIds), gte(schema.scoreEvents.createdAt, monthAgo))).groupBy(schema.scoreEvents.userId),
        db.select({
            userId: schema.scoreEvents.userId,
            total: sql<number>`coalesce(sum(${schema.scoreEvents.pointsAwarded}), 0)`.mapWith(Number),
        }).from(schema.scoreEvents).where(and(inArray(schema.scoreEvents.userId, userIds), gte(schema.scoreEvents.createdAt, weekAgo))).groupBy(schema.scoreEvents.userId),
        db.select({
            userId: schema.workouts.userId,
            total: sql<number>`count(*)`.mapWith(Number),
        }).from(schema.workouts).where(and(inArray(schema.workouts.userId, userIds), eq(schema.workouts.status, 'completed'), isNull(schema.workouts.deletedAt))).groupBy(schema.workouts.userId),
        db.select({
            userId: schema.workouts.userId,
            total: sql<number>`count(*)`.mapWith(Number),
        }).from(schema.workouts).where(and(inArray(schema.workouts.userId, userIds), eq(schema.workouts.status, 'completed'), isNull(schema.workouts.deletedAt), gte(schema.workouts.date, Math.floor(monthAgo.getTime() / 1000)))).groupBy(schema.workouts.userId),
        db.select({
            userId: schema.workouts.userId,
            total: sql<number>`count(*)`.mapWith(Number),
        }).from(schema.workouts).where(and(inArray(schema.workouts.userId, userIds), eq(schema.workouts.status, 'completed'), isNull(schema.workouts.deletedAt), gte(schema.workouts.date, Math.floor(weekAgo.getTime() / 1000)))).groupBy(schema.workouts.userId),
    ]);

    const profileMap = new Map(profiles.map((p) => [p.id, p]));
    const monthMap = new Map(monthScores.map((r) => [r.userId, r.total]));
    const weekMap = new Map(weekScores.map((r) => [r.userId, r.total]));
    const wLifeMap = new Map(workoutsLife.map((r) => [r.userId, r.total]));
    const wMonthMap = new Map(workoutsMonth.map((r) => [r.userId, r.total]));
    const wWeekMap = new Map(workoutsWeek.map((r) => [r.userId, r.total]));

    const leaderboard = userIds.map((id) => {
        const p = profileMap.get(id);
        return {
            id,
            displayName: p?.displayName || 'Unknown',
            scores: {
                lifetime: Number(p?.scoreLifetime || 0),
                monthly: Number(monthMap.get(id) || 0),
                weekly: Number(weekMap.get(id) || 0),
            },
            stats: {
                workoutsLifetime: Number(wLifeMap.get(id) || 0),
                workoutsMonthly: Number(wMonthMap.get(id) || 0),
                workoutsWeekly: Number(wWeekMap.get(id) || 0),
                routines: 0,
                shares: Number(p?.shareStats || 0),
                currentStreak: Number(p?.streakWeeks || p?.currentStreak || 0),
                highestStreak: Number(p?.highestStreak || 0),
            },
        };
    });

    leaderboard.sort((a, b) => b.scores.lifetime - a.scores.lifetime || b.stats.workoutsLifetime - a.stats.workoutsLifetime);
    return leaderboard;
}
