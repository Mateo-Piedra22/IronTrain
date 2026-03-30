import crypto from 'crypto';
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
    heatThresholdC: number;
    weatherBonusEnabled: boolean;
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
    heatThresholdC: 33,
    weatherBonusEnabled: true,
};

type ScoreExecutor = Pick<typeof db, 'select' | 'insert' | 'update' | 'delete'>;

type OpenWeatherResponse = {
    weather?: Array<{ main?: unknown }>;
    main?: { temp?: unknown; humidity?: unknown };
    wind?: { speed?: unknown };
};

function weekStartUtcSeconds(epochTimestamp: number): number {
    // Robustly handle both seconds and milliseconds (if > year 2286 in seconds, assume ms)
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

function weekStartSecondsFromWeekKey(weekKey: string | null | undefined): number | null {
    if (!weekKey || typeof weekKey !== 'string') return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekKey.trim());
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

    const ms = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
    if (!Number.isFinite(ms)) return null;
    return Math.floor(ms / 1000);
}

function previousWeekKey(weekKey: string): string {
    const startSeconds = weekStartSecondsFromWeekKey(weekKey);
    if (!Number.isFinite(startSeconds)) return weekKey;
    return weekKeyFromSeconds((startSeconds as number) - (7 * 86400));
}

export function calculateConsecutiveWeeklyStreakFromMap(
    weeklyCompletions: Record<string, number>,
    goalDays: number,
    currentWeekKey: string,
    maxLookbackWeeks: number = 52
): number {
    const normalizedGoalDays = Math.max(1, Math.floor(goalDays));
    const lookback = Math.max(1, Math.floor(maxLookbackWeeks));
    let cursor = previousWeekKey(currentWeekKey);
    let streakWeeks = 0;

    for (let i = 0; i < lookback; i++) {
        const completed = Number(weeklyCompletions[cursor] || 0);
        if (completed >= normalizedGoalDays) {
            streakWeeks += 1;
            cursor = previousWeekKey(cursor);
            continue;
        }
        break;
    }

    return streakWeeks;
}

function parseTrainingDays(raw: string | null | undefined): number[] {
    if (!raw) return [1, 2, 3, 4, 5]; // Default workdays
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed.filter((x) => Number.isInteger(x) && x >= 0 && x <= 6);
        }
    } catch { }
    return [1, 2, 3, 4, 5];
}

function resolveStreakMultiplier(cfg: ScoreConfig, streakWeeks: number): number {
    if (streakWeeks >= cfg.weekTier4Min) return cfg.tier4Multiplier;
    if (streakWeeks >= cfg.weekTier3Min) return cfg.tier3Multiplier;
    if (streakWeeks >= cfg.weekTier2Min) return cfg.tier2Multiplier;
    return 1;
}

export async function getOrCreateScoreConfig(trx: ScoreExecutor): Promise<ScoreConfig> {
    const [row] = await trx.select().from(schema.socialScoringConfig).where(eq(schema.socialScoringConfig.id, 'default')).limit(1);
    if (row) return row as ScoreConfig;
    await trx.insert(schema.socialScoringConfig).values({ id: 'default' });
    return DEFAULT_SCORE_CONFIG;
}

async function getWeeklyGoalDays(trx: ScoreExecutor, userId: string): Promise<number[]> {
    const [goalSetting] = await trx
        .select({ value: schema.settings.value })
        .from(schema.settings)
        .where(and(eq(schema.settings.userId, userId), eq(schema.settings.key, `${userId}:training_days`)))
        .limit(1);
    return parseTrainingDays(goalSetting?.value);
}

async function calculateDailyStreak(trx: ScoreExecutor, userId: string, trainingDays: number[], limit: number = 365): Promise<number> {
    const workoutDayExpr = sql`date_trunc('day', to_timestamp(${schema.workouts.date} / 1000.0) at time zone 'UTC')`;
    // OPTIMIZATION: Instead of fetching all workouts and processing in JS,
    // we use SQL to get unique training days in descending order.
    const workoutDays = await trx
        .select({
            dateStr: sql<string>`to_char(${workoutDayExpr}, 'YYYY-MM-DD')`
        })
        .from(schema.workouts)
        .where(and(
            eq(schema.workouts.userId, userId),
            eq(schema.workouts.status, 'completed'),
            isNull(schema.workouts.deletedAt)
        ))
        .groupBy(workoutDayExpr)
        .orderBy(desc(workoutDayExpr))
        .limit(limit);

    if (workoutDays.length === 0) return 0;

    const uniqueDays = new Set(workoutDays.map((w) => w.dateStr));
    const sortedDays = workoutDays.map((w) => w.dateStr);
    
    let streak = 0;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const latestWorkoutStr = sortedDays[0];

    // If the latest workout wasn't today, check if the streak is already broken
    if (latestWorkoutStr < todayStr) {
        const check = new Date(todayStr + 'T12:00:00Z');
        check.setUTCDate(check.getUTCDate() - 1);
        while (check.toISOString().split('T')[0] > latestWorkoutStr) {
            if (trainingDays.includes(check.getUTCDay())) {
                return 0; // Streak broken because a training day was missed
            }
            check.setUTCDate(check.getUTCDate() - 1);
        }
    }

    const checkDate = new Date(latestWorkoutStr + 'T12:00:00Z');
    while (streak < limit) {
        const dateStr = checkDate.toISOString().split('T')[0];
        const dayOfWeek = checkDate.getUTCDay();

        if (uniqueDays.has(dateStr)) {
            streak++;
        } else if (trainingDays.includes(dayOfWeek)) {
            break; // Training day missed, streak ends here
        }

        checkDate.setUTCDate(checkDate.getUTCDate() - 1);
    }

    return streak;
}

