import { endOfDay, getUnixTime, startOfDay } from 'date-fns';
import { Workout, WorkoutSet } from '../types/db';
import { dbService } from './DatabaseService';

class WorkoutService {
    /**
     * Get or create a workout for a specific date.
     * @param date Date object
     */
    /**
     * Get calendar events: dates with status and muscle colors.
     */
    public async getCalendarEvents(): Promise<Record<string, { status: string, colors: string[] }>> {
        const db = dbService.getDatabase();
        // Get all workouts with their ID, date, status
        const workouts = await db.getAllAsync<{ id: string, date: number, status: string }>('SELECT id, date, status FROM workouts');

        const events: Record<string, { status: string, colors: string[] }> = {};

        for (const w of workouts) {
            const dateStr = new Date(w.date).toISOString().split('T')[0];

            // Get muscle colors for this workout
            // Distinct colors from categories used in this workout
            const colorsResult = await db.getAllAsync<{ color: string }>(`
                SELECT DISTINCT c.color
                FROM workout_sets s
                JOIN exercises e ON s.exercise_id = e.id
                JOIN categories c ON e.category_id = c.id
                WHERE s.workout_id = ?
            `, [w.id]);

            const colors = colorsResult.map(c => c.color);

            events[dateStr] = {
                status: w.status,
                colors: colors
            };
        }

        return events;
    }

    // ... (getActiveWorkout, getSets, etc. remain the same, I am not replacing them here, only the start of class methods usually)
    // Wait, replacing a chunk.

    public async loadTemplate(templateId: string, targetDateStr: string): Promise<string> {
        const template = await dbService.getWorkoutById(templateId);
        if (!template) throw new Error('Template not found');

        // Parse date strictly (YYYY-MM-DD)
        // We set it to NOON to be safe from timezone shifts
        const parts = targetDateStr.split('-');
        const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
        const newDate = dateObj.getTime(); // Unix ms
        const now = Date.now();

        const newId = this.generateId();

        await dbService.run(
            'INSERT INTO workouts (id, name, date, start_time, status, is_template) VALUES (?, ?, ?, ?, ?, ?)',
            [newId, template.name, newDate, now, 'in_progress', 0]
        );

        // Copy Sets
        const sets = await this.getSets(templateId);
        for (const set of sets) {
            await dbService.addSet({
                workout_id: newId,
                exercise_id: set.exercise_id,
                type: set.type,
                order_index: set.order_index,
                weight: set.weight,
                reps: set.reps,
                // New sets are not completed
                completed: 0
            });
        }

        return newId;
    }

    public async getActiveWorkout(date: Date): Promise<Workout> {
        const start = getUnixTime(startOfDay(date)) * 1000;
        const end = getUnixTime(endOfDay(date)) * 1000;

        let workout = await dbService.getWorkoutByDate(start, end);

        if (!workout) {
            // Create new workout
            const workoutDate = getUnixTime(date) * 1000;
            const id = await dbService.createWorkout(workoutDate);
            workout = await dbService.getWorkoutById(id);
        }

        if (!workout) throw new Error('Failed to create/fetch workout');

        return workout;
    }

    public async getSets(workoutId: string) {
        const sets = await dbService.getSetsForWorkout(workoutId);
        const workout = await dbService.getWorkoutById(workoutId);

        if (!workout || sets.length === 0) return sets;

        // Group sets by exercise to batch process
        const exerciseIds = [...new Set(sets.map(s => s.exercise_id))];

        for (const exId of exerciseIds) {
            // Find the last completed workout before this one that had this exercise
            const sql = `
                SELECT w.id 
                FROM workouts w 
                JOIN workout_sets s ON w.id = s.workout_id 
                WHERE s.exercise_id = ? 
                AND w.date < ? 
                AND w.status = 'completed'
                ORDER BY w.date DESC 
                LIMIT 1
            `;
            const result = await dbService.getAll<{ id: string }>(sql, [exId, workout.date]);

            if (result.length > 0) {
                const prevWorkoutId = result[0].id;
                // Fetch sets from that workout for this exercise
                const prevSets = await dbService.getAll<WorkoutSet>(
                    `SELECT * FROM workout_sets WHERE workout_id = ? AND exercise_id = ? ORDER BY order_index ASC`,
                    [prevWorkoutId, exId]
                );

                // Map current sets to prev sets by index (Set 1 -> Set 1)
                const currentExSets = sets.filter(s => s.exercise_id === exId);

                currentExSets.forEach((set, idx) => {
                    // Find matching set by index if possible, or order_index
                    // Assuming reliable ordering.
                    if (prevSets[idx]) {
                        set.previous_weight = prevSets[idx].weight;
                        set.previous_reps = prevSets[idx].reps;
                        set.previous_rpe = prevSets[idx].rpe;
                    }
                });
            }
        }

        return sets;
    }

