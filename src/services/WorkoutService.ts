import { endOfDay, format, getUnixTime, startOfDay } from 'date-fns';
import { useAuthStore } from '../store/authStore';
import { ExerciseType, SetType, Workout, WorkoutSet } from '../types/db';
import { logger } from '../utils/logger';
import { uuidV4 } from '../utils/uuid';
import { dataEventService } from './DataEventService';
import { dbService } from './DatabaseService';

type CopyMode = 'replace' | 'append';
type CopyNameMode = 'if_empty' | 'always' | 'never';
type CopyContentMode = 'full' | 'structure' | 'exercises_only';
type FinishLocation = { lat: number; lon: number } | null;

class WorkoutService {
    private calendarEventsCache: { ts: number; data: Record<string, { status: string; colors: string[] }> } | null = null;
    private exerciseHistoryCache = new Map<string, { ts: number; data: { date: number; sets: WorkoutSet[] }[] }>();

    constructor() {
        dataEventService.subscribe('DATA_UPDATED', () => {
            this.invalidateCaches();
        });
    }

    private invalidateCaches() {
        this.calendarEventsCache = null;
        this.exerciseHistoryCache.clear();
    }

    private async captureFinishLocation(): Promise<FinishLocation> {
        try {
            const expoLocation = require('expo-location');
            if (!expoLocation?.requestForegroundPermissionsAsync || !expoLocation?.getCurrentPositionAsync) {
                return null;
            }
            const permission = await expoLocation.requestForegroundPermissionsAsync();
            if (permission?.status !== 'granted') return null;
            const position = await expoLocation.getCurrentPositionAsync({
                accuracy: expoLocation.Accuracy?.Balanced ?? 3,
            });
            const lat = Number(position?.coords?.latitude);
            const lon = Number(position?.coords?.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
            return { lat, lon };
        } catch {
            return null;
        }
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
            const dateStr = format(new Date(r.date), 'yyyy-MM-dd');
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
            await dbService.withTransaction(async () => {
                if (!targetWorkoutId) {
                    await dbService.run(
                        'INSERT INTO workouts (id, name, date, start_time, status, is_template) VALUES (?, ?, ?, ?, ?, ?)',
                        [newId, template.name, newDate, now, 'in_progress', 0]
                    );
                    await dbService.queueSyncMutation('workouts', newId, 'INSERT', { id: newId, name: template.name, date: newDate, start_time: now, status: 'in_progress', is_template: 0 });
                } else if (!existing?.name && template.name) {
                    await dbService.run('UPDATE workouts SET name = ? WHERE id = ?', [template.name, newId]);
                    await dbService.queueSyncMutation('workouts', newId, 'UPDATE', { name: template.name });
                }

                await this.copySetsIntoWorkout(templateId, newId);
            });
        } catch (e) {
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
            await dbService.withTransaction(async () => {
                if (targetWorkout.status === 'completed' && resumeTargetIfCompleted) {
                    await dbService.run('UPDATE workouts SET status = ?, end_time = NULL WHERE id = ?', ['in_progress', targetWorkoutId]);
                    await dbService.queueSyncMutation('workouts', targetWorkoutId, 'UPDATE', { status: 'in_progress', end_time: null });
                }

                if (mode === 'replace' && targetExistingSetsRaw.length > 0) {
                    await dbService.run('DELETE FROM workout_sets WHERE workout_id = ?', [targetWorkoutId]);
                    // Emitting bulk deletes for the sets (we don't have all IDs readily here without mapping, but we have targetExistingSetsRaw)
                    for (const set of targetExistingSetsRaw) {
                        await dbService.queueSyncMutation('workout_sets', set.id, 'DELETE');
                    }
                }

                const shouldCopyName =
                    copyName === 'always' || (copyName === 'if_empty' && !targetWorkout.name);
                if (shouldCopyName && sourceWorkout.name) {
                    await dbService.run('UPDATE workouts SET name = ? WHERE id = ?', [sourceWorkout.name, targetWorkoutId]);
                    await dbService.queueSyncMutation('workouts', targetWorkoutId, 'UPDATE', { name: sourceWorkout.name });
                }

                const copied = await this.copySetsArrayIntoWorkout(sourceSets, targetWorkoutId, startIndex, content);
            });

            this.invalidateCaches();
            return { copied: sourceSets.length, skippedMissingExercises, skippedExistingExercises, mode, content };
        } catch (e) {
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
        // Normalize search range
        const start = getUnixTime(startOfDay(date)) * 1000;
        const end = getUnixTime(endOfDay(date)) * 1000;

        let workout = await dbService.getWorkoutByDate(start, end);

        if (!workout) {
            // Create new workout - ALWAYS normalize to Local Noon (12:00)
            // This prevents timezone-related daily splits and matches SyncService logic.
            const dateObj = new Date(date);
            dateObj.setHours(12, 0, 0, 0);
            const normalizedDate = dateObj.getTime();

            const id = await dbService.createWorkout(normalizedDate);
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
        type: SetType = 'normal',
        overrides?: Partial<WorkoutSet>
    ) {
        const exercise = await dbService.getExerciseById(exerciseId);
        const exerciseType: ExerciseType = (exercise?.type as ExerciseType) ?? 'weight_reps';

        // 1. Determine Order Index
        // We need to fetch current sets to determine the next order index securely
        const currentSets = await dbService.getSetsForWorkout(workoutId);
        const nextIndex = currentSets.length;

        const orderIndex = typeof overrides?.order_index === 'number' ? overrides.order_index : nextIndex;
        const superset_id = (overrides as any)?.superset_id;

        const allowWeight = exerciseType === 'weight_reps' || exerciseType === 'weight_only';
        const allowReps = exerciseType === 'weight_reps' || exerciseType === 'reps_only';
        const allowDistanceTime = exerciseType === 'distance_time';

        const filteredOverrides: Partial<WorkoutSet> = { ...(overrides ?? {}) };
        if (!allowWeight) filteredOverrides.weight = undefined;
        if (!allowReps) filteredOverrides.reps = undefined;
        if (!allowDistanceTime) {
            filteredOverrides.distance = undefined;
            filteredOverrides.time = undefined;
        }

        if (filteredOverrides.weight !== undefined && filteredOverrides.weight !== null && filteredOverrides.weight < 0) {
            throw new Error('Weight cannot be negative');
        }
        if (filteredOverrides.reps !== undefined && filteredOverrides.reps !== null && filteredOverrides.reps < 0) {
            throw new Error('Reps cannot be negative');
        }
        if (filteredOverrides.distance !== undefined && filteredOverrides.distance !== null && filteredOverrides.distance < 0) {
            throw new Error('Distance cannot be negative');
        }
        if (filteredOverrides.time !== undefined && filteredOverrides.time !== null && filteredOverrides.time < 0) {
            throw new Error('Time cannot be negative');
        }

        // 3. Create Set
        const payload: any = {
            workout_id: workoutId,
            exercise_id: exerciseId,
            type: type,
            order_index: orderIndex,
            weight: exerciseType === 'weight_reps' || exerciseType === 'weight_only' ? null : null,
            reps: exerciseType === 'weight_reps' || exerciseType === 'reps_only' ? null : null,
            distance: exerciseType === 'distance_time' ? null : null,
            time: exerciseType === 'distance_time' ? null : null,
            notes: null,
            rpe: null,
            superset_id,
            completed: 0
        };

        if (filteredOverrides.weight !== undefined) payload.weight = filteredOverrides.weight;
        if (filteredOverrides.reps !== undefined) payload.reps = filteredOverrides.reps;
        if (filteredOverrides.distance !== undefined) payload.distance = filteredOverrides.distance;
        if (filteredOverrides.time !== undefined) payload.time = filteredOverrides.time;
        if (filteredOverrides.notes !== undefined) payload.notes = filteredOverrides.notes;
        if (filteredOverrides.rpe !== undefined) payload.rpe = filteredOverrides.rpe;
        if ((filteredOverrides as any).completed !== undefined) payload.completed = (filteredOverrides as any).completed;
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

        const now = Date.now();
        const location = await this.captureFinishLocation();

        if (location) {
            await dbService.run(
                'UPDATE workouts SET status = ?, end_time = ?, finish_lat = ?, finish_lon = ?, updated_at = ? WHERE id = ?',
                ['completed', now, location.lat, location.lon, now, id]
            );
            await dbService.queueSyncMutation('workouts', id, 'UPDATE', {
                status: 'completed',
                end_time: now,
                finish_lat: location.lat,
                finish_lon: location.lon,
                updated_at: now,
            });
        } else {
            await dbService.run(
                'UPDATE workouts SET status = ?, end_time = ?, updated_at = ? WHERE id = ?',
                ['completed', now, now, id]
            );
            await dbService.queueSyncMutation('workouts', id, 'UPDATE', { status: 'completed', end_time: now, updated_at: now });
        }

        try {
            const { IronScoreService } = await import('./IronScoreService');
            await IronScoreService.awardForFinishedWorkout(id, now);
        } catch (e) {
            logger.captureException(e, { scope: 'WorkoutService.finishWorkout', message: 'IronScore awarding failed', workoutId: id });
        }

        await this.createSocialFeedEventsForFinishedWorkout(id, now);

        dataEventService.emit('DATA_UPDATED');

        this.invalidateCaches();
    }

    public async resumeWorkout(id: string): Promise<void> {
        const now = Date.now();
        await dbService.run(
            'UPDATE workouts SET status = ?, updated_at = ? WHERE id = ?',
            ['in_progress', now, id]
        );
        await dbService.queueSyncMutation('workouts', id, 'UPDATE', { status: 'in_progress', updated_at: now });

        // Clean up social feed events because the workout is no longer completed
        await this.cleanupActivityFeedForWorkout(id);

        dataEventService.emit('DATA_UPDATED');

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

        await dbService.run(sql, params);
        // Sync note: This bulk updates. We need to queue mutations for each updated set.
        const updatedSets = await dbService.getAll<{ id: string }>(`SELECT id FROM workout_sets WHERE workout_id = ? AND exercise_id IN (${placeholders})`, [workoutId, ...exerciseIds]);
        for (const s of updatedSets) {
            await dbService.queueSyncMutation('workout_sets', s.id, 'UPDATE', { superset_id: supersetId });
        }
    }

    public async addToSuperset(workoutId: string, targetSupersetId: string, exerciseId: string) {
        await dbService.run(
            'UPDATE workout_sets SET superset_id = ? WHERE workout_id = ? AND exercise_id = ?',
            [targetSupersetId, workoutId, exerciseId]
        );
        const updatedSets = await dbService.getAll<{ id: string }>('SELECT id FROM workout_sets WHERE workout_id = ? AND exercise_id = ?', [workoutId, exerciseId]);
        for (const s of updatedSets) {
            await dbService.queueSyncMutation('workout_sets', s.id, 'UPDATE', { superset_id: targetSupersetId });
        }
    }

    public async removeFromSuperset(workoutId: string, exerciseId: string) {
        await dbService.run(
            'UPDATE workout_sets SET superset_id = NULL WHERE workout_id = ? AND exercise_id = ?',
            [workoutId, exerciseId]
        );
        const updatedSets = await dbService.getAll<{ id: string }>('SELECT id FROM workout_sets WHERE workout_id = ? AND exercise_id = ?', [workoutId, exerciseId]);
        for (const s of updatedSets) {
            await dbService.queueSyncMutation('workout_sets', s.id, 'UPDATE', { superset_id: null });
        }
    }

    private async createSocialFeedEventsForFinishedWorkout(workoutId: string, now?: number): Promise<void> {
        const timestamp = now || Date.now();
        const userId = useAuthStore.getState().user?.id;
        if (!userId) return;

        // 1. Clean up existing PR events for THIS workout first.
        // This handles cases where an exercise was removed or the PR is no longer achieved.
        // We use the deterministic ID pattern: activity-pr-${workoutId}-*
        const stalePrs = await dbService.getAll<{ id: string }>(
            "SELECT id FROM activity_feed WHERE action_type = 'pr_broken' AND id LIKE ?",
            [`activity-pr-${workoutId}-%`]
        );
        for (const pr of stalePrs) {
            await dbService.run('UPDATE activity_feed SET deleted_at = ?, updated_at = ? WHERE id = ?', [timestamp, timestamp, pr.id]);
            await dbService.queueSyncMutation('activity_feed', pr.id, 'UPDATE', { deleted_at: timestamp, updated_at: timestamp });
        }

        // 2. Main workout event
        await this.upsertActivityFeedRecord({
            id: `activity-workout-${workoutId}`,
            userId,
            actionType: 'workout_completed',
            referenceId: workoutId,
            metadata: JSON.stringify({ workoutId }),
            createdAt: timestamp,
            updatedAt: timestamp,
        });

        const workoutSets = await dbService.getAll<{ exercise_id: string; exercise_name: string; weight: number; reps: number; type: string | null }>(
            `SELECT
                s.exercise_id as exercise_id,
                e.name as exercise_name,
                s.weight as weight,
                s.reps as reps,
                s.type as type
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

        const bestByExercise = new Map<string, { exerciseName: string; oneRm: number }>();
        for (const set of workoutSets) {
            const oneRm = set.weight * (1 + set.reps / 30);
            const previous = bestByExercise.get(set.exercise_id);
            if (!previous || oneRm > previous.oneRm) {
                bestByExercise.set(set.exercise_id, {
                    exerciseName: set.exercise_name,
                    oneRm,
                });
            }
        }

        for (const [exerciseId, current] of bestByExercise.entries()) {
            const previousMax = await dbService.getFirst<{ max_1rm: number | null }>(
                `SELECT MAX(s.weight * (1.0 + (s.reps / 30.0))) as max_1rm
                 FROM workout_sets s
                 JOIN workouts w ON w.id = s.workout_id
                 WHERE s.exercise_id = ?
                   AND s.workout_id != ?
                   AND s.completed = 1
                   AND s.weight > 0
                   AND s.reps > 0
                   AND (s.type IS NULL OR s.type != 'warmup')
                   AND s.deleted_at IS NULL
                   AND w.deleted_at IS NULL`,
                [exerciseId, workoutId]
            );

            const oldOneRm = Number(previousMax?.max_1rm || 0);
            if (current.oneRm <= oldOneRm) {
                continue;
            }

            const roundedOneRm = Math.round(current.oneRm);
            await this.upsertActivityFeedRecord({
                id: `activity-pr-${workoutId}-${exerciseId}`,
                userId,
                actionType: 'pr_broken',
                referenceId: exerciseId,
                metadata: JSON.stringify({
                    workoutId,
                    exerciseId,
                    exerciseName: current.exerciseName,
                    oneRm: roundedOneRm,
                    previousOneRm: Math.round(oldOneRm),
                }),
                createdAt: timestamp,
                updatedAt: timestamp,
            });
        }
    }

    private async upsertActivityFeedRecord(payload: {
        id: string;
        userId: string;
        actionType: string;
        referenceId: string;
        metadata: string;
        createdAt: number;
        updatedAt: number;
    }): Promise<void> {
        const existing = await dbService.getFirst<{ id: string }>(
            'SELECT id FROM activity_feed WHERE id = ?',
            [payload.id]
        );

        if (existing?.id) {
            await dbService.run(
                'UPDATE activity_feed SET metadata = ?, updated_at = ?, seen_at = NULL, deleted_at = NULL WHERE id = ?',
                [payload.metadata, payload.updatedAt, payload.id]
            );
            await dbService.queueSyncMutation('activity_feed', payload.id, 'UPDATE', {
                metadata: payload.metadata,
                updated_at: payload.updatedAt,
                seen_at: null,
                deleted_at: null,
            });

            // IMPORTANT: Clear seen records locally to ensure UI shows it as new
            await dbService.run('DELETE FROM activity_seen WHERE activity_id = ?', [payload.id]);
            // (Sync concern: activity_seen deletions are usually managed by the server when the parent activity is updated)
            return;
        }

        await dbService.run(
            'INSERT INTO activity_feed (id, user_id, action_type, reference_id, metadata, created_at, updated_at, kudo_count) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
            [payload.id, payload.userId, payload.actionType, payload.referenceId, payload.metadata, payload.createdAt, payload.updatedAt]
        );
        await dbService.queueSyncMutation('activity_feed', payload.id, 'INSERT', {
            id: payload.id,
            user_id: payload.userId,
            action_type: payload.actionType,
            reference_id: payload.referenceId,
            metadata: payload.metadata,
            created_at: payload.createdAt,
            updated_at: payload.updatedAt,
            kudo_count: 0,
        });
    }

    private async cleanupActivityFeedForWorkout(workoutId: string): Promise<void> {
        const now = Date.now();
        // Since we use deterministic IDs for workouts and PRs, we can target them directly or via prefix
        // Workout ID: activity-workout-[workoutId]
        // PR ID: activity-pr-[workoutId]-[exerciseId]

        const related = await dbService.getAll<{ id: string }>(
            "SELECT id FROM activity_feed WHERE id = ? OR id LIKE ?",
            [`activity-workout-${workoutId}`, `activity-pr-${workoutId}-%`]
        );

        for (const act of related) {
            await dbService.run(
                'UPDATE activity_feed SET deleted_at = ?, updated_at = ? WHERE id = ?',
                [now, now, act.id]
            );
            // Queue sync deletion
            await dbService.queueSyncMutation('activity_feed', act.id, 'DELETE');

            // Also clear seen records locally
            await dbService.run('DELETE FROM activity_seen WHERE activity_id = ?', [act.id]);
        }
    }

    private generateId(): string {
        return uuidV4();
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
        let shouldInvalidate = false;

        Object.entries(updates).forEach(([key, value]) => {
            if (key !== 'id' && value !== undefined) {
                fields.push(`${key} = ?`);
                values.push(value);
                if (key === 'status' || key === 'date') {
                    shouldInvalidate = true;
                }
            }
        });
        if (fields.length === 0) return;
        values.push(id);
        await dbService.run(`UPDATE workouts SET ${fields.join(', ')} WHERE id = ?`, values);
        await dbService.queueSyncMutation('workouts', id, 'UPDATE', updates);

        if (shouldInvalidate) {
            this.invalidateCaches();
        }
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
        await dbService.queueSyncMutation('workouts', id, 'INSERT', { id, name, date: Date.now(), start_time: Date.now(), status: 'in_progress', is_template: 1 });
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
            await dbService.withTransaction(async () => {
                // Clean up associated social feed events
                await this.cleanupActivityFeedForWorkout(id);

                // Queue deletes before actual deletion so we have the references
                const sets = await dbService.getAll<{ id: string }>('SELECT id FROM workout_sets WHERE workout_id = ?', [id]);
                for (const s of sets) await dbService.queueSyncMutation('workout_sets', s.id, 'DELETE');
                await dbService.queueSyncMutation('workouts', id, 'DELETE');

                // Explicitly delete sets first to ensure referential integrity if ON DELETE CASCADE fails or is disabled
                await dbService.run('DELETE FROM workout_sets WHERE workout_id = ?', [id]);
                await dbService.run('DELETE FROM workouts WHERE id = ?', [id]);
            });

            dataEventService.emit('DATA_UPDATED');

            this.invalidateCaches();
        } catch (e) {
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
