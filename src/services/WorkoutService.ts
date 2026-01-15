import { endOfDay, getUnixTime, startOfDay } from 'date-fns';
import { Workout, WorkoutSet } from '../types/db';
import { dbService } from './DatabaseService';

class WorkoutService {
    private calendarEventsCache: { ts: number; data: Record<string, { status: string; colors: string[] }> } | null = null;
    private exerciseHistoryCache = new Map<string, { ts: number; data: { date: number; sets: WorkoutSet[] }[] }>();

    private invalidateCaches() {
        this.calendarEventsCache = null;
        this.exerciseHistoryCache.clear();
    }

    /**
     * Get or create a workout for a specific date.
     * @param date Date object
     */
    /**
     * Get calendar events: dates with status and muscle colors.
     */
    public async getCalendarEvents(): Promise<Record<string, { status: string, colors: string[] }>> {
        const now = Date.now();
        if (this.calendarEventsCache && now - this.calendarEventsCache.ts < 15_000) {
            return this.calendarEventsCache.data;
        }

        const rows = await dbService.getAll<{ id: string; date: number; status: string; colors: string | null }>(`
            SELECT 
                w.id as id,
                w.date as date,
                w.status as status,
                GROUP_CONCAT(DISTINCT c.color) as colors
            FROM workouts w
            LEFT JOIN workout_sets s ON s.workout_id = w.id
            LEFT JOIN exercises e ON s.exercise_id = e.id
            LEFT JOIN categories c ON e.category_id = c.id
            GROUP BY w.id
        `);

        const events: Record<string, { status: string; colors: string[] }> = {};
        for (const r of rows) {
            const dateStr = new Date(r.date).toISOString().split('T')[0];
            const colors = (r.colors || '')
                .split(',')
                .map(s => s.trim())
                .filter(Boolean);
            events[dateStr] = { status: r.status, colors };
        }

        this.calendarEventsCache = { ts: now, data: events };
        return events;
    }

    // ... (getActiveWorkout, getSets, etc. remain the same, I am not replacing them here, only the start of class methods usually)
    // Wait, replacing a chunk.

    public async loadTemplate(templateId: string, targetDateStr: string): Promise<string> {
        const template = await dbService.getWorkoutById(templateId);
        if (!template) throw new Error('Template not found');

        // Parse date strictly (YYYY-MM-DD)
        const parts = targetDateStr.split('-');
        // Force NOON (12:00) local time to ensure it lands on the correct calendar day
        const dateObj = new Date(
            parseInt(parts[0]),
            parseInt(parts[1]) - 1,
            parseInt(parts[2]),
            12, 0, 0
        );

        const newDate = dateObj.getTime(); // Local Unix ms
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

        this.invalidateCaches();
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
        type: 'normal' | 'warmup' | 'failure' | 'drop' | 'pr' = 'normal',
        overrides?: Partial<WorkoutSet>
    ) {
        // 1. Determine Order Index
        // We need to fetch current sets to determine the next order index securely
        const currentSets = await dbService.getSetsForWorkout(workoutId);
        const nextIndex = currentSets.length;

        // 2. Fetch Ghost Values (History) if not provided
        let weight = overrides?.weight;
        let reps = overrides?.reps;

        if (weight === undefined || reps === undefined) {
            // Check if there is a previous set IN THIS WORKOUT for the same exercise to copy from
            const sameExerciseSets = currentSets.filter(s => s.exercise_id === exerciseId);
            if (sameExerciseSets.length > 0) {
                const last = sameExerciseSets[sameExerciseSets.length - 1];
                weight = weight ?? last.weight;
                reps = reps ?? last.reps;
            } else {
                // Fetch from strict history
                const lastHistorySet = await dbService.getLastSetForExercise(exerciseId);
                weight = weight ?? lastHistorySet?.weight;
                reps = reps ?? lastHistorySet?.reps;
            }
        }

        // 3. Create Set
        const id = await dbService.addSet({
            workout_id: workoutId,
            exercise_id: exerciseId,
            type: type,
            order_index: nextIndex,
            weight: weight ?? 0,
            reps: reps ?? 0,
            notes: overrides?.notes,
            rpe: overrides?.rpe,
            completed: 0
        });
        this.invalidateCaches();
        return id;
    }

    public async updateSet(id: string, updates: Partial<WorkoutSet>) {
        // Validation could go here (e.g. negative weight check)
        if (updates.weight !== undefined && updates.weight < 0) throw new Error('Weight cannot be negative');
        if (updates.reps !== undefined && updates.reps < 0) throw new Error('Reps cannot be negative');
        
        await dbService.updateSet(id, updates);
        this.invalidateCaches();
    }

