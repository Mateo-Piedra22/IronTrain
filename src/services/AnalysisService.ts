import { dbService } from './DatabaseService';

export interface OneRepMax {
    exerciseId: string;
    exerciseName: string;
    weight: number;
    reps: number;
    estimated1RM: number;
    date: number;
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
    squat: ExercisePR | null;
    bench: ExercisePR | null;
    deadlift: ExercisePR | null;
    totalKg: number;
}

export interface VolumeSeriesPoint {
    label: string;
    dateMs: number;
    volume: number;
}

export interface CategoryVolumeRow {
    categoryId: string;
    categoryName: string;
    categoryColor: string | null;
    volume: number;
    setCount: number;
}

export interface ExerciseVolumeRow {
    exerciseId: string;
    exerciseName: string;
    categoryName: string;
    categoryColor: string | null;
    volume: number;
    setCount: number;
}

export interface OneRMProgressRow {
    exerciseId: string;
    exerciseName: string;
    start1RM: number;
    end1RM: number;
    delta: number;
    deltaPct: number | null;
}

export class AnalysisService {
    // 1RM Calculation (Epley Formula)
    static async getTop1RMs(days?: number, limit: number = 5): Promise<OneRepMax[]> {
        try {
            const cutoff = days ? Date.now() - (days * 86400 * 1000) : null;

            // Get generic results
            const results = await dbService.getAll<RawAnalysisRow>(`
            SELECT e.id as exerciseId, e.name as exerciseName, s.weight, s.reps, w.date
            FROM workout_sets s
            JOIN exercises e ON s.exercise_id = e.id
            JOIN workouts w ON s.workout_id = w.id
            WHERE s.completed = 1 AND s.weight > 0 AND s.reps > 0
            ${cutoff ? 'AND w.date > ?' : ''}
            ORDER BY s.weight DESC
        `, cutoff ? [cutoff] : []);

            // Process in JS to find max 1RM per exercise
            const maxes: Record<string, OneRepMax> = {};

            results.forEach(r => {
                // Epley: weight * (1 + reps/30)
                const epley = Math.round(r.weight * (1 + r.reps / 30));
                if (!maxes[r.exerciseName] || epley > maxes[r.exerciseName].estimated1RM) {
                    maxes[r.exerciseName] = {
                        exerciseId: r.exerciseId,
                        exerciseName: r.exerciseName,
                        weight: r.weight,
                        reps: r.reps,
                        estimated1RM: epley,
                        date: r.date
                    };
                }
            });

            return Object.values(maxes).sort((a, b) => b.estimated1RM - a.estimated1RM).slice(0, limit);
        } catch (error) {
            console.error('Error calculating 1RMs:', error);
            return [];
        }
    }

    // Consistency Heatmap Data (Timestamps of completed workouts)
    static async getConsistency(days: number = 60): Promise<number[]> {
        // Last N days
        const now = Date.now();
        const cutoffMs = now - (days * 86400 * 1000);

        const results = await dbService.getAll<{ date: number }>(`
            SELECT date FROM workouts 
            WHERE status = 'completed'
            AND date > ?
        `, [cutoffMs]);

        return results.map(r => r.date);
    }

