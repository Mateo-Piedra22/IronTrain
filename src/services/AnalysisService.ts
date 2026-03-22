import { logger } from '../utils/logger';
import { dbService } from './DatabaseService';

export interface OneRepMax {
    exerciseId: string;
    exerciseName: string;
    weight: number;
    reps: number;
    estimated1RM: number;
    date: number;
    badges: { name: string; color: string; icon?: string }[];
}

export interface VolumeData {
    date: string; // MM/DD
    volume: number;
}

interface RawAnalysisRow {
    exerciseId: string;
    exerciseName: string;
    weight: number;
    reps: number;
    date: number;
}

export interface WorkoutSummary {
    days: number;
    workoutCount: number;
    totalVolume: number;
    avgDurationMin: number | null;
    totalSets: number;
    totalReps: number;
}

export interface CardioSummary {
    days: number;
    sessions: number;
    totalDistanceMeters: number;
    totalTimeSeconds: number;
    avgSpeedKmh: number | null;
    bestSpeedKmh: number | null;
}

export interface RepsOnlySummary {
    days: number;
    sessions: number;
    totalReps: number;
    bestReps: number | null;
}

export interface WeightOnlySummary {
    days: number;
    sessions: number;
    bestWeightKg: number | null;
}

export interface WorkoutComparison {
    days: number;
    current: WorkoutSummary;
    previous: WorkoutSummary;
    volumeChangePct: number | null;
    workoutChangePct: number | null;
}

export interface WorkoutStreak {
    current: number;
    best: number;
}

export interface ExercisePR {
    weight: number;
    reps: number;
    date: number;
}

export interface PowerliftingPRs {
    squat: (ExercisePR & { badges: { name: string; color: string; icon?: string }[] }) | null;
    bench: (ExercisePR & { badges: { name: string; color: string; icon?: string }[] }) | null;
    deadlift: (ExercisePR & { badges: { name: string; color: string; icon?: string }[] }) | null;
    totalKg: number;
    squatName: string | null;
    benchName: string | null;
    deadliftName: string | null;
}

export interface VolumeSeriesPoint {
    label: string;
    dateMs: number;
    volume: number;
    sets: number;
}

export interface CategoryVolumeRow {
    categoryId: string;
    categoryName: string;
    categoryColor: string | null;
    volume: number;
    setCount: number;
    maxWeight: number;
}

export interface ExerciseVolumeRow {
    exerciseId: string;
    exerciseName: string;
    categoryName: string;
    categoryColor: string | null;
    volume: number;
    setCount: number;
    badges: { name: string; color: string; icon?: string }[];
}

export interface OneRMProgressRow {
    exerciseId: string;
    exerciseName: string;
    start1RM: number;
    end1RM: number;
    delta: number;
    deltaPct: number | null;
    badges: { name: string; color: string; icon?: string }[];
}


import { dataEventService } from './DataEventService';

export class AnalysisService {
    private static cache = new Map<string, { value: any; timestamp: number }>();
    private static CACHE_TTL = 30000; // 30 seconds
    private static isSubscribed = false;

    private static init() {
        if (this.isSubscribed) return;
        dataEventService.subscribe('DATA_UPDATED', () => this.clearCache());
        dataEventService.subscribe('SYNC_COMPLETED', () => this.clearCache());
        this.isSubscribed = true;
    }

    public static clearCache() {
        this.cache.clear();
    }