/**
 * Checks if a streak is broken between two dates relative to training days.
 * Returns true if at least one training day was missed between start and end.
 */
function isStreakBrokenBetween(startTsMs: number, endTsMs: number, trainingDays: number[]): boolean {
    const startDate = new Date(startTsMs);
    const endDate = new Date(endTsMs);
    
    // Start checking from the day after startDate
    const current = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate() + 1));
    const target = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
    
    while (current < target) {
        if (trainingDays.includes(current.getUTCDay())) return true;
        current.setUTCDate(current.getUTCDate() + 1);
    }
    return false;
}

export function isCurrentStreakStillValid(lastActiveDateMs: number | null | undefined, trainingDays: number[], nowMs: number = Date.now()): boolean {
    if (!Number.isFinite(lastActiveDateMs) || Number(lastActiveDateMs) <= 0) return false;
    const lastActive = Number(lastActiveDateMs);
    if (nowMs <= lastActive) return true;

    const lastStart = new Date(lastActive);
    const nowStart = new Date(nowMs);
    const lastStartUtc = Date.UTC(lastStart.getUTCFullYear(), lastStart.getUTCMonth(), lastStart.getUTCDate());
    const nowStartUtc = Date.UTC(nowStart.getUTCFullYear(), nowStart.getUTCMonth(), nowStart.getUTCDate());

    if (nowStartUtc <= lastStartUtc) return true;
    return !isStreakBrokenBetween(lastStartUtc, nowStartUtc, trainingDays);
}

export async function reconcileCurrentStreakForUser(
    trx: ScoreExecutor,
    userId: string,
    nowMs: number = Date.now()
): Promise<number> {
    const [profile] = await trx
        .select()
        .from(schema.userProfiles)
        .where(eq(schema.userProfiles.id, userId))
        .limit(1);

    if (!profile) return 0;

    const trainingDays = await getWeeklyGoalDays(trx, userId);
    const computedCurrentStreak = await calculateDailyStreak(trx, userId, trainingDays);
    const previousCurrentStreak = Number(profile.currentStreak || 0);
    const previousHighestStreak = Number(profile.highestStreak || 0);
    const nextHighestStreak = Math.max(previousHighestStreak, computedCurrentStreak);
    const hasChanged = previousCurrentStreak !== computedCurrentStreak || previousHighestStreak !== nextHighestStreak;

    if (hasChanged) {
        await trx
            .update(schema.userProfiles)
            .set({
                currentStreak: computedCurrentStreak,
                highestStreak: nextHighestStreak,
                updatedAt: new Date(nowMs),
            })
            .where(eq(schema.userProfiles.id, userId));
    }

    return computedCurrentStreak;
}

export async function reconcileWeeklyStreakForUser(
    trx: ScoreExecutor,
    userId: string,
    nowMs: number = Date.now(),
    lookbackWeeks: number = 52
): Promise<{ streakWeeks: number; streakMultiplier: number }> {
    const [profile] = await trx
        .select()
        .from(schema.userProfiles)
        .where(eq(schema.userProfiles.id, userId))
        .limit(1);

    if (!profile) return { streakWeeks: 0, streakMultiplier: 1 };

    const cfg = await getOrCreateScoreConfig(trx).catch(() => DEFAULT_SCORE_CONFIG);
    const trainingDays = await getWeeklyGoalDays(trx, userId);
    const goalDays = Math.max(1, trainingDays.length);

    const currentWeekStartSeconds = weekStartUtcSeconds(Math.floor(nowMs / 1000));
    const currentWeekKey = weekKeyFromSeconds(currentWeekStartSeconds);
    const evaluatedWeekStartSeconds = weekStartSecondsFromWeekKey(profile.streakWeekEvaluatedAt ?? null);
    if (evaluatedWeekStartSeconds === currentWeekStartSeconds) {
        const existingWeeks = Math.max(0, Number(profile.streakWeeks || 0));
        const existingMultiplier = Number(profile.streakMultiplier || resolveStreakMultiplier(cfg, existingWeeks) || 1);
        return { streakWeeks: existingWeeks, streakMultiplier: existingMultiplier };
    }

    const lookbackStartMs = (currentWeekStartSeconds - (Math.max(1, Math.floor(lookbackWeeks)) * 7 * 86400)) * 1000;
    const [weeklyRows] = await Promise.all([
        trx
            .select({
                weekKey: sql<string>`to_char(date_trunc('week', to_timestamp(${schema.workouts.date} / 1000.0) at time zone 'UTC'), 'YYYY-MM-DD')`,
                completedDays: sql<number>`count(distinct date_trunc('day', to_timestamp(${schema.workouts.date} / 1000.0) at time zone 'UTC'))`.mapWith(Number),
            })
            .from(schema.workouts)
            .where(and(
                eq(schema.workouts.userId, userId),
                eq(schema.workouts.status, 'completed'),
                isNull(schema.workouts.deletedAt),
                gte(schema.workouts.date, lookbackStartMs),
                lte(schema.workouts.date, currentWeekStartSeconds * 1000)
            ))
            .groupBy(sql`date_trunc('week', to_timestamp(${schema.workouts.date} / 1000.0) at time zone 'UTC')`),
    ]);

    const weeklyMap = Object.fromEntries(weeklyRows.map((row) => [String(row.weekKey), Number(row.completedDays || 0)]));
    const nextWeeks = calculateConsecutiveWeeklyStreakFromMap(weeklyMap, goalDays, currentWeekKey, lookbackWeeks);
    const nextMultiplier = resolveStreakMultiplier(cfg, nextWeeks);

    const previousWeeks = Math.max(0, Number(profile.streakWeeks || 0));
    const previousMultiplier = Number(profile.streakMultiplier || 1);
    if (previousWeeks !== nextWeeks || previousMultiplier !== nextMultiplier || profile.streakWeekEvaluatedAt !== currentWeekKey) {
        await trx
            .update(schema.userProfiles)
            .set({
                streakWeeks: nextWeeks,
                streakMultiplier: nextMultiplier,
                streakWeekEvaluatedAt: currentWeekKey,
                updatedAt: new Date(nowMs),
            })
            .where(eq(schema.userProfiles.id, userId));
    }

    return { streakWeeks: nextWeeks, streakMultiplier: nextMultiplier };
}

