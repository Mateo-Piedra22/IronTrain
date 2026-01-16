import { endOfDay, getUnixTime, startOfDay } from 'date-fns';
import { ExerciseType, Workout, WorkoutSet } from '../types/db';
import { dbService } from './DatabaseService';

type CopyMode = 'replace' | 'append';
type CopyNameMode = 'if_empty' | 'always' | 'never';
type CopyContentMode = 'full' | 'structure' | 'exercises_only';

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

        const start = getUnixTime(startOfDay(dateObj)) * 1000;
        const end = getUnixTime(endOfDay(dateObj)) * 1000;

        const existing = await dbService.getWorkoutByDate(start, end);
        let targetWorkoutId = existing?.id ?? null;

        if (targetWorkoutId) {
            const existingSets = await dbService.getSetsForWorkout(targetWorkoutId);
            if (existingSets.length > 0) {
                targetWorkoutId = null;
            }
        }

        const newId = targetWorkoutId ?? this.generateId();

        try {
            await dbService.run('BEGIN TRANSACTION');

            if (!targetWorkoutId) {
                await dbService.run(
                    'INSERT INTO workouts (id, name, date, start_time, status, is_template) VALUES (?, ?, ?, ?, ?, ?)',
                    [newId, template.name, newDate, now, 'in_progress', 0]
                );
            } else if (!existing?.name && template.name) {
                await dbService.run('UPDATE workouts SET name = ? WHERE id = ?', [template.name, newId]);
            }

            await this.copySetsIntoWorkout(templateId, newId);
            await dbService.run('COMMIT');
        } catch (e) {
            try { await dbService.run('ROLLBACK'); } catch { }
            throw e;
        }

        this.invalidateCaches();
        return newId;
    }

    public async getWorkoutWithSetsForDate(date: Date): Promise<Workout | null> {
        const start = getUnixTime(startOfDay(date)) * 1000;
        const end = getUnixTime(endOfDay(date)) * 1000;

        const rows = await dbService.getAll<(Workout & { set_count: number })>(`
            SELECT w.*, COUNT(s.id) as set_count
            FROM workouts w
            LEFT JOIN workout_sets s ON s.workout_id = w.id
            WHERE w.date >= ? AND w.date < ?
            GROUP BY w.id
            HAVING set_count > 0
            ORDER BY w.start_time DESC, w.date DESC
            LIMIT 1
        `, [start, end]);

        return rows?.[0] ?? null;
    }

    public async copyWorkoutToWorkout(sourceWorkoutId: string, targetWorkoutId: string): Promise<void> {
        await this.copyWorkoutToWorkoutAdvanced(sourceWorkoutId, targetWorkoutId, { mode: 'replace' });
    }

    public async getWorkout(id: string): Promise<Workout | null> {
        return await dbService.getWorkoutById(id);
    }

    public async copyWorkoutToWorkoutAdvanced(
        sourceWorkoutId: string,
        targetWorkoutId: string,
        options: {
            mode: CopyMode;
            content?: CopyContentMode;
            copyName?: CopyNameMode;
            dedupeByExercise?: boolean;
            resumeTargetIfCompleted?: boolean;
        }
    ): Promise<{ copied: number; skippedMissingExercises: number; skippedExistingExercises: number; mode: CopyMode; content: CopyContentMode }> {
        if (!sourceWorkoutId || !targetWorkoutId) throw new Error('Faltan datos para copiar');
        if (sourceWorkoutId === targetWorkoutId) throw new Error('No se puede copiar al mismo entrenamiento');

        const mode = options.mode;
        const content = options.content ?? 'full';
        const copyName = options.copyName ?? 'if_empty';
        const dedupeByExercise = options.dedupeByExercise ?? false;
        const resumeTargetIfCompleted = options.resumeTargetIfCompleted ?? false;

        const [sourceWorkout, targetWorkout] = await Promise.all([
            dbService.getWorkoutById(sourceWorkoutId),
            dbService.getWorkoutById(targetWorkoutId)
        ]);

        if (!sourceWorkout) throw new Error('No se encontró el entrenamiento origen');
        if (!targetWorkout) throw new Error('No se encontró el entrenamiento destino');

        if (targetWorkout.status === 'completed' && !resumeTargetIfCompleted) {
            throw new Error('El día destino está finalizado. Reanúdalo o copiá a otro día.');
        }

        const [targetExistingSetsRaw, sourceSetsRaw] = await Promise.all([
            dbService.getSetsForWorkout(targetWorkoutId),
            dbService.getSetsForWorkout(sourceWorkoutId)
        ]);

        if (sourceSetsRaw.length === 0) throw new Error('El entrenamiento origen no tiene sets para copiar');

        const { sets: sourceSetsFiltered, skippedMissingExercises } = await this.filterSetsWithExistingExercises(sourceSetsRaw);
        if (sourceSetsFiltered.length === 0) throw new Error('No se pudieron copiar sets: faltan ejercicios en la biblioteca.');

        const targetExistingSets = mode === 'append' ? targetExistingSetsRaw : [];
        const targetExerciseIds = mode === 'append' && dedupeByExercise ? new Set(targetExistingSets.map((s) => s.exercise_id)) : null;
        const { sets: sourceSets, skippedExistingExercises } = targetExerciseIds
            ? this.filterSetsByMissingExercises(sourceSetsFiltered, targetExerciseIds)
            : { sets: sourceSetsFiltered, skippedExistingExercises: 0 };

        if (sourceSets.length === 0) {
            throw new Error('No hay nada nuevo para copiar (todos los ejercicios ya existen en el día destino).');
        }

        const startIndex =
            mode === 'append'
                ? ((targetExistingSets.reduce((m, s) => Math.max(m, (s.order_index ?? 0)), -1)) + 1)
                : 0;

        try {
            await dbService.run('BEGIN TRANSACTION');

            if (targetWorkout.status === 'completed' && resumeTargetIfCompleted) {
                await dbService.run('UPDATE workouts SET status = ?, end_time = NULL WHERE id = ?', ['in_progress', targetWorkoutId]);
            }

            if (mode === 'replace' && targetExistingSetsRaw.length > 0) {
                await dbService.run('DELETE FROM workout_sets WHERE workout_id = ?', [targetWorkoutId]);
            }

            const shouldCopyName =
                copyName === 'always' || (copyName === 'if_empty' && !targetWorkout.name);
            if (shouldCopyName && sourceWorkout.name) {
                await dbService.run('UPDATE workouts SET name = ? WHERE id = ?', [sourceWorkout.name, targetWorkoutId]);
            }

            const copied = await this.copySetsArrayIntoWorkout(sourceSets, targetWorkoutId, startIndex, content);
            await dbService.run('COMMIT');

            this.invalidateCaches();
            return { copied, skippedMissingExercises, skippedExistingExercises, mode, content };
        } catch (e) {
            try { await dbService.run('ROLLBACK'); } catch { }
            throw e;
        }
    }

    private async copySetsIntoWorkout(sourceWorkoutId: string, targetWorkoutId: string): Promise<void> {
        const sourceSets = await dbService.getSetsForWorkout(sourceWorkoutId);
        await this.copySetsArrayIntoWorkout(sourceSets, targetWorkoutId, 0, 'full');
    }

    private async copySetsArrayIntoWorkout(sourceSets: WorkoutSet[], targetWorkoutId: string, startIndex: number, content: CopyContentMode): Promise<number> {
        const ordered = [...sourceSets].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
        if (ordered.length > 500) throw new Error('El entrenamiento origen es demasiado grande para copiar.');
        const limited = ordered;

        const supersetMap = new Map<string, string>();

        const exerciseIds = Array.from(new Set(limited.map((s) => s.exercise_id))).filter(Boolean);
        const exTypeMap = new Map<string, ExerciseType>();
        if (exerciseIds.length > 0) {
            const placeholders = exerciseIds.map(() => '?').join(',');
            const rows = await dbService.getAll<{ id: string; type: ExerciseType }>(`SELECT id, type FROM exercises WHERE id IN (${placeholders})`, exerciseIds);
            for (const r of rows ?? []) exTypeMap.set(r.id, r.type);
        }

        let idx = startIndex;
        const iterable =
            content === 'exercises_only'
                ? Array.from(new Map(limited.map((s) => [s.exercise_id, s])).values())
                : limited;

        for (const set of iterable) {
            const exType = exTypeMap.get(set.exercise_id) ?? 'weight_reps';
            const originalSuperset = set.superset_id;
            let superset_id: string | undefined = undefined;
            if (content === 'full' && originalSuperset) {
                if (!supersetMap.has(originalSuperset)) supersetMap.set(originalSuperset, this.generateId());
                superset_id = supersetMap.get(originalSuperset) ?? undefined;
            }

            const base = {
                workout_id: targetWorkoutId,
                exercise_id: set.exercise_id,
                type: (content === 'exercises_only' ? 'normal' : set.type) as any,
                order_index: idx++,
                completed: 0,
            };

            const payload =
                content === 'full'
                    ? {
                        ...base,
                        weight: (exType === 'weight_reps' || exType === 'weight_only') ? this.sanitizeNonNegativeNumber(set.weight) : null,
                        reps: (exType === 'weight_reps' || exType === 'reps_only') ? this.sanitizeNonNegativeInt(set.reps) : null,
                        distance: exType === 'distance_time' ? this.sanitizeNonNegativeNumber(set.distance) : null,
                        time: exType === 'distance_time' ? this.sanitizeNonNegativeInt(set.time) : null,
                        rpe: this.sanitizeRpe(set.rpe),
                        notes: typeof set.notes === 'string' ? set.notes : null,
                        superset_id,
                    }
                    : {
                        ...base,
                        weight: null,
                        reps: null,
                        distance: null,
                        time: null,
                        rpe: null,
                        notes: null,
                        superset_id: undefined,
                    };

            await dbService.addSet(payload as any);
        }
        return iterable.length;
    }

    private filterSetsByMissingExercises(sourceSets: WorkoutSet[], existingExerciseIds: Set<string>): { sets: WorkoutSet[]; skippedExistingExercises: number } {
        const kept: WorkoutSet[] = [];
        let skipped = 0;
        for (const s of sourceSets) {
            if (existingExerciseIds.has(s.exercise_id)) {
                skipped++;
            } else {
                kept.push(s);
            }
        }
        return { sets: kept, skippedExistingExercises: skipped };
    }

    private async filterSetsWithExistingExercises(sourceSets: WorkoutSet[]): Promise<{ sets: WorkoutSet[]; skippedMissingExercises: number }> {
        const ids = Array.from(new Set(sourceSets.map((s) => s.exercise_id))).filter(Boolean);
        if (ids.length === 0) return { sets: [], skippedMissingExercises: sourceSets.length };

        const placeholders = ids.map(() => '?').join(',');
        const rows = await dbService.getAll<{ id: string }>(`SELECT id FROM exercises WHERE id IN (${placeholders})`, ids);
        const existing = new Set((rows ?? []).map((r) => r.id));

        const kept: WorkoutSet[] = [];
        let skipped = 0;
        for (const s of sourceSets) {
            if (existing.has(s.exercise_id)) kept.push(s);
            else skipped++;
        }
        return { sets: kept, skippedMissingExercises: skipped };
    }

    private sanitizeNonNegativeNumber(v: any): number | null {
        if (typeof v !== 'number') return null;
        if (!Number.isFinite(v)) return null;
        if (v < 0) return null;
        return v;
    }

    private sanitizeNonNegativeInt(v: any): number | null {
        if (typeof v !== 'number') return null;
        if (!Number.isFinite(v)) return null;
        const n = Math.trunc(v);
        if (n < 0) return null;
        return n;
    }

    private sanitizeRpe(v: any): number | null {
        if (typeof v !== 'number') return null;
        if (!Number.isFinite(v)) return null;
        if (v < 0 || v > 10) return null;
        return v;
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
        const exercise = await dbService.getExerciseById(exerciseId);
        const exerciseType: ExerciseType = (exercise?.type as ExerciseType) ?? 'weight_reps';

        // 1. Determine Order Index
        // We need to fetch current sets to determine the next order index securely
        const currentSets = await dbService.getSetsForWorkout(workoutId);
        const nextIndex = currentSets.length;

        // 2. Fetch Ghost Values (History) if not provided
        const sameExerciseSets = currentSets.filter(s => s.exercise_id === exerciseId);
        const lastInWorkout = sameExerciseSets.length > 0 ? sameExerciseSets[sameExerciseSets.length - 1] : null;
        const lastHistorySet = (!lastInWorkout) ? await dbService.getLastSetForExercise(exerciseId) : null;

        const pick = (k: keyof WorkoutSet) => (overrides as any)?.[k] ?? (lastInWorkout as any)?.[k] ?? (lastHistorySet as any)?.[k];

        const weight = (exerciseType === 'weight_reps' || exerciseType === 'weight_only') ? pick('weight') : null;
        const reps = (exerciseType === 'weight_reps' || exerciseType === 'reps_only') ? pick('reps') : null;
        const distance = (exerciseType === 'distance_time') ? pick('distance') : null;
        const time = (exerciseType === 'distance_time') ? pick('time') : null;
        const rpe = pick('rpe');
        const notes = pick('notes');
        const superset_id = (overrides as any)?.superset_id;

        // 3. Create Set
        const payload: any = {
            workout_id: workoutId,
            exercise_id: exerciseId,
            type: type,
            order_index: nextIndex,
            weight: exerciseType === 'weight_reps' || exerciseType === 'weight_only' ? (weight ?? 0) : null,
            reps: exerciseType === 'weight_reps' || exerciseType === 'reps_only' ? (reps ?? 0) : null,
            distance: exerciseType === 'distance_time' ? (distance ?? null) : null,
            time: exerciseType === 'distance_time' ? (time ?? null) : null,
            notes: typeof notes === 'string' ? notes : null,
            rpe: typeof rpe === 'number' ? rpe : null,
            superset_id,
            completed: 0
        };
        const id = await dbService.addSet(payload);
        this.invalidateCaches();
        return id;
    }

    public async updateSet(id: string, updates: Partial<WorkoutSet>) {
        const existing = await dbService.getSetById(id);
        if (!existing) throw new Error('Set not found');
        const exercise = await dbService.getExerciseById(existing.exercise_id);
        const exerciseType: ExerciseType = (exercise?.type as ExerciseType) ?? 'weight_reps';

        const filtered: any = { ...updates };

        const allowWeight = exerciseType === 'weight_reps' || exerciseType === 'weight_only';
        const allowReps = exerciseType === 'weight_reps' || exerciseType === 'reps_only';
        const allowDistanceTime = exerciseType === 'distance_time';

        if (!allowWeight) {
            filtered.weight = null;
        }
        if (!allowReps) {
            filtered.reps = null;
        }
        if (!allowDistanceTime) {
            filtered.distance = null;
            filtered.time = null;
        }

        if (filtered.weight !== undefined && filtered.weight !== null && filtered.weight < 0) throw new Error('Weight cannot be negative');
        if (filtered.reps !== undefined && filtered.reps !== null && filtered.reps < 0) throw new Error('Reps cannot be negative');
        if (filtered.distance !== undefined && filtered.distance !== null && filtered.distance < 0) throw new Error('Distance cannot be negative');
        if (filtered.time !== undefined && filtered.time !== null && filtered.time < 0) throw new Error('Time cannot be negative');

        await dbService.updateSet(id, filtered as any);
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

    public async getExerciseHistory(exerciseId: string, limit: number = 5, days?: number): Promise<{ date: number; sets: WorkoutSet[] }[]> {
        const cached = this.exerciseHistoryCache.get(exerciseId);
        const now = Date.now();
        if (cached && now - cached.ts < 30_000 && cached.data.length > 0) {
            const cutoff = days ? now - (days * 86400 * 1000) : null;
            const filtered = cutoff ? cached.data.filter((h) => (h.date ?? 0) > cutoff) : cached.data;
            return filtered.slice(0, limit);
        }

        const cutoff = days ? now - (days * 86400 * 1000) : null;
        const params: any[] = [exerciseId];

        // Get workouts that have at least one completed set for this exercise
        const sql = `
            SELECT DISTINCT w.id, w.date 
            FROM workouts w 
            JOIN workout_sets s ON w.id = s.workout_id 
            WHERE s.exercise_id = ? 
            AND s.completed = 1
            ${cutoff ? 'AND w.date > ?' : ''}
            ORDER BY w.date DESC 
            LIMIT ?
        `;
        if (cutoff) params.push(cutoff);
        params.push(Math.max(limit, 20));

        const workouts = await dbService.getAll<{ id: string; date: number }>(sql, params);

        const history = await Promise.all(workouts.map(async (w) => {
            const sets = await dbService.getAll<WorkoutSet>(
                'SELECT * FROM workout_sets WHERE workout_id = ? AND exercise_id = ? AND completed = 1 ORDER BY order_index ASC',
                [w.id, exerciseId]
            );
            return { date: w.date, sets };
        }));

        this.exerciseHistoryCache.set(exerciseId, { ts: now, data: history });
        return history.slice(0, limit);
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
        const sets = await dbService.getAll<WorkoutSet>(
            'SELECT * FROM workout_sets WHERE workout_id = ? ORDER BY order_index ASC',
            [workoutId]
        );
        await this.copySetsArrayIntoWorkout(sets, templateId, 0, 'full');
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