    // Volume Last 7 Workouts
    static async getWeeklyVolume(): Promise<VolumeData[]> {
        const results = await dbService.getAll<any>(`
            SELECT w.date, SUM(s.weight * s.reps) as volume
            FROM workouts w
            JOIN workout_sets s ON s.workout_id = w.id
            JOIN exercises e ON e.id = s.exercise_id
            WHERE w.status = 'completed' AND s.completed = 1 AND e.type = 'weight_reps'
            GROUP BY w.id
            ORDER BY w.date ASC
            LIMIT 7
        `);

        return results.map(r => ({
            date: new Date(r.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
            volume: r.volume || 0
        }));
    }

    static async getWorkoutSummary(days: number): Promise<WorkoutSummary> {
        const now = Date.now();
        const cutoffMs = now - (days * 86400 * 1000);

        const workoutCountRow = await dbService.getFirst<{ count: number }>(
            'SELECT COUNT(*) as count FROM workouts WHERE status = ? AND date > ?',
            ['completed', cutoffMs]
        );
        const volumeRow = await dbService.getFirst<{ total: number }>(
            `
                SELECT COALESCE(SUM(s.weight * s.reps), 0) as total
                FROM workout_sets s
                JOIN workouts w ON s.workout_id = w.id
                JOIN exercises e ON e.id = s.exercise_id
                WHERE w.status = 'completed' AND w.date > ? AND s.completed = 1 AND e.type = 'weight_reps'
            `,
            [cutoffMs]
        );
        const avgDurationRow = await dbService.getFirst<{ avgMin: number | null }>(
            `
                SELECT AVG((end_time - start_time) / 60000.0) as avgMin
                FROM workouts
                WHERE status = 'completed'
                AND date > ?
                AND end_time IS NOT NULL
                AND start_time IS NOT NULL
                AND end_time > start_time
            `,
            [cutoffMs]
        );

        return {
            days,
            workoutCount: workoutCountRow?.count ?? 0,
            totalVolume: Math.round(volumeRow?.total ?? 0),
            avgDurationMin: avgDurationRow?.avgMin ?? null
        };
    }

    static async getCardioSummary(days: number): Promise<CardioSummary> {
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
                  AND e.type = 'distance_time'
            `,
            [cutoffMs]
        );

        return {
            days,
            sessions: row?.sessions ?? 0,
            totalDistanceMeters: row?.totalDistanceMeters ?? 0,
            totalTimeSeconds: row?.totalTimeSeconds ?? 0,
            avgSpeedKmh: row?.avgSpeedKmh ?? null,
            bestSpeedKmh: row?.bestSpeedKmh ?? null,
        };
    }

    static async getRepsOnlySummary(days: number): Promise<RepsOnlySummary> {
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
                  AND e.type = 'reps_only'
            `,
            [cutoffMs]
        );

        return {
            days,
            sessions: row?.sessions ?? 0,
            totalReps: row?.totalReps ?? 0,
            bestReps: row?.bestReps ?? null,
        };
    }

    static async getWeightOnlySummary(days: number): Promise<WeightOnlySummary> {
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
                  AND e.type = 'weight_only'
            `,
            [cutoffMs]
        );

        return {
            days,
            sessions: row?.sessions ?? 0,
            bestWeightKg: row?.bestWeightKg ?? null,
        };
    }

    static async getWorkoutSummaryBetween(startMs: number, endMs: number): Promise<Omit<WorkoutSummary, 'days'> & { startMs: number; endMs: number }> {
        const workoutCountRow = await dbService.getFirst<{ count: number }>(
            'SELECT COUNT(*) as count FROM workouts WHERE status = ? AND date > ? AND date <= ?',
            ['completed', startMs, endMs]
        );
        const volumeRow = await dbService.getFirst<{ total: number }>(
            `
                SELECT COALESCE(SUM(s.weight * s.reps), 0) as total
                FROM workout_sets s
                JOIN workouts w ON s.workout_id = w.id
                JOIN exercises e ON e.id = s.exercise_id
                WHERE w.status = 'completed'
                AND w.date > ?
                AND w.date <= ?
                AND s.completed = 1
                AND e.type = 'weight_reps'
            `,
            [startMs, endMs]
        );
        const avgDurationRow = await dbService.getFirst<{ avgMin: number | null }>(
            `
                SELECT AVG((end_time - start_time) / 60000.0) as avgMin
                FROM workouts
                WHERE status = 'completed'
                AND date > ?
                AND date <= ?
                AND end_time IS NOT NULL
                AND start_time IS NOT NULL
                AND end_time > start_time
            `,
            [startMs, endMs]
        );

        return {
            startMs,
            endMs,
            workoutCount: workoutCountRow?.count ?? 0,
            totalVolume: Math.round(volumeRow?.total ?? 0),
            avgDurationMin: avgDurationRow?.avgMin ?? null
        };
    }

    static async getWorkoutComparison(days: number): Promise<WorkoutComparison> {
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
            avgDurationMin: currentRaw.avgDurationMin
        };
        const previous: WorkoutSummary = {
            days,
            workoutCount: previousRaw.workoutCount,
            totalVolume: previousRaw.totalVolume,
            avgDurationMin: previousRaw.avgDurationMin
        };

        const volumeChangePct = previous.totalVolume > 0
            ? Math.round(((current.totalVolume - previous.totalVolume) / previous.totalVolume) * 100)
            : null;
        const workoutChangePct = previous.workoutCount > 0
            ? Math.round(((current.workoutCount - previous.workoutCount) / previous.workoutCount) * 100)
            : null;

        return { days, current, previous, volumeChangePct, workoutChangePct };
    }

    static async getVolumeSeries(days: number, bucket: 'day' | 'week' | 'month'): Promise<VolumeSeriesPoint[]> {
        const now = Date.now();
        const cutoffMs = now - (days * 86400 * 1000);

        const rows = await dbService.getAll<{ date: number; volume: number }>(
            `
                SELECT w.date as date, COALESCE(SUM(s.weight * s.reps), 0) as volume
                FROM workouts w
                JOIN workout_sets s ON s.workout_id = w.id
                WHERE w.status = 'completed' AND w.date > ? AND s.completed = 1
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

        const bucketMap = new Map<string, { dateMs: number; volume: number }>();
        for (const r of rows) {
            const key = keyFor(r.date);
            if (!bucketMap.has(key)) {
                const dateMs = bucket === 'month'
                    ? new Date(Number(key.split('-')[0]), Number(key.split('-')[1]) - 1, 1).getTime()
                    : new Date(Number(key.split('-')[0]), Number(key.split('-')[1]) - 1, Number(key.split('-')[2])).getTime();
                bucketMap.set(key, { dateMs, volume: 0 });
            }
            bucketMap.get(key)!.volume += r.volume || 0;
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
                return { label, dateMs: v.dateMs, volume: Math.round(v.volume) };
            })
            .sort((a, b) => a.dateMs - b.dateMs);

