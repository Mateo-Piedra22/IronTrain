import { ExerciseType, WorkoutSet } from '../types/db';
import { dbService } from './DatabaseService';

export class SetService {
    static async getByWorkout(workoutId: string): Promise<WorkoutSet[]> {
        return await dbService.getAll<WorkoutSet>(
            `SELECT * FROM workout_sets WHERE workout_id = ? ORDER BY order_index ASC`,
            [workoutId]
        );
    }

    static async add(set: WorkoutSet): Promise<void> {
        const exercise = await dbService.getExerciseById(set.exercise_id);
        const exerciseType: ExerciseType = (exercise?.type as ExerciseType) ?? 'weight_reps';

        const payload: any = { ...set };
        if (exerciseType === 'distance_time') {
            payload.weight = null;
            payload.reps = null;
        } else if (exerciseType === 'reps_only') {
            payload.weight = null;
            payload.distance = null;
            payload.time = null;
        } else if (exerciseType === 'weight_only') {
            payload.reps = null;
            payload.distance = null;
            payload.time = null;
        } else {
            payload.distance = null;
            payload.time = null;
        }

        await dbService.addSet(payload);
    }

    static async update(id: string, updates: Partial<WorkoutSet>): Promise<void> {
        const existing = await dbService.getSetById(id);
        if (!existing) throw new Error('Set not found');
        const exercise = await dbService.getExerciseById(existing.exercise_id);
        const exerciseType: ExerciseType = (exercise?.type as ExerciseType) ?? 'weight_reps';

        const filtered: any = { ...updates };
        const allowWeight = exerciseType === 'weight_reps' || exerciseType === 'weight_only';
        const allowReps = exerciseType === 'weight_reps' || exerciseType === 'reps_only';
        const allowDistanceTime = exerciseType === 'distance_time';

        if (!allowWeight) filtered.weight = null;
        if (!allowReps) filtered.reps = null;
        if (!allowDistanceTime) {
            filtered.distance = null;
            filtered.time = null;
        }

        if (filtered.weight !== undefined && filtered.weight !== null && filtered.weight < 0) throw new Error('Weight cannot be negative');
        if (filtered.reps !== undefined && filtered.reps !== null && filtered.reps < 0) throw new Error('Reps cannot be negative');
        if (filtered.distance !== undefined && filtered.distance !== null && filtered.distance < 0) throw new Error('Distance cannot be negative');
        if (filtered.time !== undefined && filtered.time !== null && filtered.time < 0) throw new Error('Time cannot be negative');

        // Construct dynamic query
        const keys = Object.keys(filtered);
        if (keys.length === 0) return;

        const setString = keys.map(k => `${k} = ?`).join(', ');
        const values = Object.values(filtered);

        await dbService.run(
            `UPDATE workout_sets SET ${setString} WHERE id = ?`,
            [...values, id]
        );
    }

    static async delete(id: string): Promise<void> {
        await dbService.run('DELETE FROM workout_sets WHERE id = ?', [id]);
    }
}