export async function reconcileStreakStateForUser(
    trx: ScoreExecutor,
    userId: string,
    nowMs: number = Date.now()
): Promise<void> {
    await reconcileCurrentStreakForUser(trx, userId, nowMs);
    await reconcileWeeklyStreakForUser(trx, userId, nowMs);
}

export async function reconcileScoreLifetimeForUser(
    trx: ScoreExecutor,
    userId: string,
    nowMs: number = Date.now()
): Promise<number> {
    const [profile] = await trx
        .select()
        .from(schema.userProfiles)
        .where(eq(schema.userProfiles.id, userId))
        .limit(1);

    if (!profile) return 0;

    const [sumRow] = await trx
        .select({
            total: sql<number>`coalesce(sum(${schema.scoreEvents.pointsAwarded}), 0)`.mapWith(Number),
        })
        .from(schema.scoreEvents)
        .where(and(
            eq(schema.scoreEvents.userId, userId),
            isNull(schema.scoreEvents.deletedAt)
        ));

    const canonicalScore = Math.max(0, Number(sumRow?.total || 0));
    const currentScore = Math.max(0, Number(profile.scoreLifetime || 0));

    if (canonicalScore !== currentScore) {
        await trx
            .update(schema.userProfiles)
            .set({
                scoreLifetime: canonicalScore,
                updatedAt: new Date(nowMs),
            })
            .where(eq(schema.userProfiles.id, userId));
    }

    return canonicalScore;
}

export type SocialIntegrityAuditResult = {
    userId: string;
    hasProfile: boolean;
    scoreLifetimeStored: number;
    scoreLifetimeCanonical: number;
    scoreLifetimeDrift: number;
    streakPossiblyStale: boolean;
    streakWeekNeedsRecalc: boolean;
};

export type SocialIntegrityReconcileResult = SocialIntegrityAuditResult & {
    changed: boolean;
    changedFields: Array<'scoreLifetime' | 'currentStreak' | 'highestStreak' | 'streakWeeks' | 'streakMultiplier' | 'streakWeekEvaluatedAt'>;
};

export async function auditSocialIntegrityForUser(
    trx: ScoreExecutor,
    userId: string,
    nowMs: number = Date.now()
): Promise<SocialIntegrityAuditResult> {
    const [profile] = await trx
        .select()
        .from(schema.userProfiles)
        .where(eq(schema.userProfiles.id, userId))
        .limit(1);

    if (!profile) {
        return {
            userId,
            hasProfile: false,
            scoreLifetimeStored: 0,
            scoreLifetimeCanonical: 0,
            scoreLifetimeDrift: 0,
            streakPossiblyStale: false,
            streakWeekNeedsRecalc: false,
        };
    }

    const [sumRow] = await trx
        .select({
            total: sql<number>`coalesce(sum(${schema.scoreEvents.pointsAwarded}), 0)`.mapWith(Number),
        })
        .from(schema.scoreEvents)
        .where(and(
            eq(schema.scoreEvents.userId, userId),
            isNull(schema.scoreEvents.deletedAt)
        ));

    const trainingDays = await getWeeklyGoalDays(trx, userId);
    const storedScore = Math.max(0, Number(profile.scoreLifetime || 0));
    const canonicalScore = Math.max(0, Number(sumRow?.total || 0));
    const currentWeekKey = weekKeyFromSeconds(Math.floor(nowMs / 1000));
    const lastActiveDate = Number(profile.lastActiveDate || 0);
    const streakPossiblyStale = Number(profile.currentStreak || 0) > 0 && !isCurrentStreakStillValid(lastActiveDate > 0 ? lastActiveDate : null, trainingDays, nowMs);

    return {
        userId,
        hasProfile: true,
        scoreLifetimeStored: storedScore,
        scoreLifetimeCanonical: canonicalScore,
        scoreLifetimeDrift: canonicalScore - storedScore,
        streakPossiblyStale,
        streakWeekNeedsRecalc: (profile.streakWeekEvaluatedAt || null) !== currentWeekKey,
    };
}