    public async addSet(
        workoutId: string,
        exerciseId: string,
        type: 'normal' | 'warmup' | 'failure' | 'drop' | 'pr',
        orderIndex: number,
        overrides?: Partial<WorkoutSet>
    ) {
        // Fetch ghost values from history (only if no overrides provided for weight/reps)
        let weight = overrides?.weight;
        let reps = overrides?.reps;

        if (weight === undefined || reps === undefined) {
            const lastSet = await dbService.getLastSetForExercise(exerciseId);
            if (weight === undefined) weight = lastSet?.weight;
            if (reps === undefined) reps = lastSet?.reps;
        }

        return await dbService.addSet({
            workout_id: workoutId,
            exercise_id: exerciseId,
            type: type,
            order_index: orderIndex,
            weight: weight,
            reps: reps,
            notes: overrides?.notes,
            rpe: overrides?.rpe,
            completed: 0
        });
    }

    public async updateSet(id: string, updates: Partial<WorkoutSet>) {
        return await dbService.updateSet(id, updates);
    }

    public async deleteSet(id: string) {
        return await dbService.deleteSet(id);
    }

    public async finishWorkout(id: string) {
        const workout = await dbService.getWorkoutById(id);
        if (workout?.status === 'completed') return; // Idempotent

        await dbService.run(
            'UPDATE workouts SET status = ?, end_time = ? WHERE id = ?',
            ['completed', Date.now(), id]
        );
    }

    public async resumeWorkout(id: string): Promise<void> {
        await dbService.run(
            'UPDATE workouts SET status = ? WHERE id = ?',
            ['in_progress', id]
        );
    }

    // --- SUPERSETS ---

    public async createSuperset(workoutId: string, exerciseIds: string[]) {
        if (exerciseIds.length < 2) return;

        // Generate a new Superset UUID
        const supersetId = this.generateId();

        // Update all sets for these exercises in this workout
        // We use IN clause
        const placeholders = exerciseIds.map(() => '?').join(',');
        const sql = `UPDATE workout_sets SET superset_id = ? WHERE workout_id = ? AND exercise_id IN (${placeholders})`;
        const params = [supersetId, workoutId, ...exerciseIds];

        return await dbService.run(sql, params);
    }

    public async addToSuperset(workoutId: string, targetSupersetId: string, exerciseId: string) {
        return await dbService.run(
            'UPDATE workout_sets SET superset_id = ? WHERE workout_id = ? AND exercise_id = ?',
            [targetSupersetId, workoutId, exerciseId]
        );
    }

    public async removeFromSuperset(workoutId: string, exerciseId: string) {
        return await dbService.run(
            'UPDATE workout_sets SET superset_id = NULL WHERE workout_id = ? AND exercise_id = ?',
            [workoutId, exerciseId]
        );
    }

    private generateId(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    public async getCompletedWorkoutsLastYear(): Promise<number[]> {
        const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
        const result = await dbService.getAll<{ date: number }>('SELECT date FROM workouts WHERE status = ? AND date > ?', ['completed', oneYearAgo]);
        return result.map(r => r.date);
    }

    public async getExerciseHistory(exerciseId: string, limit: number = 5): Promise<{ date: number; sets: WorkoutSet[] }[]> {
        const sql = `
            SELECT DISTINCT w.id, w.date 
            FROM workouts w 
            JOIN workout_sets s ON w.id = s.workout_id 
            WHERE s.exercise_id = ? 
            AND w.status = 'completed' 
            ORDER BY w.date DESC 
            LIMIT ?
        `;
        const workouts = await dbService.getAll<{ id: string; date: number }>(sql, [exerciseId, limit]);

        const history = await Promise.all(workouts.map(async (w) => {
            const sets = await dbService.getAll<WorkoutSet>(
                'SELECT * FROM workout_sets WHERE workout_id = ? AND exercise_id = ? ORDER BY order_index ASC',
                [w.id, exerciseId]
            );
            return { date: w.date, sets };
        }));

        return history;
    }

    public async update(id: string, updates: Partial<Workout>): Promise<void> {
        const fields: string[] = [];
        const values: any[] = [];
        Object.entries(updates).forEach(([key, value]) => {
            if (key !== 'id' && value !== undefined) {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        });
        if (fields.length === 0) return;
        values.push(id);
        await dbService.run(`UPDATE workouts SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    public async getTemplates(): Promise<Workout[]> {
        return await dbService.getAll<Workout>('SELECT * FROM workouts WHERE is_template = 1 ORDER BY name ASC');
    }

    public async getExercise(id: string) {
        return await dbService.getExerciseById(id);
    }

    public async delete(id: string): Promise<void> {
        // Sets should cascade delete ideally, but let's be safe
        await dbService.run('DELETE FROM workout_sets WHERE workout_id = ?', [id]);
        await dbService.run('DELETE FROM workouts WHERE id = ?', [id]);
    }


}

export const workoutService = new WorkoutService();
