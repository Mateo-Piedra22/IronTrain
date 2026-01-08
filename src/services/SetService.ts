import { WorkoutSet } from '../types/db';
import { dbService } from './DatabaseService';

export class SetService {
    static async getByWorkout(workoutId: string): Promise<WorkoutSet[]> {
        return await dbService.getAll<WorkoutSet>(
            `SELECT * FROM workout_sets WHERE workout_id = ? ORDER BY order_index ASC`,
            [workoutId]
        );
    }

    static async add(set: WorkoutSet): Promise<void> {
        await dbService.addSet(set);
    }

    static async update(id: string, updates: Partial<WorkoutSet>): Promise<void> {
        // Construct dynamic query
        const keys = Object.keys(updates);
        if (keys.length === 0) return;

        const setString = keys.map(k => `${k} = ?`).join(', ');
        const values = Object.values(updates);

        await dbService.run(
            `UPDATE workout_sets SET ${setString} WHERE id = ?`,
            [...values, id]
        );
    }

    static async delete(id: string): Promise<void> {
        await dbService.run('DELETE FROM workout_sets WHERE id = ?', [id]);
    }
}