export async function auditAndReconcileSocialIntegrityForUser(
    trx: ScoreExecutor,
    userId: string,
    nowMs: number = Date.now()
): Promise<SocialIntegrityReconcileResult> {
    const before = await auditSocialIntegrityForUser(trx, userId, nowMs);
    if (!before.hasProfile) {
        return {
            ...before,
            changed: false,
            changedFields: [],
        };
    }

    const [beforeProfile] = await trx
        .select()
        .from(schema.userProfiles)
        .where(eq(schema.userProfiles.id, userId))
        .limit(1);

    await reconcileStreakStateForUser(trx, userId, nowMs);
    await reconcileScoreLifetimeForUser(trx, userId, nowMs);

    const after = await auditSocialIntegrityForUser(trx, userId, nowMs);
    const [afterProfile] = await trx
        .select()
        .from(schema.userProfiles)
        .where(eq(schema.userProfiles.id, userId))
        .limit(1);

    const changedFields: SocialIntegrityReconcileResult['changedFields'] = [];
    if ((beforeProfile?.scoreLifetime || 0) !== (afterProfile?.scoreLifetime || 0)) changedFields.push('scoreLifetime');
    if ((beforeProfile?.currentStreak || 0) !== (afterProfile?.currentStreak || 0)) changedFields.push('currentStreak');
    if ((beforeProfile?.highestStreak || 0) !== (afterProfile?.highestStreak || 0)) changedFields.push('highestStreak');
    if ((beforeProfile?.streakWeeks || 0) !== (afterProfile?.streakWeeks || 0)) changedFields.push('streakWeeks');
    if ((beforeProfile?.streakMultiplier || 1) !== (afterProfile?.streakMultiplier || 1)) changedFields.push('streakMultiplier');
    if ((beforeProfile?.streakWeekEvaluatedAt || null) !== (afterProfile?.streakWeekEvaluatedAt || null)) changedFields.push('streakWeekEvaluatedAt');

    return {
        ...after,
        changed: changedFields.length > 0,
        changedFields,
    };
}

