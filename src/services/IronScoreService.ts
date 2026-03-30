import { startOfWeek } from 'date-fns';
import { useAuthStore } from '../store/authStore';
import { useSocialStore } from '../store/useSocialStore';
import { logger } from '../utils/logger';
import { configService } from './ConfigService';
import { dbService } from './DatabaseService';
import type { GlobalEvent, ScoreConfig, SocialProfile, WeatherInfo } from './SocialService';
import { SocialService } from './SocialService';

export type IronScoreAwardResult = {
    insertedEvents: number;
    pointsAwarded: number;
};

type ScoreEventType = 'workout_completed' | 'pr_broken' | 'extra_day';

type ScoreEventTypeExt = ScoreEventType | 'weather_bonus';

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
    heatThresholdC: 30,
    weatherBonusEnabled: 1,
};

const EPLEY_FORMULA_DIVISOR = 30;

function normalizeName(s: string): string {
    return String(s ?? '').toLowerCase().trim();
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('timeout')), ms);
        p.then(
            (v) => {
                clearTimeout(t);
                resolve(v);
            },
            (e) => {
                clearTimeout(t);
                reject(e);
            }
        );
    });
}

function isBig3ExerciseName(exerciseName: string): boolean {
    const n = normalizeName(exerciseName);

    const isSquat = (n.includes('squat') || n.includes('sentadilla')) && !n.includes('front') && !n.includes('frontal') && !n.includes('split') && !n.includes('bulgar') && !n.includes('hack');
    const isBench = (n.includes('bench') || n.includes('banca')) && !n.includes('incline') && !n.includes('inclinado') && !n.includes('dumb') && !n.includes('mancuern');
    const isDeadlift = (n.includes('deadlift') || n.includes('peso muerto')) && !n.includes('romanian') && !n.includes('rumano') && !n.includes('rdl');

    return isSquat || isBench || isDeadlift;
}

function startOfWeekMs(ts: number): number {
    const d = new Date(ts);
    const start = startOfWeek(d, { weekStartsOn: 1 });
    return start.getTime();
}

export class IronScoreService {
    static async calculateMissingScoresRetroactively(): Promise<void> {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) return;