    public async deleteSet(id: string) {
        await dbService.deleteSet(id);
        this.invalidateCaches();
    }

    public async finishWorkout(id: string) {
        const workout = await dbService.getWorkoutById(id);
        if (workout?.status === 'completed') return; // Idempotent

        await dbService.run(
            'UPDATE workouts SET status = ?, end_time = ? WHERE id = ?',
            ['completed', Date.now(), id]
        );
        this.invalidateCaches();
    }

    public async resumeWorkout(id: string): Promise<void> {
        await dbService.run(
            'UPDATE workouts SET status = ? WHERE id = ?',
            ['in_progress', id]
        );
        this.invalidateCaches();
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
        const cached = this.exerciseHistoryCache.get(exerciseId);
        const now = Date.now();
        if (cached && now - cached.ts < 30_000 && cached.data.length > 0) {
            return cached.data.slice(0, limit);
        }

        // Get workouts that have at least one completed set for this exercise
        const sql = `
            SELECT DISTINCT w.id, w.date 
            FROM workouts w 
            JOIN workout_sets s ON w.id = s.workout_id 
            WHERE s.exercise_id = ? 
            AND s.completed = 1
            ORDER BY w.date DESC 
            LIMIT ?
        `;
        const workouts = await dbService.getAll<{ id: string; date: number }>(sql, [exerciseId, limit]);

        const history = await Promise.all(workouts.map(async (w) => {
            const sets = await dbService.getAll<WorkoutSet>(
                'SELECT * FROM workout_sets WHERE workout_id = ? AND exercise_id = ? AND completed = 1 ORDER BY order_index ASC',
                [w.id, exerciseId]
            );
            return { date: w.date, sets };
        }));

        this.exerciseHistoryCache.set(exerciseId, { ts: now, data: history });
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

    public async createTemplate(name: string): Promise<string> {
        const id = this.generateId();
        await dbService.run(
            'INSERT INTO workouts (id, name, date, start_time, status, is_template) VALUES (?, ?, ?, ?, ?, ?)',
            [id, name, Date.now(), Date.now(), 'in_progress', 1]
        );
        this.invalidateCaches();
        return id;
    }

    public async saveWorkoutAsTemplate(workoutId: string, templateName: string): Promise<string> {
        // 1. Create Template Workout
        const templateId = await this.createTemplate(templateName);

        // 2. Copy Sets
        const sets = await this.getSets(workoutId);
        for (const set of sets) {
            await dbService.addSet({
                workout_id: templateId,
                exercise_id: set.exercise_id,
                type: set.type,
                order_index: set.order_index,
                weight: set.weight,
                reps: set.reps,
                notes: set.notes,
                rpe: set.rpe,
                completed: 0 // Templates sets are never "completed"
            });
        }
        this.invalidateCaches();
        return templateId;
    }

    public async getExercise(id: string) {
        return await dbService.getExerciseById(id);
    }

    public async delete(id: string): Promise<void> {
        try {
            await dbService.run('BEGIN TRANSACTION');
            // Explicitly delete sets first to ensure referential integrity if ON DELETE CASCADE fails or is disabled
            await dbService.run('DELETE FROM workout_sets WHERE workout_id = ?', [id]);
            await dbService.run('DELETE FROM workouts WHERE id = ?', [id]);
            await dbService.run('COMMIT');
            this.invalidateCaches();
        } catch (e) {
            await dbService.run('ROLLBACK');
            throw e;
        }
    }

    public async reorderExercises(workoutId: string, newExerciseOrder: string[]) {
        const sets = await this.getSets(workoutId);
        // Group sets by exercise
        const grouped: Record<string, WorkoutSet[]> = {};
        sets.forEach(s => {
            if (!grouped[s.exercise_id]) grouped[s.exercise_id] = [];
            grouped[s.exercise_id].push(s);
        });

        let currentOrderIndex = 0;

        // Iterate through the NEW exercise order
        // and assign sequential indices to their sets
        for (const exId of newExerciseOrder) {
            const exerciseSets = grouped[exId] || [];
            // Sort internal sets by their existing relative order (or id) to maintain internal set order
            exerciseSets.sort((a, b) => a.order_index - b.order_index);

            for (const set of exerciseSets) {
                if (set.order_index !== currentOrderIndex) {
                    await this.updateSet(set.id, { order_index: currentOrderIndex });
                }
                currentOrderIndex++;
            }
        }
    }



}

export const workoutService = new WorkoutService();