    private static getCached<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > this.CACHE_TTL) {
            this.cache.delete(key);
            return null;
        }
        return entry.value as T;
    }

    private static setCache(key: string, value: any) {
        this.init();
        this.cache.set(key, { value, timestamp: Date.now() });
    }


    // 1RM Calculation (Epley Formula)
    static async getTop1RMs(days?: number, limit: number = 5): Promise<OneRepMax[]> {
        const cacheKey = `top1rms_${days}_${limit}`;
        const cached = this.getCached<OneRepMax[]>(cacheKey);
        if (cached) return cached;
        try {

            const cutoff = days ? Date.now() - (days * 86400 * 1000) : null;

            const results = await dbService.getAll<any>(`
            SELECT 
                s.exercise_id as exerciseId, 
                e.name as exerciseName, 
                s.weight, 
                s.reps, 
                w.date,
                (SELECT GROUP_CONCAT(b.name || '|' || b.color || '|' || COALESCE(b.icon, '')) 
                 FROM badges b 
                 JOIN exercise_badges eb ON b.id = eb.badge_id 
                 WHERE eb.exercise_id = e.id AND eb.deleted_at IS NULL AND b.deleted_at IS NULL) as badges_csv
            FROM workout_sets s
            JOIN exercises e ON s.exercise_id = e.id
            JOIN workouts w ON s.workout_id = w.id
            WHERE s.completed = 1 AND s.weight > 0 AND s.reps > 0 AND s.type != 'warmup'
            ${cutoff ? 'AND w.date > ?' : ''}
            ORDER BY s.weight DESC
        `, cutoff ? [cutoff] : []);

            // Process in JS to find max 1RM per exercise
            const maxes: Record<string, OneRepMax & { badges: any[] }> = {};

            results.forEach(raw => {
                const r: any = raw;
                const eNameStr = String(r.exerciseName || r.exercisename || r.name);
                const eIdStr = String(r.exerciseId || r.exercise_id);
                // Epley: weight * (1 + reps/30)
                const epley = Math.round(r.weight * (1 + r.reps / 30));

                // If we don't have this exercise or this set provides a higher 1RM
                // Keying by Exercise ID is more precise than Name
                if (!maxes[eIdStr] || epley > maxes[eIdStr].estimated1RM) {
                    const badges = r.badges_csv ? r.badges_csv.split(',').map((s: string) => {
                        const [name, color, icon] = s.split('|');
                        return { name, color, icon: icon || undefined };
                    }) : [];

                    maxes[eIdStr] = {
                        exerciseId: eIdStr,
                        exerciseName: eNameStr,
                        weight: r.weight,
                        reps: r.reps,
                        estimated1RM: epley,
                        date: r.date,
                        badges
                    };
                }
            });

            const result = Object.values(maxes).sort((a, b) => b.estimated1RM - a.estimated1RM).slice(0, limit);
            this.setCache(cacheKey, result);
            return result;
        } catch (error) {

            logger.captureException(error, { scope: 'AnalysisService.getTop1RMs', message: 'Error calculating 1RMs' });
            return [];
        }
    }

    // Consistency Heatmap Data (Timestamps of completed workouts)
    static async getConsistency(days: number = 60): Promise<number[]> {
        const cacheKey = `consistency_${days}`;
        const cached = this.getCached<number[]>(cacheKey);
        if (cached) return cached;

        // Last N days
        const now = Date.now();
        const cutoffMs = now - (days * 86400 * 1000);

        const results = await dbService.getAll<{ date: number }>(`
            SELECT date FROM workouts 
            WHERE status = 'completed'
            AND date > ?
        `, [cutoffMs]);

        const result = Array.from(new Set(results.map(r => {
            const d = new Date(r.date);
            return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        })));
        this.setCache(cacheKey, result);
        return result;
    }


    // Volume Last 7 Workouts
    static async getWeeklyVolume(): Promise<VolumeData[]> {
        const cacheKey = 'weekly_volume';
        const cached = this.getCached<VolumeData[]>(cacheKey);
        if (cached) return cached;

        const results = await dbService.getAll<any>(`
            SELECT w.date, SUM(s.weight * s.reps) as volume
            FROM workouts w
            JOIN workout_sets s ON s.workout_id = w.id
            JOIN exercises e ON e.id = s.exercise_id
            WHERE w.status = 'completed' 
            AND s.completed = 1
            AND s.type != 'warmup'
            AND e.type = 'weight_reps'
            AND s.weight < 1000
            AND s.reps < 500
            GROUP BY w.id
            ORDER BY w.date DESC
            LIMIT 15
        `);

        // Group by day in JS to handle multiple sessions per day correctly
        const dailyTotals = new Map<string, number>();
        results.forEach(r => {
            const dateStr = new Date(r.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
            dailyTotals.set(dateStr, (dailyTotals.get(dateStr) || 0) + (r.volume || 0));
        });

        const result = Array.from(dailyTotals.entries())
            .map(([date, volume]) => ({ date, volume }))
            .reverse() // Back to ASC
            .slice(-7);

        this.setCache(cacheKey, result);
        return result;
    }


    static async getWorkoutSummary(days: number): Promise<WorkoutSummary> {
        const cacheKey = `workout_summary_${days}`;
        const cached = this.getCached<WorkoutSummary>(cacheKey);
        if (cached) return cached;

        const now = Date.now();
        const cutoffMs = now - (days * 86400 * 1000);

        const workoutCountRow = await dbService.getFirst<{ count: number }>(
            'SELECT COUNT(*) as count FROM workouts WHERE status = ? AND date > ?',
            ['completed', cutoffMs]
        );
        const volumeRow = await dbService.getFirst<{ total: number; sets: number; reps: number }>(
            `
                SELECT COALESCE(SUM(s.weight * s.reps), 0) as total,
                       COUNT(s.id) as total_sets,
                       COALESCE(SUM(s.reps), 0) as total_reps
                FROM workout_sets s
                JOIN workouts w ON s.workout_id = w.id
                JOIN exercises e ON e.id = s.exercise_id
                WHERE w.status = 'completed' 
                AND w.date > ? 
                AND s.completed = 1 
                AND s.type != 'warmup'
                AND e.type = 'weight_reps'
                AND s.weight < 1000 -- Guard against typos/outliers
                AND s.reps < 500 -- Guard against typos/outliers
            `,
            [cutoffMs]
        );
        const avgDurationRow = await dbService.getFirst<{ avgMin: number | null }>(
            `
                SELECT AVG(
                    CASE 
                        WHEN duration > 0 THEN duration / 60.0
                        WHEN end_time > start_time THEN (end_time - start_time) / 60000.0
                        ELSE NULL
                    END
                ) as avgMin
                FROM workouts
                WHERE status = 'completed'
                AND date > ?
            `,
            [cutoffMs]
        );

        const result = {
            days,
            workoutCount: workoutCountRow?.count ?? 0,
            totalVolume: Math.round(volumeRow?.total ?? 0),
            avgDurationMin: avgDurationRow?.avgMin ?? null,
            totalSets: (volumeRow as any)?.total_sets ?? 0,
            totalReps: (volumeRow as any)?.total_reps ?? 0
        };
        this.setCache(cacheKey, result);
        return result;
    }


    static async getCardioSummary(days: number): Promise<CardioSummary> {
        const cacheKey = `cardio_summary_${days}`;
        const cached = this.getCached<CardioSummary>(cacheKey);
        if (cached) return cached;
        const now = Date.now();
        const cutoffMs = now - (days * 86400 * 1000);

        const row = await dbService.getFirst<{
            sessions: number;
            totalDistanceMeters: number;
            totalTimeSeconds: number;
            avgSpeedKmh: number | null;
            bestSpeedKmh: number | null;
        }>(
            `
                SELECT
                  COUNT(DISTINCT s.workout_id) as sessions,
                  COALESCE(SUM(s.distance), 0) as totalDistanceMeters,
                  COALESCE(SUM(s.time), 0) as totalTimeSeconds,
                  CASE
                    WHEN COALESCE(SUM(s.time), 0) > 0 AND COALESCE(SUM(s.distance), 0) > 0
                    THEN ((SUM(s.distance) / 1000.0) / (SUM(s.time) / 3600.0))
                    ELSE NULL
                  END as avgSpeedKmh,
                  MAX(
                    CASE
                      WHEN s.distance > 0 AND s.time > 0
                      THEN ((s.distance / 1000.0) / (s.time / 3600.0))
                      ELSE NULL
                    END
                  ) as bestSpeedKmh
                FROM workout_sets s
                JOIN workouts w ON s.workout_id = w.id
                JOIN exercises e ON e.id = s.exercise_id
                WHERE w.status = 'completed'
                  AND w.date > ?
                  AND s.completed = 1
                  AND s.type != 'warmup'
                  AND e.type = 'distance_time'
            `,
            [cutoffMs]
        );

        const result = {
            days,
            sessions: row?.sessions ?? 0,
            totalDistanceMeters: row?.totalDistanceMeters ?? 0,
            totalTimeSeconds: row?.totalTimeSeconds ?? 0,
            avgSpeedKmh: row?.avgSpeedKmh ?? null,
            bestSpeedKmh: row?.bestSpeedKmh ?? null,
        };
        this.setCache(cacheKey, result);
        return result;
    }


    static async getRepsOnlySummary(days: number): Promise<RepsOnlySummary> {
        const cacheKey = `reps_only_summary_${days}`;
        const cached = this.getCached<RepsOnlySummary>(cacheKey);
        if (cached) return cached;
        const now = Date.now();
        const cutoffMs = now - (days * 86400 * 1000);

        const row = await dbService.getFirst<{
            sessions: number;
            totalReps: number;
            bestReps: number | null;
        }>(
            `
                SELECT
                  COUNT(DISTINCT s.workout_id) as sessions,
                  COALESCE(SUM(s.reps), 0) as totalReps,
                  MAX(s.reps) as bestReps
                FROM workout_sets s
                JOIN workouts w ON s.workout_id = w.id
                JOIN exercises e ON e.id = s.exercise_id
                WHERE w.status = 'completed'
                  AND w.date > ?
                  AND s.completed = 1
                  AND s.type != 'warmup'
                  AND e.type = 'reps_only'
            `,
            [cutoffMs]
        );

        const result = {
            days,
            sessions: row?.sessions ?? 0,
            totalReps: row?.totalReps ?? 0,
            bestReps: row?.bestReps ?? null,
        };
        this.setCache(cacheKey, result);
        return result;
    }


    static async getWeightOnlySummary(days: number): Promise<WeightOnlySummary> {
        const cacheKey = `weight_only_summary_${days}`;
        const cached = this.getCached<WeightOnlySummary>(cacheKey);
        if (cached) return cached;
        const now = Date.now();
        const cutoffMs = now - (days * 86400 * 1000);

        const row = await dbService.getFirst<{
            sessions: number;
            bestWeightKg: number | null;
        }>(
            `
                SELECT
                  COUNT(DISTINCT s.workout_id) as sessions,
                  MAX(s.weight) as bestWeightKg
                FROM workout_sets s
                JOIN workouts w ON s.workout_id = w.id
                JOIN exercises e ON e.id = s.exercise_id
                WHERE w.status = 'completed'
                  AND w.date > ?
                  AND s.completed = 1
                  AND s.type != 'warmup'
                  AND e.type = 'weight_only'
            `,
            [cutoffMs]
        );

        const result = {
            days,
            sessions: row?.sessions ?? 0,
            bestWeightKg: row?.bestWeightKg ?? null,
        };
        this.setCache(cacheKey, result);
        return result;
    }


    static async getWorkoutSummaryBetween(startMs: number, endMs: number): Promise<Omit<WorkoutSummary, 'days'> & { startMs: number; endMs: number }> {
        const workoutCountRow = await dbService.getFirst<{ count: number }>(
            'SELECT COUNT(*) as count FROM workouts WHERE status = ? AND date > ? AND date <= ?',
            ['completed', startMs, endMs]
        );
        const volumeRow = await dbService.getFirst<{ total: number; sets: number; reps: number }>(
            `
                SELECT COALESCE(SUM(s.weight * s.reps), 0) as total,
                       COUNT(s.id) as total_sets,
                       COALESCE(SUM(s.reps), 0) as total_reps
                FROM workout_sets s
                JOIN workouts w ON s.workout_id = w.id
                JOIN exercises e ON e.id = s.exercise_id
                WHERE w.status = 'completed'
                AND w.date > ?
                AND w.date <= ?
                AND s.completed = 1
                AND s.type != 'warmup'
                AND e.type = 'weight_reps'
            `,
            [startMs, endMs]
        );
        const avgDurationRow = await dbService.getFirst<{ avgMin: number | null }>(
            `
                SELECT AVG(
                    COALESCE(
                        CASE 
                            WHEN duration > 0 THEN 
                                CASE 
                                    WHEN duration > 43200000 THEN NULL 
                                    WHEN duration > 43200 THEN duration / 60000.0 
                                    ELSE duration / 60.0 
                                END
                            ELSE NULL 
                        END,
                        CASE 
                            WHEN end_time > start_time THEN 
                                CASE 
                                    WHEN (end_time - start_time) > 43200000 THEN NULL 
                                    ELSE (end_time - start_time) / 60000.0 
                                END
                            ELSE NULL 
                        END
                    )
                ) as avgMin
                FROM workouts
                WHERE status = 'completed'
                AND date > ?
                AND date <= ?
            `,
            [startMs, endMs]
        );

        return {
            startMs,
            endMs,
            workoutCount: workoutCountRow?.count ?? 0,
            totalVolume: Math.round(volumeRow?.total ?? 0),
            avgDurationMin: avgDurationRow?.avgMin ?? null,
            totalSets: (volumeRow as any)?.total_sets ?? 0,
            totalReps: (volumeRow as any)?.total_reps ?? 0
        };
    }

    static async getWorkoutComparison(days: number): Promise<WorkoutComparison> {
        const cacheKey = `workout_comparison_${days}`;
        const cached = this.getCached<WorkoutComparison>(cacheKey);
        if (cached) return cached;

        const now = Date.now();
        const currentStart = now - (days * 86400 * 1000);
        const previousStart = now - (days * 2 * 86400 * 1000);

        const [currentRaw, previousRaw] = await Promise.all([
            AnalysisService.getWorkoutSummaryBetween(currentStart, now),
            AnalysisService.getWorkoutSummaryBetween(previousStart, currentStart),
        ]);

        const current: WorkoutSummary = {
            days,
            workoutCount: currentRaw.workoutCount,
            totalVolume: currentRaw.totalVolume,
            avgDurationMin: currentRaw.avgDurationMin,
            totalSets: currentRaw.totalSets,
            totalReps: currentRaw.totalReps
        };
        const previous: WorkoutSummary = {
            days,
            workoutCount: previousRaw.workoutCount,
            totalVolume: previousRaw.totalVolume,
            avgDurationMin: previousRaw.avgDurationMin,
            totalSets: previousRaw.totalSets,
            totalReps: previousRaw.totalReps
        };

        const volumeChangePct = previous.totalVolume > 0
            ? Math.round(((current.totalVolume - previous.totalVolume) / previous.totalVolume) * 100)
            : null;
        const workoutChangePct = previous.workoutCount > 0
            ? Math.round(((current.workoutCount - previous.workoutCount) / previous.workoutCount) * 100)
            : null;

        const result = { days, current, previous, volumeChangePct, workoutChangePct };
        this.setCache(cacheKey, result);
        return result;
    }


    static async getVolumeSeries(days: number, bucket: 'day' | 'week' | 'month'): Promise<VolumeSeriesPoint[]> {
        const cacheKey = `volume_series_${days}_${bucket}`;
        const cached = this.getCached<VolumeSeriesPoint[]>(cacheKey);
        if (cached) return cached;
        const now = Date.now();
        const cutoffMs = now - (days * 86400 * 1000);

        const rows = await dbService.getAll<{ date: number; volume: number; total_sets: number }>(
            `
                SELECT w.date as date, COALESCE(SUM(s.weight * s.reps), 0) as volume, COUNT(s.id) as total_sets
                FROM workouts w
                JOIN workout_sets s ON s.workout_id = w.id
                JOIN exercises e ON s.exercise_id = e.id
                WHERE w.status = 'completed' 
                AND w.date > ? 
                AND s.completed = 1
                AND s.type != 'warmup'
                AND e.type = 'weight_reps' -- Strict type check
                AND s.weight < 1000
                AND s.reps < 500
                GROUP BY w.id
                ORDER BY w.date ASC
            `,
            [cutoffMs]
        );

        const keyFor = (ts: number) => {
            const d = new Date(ts);
            if (bucket === 'month') {
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            }
            const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            if (bucket === 'day') {
                return `${dayStart.getFullYear()}-${String(dayStart.getMonth() + 1).padStart(2, '0')}-${String(dayStart.getDate()).padStart(2, '0')}`;
            }
            const dow = dayStart.getDay() === 0 ? 7 : dayStart.getDay();
            const weekStart = new Date(dayStart);
            weekStart.setDate(weekStart.getDate() - (dow - 1));
            return `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
        };

        const bucketMap = new Map<string, { dateMs: number; volume: number; sets: number }>();
        for (const r of rows) {
            const key = keyFor(r.date);
            if (!bucketMap.has(key)) {
                const dateMs = bucket === 'month'
                    ? new Date(Number(key.split('-')[0]), Number(key.split('-')[1]) - 1, 1).getTime()
                    : new Date(Number(key.split('-')[0]), Number(key.split('-')[1]) - 1, Number(key.split('-')[2])).getTime();
                bucketMap.set(key, { dateMs, volume: 0, sets: 0 });
            }
            bucketMap.get(key)!.volume += r.volume || 0;
            bucketMap.get(key)!.sets += (r as any).total_sets || 0;
        }

        const points = Array.from(bucketMap.entries())
            .map(([key, v]) => {
                let label = key;
                const d = new Date(v.dateMs);
                if (bucket === 'day') {
                    label = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
                } else if (bucket === 'week') {
                    label = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
                } else {
                    label = d.toLocaleDateString('es-ES', { month: 'short' });
                }
                return { label, dateMs: v.dateMs, volume: Math.round(v.volume), sets: v.sets };
            })
            .sort((a, b) => a.dateMs - b.dateMs);

        const result = points;
        this.setCache(cacheKey, result);
        return result;
    }


    static async getCategoryVolume(days: number, limit: number = 6): Promise<CategoryVolumeRow[]> {
        const cacheKey = `category_volume_${days}_${limit}`;
        const cached = this.getCached<CategoryVolumeRow[]>(cacheKey);
        if (cached) return cached;
        const now = Date.now();
        const cutoffMs = now - (days * 86400 * 1000);

        const rows = await dbService.getAll<CategoryVolumeRow>(
            `
                SELECT
                    c.id as categoryId,
                    c.name as categoryName,
                    c.color as categoryColor,
                    COALESCE(SUM(CASE WHEN s.weight > 0 AND s.reps > 0 THEN (s.weight * s.reps) ELSE 0 END), 0) as volume,
                    COALESCE(COUNT(CASE WHEN s.weight > 0 AND s.reps > 0 THEN 1 END), 0) as total_sets,
                    COALESCE(MAX(CASE WHEN s.weight > 0 AND s.reps > 0 THEN s.weight ELSE 0 END), 0) as max_weight
                FROM workout_sets s
                JOIN workouts w ON s.workout_id = w.id
                JOIN exercises e ON s.exercise_id = e.id
                JOIN categories c ON e.category_id = c.id
                WHERE w.status = 'completed'
                AND w.date > ?
                AND s.completed = 1
                AND s.type != 'warmup'
                AND e.type = 'weight_reps'
                GROUP BY c.id
                ORDER BY volume DESC
                LIMIT ?
            `,
            [cutoffMs, limit]
        );

        const result = rows.map((r) => ({
            ...r,
            volume: Math.round((r as any).volume ?? 0),
            setCount: (r as any).total_sets ?? 0,
            maxWeight: (r as any).max_weight ?? 0,
        }));
        this.setCache(cacheKey, result);
        return result;
    }


    static async getTopExercisesByVolume(days: number, limit: number = 8): Promise<ExerciseVolumeRow[]> {
        const cacheKey = `top_exercises_volume_${days}_${limit}`;
        const cached = this.getCached<ExerciseVolumeRow[]>(cacheKey);
        if (cached) return cached;
        const now = Date.now();
        const cutoffMs = now - (days * 86400 * 1000);

        const rows = await dbService.getAll<ExerciseVolumeRow>(
            `
                SELECT
                    e.id as exerciseId,
                    e.name as exerciseName,
                    c.name as categoryName,
                    c.color as categoryColor,
                    COALESCE(SUM(CASE WHEN s.weight > 0 AND s.reps > 0 THEN (s.weight * s.reps) ELSE 0 END), 0) as volume,
                    COALESCE(COUNT(CASE WHEN s.weight > 0 AND s.reps > 0 THEN 1 END), 0) as total_sets,
                    (SELECT GROUP_CONCAT(b.name || '|' || b.color || '|' || COALESCE(b.icon, '')) 
                     FROM badges b 
                     JOIN exercise_badges eb ON b.id = eb.badge_id 
                     WHERE eb.exercise_id = e.id AND eb.deleted_at IS NULL AND b.deleted_at IS NULL) as badges_csv
                FROM workout_sets s
                JOIN workouts w ON s.workout_id = w.id
                JOIN exercises e ON s.exercise_id = e.id
                JOIN categories c ON e.category_id = c.id
                WHERE w.status = 'completed'
                AND w.date > ?
                AND s.completed = 1
                AND s.type != 'warmup'
                AND e.type = 'weight_reps'
                GROUP BY e.id
                ORDER BY volume DESC
                LIMIT ?
            `,
            [cutoffMs, limit]
        );

        const result = rows.map((r: any) => {
            const badges = r.badges_csv ? r.badges_csv.split(',').map((s: string) => {
                const [name, color, icon] = s.split('|');
                return { name, color, icon: icon || undefined };
            }) : [];

            return {
                ...r,
                volume: Math.round(r.volume ?? 0),
                setCount: r.total_sets ?? 0,
                badges
            };
        });
        this.setCache(cacheKey, result);
        return result;
    }


    static async getTop1RMProgress(days: number, limit: number = 6): Promise<OneRMProgressRow[]> {
        const cacheKey = `top_1rm_progress_${days}_${limit}`;
        const cached = this.getCached<OneRMProgressRow[]>(cacheKey);
        if (cached) return cached;
        const now = Date.now();
        const cutoffMs = now - (days * 86400 * 1000);
        const midMs = cutoffMs + Math.floor((now - cutoffMs) / 2);

        const rows = await dbService.getAll<{ exerciseId: string; exerciseName: string; weight: number; reps: number; date: number }>(
            `
                SELECT
                    e.id as exerciseId,
                    e.name as exerciseName,
                    s.weight as weight,
                    s.reps as reps,
                    w.date as date,
                    (SELECT GROUP_CONCAT(b.name || '|' || b.color || '|' || COALESCE(b.icon, '')) 
                     FROM badges b 
                     JOIN exercise_badges eb ON b.id = eb.badge_id 
                     WHERE eb.exercise_id = e.id AND eb.deleted_at IS NULL AND b.deleted_at IS NULL) as badges_csv
                FROM workout_sets s
                JOIN workouts w ON s.workout_id = w.id
                JOIN exercises e ON s.exercise_id = e.id
                WHERE w.status = 'completed'
                AND w.date > ?
                AND s.completed = 1
                AND s.type != 'warmup'
                AND s.weight > 0
                AND s.reps > 0
            `,
            [cutoffMs]
        );

        const map = new Map<string, { exerciseId: string; exerciseName: string; first: number; last: number; dateFirst: number; dateLast: number; badges: any[] }>();
        for (const r of rows as any[]) {
            const epley = Math.round(r.weight * (1 + r.reps / 30));
            if (!Number.isFinite(epley) || epley <= 0) continue;

            if (!map.has(r.exerciseId)) {
                const badges = r.badges_csv ? r.badges_csv.split(',').map((s: string) => {
                    const [name, color, icon] = s.split('|');
                    return { name, color, icon: icon || undefined };
                }) : [];
                map.set(r.exerciseId, {
                    exerciseId: r.exerciseId,
                    exerciseName: r.exerciseName,
                    first: epley,
                    last: epley,
                    dateFirst: r.date,
                    dateLast: r.date,
                    badges
                });
            } else {
                const cur = map.get(r.exerciseId)!;
                // Update first if earlier, last if later
                if (r.date < cur.dateFirst) {
                    cur.dateFirst = r.date;
                    cur.first = epley;
                }
                if (r.date > cur.dateLast) {
                    cur.dateLast = r.date;
                    cur.last = epley;
                } else if (r.date === cur.dateLast) {
                    // Same session/day, take the best
                    if (epley > cur.last) cur.last = epley;
                }
                if (r.date === cur.dateFirst) {
                    if (epley > cur.first) cur.first = epley;
                }
            }
        }

        const result: OneRMProgressRow[] = [];
        map.forEach((v) => {
            if (v.first <= 0 || v.last <= 0 || v.dateFirst === v.dateLast) return;
            const delta = v.last - v.first;
            if (delta <= 0) return;
            const deltaPct = v.first > 0 ? Math.round((delta / v.first) * 100) : null;
            result.push({
                exerciseId: v.exerciseId,
                exerciseName: v.exerciseName,
                start1RM: v.first,
                end1RM: v.last,
                delta,
                deltaPct,
                badges: v.badges
            });
        });

        const finalResult = result.sort((a, b) => b.delta - a.delta).slice(0, limit);
        this.setCache(cacheKey, finalResult);
        return finalResult;
    }


    static async getWorkoutHeatmapData(): Promise<{ date: number; sets: number; volume: number }[]> {
        const rows = await dbService.getAll<{ date: number; total_sets: number; volume: number }>(
            `SELECT w.date, COUNT(ws.id) as total_sets, SUM(ws.weight * (1 + ws.reps/30.0)) as volume
             FROM workouts w
             LEFT JOIN workout_sets ws ON w.id = ws.workout_id AND ws.completed = 1
             WHERE w.date > ? AND w.status = 'completed'
             GROUP BY w.id
             ORDER BY w.date ASC`,
            [Date.now() - 366 * 86400000]
        );
        return rows.map(r => ({
            date: r.date,
            sets: r.total_sets || 0,
            volume: Math.round(r.volume || 0)
        }));
    }

    static async getWorkoutStreakLastYear(): Promise<WorkoutStreak> {
        const cacheKey = 'workout_streak_year';
        const cached = this.getCached<WorkoutStreak>(cacheKey);
        if (cached) return cached;

        const oneYearAgo = Date.now() - 366 * 24 * 60 * 60 * 1000;
        const rows = await dbService.getAll<{ date: number }>(
            'SELECT date FROM workouts WHERE status = ? AND date > ? ORDER BY date ASC',
            ['completed', oneYearAgo]
        );

        const trainedKeys = new Set(rows.map(r => {
            const d = new Date(r.date);
            return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        }));

        const { configService: cfg } = await import('./ConfigService');
        const rawDays = cfg.get('training_days');
        let trainingDays = [1, 2, 3, 4, 5, 6]; // default Mon-Sat
        if (rawDays) {
            trainingDays = rawDays;
        }

        const today = new Date();
        const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        let currentRun = 0;
        let best = 0;

        for (let i = 0; i <= 365; i++) {
            const date = new Date(todayMidnight);
            date.setDate(date.getDate() - (365 - i));
            const currentMs = date.getTime();

            const dow = date.getDay();
            const isTrained = trainedKeys.has(currentMs);
            const isTrainingDay = trainingDays.includes(dow);

            if (isTrained) {
                currentRun++;
                if (currentRun > best) best = currentRun;
            } else if (isTrainingDay && i !== 365) {
                currentRun = 0;
            }
        }

        const result = { current: currentRun, best };
        this.setCache(cacheKey, result);
        return result;
    }


    static async getExercisePR(exerciseId: string): Promise<(ExercisePR & { badges: { name: string; color: string; icon?: string }[] }) | null> {
        const row = await dbService.getFirst<{ weight: number; reps: number; date: number; badges_csv: string | null }>(
            `
                SELECT s.weight as weight, s.reps as reps, w.date as date,
                       (SELECT GROUP_CONCAT(b.name || '|' || b.color || '|' || COALESCE(b.icon, '')) 
                        FROM badges b 
                        JOIN exercise_badges eb ON b.id = eb.badge_id 
                        WHERE eb.exercise_id = e.id AND eb.deleted_at IS NULL AND b.deleted_at IS NULL) as badges_csv
                FROM workout_sets s
                JOIN workouts w ON s.workout_id = w.id
                JOIN exercises e ON s.exercise_id = e.id
                WHERE s.exercise_id = ?
                AND s.completed = 1
                AND s.type != 'warmup'
                AND s.weight IS NOT NULL
                ORDER BY s.weight DESC, COALESCE(s.reps, 0) DESC, w.date DESC
                LIMIT 1
            `,
            [exerciseId]
        );

        if (!row || row.weight == null) return null;

        const badges = row.badges_csv ? row.badges_csv.split(',').map((s: string) => {
            const [name, color, icon] = s.split('|');
            return { name, color, icon: icon || undefined };
        }) : [];

        return {
            weight: row.weight ?? 0,
            reps: row.reps ?? 0,
            date: row.date ?? 0,
            badges
        };
    }

    static async getPowerliftingPRs(manualExerciseIds?: (string | null)[]): Promise<PowerliftingPRs> {
        const cacheKey = manualExerciseIds && manualExerciseIds.length > 0
            ? `powerlifting_prs_${manualExerciseIds.map(id => id || 'null').join('_')}`
            : 'powerlifting_prs_auto';

        const cached = this.getCached<PowerliftingPRs>(cacheKey);
        if (cached) return cached;

        let squatMatch: { id: string; name: string } | null = null;
        let benchMatch: { id: string; name: string } | null = null;
        let deadliftMatch: { id: string; name: string } | null = null;

        // Load exercises for manual IDs
        const manualIdsToFetch = manualExerciseIds?.filter((id): id is string => Boolean(id)) || [];
        const manualExercises = manualIdsToFetch.length > 0
            ? await dbService.getAll<{ id: string; name: string }>(`SELECT id, name FROM exercises WHERE id IN (${manualIdsToFetch.map(id => `'${id}'`).join(',')})`)
            : [];

        // Assign manual matches if present
        if (manualExerciseIds) {
            squatMatch = manualExerciseIds[0] ? (manualExercises.find(e => e.id === manualExerciseIds[0]) || null) : null;
            benchMatch = manualExerciseIds[1] ? (manualExercises.find(e => e.id === manualExerciseIds[1]) || null) : null;
            deadliftMatch = manualExerciseIds[2] ? (manualExercises.find(e => e.id === manualExerciseIds[2]) || null) : null;
        }

        // Auto-detection for ONLY missing slots (Hybrid mode)
        const exercises = (!squatMatch || !benchMatch || !deadliftMatch)
            ? await dbService.getAll<{ id: string; name: string }>('SELECT id, name FROM exercises ORDER BY name ASC')
            : [];

        if (exercises.length > 0) {
            const normalized = exercises.map((e) => ({ ...e, norm: e.name.toLowerCase() }));

            const findBy = (include: string[], exclude: string[] = []): { id: string; name: string } | null => {
                const found = normalized.find((e) => include.some((k) => e.norm.includes(k)) && !exclude.some((k) => e.norm.includes(k)));
                return found ? { id: found.id, name: found.name } : null;
            };

            if (!squatMatch) {
                squatMatch =
                    findBy(['squat', 'sentadilla'], ['split', 'bulgar', 'hack']) ??
                    findBy(['front squat', 'sentadilla frontal'], []);
            }
            if (!benchMatch) {
                benchMatch =
                    findBy(['bench press', 'press banca', 'banca'], ['dumb', 'mancuern', 'incline', 'inclinado']) ??
                    findBy(['press'], ['military', 'overhead', 'hombro']);
            }
            if (!deadliftMatch) {
                deadliftMatch =
                    findBy(['deadlift', 'peso muerto'], ['romanian', 'rumano', 'rdl']) ??
                    findBy(['peso muerto convencional'], []);
            }
        }

        const squat = squatMatch ? await AnalysisService.getExercisePR(squatMatch.id) : null;
        const bench = benchMatch ? await AnalysisService.getExercisePR(benchMatch.id) : null;
        const deadlift = deadliftMatch ? await AnalysisService.getExercisePR(deadliftMatch.id) : null;

        const totalKg = (squat?.weight ?? 0) + (bench?.weight ?? 0) + (deadlift?.weight ?? 0);

        const result = {
            squat, bench, deadlift, totalKg,
            squatName: squatMatch?.name ?? null,
            benchName: benchMatch?.name ?? null,
            deadliftName: deadliftMatch?.name ?? null,
        };

        this.setCache(cacheKey, result);
        return result;
    }


}
