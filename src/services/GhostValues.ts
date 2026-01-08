import { dbService } from './DatabaseService';

export interface GhostValue {
    weight: number;
    reps: number;
    rpe?: number;
    date: number; // timestamp
}

export class GhostValueService {
    static async getLastSet(exerciseId: string): Promise<GhostValue | null> {
        // Find the last completed workout set for this exercise
        const result = await dbService.getFirst<any>(`
            SELECT s.weight, s.reps, s.rpe, w.date
            FROM workout_sets s
            JOIN workouts w ON s.workout_id = w.id
            WHERE s.exercise_id = ? AND s.completed = 1
            ORDER BY w.date DESC, s.order_index DESC
            LIMIT 1
        `, [exerciseId]);

        if (result) {
            return {
                weight: result.weight,
                reps: result.reps,
                rpe: result.rpe,
                date: result.date
            };
        }

        return null;
    }
}