async function getActiveGlobalMultiplier(trx: ScoreExecutor, now: Date): Promise<number> {
    const [row] = await trx
        .select({ multiplier: schema.globalEvents.multiplier })
        .from(schema.globalEvents)
        .where(
            and(
                eq(schema.globalEvents.isActive, true),
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

export async function isAdverseWeather(
    trx: ScoreExecutor,
    userId: string,
    lat: number,
    lon: number,
    coldThresholdC: number,
    heatThresholdC: number,
    workoutId?: string
): Promise<{ adverse: boolean; reason: string | null; tempC: number | null; windSpeed: number | null; humidity: number | null; logId: string | null; checkedAtMs: number | null }> {
    // 1. Check for recent weather logs to avoid API calls and implement grace period
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
    const [recentLog] = await trx
        .select()
        .from(schema.weatherLogs)
        .where(and(eq(schema.weatherLogs.userId, userId), gte(schema.weatherLogs.createdAt, twentyMinutesAgo), isNull(schema.weatherLogs.deletedAt)))
        .orderBy(desc(schema.weatherLogs.createdAt))
        .limit(1);

    if (recentLog) {
        return {
            adverse: recentLog.isAdverse ?? false,
            reason: recentLog.condition,
            tempC: recentLog.tempC,
            windSpeed: recentLog.windSpeed,
            humidity: recentLog.humidity,
            logId: recentLog.id,
            checkedAtMs: recentLog.createdAt ? recentLog.createdAt.getTime() : Date.now(),
        };
    }

    // 2. No recent log found, call OpenWeather API
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) return { adverse: false, reason: null, tempC: null, windSpeed: null, humidity: null, logId: null, checkedAtMs: null };

    try {
        const params = new URLSearchParams({
            lat: String(lat),
            lon: String(lon),
            appid: apiKey,
            units: 'metric',
        });
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) return { adverse: false, reason: null, tempC: null, windSpeed: null, humidity: null, logId: null, checkedAtMs: null };
        const data = (await res.json()) as OpenWeatherResponse;
        const weatherMain = String(data?.weather?.[0]?.main || '').toLowerCase();
        const tempC = Number(data?.main?.temp);
        const windSpeed = Number(data?.wind?.speed);
        const humidity = Number(data?.main?.humidity);

        let adverse = false;
        let reason: string | null = null;

        if (weatherMain.includes('rain')) {
            adverse = true;
            reason = 'rain';
        } else if (weatherMain.includes('snow')) {
            adverse = true;
            reason = 'snow';
        } else if (weatherMain.includes('thunderstorm')) {
            adverse = true;
            reason = 'storm';
        } else if (Number.isFinite(tempC) && tempC <= coldThresholdC) {
            adverse = true;
            reason = 'cold';
        } else if (Number.isFinite(tempC) && tempC >= heatThresholdC) {
            adverse = true;
            reason = 'heat';
        }

        const logId = crypto.randomUUID();
        const result = {
            adverse,
            reason,
            tempC: Number.isFinite(tempC) ? tempC : null,
            windSpeed: Number.isFinite(windSpeed) ? windSpeed : null,
            humidity: Number.isFinite(humidity) ? humidity : null,
            logId,
            checkedAtMs: Date.now(),
        };

        // 3. Log the check to the database
        await trx.insert(schema.weatherLogs).values({
            id: logId,
            userId,
            lat,
            lon,
            condition: reason || weatherMain || 'clear',
            temperature: result.tempC,
            tempC: result.tempC,
            windSpeed: result.windSpeed,
            humidity: result.humidity,
            isAdverse: adverse,
            workoutId,
            createdAt: new Date(),
        });

        // 4. Clean up old logs (older than 48 hours) to keep DB small
        await cleanupWeatherLogs(trx).catch(err => {
            logger.error('[Scoring] Cleanup error', { error: err instanceof Error ? err.message : String(err) });
        });

        return result;
    } catch (e) {
        logger.error('[Scoring] Weather API error', { error: e instanceof Error ? e.message : String(e), userId });
        return { adverse: false, reason: null, tempC: null, windSpeed: null, humidity: null, logId: null, checkedAtMs: null };
    }
}

async function ensureStreakState(trx: ScoreExecutor, userId: string, workoutDateSeconds: number, cfg: ScoreConfig): Promise<{ streakWeeks: number; multiplier: number }> {
    const [profile] = await trx.select().from(schema.userProfiles).where(eq(schema.userProfiles.id, userId)).limit(1);
    
    const workoutMs = workoutDateSeconds > 10000000000 ? workoutDateSeconds : workoutDateSeconds * 1000;
    const trainingDays = await getWeeklyGoalDays(trx, userId);
    const currentWeekKey = weekKeyFromSeconds(workoutDateSeconds);

    if (!profile) {
        const initialStreak = await calculateDailyStreak(trx, userId, trainingDays);
        await trx.insert(schema.userProfiles).values({
            id: userId,
            scoreLifetime: 0,
            streakWeeks: 0,
            streakMultiplier: 1,
            currentStreak: initialStreak,
            highestStreak: initialStreak,
            lastActiveDate: workoutMs,
            streakWeekEvaluatedAt: currentWeekKey,
            updatedAt: new Date(),
        });
        return { streakWeeks: 0, multiplier: 1 };
    }

    let finalCurrentStreak = Number(profile.currentStreak || 0);
    const lastActive = Number(profile.lastActiveDate || 0);

    if (lastActive === 0) {
        finalCurrentStreak = await calculateDailyStreak(trx, userId, trainingDays);
    } else {
        const lastDateStr = new Date(lastActive).toISOString().split('T')[0];
        const newDateStr = new Date(workoutMs).toISOString().split('T')[0];

        if (newDateStr === lastDateStr) {
            // Same day, streak doesn't change
            finalCurrentStreak = Number(profile.currentStreak || 0);
        } else if (workoutMs < lastActive) {
            // Out-of-order/Historical workout: Recalculate to be safe
            finalCurrentStreak = await calculateDailyStreak(trx, userId, trainingDays);
        } else {
            // Forward workout: Incremental check
            const isBroken = isStreakBrokenBetween(lastActive, workoutMs, trainingDays);
            finalCurrentStreak = isBroken ? 1 : Number(profile.currentStreak || 0) + 1;
        }
    }

    const nextHighest = Math.max(Number(profile.highestStreak || 0), finalCurrentStreak);

    // Legacy support: check if streakWeekEvaluatedAt is an old timestamp format
    let evalKey = profile.streakWeekEvaluatedAt;
    if (evalKey && !evalKey.includes('-')) {
        const parsedMs = parseInt(evalKey, 10);
        if (!isNaN(parsedMs)) evalKey = weekKeyFromSeconds(parsedMs);
    }

    if (evalKey === currentWeekKey) {
        // Already evaluated this week, just update daily stats
        await trx.update(schema.userProfiles).set({
            currentStreak: finalCurrentStreak,
            highestStreak: nextHighest,
            lastActiveDate: Math.max(lastActive, workoutMs),
            updatedAt: new Date(),
        }).where(eq(schema.userProfiles.id, userId));

        const weeks = Number(profile.streakWeeks || 0);
        const multiplier = Number(profile.streakMultiplier || resolveStreakMultiplier(cfg, weeks) || 1);
        return { streakWeeks: weeks, multiplier };
    }

    // Weekly Evaluation
    const previousWeekStart = weekStartUtcSeconds(workoutDateSeconds) - 7 * 86400;
    const previousWeekEnd = previousWeekStart + (7 * 86400) - 1;
    const goalDays = Math.max(1, trainingDays.length);

    const [countRow] = await trx
        .select({ count: sql<number>`count(distinct date_trunc('day', to_timestamp(${schema.workouts.date} / 1000.0)))`.mapWith(Number) })
        .from(schema.workouts)
        .where(and(
            eq(schema.workouts.userId, userId),
            eq(schema.workouts.status, 'completed'),
            gte(schema.workouts.date, previousWeekStart * 1000),
            lte(schema.workouts.date, previousWeekEnd * 1000),
            isNull(schema.workouts.deletedAt)
        ));

    const completedDays = Number(countRow?.count || 0);
    const metGoal = completedDays >= goalDays;
    const nextWeeks = metGoal ? Number(profile.streakWeeks || 0) + 1 : 0;
    const nextMultiplier = resolveStreakMultiplier(cfg, nextWeeks);

    await trx.update(schema.userProfiles).set({
        streakWeeks: nextWeeks,
        streakMultiplier: nextMultiplier,
        currentStreak: finalCurrentStreak,
        highestStreak: nextHighest,
        lastActiveDate: Math.max(lastActive, workoutMs),
        streakWeekEvaluatedAt: currentWeekKey,
        updatedAt: new Date(),
    }).where(eq(schema.userProfiles.id, userId));

    return { streakWeeks: nextWeeks, multiplier: nextMultiplier };
}

type AwardArgs = {
    trx: ScoreExecutor;
    userId: string;
    workoutId: string | null;
    eventType: string;
    eventKey: string;
    pointsBase: number;
    streakMultiplier: number;
    globalMultiplier: number;
    weatherId?: string | null;
    metadata?: Record<string, unknown>;
};

async function awardEvent(args: AwardArgs): Promise<number> {
    const [existingEvent] = await args.trx.select().from(schema.scoreEvents).where(eq(schema.scoreEvents.eventKey, args.eventKey)).limit(1);

    if (existingEvent) {
        if (existingEvent.deletedAt) {
            // Re-vivimos el evento (esto pasa si el usuario borró el entrenamiento y lo volvió a subir en el mismo minuto)
            // IMPORTANTE: Al revivirlo hay que volver a sumar los puntos al perfil
            const pointsToAward = Number(existingEvent.pointsAwarded || 0);
            await args.trx.update(schema.scoreEvents).set({
                deletedAt: null,
                updatedAt: new Date(),
            }).where(eq(schema.scoreEvents.id, existingEvent.id));

            return pointsToAward;
        }
        return 0; // Event already exists and is active
    }

    const pointsAwarded = Math.max(0, Math.round(args.pointsBase * args.streakMultiplier * args.globalMultiplier));
    if (pointsAwarded <= 0) return 0;

    // Use eventKey as part of the ID to make it deterministic and unique across syncs
    const id = `score:${args.eventKey}`;

    await args.trx.insert(schema.scoreEvents).values({
        id,
        userId: args.userId,
        workoutId: args.workoutId,
        eventType: args.eventType,
        eventKey: args.eventKey,
        pointsBase: args.pointsBase,
        streakMultiplier: args.streakMultiplier,
        globalMultiplier: args.globalMultiplier,
        pointsAwarded,
        weatherId: args.weatherId ?? null,
        metadata: args.metadata ?? null,
    }).onConflictDoUpdate({
        target: schema.scoreEvents.eventKey,
        set: {
            pointsAwarded,
            updatedAt: new Date(),
        }
    });

    return pointsAwarded;
}

export async function applyWorkoutScoring(trx: ScoreExecutor, userId: string, workoutId: string): Promise<{ totalAwarded: number }> {
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

    let trainingDays = [1, 2, 3, 4, 5];
    try {
        trainingDays = await getWeeklyGoalDays(trx, userId);
    } catch (e) {
        logger.captureException(e, { scope: 'social-scoring.getWeeklyGoalDays', userId, workoutId });
    }
    const goalDays = Math.max(1, trainingDays.length);
    let totalAwarded = 0;

    totalAwarded += await awardEvent({
        trx,
        userId,
        workoutId,
        eventType: 'workout_completed',
        eventKey: `workout_completed:${workoutId}`,
        pointsBase: cfg.workoutCompletePoints,
        streakMultiplier: streak.multiplier,
        globalMultiplier,
        metadata: { workoutId },
    });

    const weekStart = weekStartUtcSeconds(Number(workout.date));
    const weekEnd = weekStart + (7 * 86400) - 1;

    const [weekCountRow] = await trx
        .select({ count: sql<number>`count(distinct date_trunc('day', to_timestamp(${schema.workouts.date} / 1000.0)))`.mapWith(Number) })
        .from(schema.workouts)
        .where(and(
            eq(schema.workouts.userId, userId),
            eq(schema.workouts.status, 'completed'),
            gte(schema.workouts.date, weekStart * 1000),
            lte(schema.workouts.date, weekEnd * 1000),
            isNull(schema.workouts.deletedAt)
        ));

    const [weekExtraRow] = await trx
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(schema.scoreEvents)
        .where(and(
            eq(schema.scoreEvents.userId, userId),
            eq(schema.scoreEvents.eventType, 'extra_day'),
            gte(schema.scoreEvents.createdAt, new Date(weekStart * 1000)),
            lte(schema.scoreEvents.createdAt, new Date(weekEnd * 1000)),
            isNull(schema.scoreEvents.deletedAt)
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

    const bestSetsQuery = await trx
        .select({
            exerciseId: schema.workoutSets.exerciseId,
            exerciseName: schema.exercises.name,
            maxOneRm: sql<number>`MAX(${schema.workoutSets.weight} * (1.0 + (${schema.workoutSets.reps} / 30.0)))`.mapWith(Number),
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
        ))
        .groupBy(schema.workoutSets.exerciseId, schema.exercises.name);

    for (const set of bestSetsQuery) {
        const exerciseId = String(set.exerciseId);
        const exerciseName = String(set.exerciseName || 'Exercise');
        const oneRmKg = Number(set.maxOneRm);
        
        if (!Number.isFinite(oneRmKg) || oneRmKg <= 0) continue;

        const prId = `${userId}:${exerciseId}`;
        const [existingPr] = await trx.select().from(schema.userExercisePrs).where(eq(schema.userExercisePrs.id, prId)).limit(1);
        const oldOneRm = Number(existingPr?.best1RmKg || 0);
        
        if (oneRmKg <= oldOneRm) continue;

        if (existingPr) {
            await trx.update(schema.userExercisePrs).set({
                exerciseName: exerciseName,
                best1RmKg: oneRmKg,
                workoutSetId: workoutId, // Note: For batch, we just reference workout since we don't have the specific set ID easily here. 
                                         // But ideally we'd join and get the set ID.
                achievedAt: new Date(Number(workout.date)),
                updatedAt: new Date(),
            }).where(eq(schema.userExercisePrs.id, prId));
        } else {
            await trx.insert(schema.userExercisePrs).values({
                id: prId,
                userId,
                exerciseId,
                exerciseName: exerciseName,
                best1RmKg: oneRmKg,
                workoutSetId: workoutId,
                achievedAt: new Date(Number(workout.date)),
            });
        }

        const pointsBase = isBigThreeExercise(exerciseName) ? cfg.prBig3Points : cfg.prNormalPoints;
        totalAwarded += await awardEvent({
            trx,
            userId,
            workoutId,
            eventType: 'pr_broken',
            eventKey: `pr_broken:${workoutId}:${exerciseId}`,
            pointsBase,
            streakMultiplier: streak.multiplier,
            globalMultiplier,
            metadata: {
                workoutId,
                exerciseId,
                exerciseName: exerciseName,
                oldOneRmKg: oldOneRm,
                newOneRmKg: oneRmKg,
                isBig3: pointsBase === cfg.prBig3Points,
            },
        });
    }

    if (cfg.weatherBonusEnabled === true && Number.isFinite(workout.finishLat) && Number.isFinite(workout.finishLon)) {
        try {
            const weather = await isAdverseWeather(trx, userId, Number(workout.finishLat), Number(workout.finishLon), cfg.coldThresholdC, cfg.heatThresholdC, workout.id);
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
                    weatherId: weather.logId,
                    metadata: {
                        workoutId,
                        lat: Number(workout.finishLat),
                        lon: Number(workout.finishLon),
                        reason: weather.reason,
                        tempC: weather.tempC,
                        windSpeed: weather.windSpeed,
                        humidity: weather.humidity,
                    },
                });
            }
        } catch (e) {
            logger.captureException(e, { scope: 'social-scoring.weatherCheck', userId, workoutId, message: '[Scoring] Weather check failed for workout, skipping' });
        }
    }

    return { totalAwarded };
}