        return points;
    }

    static async getCategoryVolume(days: number, limit: number = 6): Promise<CategoryVolumeRow[]> {
        const now = Date.now();
        const cutoffMs = now - (days * 86400 * 1000);

        const rows = await dbService.getAll<CategoryVolumeRow>(
            `
                SELECT
                    c.id as categoryId,
                    c.name as categoryName,
                    c.color as categoryColor,
                    COALESCE(SUM(CASE WHEN s.weight > 0 AND s.reps > 0 THEN (s.weight * s.reps) ELSE 0 END), 0) as volume,
                    COALESCE(COUNT(CASE WHEN s.weight > 0 AND s.reps > 0 THEN 1 END), 0) as setCount
                FROM workout_sets s
                JOIN workouts w ON s.workout_id = w.id
                JOIN exercises e ON s.exercise_id = e.id
                JOIN categories c ON e.category_id = c.id
                WHERE w.status = 'completed'
                AND w.date > ?
                AND s.completed = 1
                AND e.type = 'weight_reps'
                GROUP BY c.id
                ORDER BY volume DESC
                LIMIT ?
            `,
            [cutoffMs, limit]
        );

        return rows.map((r) => ({
            ...r,
            volume: Math.round((r as any).volume ?? 0),
            setCount: (r as any).setCount ?? 0,
        }));
    }

    static async getTopExercisesByVolume(days: number, limit: number = 8): Promise<ExerciseVolumeRow[]> {
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
                    COALESCE(COUNT(CASE WHEN s.weight > 0 AND s.reps > 0 THEN 1 END), 0) as setCount
                FROM workout_sets s
                JOIN workouts w ON s.workout_id = w.id
                JOIN exercises e ON s.exercise_id = e.id
                JOIN categories c ON e.category_id = c.id
                WHERE w.status = 'completed'
                AND w.date > ?
                AND s.completed = 1
                AND e.type = 'weight_reps'
                GROUP BY e.id
                ORDER BY volume DESC
                LIMIT ?
            `,
            [cutoffMs, limit]
        );

        return rows.map((r) => ({
            ...r,
            volume: Math.round((r as any).volume ?? 0),
            setCount: (r as any).setCount ?? 0,
        }));
    }

    static async getTop1RMProgress(days: number, limit: number = 6): Promise<OneRMProgressRow[]> {
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
                    w.date as date
                FROM workout_sets s
                JOIN workouts w ON s.workout_id = w.id
                JOIN exercises e ON s.exercise_id = e.id
                WHERE w.status = 'completed'
                AND w.date > ?
                AND s.completed = 1
                AND s.weight > 0
                AND s.reps > 0
            `,
            [cutoffMs]
        );

        const map = new Map<string, { exerciseId: string; exerciseName: string; start: number; end: number }>();
        for (const r of rows) {
            const epley = Math.round(r.weight * (1 + r.reps / 30));
            if (!Number.isFinite(epley) || epley <= 0) continue;
            if (!map.has(r.exerciseId)) {
                map.set(r.exerciseId, { exerciseId: r.exerciseId, exerciseName: r.exerciseName, start: 0, end: 0 });
            }
            const cur = map.get(r.exerciseId)!;
            if (r.date <= midMs) {
                if (epley > cur.start) cur.start = epley;
            } else {
                if (epley > cur.end) cur.end = epley;
            }
        }

        const result: OneRMProgressRow[] = [];
        map.forEach((v) => {
            if (v.start <= 0 || v.end <= 0) return;
            const delta = v.end - v.start;
            if (delta <= 0) return;
            const deltaPct = v.start > 0 ? Math.round((delta / v.start) * 100) : null;
            result.push({
                exerciseId: v.exerciseId,
                exerciseName: v.exerciseName,
                start1RM: v.start,
                end1RM: v.end,
                delta,
                deltaPct
            });
        });

        return result.sort((a, b) => b.delta - a.delta).slice(0, limit);
    }

    static async getWorkoutStreakLastYear(): Promise<WorkoutStreak> {
        const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
        const rows = await dbService.getAll<{ date: number }>(
            'SELECT date FROM workouts WHERE status = ? AND date > ? ORDER BY date ASC',
            ['completed', oneYearAgo]
        );

        const dayKeys = Array.from(
            new Set(
                rows.map((r) => {
                    const d = new Date(r.date);
                    const localMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
                    return Math.floor(localMidnight / 86400000);
                })
            )
        ).sort((a, b) => a - b);

        if (dayKeys.length === 0) {
            return { current: 0, best: 0 };
        }

        let best = 1;
        let run = 1;
        for (let i = 1; i < dayKeys.length; i++) {
            if (dayKeys[i] === dayKeys[i - 1] + 1) {
                run += 1;
                if (run > best) best = run;
            } else {
                run = 1;
            }
        }

        const today = new Date();
        const todayKey = Math.floor(new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() / 86400000);
        const latestKey = dayKeys[dayKeys.length - 1];

        let current = 0;
        if (latestKey === todayKey || latestKey === todayKey - 1) {
            current = 1;
            for (let i = dayKeys.length - 2; i >= 0; i--) {
                if (dayKeys[i] === dayKeys[i + 1] - 1) {
                    current += 1;
                } else {
                    break;
                }
            }
        }

        return { current, best };
    }

    static async getExercisePR(exerciseId: string): Promise<ExercisePR | null> {
        const row = await dbService.getFirst<{ weight: number; reps: number; date: number }>(
            `
                SELECT s.weight as weight, s.reps as reps, w.date as date
                FROM workout_sets s
                JOIN workouts w ON s.workout_id = w.id
                WHERE s.exercise_id = ?
                AND s.completed = 1
                AND s.weight IS NOT NULL
                ORDER BY s.weight DESC, COALESCE(s.reps, 0) DESC, w.date DESC
                LIMIT 1
            `,
            [exerciseId]
        );

        if (!row || row.weight == null) return null;
        return {
            weight: row.weight ?? 0,
            reps: row.reps ?? 0,
            date: row.date ?? 0
        };
    }

    static async getPowerliftingPRs(): Promise<PowerliftingPRs> {
        const exercises = await dbService.getAll<{ id: string; name: string }>('SELECT id, name FROM exercises ORDER BY name ASC');
        const normalized = exercises.map((e) => ({ ...e, norm: e.name.toLowerCase() }));

        const findBy = (include: string[], exclude: string[] = []) => {
            return normalized.find((e) => include.some((k) => e.norm.includes(k)) && !exclude.some((k) => e.norm.includes(k)))?.id ?? null;
        };

        const squatId =
            findBy(['squat', 'sentadilla'], ['split', 'bulgar', 'hack']) ??
            findBy(['front squat', 'sentadilla frontal'], []);
        const benchId =
            findBy(['bench press', 'press banca', 'banca'], ['dumb', 'mancuern', 'incline', 'inclinado']) ??
            findBy(['press'], ['military', 'overhead', 'hombro']);
        const deadliftId =
            findBy(['deadlift', 'peso muerto'], ['romanian', 'rumano', 'rdl']) ??
            findBy(['peso muerto convencional'], []);

        const squat = squatId ? await AnalysisService.getExercisePR(squatId) : null;
        const bench = benchId ? await AnalysisService.getExercisePR(benchId) : null;
        const deadlift = deadliftId ? await AnalysisService.getExercisePR(deadliftId) : null;

        const totalKg = (squat?.weight ?? 0) + (bench?.weight ?? 0) + (deadlift?.weight ?? 0);

        return { squat, bench, deadlift, totalKg };
    }

}
