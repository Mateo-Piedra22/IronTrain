import { dbService } from './DatabaseService';

export interface OneRepMax {
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

export class AnalysisService {
    // 1RM Calculation (Epley Formula)
    static async getTop1RMs(): Promise<OneRepMax[]> {
        // Get generic results
        const results = await dbService.getAll<any>(`
            SELECT e.name as exerciseName, s.weight, s.reps, w.date
            FROM workout_sets s
            JOIN exercises e ON s.exercise_id = e.id
            JOIN workouts w ON s.workout_id = w.id
            WHERE s.completed = 1 AND s.weight > 0 AND s.reps > 0
            ORDER BY s.weight DESC
        `);

        // Process in JS to find max 1RM per exercise
        const maxes: Record<string, OneRepMax> = {};

        results.forEach(r => {
            // Epley: weight * (1 + reps/30)
            const epley = Math.round(r.weight * (1 + r.reps / 30));
            if (!maxes[r.exerciseName] || epley > maxes[r.exerciseName].estimated1RM) {
                maxes[r.exerciseName] = {
                    exerciseName: r.exerciseName,
                    weight: r.weight,
                    reps: r.reps,
                    estimated1RM: epley,
                    date: r.date
                };
            }
        });

        return Object.values(maxes).slice(0, 5).sort((a, b) => b.estimated1RM - a.estimated1RM);
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
            WHERE w.status = 'completed' AND s.completed = 1
            GROUP BY w.id
            ORDER BY w.date ASC
            LIMIT 7
        `);

        return results.map(r => ({
            date: new Date(r.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
            volume: r.volume || 0
        }));
    }


}