export async function revertWorkoutScoring(trx: ScoreExecutor, userId: string, workoutId: string): Promise<{ totalReverted: number }> {
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

    const totalPoints = events.reduce((sum, e) => sum + Number(e.pointsAwarded || 0), 0);

    // 2. Revert PR records if necessary
    const prEvents = events.filter((e) => e.eventType === 'pr_broken');
    if (prEvents.length > 0) {
        const exerciseIds = prEvents
            .map((e) => e.eventKey?.split(':')?.[2])
            .filter((value): value is string => Boolean(value));

        if (exerciseIds.length > 0) {
            // OPTIMIZATION: Use a single query to find the next best for ALL exercises in the batch
            const nextBests = await trx
                .select({
                    exerciseId: schema.workoutSets.exerciseId,
                    oneRm: sql<number>`MAX(${schema.workoutSets.weight} * (1.0 + (${schema.workoutSets.reps} / 30.0)))`.mapWith(Number),
                    exerciseName: sql<string>`MAX(${schema.exercises.name})`
                })
                .from(schema.workoutSets)
                .innerJoin(schema.workouts, eq(schema.workouts.id, schema.workoutSets.workoutId))
                .innerJoin(schema.exercises, eq(schema.exercises.id, schema.workoutSets.exerciseId))
                .where(and(
                    eq(schema.workoutSets.userId, userId),
                    inArray(schema.workoutSets.exerciseId, exerciseIds),
                    eq(schema.workoutSets.completed, 1),
                    eq(schema.workouts.status, 'completed'),
                    isNull(schema.workouts.deletedAt),
                    isNull(schema.workoutSets.deletedAt),
                    sql`${schema.workouts.id} != ${workoutId}`,
                    sql`${schema.workoutSets.weight} > 0`,
                    sql`${schema.workoutSets.reps} > 0`,
                    or(isNull(schema.workoutSets.type), sql`${schema.workoutSets.type} != 'warmup'`)
                ))
                .groupBy(schema.workoutSets.exerciseId);

            const nextBestMap = new Map(nextBests.map((nb) => [String(nb.exerciseId), nb]));

            for (const exerciseId of exerciseIds) {
                const prId = String(`${userId}:${exerciseId}`);
                const nb = nextBestMap.get(exerciseId);

                if (nb) {
                    await trx.update(schema.userExercisePrs)
                        .set({
                            best1RmKg: nb.oneRm,
                            exerciseName: nb.exerciseName,
                            updatedAt: new Date(),
                        })
                        .where(eq(schema.userExercisePrs.id, prId));
                } else {
                    // No other PRs for this exercise, delete the PR record
                    await trx.delete(schema.userExercisePrs).where(eq(schema.userExercisePrs.id, prId));
                }
            }
        }
    }

    // 3. Delete the score events to allow re-awarding later
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
    const mondayStartSeconds = weekStartUtcSeconds(now.getTime() / 1000);
    const weekStart = new Date(mondayStartSeconds * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 86400000);

    const [outboundRecords, inboundRecords] = await Promise.all([
        db.select().from(schema.friendships).where(
            and(
                eq(schema.friendships.userId, userId),
                eq(schema.friendships.status, 'accepted'),
                isNull(schema.friendships.deletedAt)
            )
        ),
        db.select().from(schema.friendships).where(
            and(
                eq(schema.friendships.friendId, userId),
                eq(schema.friendships.status, 'accepted'),
                isNull(schema.friendships.deletedAt)
            )
        ),
    ]);

    const records = [...outboundRecords, ...inboundRecords];

    const friendIds = records.map((r) => r.userId === userId ? r.friendId : r.userId);
    const userIds = [...new Set([userId, ...friendIds])];
    if (userIds.length === 0) return [];

    await Promise.all(userIds.map((id) => reconcileStreakStateForUser(db, id).catch(() => undefined)));

    const [profiles, monthScores, weekScores, workoutsLife, workoutsMonth, workoutsWeek] = await Promise.all([
        db.select().from(schema.userProfiles).where(inArray(schema.userProfiles.id, userIds)),
        db.select({
            userId: schema.scoreEvents.userId,
            total: sql<number>`coalesce(sum(${schema.scoreEvents.pointsAwarded}), 0)`.mapWith(Number),
        }).from(schema.scoreEvents).where(and(inArray(schema.scoreEvents.userId, userIds), gte(schema.scoreEvents.createdAt, monthAgo), isNull(schema.scoreEvents.deletedAt))).groupBy(schema.scoreEvents.userId),
        db.select({
            userId: schema.scoreEvents.userId,
            total: sql<number>`coalesce(sum(${schema.scoreEvents.pointsAwarded}), 0)`.mapWith(Number),
        }).from(schema.scoreEvents).where(and(inArray(schema.scoreEvents.userId, userIds), gte(schema.scoreEvents.createdAt, weekStart), isNull(schema.scoreEvents.deletedAt))).groupBy(schema.scoreEvents.userId),
        db.select({
            userId: schema.workouts.userId,
            total: sql<number>`count(*)`.mapWith(Number),
        }).from(schema.workouts).where(and(inArray(schema.workouts.userId, userIds), eq(schema.workouts.status, 'completed'), isNull(schema.workouts.deletedAt))).groupBy(schema.workouts.userId),
        db.select({
            userId: schema.workouts.userId,
            total: sql<number>`count(*)`.mapWith(Number),
        }).from(schema.workouts).where(and(inArray(schema.workouts.userId, userIds), eq(schema.workouts.status, 'completed'), isNull(schema.workouts.deletedAt), gte(schema.workouts.date, monthAgo.getTime()))).groupBy(schema.workouts.userId),
        db.select({
            userId: schema.workouts.userId,
            total: sql<number>`count(*)`.mapWith(Number),
        }).from(schema.workouts).where(and(inArray(schema.workouts.userId, userIds), eq(schema.workouts.status, 'completed'), isNull(schema.workouts.deletedAt), gte(schema.workouts.date, weekStart.getTime()))).groupBy(schema.workouts.userId),
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
            // Backward compatibility for root-level daily streak
            currentStreak: Number(p?.currentStreak || 0),
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
                currentStreak: Number(p?.currentStreak || 0),
                streakWeeks: Number(p?.streakWeeks || 0),
                highestStreak: Number(p?.highestStreak || 0),
            },
        };
    });

    leaderboard.sort((a, b) => b.scores.lifetime - a.scores.lifetime || b.stats.workoutsLifetime - a.stats.workoutsLifetime);
    return leaderboard;
}

export async function cleanupWeatherLogs(trx?: ScoreExecutor): Promise<number> {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const executor = trx || db;
    await executor.delete(schema.weatherLogs).where(lte(schema.weatherLogs.createdAt, fortyEightHoursAgo));
    logger.info('[Scoring] Cleaned up weather logs older than 48h');
    return 0;
}