        try {
            const missing = await dbService.getAll<{ id: string; date: number }>(
                `SELECT w.id, w.date
                 FROM workouts w
                 LEFT JOIN score_events se ON w.id = se.workout_id AND se.event_type = 'workout_completed' AND se.deleted_at IS NULL
                 WHERE w.status = 'completed' AND w.deleted_at IS NULL AND se.id IS NULL
                 ORDER BY w.date ASC`
            );

            if (!missing || missing.length === 0) return;

            logger.info(`Found ${missing.length} completed workouts missing score events. Calculating retrospectively...`, { scope: 'IronScoreService' });

            for (const w of missing) {
                await this.awardForFinishedWorkout(w.id, w.date || Date.now());
            }
        } catch (err) {
            logger.captureException(err, { scope: 'IronScoreService.calculateMissingScoresRetroactively' });
        }
    }

    static async awardForFinishedWorkout(workoutId: string, finishedAtMs: number): Promise<IronScoreAwardResult> {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) return { insertedEvents: 0, pointsAwarded: 0 };

        await this.refreshScoringContextBestEffort(workoutId);

        const cfg = this.getScoreConfig();

        try {
            let insertedEvents = 0;
            let pointsAwarded = 0;

            await dbService.withTransaction(async () => {
                await this.ensureUserProfile(userId);

                const multipliers = await this.getMultipliersForUser(userId, finishedAtMs, cfg);

                const events: Array<{
                    event_type: ScoreEventTypeExt;
                    event_key: string;
                    reference_id?: string | null;
                    points_base: number;
                }> = [];

                events.push({
                    event_type: 'workout_completed',
                    event_key: `workout_completed:${workoutId}`,
                    reference_id: workoutId,
                    points_base: cfg.workoutCompletePoints,
                });

                const prEvents = await this.computePrEvents(userId, workoutId, finishedAtMs);
                for (const pr of prEvents) {
                    events.push(pr);
                }

                const extra = await this.computeExtraDayEvent(userId, workoutId, finishedAtMs, cfg);
                if (extra) {
                    events.push(extra);
                }

                const weatherBonus = this.computeWeatherBonusEvent(workoutId, cfg);
                let weatherLogId: string | null = null;
                const profile = useSocialStore.getState().profile;
                const activeWeather = profile?.weatherBonus;

                if (activeWeather) {
                    try {
                        weatherLogId = await SocialService.saveWeatherLog(activeWeather, workoutId);
                    } catch (e) {
                        logger.captureException(e, { scope: 'IronScoreService.awardForFinishedWorkout', message: 'Failed to save weather log' });
                    }
                }

                if (weatherBonus) {
                    events.push(weatherBonus);
                }

                for (const e of events) {
                    const exists = await dbService.getFirst<{ id: string }>(
                        'SELECT id FROM score_events WHERE user_id = ? AND event_key = ? AND deleted_at IS NULL',
                        [userId, e.event_key]
                    );
                    if (exists?.id) continue;

                    const points_awarded = Math.max(0, Math.round((e.points_base) * multipliers.streak_multiplier * multipliers.global_multiplier));
                    const id = `score:${e.event_key}`;

                    await dbService.run(
                        `INSERT INTO score_events (
                            id,
                            user_id,
                            type,
                            points,
                            date,
                            reference_id,
                            metadata,
                            created_at,
                            updated_at,
                            deleted_at,
                            event_type,
                            event_key,
                            points_base,
                            points_awarded,
                            streak_multiplier,
                            global_multiplier,
                            workout_id,
                            weather_id
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            id,
                            userId,
                            e.event_type,
                            points_awarded,
                            finishedAtMs,
                            e.reference_id ?? null,
                            null,
                            finishedAtMs,
                            finishedAtMs,
                            e.event_type,
                            e.event_key,
                            e.points_base,
                            points_awarded,
                            multipliers.streak_multiplier,
                            multipliers.global_multiplier,
                            workoutId,
                            weatherLogId,
                        ]
                    );

                    await dbService.queueSyncMutation('score_events', id, 'INSERT', {
                        id,
                        user_id: userId,
                        type: e.event_type,
                        points: points_awarded,
                        date: finishedAtMs,
                        reference_id: e.reference_id ?? null,
                        metadata: null,
                        created_at: finishedAtMs,
                        updated_at: finishedAtMs,
                        deleted_at: null,
                        event_type: e.event_type,
                        event_key: e.event_key,
                        points_base: e.points_base,
                        points_awarded,
                        streak_multiplier: multipliers.streak_multiplier,
                        global_multiplier: multipliers.global_multiplier,
                        workout_id: workoutId,
                        weather_id: weatherLogId,
                    });

                    insertedEvents += 1;
                    pointsAwarded += points_awarded;
                }

                if (insertedEvents > 0 && pointsAwarded > 0) {
                    const prev = await dbService.getFirst<{ score_lifetime: number | null }>(
                        'SELECT score_lifetime FROM user_profiles WHERE id = ? AND deleted_at IS NULL',
                        [userId]
                    );

                    // Robustness check: if score_lifetime is suspiciously low (0 or 0 from local fresh install),
                    // try to use the sum of existing local events as a safer baseline for the new total.
                    const localSumRow = await dbService.getFirst<{ sum: number }>(
                        'SELECT SUM(points_awarded) as sum FROM score_events WHERE user_id = ? AND deleted_at IS NULL',
                        [userId]
                    );
                    const localEventSum = localSumRow?.sum ?? 0;

                    const storedScore = typeof prev?.score_lifetime === 'number' && Number.isFinite(prev.score_lifetime) ? prev.score_lifetime : 0;

                    // Use the higher of the two as the baseline (stored vs current sum of events)
                    // This prevents overwriting a server total with a zero/stale local profile total.
                    const baselineScore = Math.max(storedScore, localEventSum - pointsAwarded);
                    const nextScore = baselineScore + pointsAwarded;

                    await dbService.run(
                        'UPDATE user_profiles SET score_lifetime = ?, updated_at = ? WHERE id = ?',
                        [nextScore, finishedAtMs, userId]
                    );
                    await dbService.queueSyncMutation('user_profiles', userId, 'UPDATE', {
                        score_lifetime: nextScore,
                        updated_at: finishedAtMs,
                    });
                }
            });

            return { insertedEvents, pointsAwarded };
        } catch (e) {
            logger.captureException(e, { scope: 'IronScoreService.awardForFinishedWorkout', workoutId });
            return { insertedEvents: 0, pointsAwarded: 0 };
        }
    }

    private static async refreshScoringContextBestEffort(workoutId: string): Promise<void> {
        const now = Date.now();
        const last = configService.get('cachedSocialScoringRefreshedAt');
        const lastMs = typeof last === 'number' && Number.isFinite(last) ? last : 0;
        if (now - lastMs < 10 * 60 * 1000) {
            return;
        }

        try {
            const prof: SocialProfile = await withTimeout(SocialService.getProfile(), 5000);
            try {
                await Promise.all([
                    configService.set('cachedSocialScoreConfig', prof?.scoreConfig ?? null),
                    configService.set('cachedSocialActiveEvent', prof?.activeEvent ?? null),
                    configService.set('cachedSocialWeatherBonus', prof?.weatherBonus ?? null),
                    configService.set('cachedSocialScoringRefreshedAt', now),
                ]);
            } catch {
                await configService.set('cachedSocialScoringRefreshedAt', now);
            }

            const cfg = prof?.scoreConfig ?? this.getScoreConfig();
            const shouldTryWeather = cfg.weatherBonusEnabled !== 0;
            if (shouldTryWeather) {
                try {
                    const workout = await dbService.getWorkoutById(workoutId);
                    const lat = workout?.finish_lat;
                    const lon = workout?.finish_lon;
                    if (typeof lat === 'number' && Number.isFinite(lat) && typeof lon === 'number' && Number.isFinite(lon)) {
                        const weather = await withTimeout(SocialService.updateWeatherBonus(lat, lon, null), 5000);
                        await configService.set('cachedSocialWeatherBonus', weather ?? null);
                    }
                } catch {
                    await configService.set('cachedSocialWeatherBonus', null);
                }
            }
        } catch {
            try {
                await configService.set('cachedSocialScoringRefreshedAt', now);
            } catch {
            }
        }
    }

    private static getScoreConfig(): ScoreConfig {
        const cached = configService.get('cachedSocialScoreConfig');
        if (cached && typeof cached === 'object') {
            return {
                ...DEFAULT_SCORE_CONFIG,
                ...cached,
            };
        }
        return DEFAULT_SCORE_CONFIG;
    }

    private static async ensureUserProfile(userId: string): Promise<void> {
        const now = Date.now();
        const existing = await dbService.getFirst<{ id: string }>(
            'SELECT id FROM user_profiles WHERE id = ? AND deleted_at IS NULL',
            [userId]
        );
        if (existing?.id) return;
        await dbService.run(
            `INSERT OR IGNORE INTO user_profiles (
                id,
                username,
                display_name,
                is_public,
                share_stats,
                current_streak,
                highest_streak,
                score_lifetime,
                streak_weeks,
                streak_multiplier,
                updated_at,
                deleted_at
            ) VALUES (?, NULL, NULL, 1, 0, 0, 0, 0, 0, 1, ?, NULL)`,
            [userId, now]
        );
        await dbService.queueSyncMutation('user_profiles', userId, 'INSERT', {
            id: userId,
            username: null,
            display_name: null,
            is_public: 1,
            share_stats: 0,
            current_streak: 0,
            highest_streak: 0,
            score_lifetime: 0,
            streak_weeks: 0,
            streak_multiplier: 1,
            updated_at: now,
            deleted_at: null,
        });
    }

    private static resolveStreakMultiplier(cfg: ScoreConfig, streakWeeks: number): number {
        const sw = Number.isFinite(streakWeeks) ? Math.max(0, Math.floor(streakWeeks)) : 0;
        if (sw >= cfg.weekTier4Min) return cfg.tier4Multiplier;
        if (sw >= cfg.weekTier3Min) return cfg.tier3Multiplier;
        if (sw >= cfg.weekTier2Min) return cfg.tier2Multiplier;
        return 1;
    }

    private static parseWeekEvaluatedAtMs(v: unknown): number | null {
        if (v == null) return null;
        const s = String(v);

        // Handle string formats like "YYYY-MM-DD" relative to local timezone
        if (s.includes('-')) {
            const parts = s.split('-');
            if (parts.length === 3) {
                const y = Number(parts[0]);
                const m = Number(parts[1]);
                const d = Number(parts[2]);
                if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
                    const localDate = new Date(y, m - 1, d, 0, 0, 0, 0);
                    return localDate.getTime();
                }
            }
        }

        const n = Number(s);
        const maxValidFuture = Date.now() + 7 * 24 * 60 * 60 * 1000;

        // Safeguard to prevent far-future bugged timestamps (like 2026 ms epoch bugs) from locking streaks
        if (Number.isFinite(n) && n > 0 && n < maxValidFuture) return n;

        const d = new Date(s);
        const ms = d.getTime();
        if (Number.isFinite(ms) && ms > 0 && ms < maxValidFuture) return ms;

        return null;
    }

    private static async ensureWeeklyStreakState(userId: string, finishedAtMs: number, cfg: ScoreConfig): Promise<{ streakWeeks: number; streakMultiplier: number }> {
        const profile = await dbService.getFirst<{ streak_weeks: number | null; streak_week_evaluated_at: string | null }>(
            'SELECT streak_weeks, streak_week_evaluated_at FROM user_profiles WHERE id = ? AND deleted_at IS NULL',
            [userId]
        );

        const weekStart = startOfWeekMs(finishedAtMs);
        const evaluatedAtMs = this.parseWeekEvaluatedAtMs(profile?.streak_week_evaluated_at);
        const prevStreakWeeks = typeof profile?.streak_weeks === 'number' && Number.isFinite(profile.streak_weeks) ? Math.max(0, Math.floor(profile.streak_weeks)) : 0;

        if (evaluatedAtMs != null && evaluatedAtMs >= weekStart) {
            const mult = this.resolveStreakMultiplier(cfg, prevStreakWeeks);
            return { streakWeeks: prevStreakWeeks, streakMultiplier: mult };
        }

        const trainingDays = configService.get('training_days');
        const weeklyGoal = Array.isArray(trainingDays) ? trainingDays.length : 0;

        let nextStreakWeeks = prevStreakWeeks;
        if (weeklyGoal > 0) {
            const prevWeekStart = weekStart - 7 * 24 * 60 * 60 * 1000;
            const prevWeekEnd = weekStart;
            const rows = await dbService.getAll<{ date: number }>(
                'SELECT date FROM workouts WHERE status = ? AND date >= ? AND date < ? AND deleted_at IS NULL',
                ['completed', prevWeekStart, prevWeekEnd]
            );
            const completedPrevWeek = new Set(rows.map(r => {
                const d = new Date(r.date);
                // Use UTC to avoid timezone-related streak issues
                return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
            })).size;
            nextStreakWeeks = completedPrevWeek >= weeklyGoal ? (prevStreakWeeks + 1) : 0;
        }

        const nextMultiplier = this.resolveStreakMultiplier(cfg, nextStreakWeeks);
        const now = Date.now();

        // Use local time accessors because weekStart is based on a local midnight timestamp
        const dWeek = new Date(weekStart);
        const yStr = dWeek.getFullYear();
        const mStr = String(dWeek.getMonth() + 1).padStart(2, '0');
        const dStr = String(dWeek.getDate()).padStart(2, '0');
        const weekKey = `${yStr}-${mStr}-${dStr}`;
        await dbService.run(
            'UPDATE user_profiles SET streak_weeks = ?, streak_multiplier = ?, streak_week_evaluated_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
            [nextStreakWeeks, nextMultiplier, weekKey, now, userId]
        );
        await dbService.queueSyncMutation('user_profiles', userId, 'UPDATE', {
            streak_weeks: nextStreakWeeks,
            streak_multiplier: nextMultiplier,
            streak_week_evaluated_at: weekKey,
            updated_at: now,
        });

        return { streakWeeks: nextStreakWeeks, streakMultiplier: nextMultiplier };
    }

    private static getGlobalEventMultiplier(): number {
        const e = configService.get('cachedSocialActiveEvent') as GlobalEvent | null;
        if (!e) return 1;
        const m = typeof e.multiplier === 'number' && Number.isFinite(e.multiplier) && e.multiplier > 0 ? e.multiplier : 1;
        const endMs = e.endDate ? new Date(e.endDate).getTime() : null;
        if (endMs && Number.isFinite(endMs) && endMs > 0 && Date.now() > endMs) return 1;
        return m;
    }

    private static computeWeatherBonusEvent(workoutId: string, cfg: ScoreConfig): { event_type: ScoreEventTypeExt; event_key: string; reference_id?: string | null; points_base: number } | null {
        if (cfg.weatherBonusEnabled === 0) return null;
        const w = configService.get('cachedSocialWeatherBonus') as WeatherInfo | null;
        if (!w || w.isActive !== true) return null;
        const now = Date.now();
        const hasCheckedAt = Number.isFinite(w.checkedAtMs);
        const hasExpiresAt = Number.isFinite(w.expiresAtMs);

        // Backward compatibility: legacy cached weather payloads may only include `isActive`.
        // If timestamps are present, enforce the validity window; otherwise trust `isActive`.
        if (hasCheckedAt && Number(w.checkedAtMs) > now) return null;
        if (hasExpiresAt && Number(w.expiresAtMs) <= now) return null;
        if (!(typeof cfg.adverseWeatherPoints === 'number' && Number.isFinite(cfg.adverseWeatherPoints) && cfg.adverseWeatherPoints > 0)) return null;
        return {
            event_type: 'weather_bonus',
            event_key: `weather:${workoutId}`,
            reference_id: workoutId,
            points_base: cfg.adverseWeatherPoints,
        };
    }

    private static async getMultipliersForUser(userId: string, finishedAtMs: number, cfg: ScoreConfig): Promise<{ streak_multiplier: number; global_multiplier: number }> {
        const streak = await this.ensureWeeklyStreakState(userId, finishedAtMs, cfg);
        const global_multiplier = this.getGlobalEventMultiplier();
        return { streak_multiplier: streak.streakMultiplier, global_multiplier };
    }

    private static async computePrEvents(
        userId: string,
        workoutId: string,
        finishedAtMs: number
    ): Promise<Array<{ event_type: ScoreEventTypeExt; event_key: string; reference_id?: string | null; points_base: number }>> {
        const workoutSets = await dbService.getAll<{ id: string; exercise_id: string; exercise_name: string; weight: number; reps: number }>(
            `SELECT
                s.id as id,
                s.exercise_id as exercise_id,
                e.name as exercise_name,
                s.weight as weight,
                s.reps as reps
             FROM workout_sets s
             JOIN exercises e ON e.id = s.exercise_id
             WHERE s.workout_id = ?
               AND s.completed = 1
               AND s.weight > 0
               AND s.reps > 0
               AND (s.type IS NULL OR s.type != 'warmup')
               AND s.deleted_at IS NULL`,
            [workoutId]
        );

        if (workoutSets.length === 0) return [];

        const bestByExercise = new Map<string, { exerciseName: string; oneRm: number; setId: string }>();
        for (const set of workoutSets) {
            // Epley 1RM estimate is considered reliable up to ~10 reps, so we cap reps at 10.
            // Sets with more than 10 reps are treated as 10-rep sets for 1RM calculation.
            const effectiveReps = Math.min(set.reps, 10);
            const oneRm = set.weight * (1 + effectiveReps / EPLEY_FORMULA_DIVISOR);
            const prev = bestByExercise.get(set.exercise_id);
            if (!prev || oneRm > prev.oneRm) {
                bestByExercise.set(set.exercise_id, { exerciseName: set.exercise_name, oneRm, setId: set.id });
            }
        }

        const result: Array<{ event_type: ScoreEventTypeExt; event_key: string; reference_id?: string | null; points_base: number }> = [];

        for (const [exerciseId, cur] of bestByExercise.entries()) {
            // OPTIMIZATION: Query user_exercise_prs instead of scanning workout_sets history
            const previousPr = await dbService.getFirst<{ best_1rm_kg: number | null }>(
                'SELECT best_1rm_kg FROM user_exercise_prs WHERE user_id = ? AND exercise_id = ? AND deleted_at IS NULL',
                [userId, exerciseId]
            );

            const oldOneRm = Number(previousPr?.best_1rm_kg || 0);
            if (cur.oneRm <= oldOneRm) continue;

            const isBig3 = isBig3ExerciseName(cur.exerciseName);

            // Update user_exercise_prs table as the new source of truth
            await this.updateExercisePr(userId, exerciseId, cur.oneRm, cur.setId, finishedAtMs);

            result.push({
                event_type: 'pr_broken',
                event_key: `pr_broken:${workoutId}:${exerciseId}`,
                reference_id: exerciseId,
                points_base: isBig3 ? this.getScoreConfig().prBig3Points : this.getScoreConfig().prNormalPoints,
            });
        }

        return result;
    }

    private static async updateExercisePr(
        userId: string,
        exerciseId: string,
        oneRm: number,
        setId: string,
        atMs: number
    ): Promise<void> {
        const id = `pr:${userId}:${exerciseId}`;
        const existing = await dbService.getFirst<{ id: string }>(
            'SELECT id FROM user_exercise_prs WHERE id = ?',
            [id]
        );

        const payload = {
            id,
            user_id: userId,
            exercise_id: exerciseId,
            workout_set_id: setId,
            best_1rm_kg: oneRm,
            achieved_at: atMs,
            updated_at: atMs,
            deleted_at: null,
        };

        if (existing) {
            await dbService.run(
                'UPDATE user_exercise_prs SET workout_set_id = ?, best_1rm_kg = ?, achieved_at = ?, updated_at = ?, deleted_at = NULL WHERE id = ?',
                [setId, oneRm, atMs, atMs, id]
            );
            await dbService.queueSyncMutation('user_exercise_prs', id, 'UPDATE', payload);
        } else {
            const now = Date.now();
            const exercise = await dbService.getExerciseById(exerciseId);
            const record = {
                ...payload,
                exercise_name: exercise?.name || 'Unknown',
                created_at: now,
                updated_at: now
            };

            await dbService.run(
                'INSERT INTO user_exercise_prs (id, user_id, exercise_id, exercise_name, workout_set_id, best_1rm_kg, achieved_at, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)',
                [id, userId, exerciseId, record.exercise_name, setId, oneRm, atMs, now, now]
            );
            await dbService.queueSyncMutation('user_exercise_prs', id, 'INSERT', record);
        }
    }

    private static async computeExtraDayEvent(
        userId: string,
        workoutId: string,
        finishedAtMs: number,
        cfg: ScoreConfig
    ): Promise<{ event_type: ScoreEventTypeExt; event_key: string; reference_id?: string | null; points_base: number } | null> {
        const weekStart = startOfWeekMs(finishedAtMs);
        const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;

        const rows = await dbService.getAll<{ date: number }>(
            'SELECT date FROM workouts WHERE status = ? AND date >= ? AND date < ? AND deleted_at IS NULL',
            ['completed', weekStart, weekEnd]
        );

        // Map to midnight timestamps to count UNIQUE training days
        const uniqueTrainedDays = new Set(rows.map(r => {
            const d = new Date(r.date);
            return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        })).size;

        const completedThisWeek = uniqueTrainedDays;

        const trainingDays = configService.get('training_days') ?? [1, 2, 3, 4, 5, 6];
        const weeklyGoal = Array.isArray(trainingDays) ? trainingDays.length : 0;

        if (weeklyGoal <= 0) return null;
        if (completedThisWeek <= weeklyGoal) return null;

        const extraCountRow = await dbService.getFirst<{ count: number }>(
            `SELECT COUNT(*) as count
             FROM score_events
             WHERE user_id = ?
               AND event_type = 'extra_day'
               AND date >= ?
               AND date < ?
               AND deleted_at IS NULL`,
            [userId, weekStart, weekEnd]
        );

        const alreadyAwardedThisWeek = extraCountRow?.count ?? 0;
        if (alreadyAwardedThisWeek >= cfg.extraDayWeeklyCap) return null;

        return {
            event_type: 'extra_day',
            event_key: `extra_day:${workoutId}`,
            reference_id: workoutId,
            points_base: cfg.extraDayPoints,
        };
    }

    /**
     * Reverts all points awarded for a specific workout.
     * Used when a workout is deleted from history.
     */
    static async revertScoreForWorkout(workoutId: string): Promise<void> {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) return;

        try {
            await dbService.withTransaction(async () => {
                // 1. Get all events for this workout that haven't been deleted yet
                const events = await dbService.getAll<{ id: string; points: number }>(
                    'SELECT id, points FROM score_events WHERE workout_id = ? AND user_id = ? AND deleted_at IS NULL',
                    [workoutId, userId]
                );

                if (events.length === 0) return;

                const totalPointsToRevert = events.reduce((sum, e) => sum + (e.points || 0), 0);

                // 2. Mark events as deleted (soft delete for sync)
                const now = Date.now();
                for (const event of events) {
                    await dbService.run('UPDATE score_events SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, event.id]);
                    await dbService.queueSyncMutation('score_events', event.id, 'UPDATE', { deleted_at: now, updated_at: now });
                }

                // 3. Update user profile lifetime score
                const profile = await dbService.getFirst<{ score_lifetime: number | null }>(
                    'SELECT score_lifetime FROM user_profiles WHERE id = ? AND deleted_at IS NULL',
                    [userId]
                );

                if (profile) {
                    const currentScore = profile.score_lifetime ?? 0;
                    const nextScore = Math.max(0, currentScore - totalPointsToRevert);

                    await dbService.run(
                        'UPDATE user_profiles SET score_lifetime = ?, updated_at = ? WHERE id = ?',
                        [nextScore, now, userId]
                    );
                    await dbService.queueSyncMutation('user_profiles', userId, 'UPDATE', {
                        score_lifetime: nextScore,
                        updated_at: now
                    });
                }
            });

            logger.info(`Reverted ${workoutId} score events.`, { scope: 'IronScoreService' });
        } catch (err) {
            logger.captureException(err, { scope: 'IronScoreService.revertScoreForWorkout', workoutId });
        }
    }
}
