import { endOfDay, format, getUnixTime, startOfDay } from 'date-fns';
import { useAuthStore } from '../store/authStore';
import { ExerciseType, SetType, Workout, WorkoutSet } from '../types/db';
import * as analytics from '../utils/analytics';
import { logger } from '../utils/logger';
import { uuidV4 } from '../utils/uuid';
import { configService } from './ConfigService';
import { dataEventService } from './DataEventService';
import { dbService } from './DatabaseService';
import { IronScoreService } from './IronScoreService';
import { systemNotificationService } from './SystemNotificationService';

type CopyMode = 'replace' | 'append';
type CopyNameMode = 'if_empty' | 'always' | 'never';
type CopyContentMode = 'full' | 'structure' | 'exercises_only';
type CalendarEvent = { status: string; colors: string[]; completedCount: number; totalCount: number };

class WorkoutService {
    private calendarEventsCache: { ts: number; data: Record<string, CalendarEvent> } | null = null;
    private exerciseHistoryCache = new Map<string, { ts: number; data: { date: number; sets: WorkoutSet[] }[] }>();

    constructor() {
        dataEventService.subscribe('DATA_UPDATED', () => {
            this.invalidateCaches();
        });
    }

    public invalidateCaches() {
        this.calendarEventsCache = null;
        this.exerciseHistoryCache.clear();
    }

    public generateIdInternal(): string {
        return this.generateId();
    }

    public async copySetsIntoWorkoutInternal(sourceWorkoutId: string, targetWorkoutId: string): Promise<void> {
        return this.copySetsIntoWorkout(sourceWorkoutId, targetWorkoutId);
    }

    public async getWorkoutsWithSetsForDate(date: Date): Promise<(Workout & { set_count: number })[]> {
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
        `, [start, end]);

        return rows || [];
    }

    public async copyWorkoutToWorkout(sourceWorkoutId: string, targetWorkoutId: string): Promise<void> {
        await this.copyWorkoutToWorkoutAdvanced(sourceWorkoutId, targetWorkoutId, { mode: 'replace' });
    }

    public async getWorkout(id: string): Promise<Workout | null> {
        return await dbService.getWorkoutById(id);
    }

    public async getActiveWorkout(date: Date = new Date()): Promise<Workout> {
        const inProgress = await dbService.getFirst<Workout>(
            `SELECT * FROM workouts
             WHERE status = 'in_progress'
               AND deleted_at IS NULL
               AND is_template = 0
             ORDER BY start_time DESC
             LIMIT 1`
        );
        if (inProgress) return inProgress;

        const dayStart = getUnixTime(startOfDay(date)) * 1000;
        const dayEnd = getUnixTime(endOfDay(date)) * 1000;
        const existingForDate = await dbService.getFirst<Workout>(
            `SELECT * FROM workouts
             WHERE date >= ? AND date < ?
               AND deleted_at IS NULL
               AND is_template = 0
             ORDER BY start_time DESC
             LIMIT 1`,
            [dayStart, dayEnd]
        );

        if (existingForDate) return existingForDate;

        const workoutId = await dbService.createWorkout(date.getTime());
        const created = await dbService.getWorkoutById(workoutId);
        if (!created) throw new Error('No se pudo crear entrenamiento activo');
        this.invalidateCaches();
        return created;
    }

    public async resumeWorkout(workoutId: string): Promise<void> {
        const workout = await dbService.getWorkoutById(workoutId);
        if (!workout) return;

        if (workout.status === 'completed') {
            await dbService.update('workouts', workoutId, { status: 'in_progress', end_time: null });
            await this.cleanupActivityFeedForWorkout(workoutId);
        }

        this.invalidateCaches();
        dataEventService.emit('DATA_UPDATED');
    }

    public async finishWorkout(workoutId: string, durationSeconds?: number): Promise<void> {
        const workout = await dbService.getWorkoutById(workoutId);
        if (!workout) return;
        if (workout.status === 'completed') return;

        const now = Date.now();
        const duration = typeof durationSeconds === 'number' && Number.isFinite(durationSeconds)
            ? Math.max(0, Math.trunc(durationSeconds))
            : workout.duration;

        await dbService.update('workouts', workoutId, {
            status: 'completed',
            end_time: now,
            duration,
        });

        await this.createSocialFeedEventsForFinishedWorkout(workoutId, now);

        analytics.capture('workout_finished', {
            workout_id: workoutId,
            duration,
        });

        this.invalidateCaches();
        dataEventService.emit('DATA_UPDATED');
        systemNotificationService.dismissPersistentWorkout();
    }

    public async startNewSession(dateInput: string | Date): Promise<Workout> {
        const date = typeof dateInput === 'string'
            ? new Date(`${dateInput}T12:00:00`)
            : dateInput;

        const dateMs = Number.isFinite(date.getTime()) ? date.getTime() : Date.now();
        const workoutId = this.generateId();
        const nowMs = Date.now();

        await dbService.insert('workouts', {
            id: workoutId,
            date: dateMs,
            start_time: nowMs,
            status: 'in_progress',
            is_template: 0,
            duration: 0,
            end_time: null,
            name: null,
            notes: null,
        } as any);

        const created = await dbService.getWorkoutById(workoutId);
        if (!created) throw new Error('No se pudo iniciar la sesión');

        this.invalidateCaches();
        dataEventService.emit('DATA_UPDATED');
        return created;
    }

    public async createSuperset(workoutId: string, exerciseIds: string[]): Promise<string> {
        const normalized = Array.from(new Set(exerciseIds.filter(Boolean)));
        if (normalized.length < 2) throw new Error('Superset requiere al menos 2 ejercicios');

        const placeholders = normalized.map(() => '?').join(',');
        const sets = await dbService.getAll<{ id: string }>(
            `SELECT id FROM workout_sets
             WHERE workout_id = ? AND exercise_id IN (${placeholders}) AND deleted_at IS NULL`,
            [workoutId, ...normalized]
        );

        if (!sets || sets.length === 0) throw new Error('No se encontraron sets para crear superset');

        const supersetId = this.generateId();
        for (const set of sets) {
            await dbService.update('workout_sets', set.id, { superset_id: supersetId } as any);
        }

        this.invalidateCaches();
        dataEventService.emit('DATA_UPDATED');
        return supersetId;
    }

    public async addToSuperset(workoutId: string, supersetId: string, exerciseId: string): Promise<void> {
        const sets = await dbService.getAll<{ id: string }>(
            `SELECT id FROM workout_sets
             WHERE workout_id = ? AND exercise_id = ? AND deleted_at IS NULL`,
            [workoutId, exerciseId]
        );

        for (const set of sets ?? []) {
            await dbService.update('workout_sets', set.id, { superset_id: supersetId } as any);
        }

        this.invalidateCaches();
        dataEventService.emit('DATA_UPDATED');
    }

    public async removeFromSuperset(workoutId: string, exerciseId: string): Promise<void> {
        const targetSets = await dbService.getAll<{ id: string; superset_id: string | null }>(
            `SELECT id, superset_id FROM workout_sets
             WHERE workout_id = ? AND exercise_id = ? AND deleted_at IS NULL`,
            [workoutId, exerciseId]
        );

        const supersetIds = Array.from(new Set((targetSets ?? []).map((s) => s.superset_id).filter(Boolean))) as string[];
        for (const set of targetSets ?? []) {
            await dbService.update('workout_sets', set.id, { superset_id: null } as any);
        }

        for (const supersetId of supersetIds) {
            const remaining = await dbService.getAll<{ id: string }>(
                `SELECT id FROM workout_sets
                 WHERE workout_id = ? AND superset_id = ? AND deleted_at IS NULL`,
                [workoutId, supersetId]
            );

            if ((remaining ?? []).length <= 1) {
                for (const row of remaining ?? []) {
                    await dbService.update('workout_sets', row.id, { superset_id: null } as any);
                }
            }
        }

        this.invalidateCaches();
        dataEventService.emit('DATA_UPDATED');
    }

    public async getTemplates(): Promise<Workout[]> {
        const rows = await dbService.getAll<Workout>(
            `SELECT * FROM workouts
             WHERE is_template = 1 AND deleted_at IS NULL
             ORDER BY updated_at DESC, date DESC`
        );
        return rows ?? [];
    }

    public async createTemplate(name: string): Promise<string> {
        const templateId = this.generateId();
        const now = Date.now();

        await dbService.insert('workouts', {
            id: templateId,
            name,
            date: now,
            start_time: now,
            end_time: now,
            status: 'completed',
            duration: 0,
            is_template: 1,
            notes: null,
        } as any);

        this.invalidateCaches();
        dataEventService.emit('DATA_UPDATED');
        return templateId;
    }

    public async loadTemplate(templateId: string, dateInput: string | Date): Promise<string> {
        const template = await dbService.getWorkoutById(templateId);
        if (!template || template.is_template !== 1) {
            throw new Error('Plantilla no encontrada');
        }

        const workout = await this.startNewSession(dateInput);
        if (template.name) {
            await dbService.update('workouts', workout.id, { name: template.name });
        }
        await this.copyWorkoutToWorkoutAdvanced(templateId, workout.id, { mode: 'append', content: 'full' });
        return workout.id;
    }

    public async getCalendarEvents(): Promise<Record<string, CalendarEvent>> {
        const now = Date.now();
        if (this.calendarEventsCache && (now - this.calendarEventsCache.ts) < 30_000) {
            return this.calendarEventsCache.data;
        }

        const rows = await dbService.getAll<{ id: string; date: number; status: string; colors: string | null }>(
            `SELECT w.id, w.date, w.status,
                    GROUP_CONCAT(DISTINCT c.color) as colors
             FROM workouts w
             LEFT JOIN workout_sets ws ON ws.workout_id = w.id AND ws.deleted_at IS NULL
             LEFT JOIN exercises e ON e.id = ws.exercise_id
             LEFT JOIN categories c ON c.id = e.category_id
             WHERE w.deleted_at IS NULL
               AND w.is_template = 0
             GROUP BY w.id
             ORDER BY w.date DESC`
        );

        const events: Record<string, CalendarEvent> = {};

        for (const row of rows ?? []) {
            if (typeof row.date !== 'number') continue;
            const key = format(new Date(row.date), 'yyyy-MM-dd');
            const parsedColors = (row.colors ?? '')
                .split(',')
                .map((color) => color.trim())
                .filter(Boolean);

            if (!events[key]) {
                events[key] = {
                    status: row.status,
                    colors: [],
                    completedCount: 0,
                    totalCount: 0,
                };
            }

            events[key].totalCount += 1;
            if (row.status === 'completed') {
                events[key].completedCount += 1;
            }
            if (row.status === 'in_progress') {
                events[key].status = 'in_progress';
            }
            for (const color of parsedColors) {
                if (!events[key].colors.includes(color)) {
                    events[key].colors.push(color);
                }
            }
        }

        this.calendarEventsCache = { ts: now, data: events };
        return events;
    }

    public async updateWorkout(id: string, updates: Partial<Pick<Workout, 'name' | 'notes' | 'duration'>>): Promise<void> {
        await dbService.update('workouts', id, updates);
        this.invalidateCaches();
        dataEventService.emit('DATA_UPDATED');
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
                    await dbService.update('workouts', targetWorkoutId, { status: 'in_progress', end_time: null });
                }

                if (mode === 'replace' && targetExistingSetsRaw.length > 0) {
                    for (const set of targetExistingSetsRaw) {
                        await dbService.delete('workout_sets', set.id);
                    }
                }

                const shouldCopyName =
                    copyName === 'always' || (copyName === 'if_empty' && !targetWorkout.name);
                if (shouldCopyName && sourceWorkout.name) {
                    await dbService.update('workouts', targetWorkoutId, { name: sourceWorkout.name });
                }

                await this.copySetsArrayIntoWorkout(sourceSets, targetWorkoutId, startIndex, content);
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

    public async copySetsArrayIntoWorkout(sourceSets: WorkoutSet[], targetWorkoutId: string, startIndex: number, content: CopyContentMode): Promise<number> {
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

            await this.addSet(targetWorkoutId, payload.exercise_id, payload.type as any, payload as Partial<WorkoutSet>);
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

    public async getWorkoutsForDate(date: Date): Promise<Workout[]> {
        const start = getUnixTime(startOfDay(date)) * 1000;
        const end = getUnixTime(endOfDay(date)) * 1000;
        return await dbService.getWorkoutsByDate(start, end);
    }

    public async getSets(workoutId: string) {
        const sets = await dbService.getSetsForWorkout(workoutId);
        const workout = await dbService.getWorkoutById(workoutId);

        if (!workout || sets.length === 0) return sets;

        const exerciseIds = [...new Set(sets.map(s => s.exercise_id))];
        if (exerciseIds.length === 0) return sets;

        const placeHolders = exerciseIds.map(() => '?').join(',');
        const latestHistoryItems = await dbService.getAll<{ exercise_id: string; workout_id: string; date: number }>(
            `SELECT s.exercise_id, w.id as workout_id, MAX(w.date) as date
             FROM workouts w
             JOIN workout_sets s ON w.id = s.workout_id
             WHERE s.exercise_id IN (${placeHolders})
               AND w.date < ?
               AND w.status = 'completed'
               AND w.deleted_at IS NULL
               AND s.deleted_at IS NULL
             GROUP BY s.exercise_id`,
            [...exerciseIds, workout.date]
        );

        if (latestHistoryItems.length === 0) return sets;

        const prevWorkoutIds = [...new Set(latestHistoryItems.map(item => item.workout_id))];
        const prevSetsResponse = await dbService.getAll<WorkoutSet>(
            `SELECT * FROM workout_sets 
             WHERE workout_id IN (${prevWorkoutIds.map(() => '?').join(',')}) 
               AND exercise_id IN (${placeHolders})
               AND deleted_at IS NULL
             ORDER BY workout_id, order_index ASC`,
            [...prevWorkoutIds, ...exerciseIds]
        );

        const historyMap = new Map<string, WorkoutSet[]>();
        for (const s of prevSetsResponse) {
            const key = `${s.workout_id}:${s.exercise_id}`;
            if (!historyMap.has(key)) historyMap.set(key, []);
            historyMap.get(key)!.push(s);
        }

        const exerciseSetsMap = new Map<string, WorkoutSet[]>();
        sets.forEach(s => {
            if (!exerciseSetsMap.has(s.exercise_id)) exerciseSetsMap.set(s.exercise_id, []);
            exerciseSetsMap.get(s.exercise_id)!.push(s);
        });

        for (const history of latestHistoryItems) {
            const key = `${history.workout_id}:${history.exercise_id}`;
            const prevSets = historyMap.get(key) || [];
            const currentSets = exerciseSetsMap.get(history.exercise_id) || [];

            currentSets.forEach((set, idx) => {
                if (prevSets[idx]) {
                    set.previous_weight = prevSets[idx].weight;
                    set.previous_reps = prevSets[idx].reps;
                    set.previous_rpe = prevSets[idx].rpe;
                }
            });
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

        const currentSets = await dbService.getSetsForWorkout(workoutId);
        let orderIndex = currentSets.length;

        if (typeof overrides?.order_index === 'number') {
            orderIndex = overrides.order_index;
        } else {
            const exerciseSets = currentSets.filter(s => s.exercise_id === exerciseId);
            if (exerciseSets.length > 0) {
                if (type === 'warmup') {
                    const firstNormal = exerciseSets.find(s => s.type !== 'warmup');
                    orderIndex = firstNormal ? firstNormal.order_index : exerciseSets[exerciseSets.length - 1].order_index + 1;
                } else {
                    orderIndex = exerciseSets[exerciseSets.length - 1].order_index + 1;
                }
            } else {
                orderIndex = currentSets.length;
            }
        }

        if (orderIndex <= currentSets.length - 1) {
            for (const s of currentSets) {
                if (s.order_index >= orderIndex) {
                    await dbService.update('workout_sets', s.id, { order_index: s.order_index + 1 });
                }
            }
        }

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

        const payload: any = {
            workout_id: workoutId,
            exercise_id: exerciseId,
            type: type,
            order_index: orderIndex,
            weight: allowWeight ? (filteredOverrides.weight ?? null) : null,
            reps: allowReps ? (filteredOverrides.reps ?? null) : null,
            distance: allowDistanceTime ? (filteredOverrides.distance ?? null) : null,
            time: allowDistanceTime ? (filteredOverrides.time ?? null) : null,
            notes: filteredOverrides.notes ?? null,
            rpe: filteredOverrides.rpe ?? null,
            superset_id,
            completed: (filteredOverrides as any).completed ?? 0
        };
        
        const id = await dbService.insert('workout_sets', payload);

        analytics.capture('set_added', {
            workout_id: workoutId,
            exercise_id: exerciseId,
            type: type,
        });

        this.invalidateCaches();
        return id;
    }

    public async updateSet(id: string, updates: Partial<WorkoutSet>) {
        if (typeof updates.weight === 'number' && updates.weight < 0) {
            throw new Error('Weight cannot be negative');
        }
        if (typeof updates.reps === 'number' && updates.reps < 0) {
            throw new Error('Reps cannot be negative');
        }
        if (typeof updates.distance === 'number' && updates.distance < 0) {
            throw new Error('Distance cannot be negative');
        }
        if (typeof updates.time === 'number' && updates.time < 0) {
            throw new Error('Time cannot be negative');
        }

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

        await dbService.update('workout_sets', id, filtered);

        if (updates.completed === 1 && existing.completed === 0) {
            analytics.capture('set_completed', {
                set_id: id,
                exercise_id: existing.exercise_id,
                type: existing.type,
                weight: filtered.weight ?? existing.weight,
                reps: filtered.reps ?? existing.reps,
            });
        }

        this.invalidateCaches();
    }

    public async deleteSet(id: string) {
        await dbService.delete('workout_sets', id);
        this.invalidateCaches();
    }

    public async reorderSets(workoutId: string, orderedSetIds: string[]) {
        let currentOrderIndex = 0;
        await dbService.withTransaction(async () => {
            for (const setId of orderedSetIds) {
                await dbService.update('workout_sets', setId, { order_index: currentOrderIndex });
                currentOrderIndex++;
            }
        });
        this.invalidateCaches();
    }

    public async createSocialFeedEventsForFinishedWorkout(workoutId: string, now?: number): Promise<void> {
        const timestamp = now || Date.now();
        const userId = useAuthStore.getState().user?.id;
        if (!userId) return;

        const stalePrs = await dbService.getAll<{ id: string }>(
            "SELECT id FROM activity_feed WHERE action_type = 'pr_broken' AND id LIKE ?",
            [`activity-pr-${workoutId}-%`]
        );
        for (const pr of stalePrs ?? []) {
            await dbService.run('UPDATE activity_feed SET deleted_at = ?, updated_at = ? WHERE id = ?', [timestamp, timestamp, pr.id]);
            await dbService.queueSyncMutation('activity_feed', pr.id, 'UPDATE', { deleted_at: timestamp, updated_at: timestamp });
        }

        await this.upsertActivityFeedRecord({
            id: `activity-workout-${workoutId}`,
            userId,
            actionType: 'workout_completed',
            referenceId: workoutId,
            metadata: JSON.stringify({ workoutId }),
            createdAt: timestamp,
            updatedAt: timestamp,
        });

        const workoutSets = await dbService.getAll<{ id: string; exercise_id: string; exercise_name: string; weight: number; reps: number; type: string | null }>(
            `SELECT s.id, s.exercise_id, e.name as exercise_name, s.weight, s.reps, s.type
             FROM workout_sets s
             JOIN exercises e ON e.id = s.exercise_id
             WHERE s.workout_id = ? AND s.completed = 1 AND s.weight > 0 AND s.reps > 0
               AND (s.type IS NULL OR s.type != 'warmup') AND s.deleted_at IS NULL`,
            [workoutId]
        );

        const bestByExercise = new Map<string, { exerciseName: string; oneRm: number }>();
        for (const set of workoutSets ?? []) {
            const effectiveReps = Math.min(set.reps, 10);
            const oneRm = set.weight * (1 + effectiveReps / 30);
            const previous = bestByExercise.get(set.exercise_id);
            if (!previous || oneRm > previous.oneRm) {
                bestByExercise.set(set.exercise_id, { exerciseName: set.exercise_name, oneRm });
            }
        }

        for (const [exerciseId, current] of bestByExercise.entries()) {
            const prRecord = await dbService.getFirst<{ best_1rm_kg: number; workout_set_id: string }>(
                `SELECT best_1rm_kg, workout_set_id FROM user_exercise_prs 
                 WHERE user_id = ? AND exercise_id = ? AND deleted_at IS NULL`,
                [userId, exerciseId]
            );

            const achievedInThisWorkout = prRecord && (workoutSets ?? []).some(s => s.id === prRecord.workout_set_id);
            if (!achievedInThisWorkout) continue;

            const bestSet = (workoutSets ?? []).find(s => s.id === prRecord.workout_set_id);
            if (!bestSet) continue;

            await this.upsertActivityFeedRecord({
                id: `activity-pr-${workoutId}-${exerciseId}`,
                userId,
                actionType: 'pr_broken',
                referenceId: exerciseId,
                metadata: JSON.stringify({
                    workoutId, exerciseId, exerciseName: current.exerciseName,
                    unit: configService.get('weightUnit'), oneRm: Math.round(current.oneRm),
                    weight: bestSet.weight, reps: bestSet.reps,
                }),
                createdAt: timestamp,
                updatedAt: timestamp,
            });
        }
    }

    public async cleanupActivityFeedForWorkout(workoutId: string): Promise<void> {
        const now = Date.now();
        const stale = await dbService.getAll<{ id: string }>(
            "SELECT id FROM activity_feed WHERE (id = ? OR id LIKE ?) AND deleted_at IS NULL",
            [`activity-workout-${workoutId}`, `activity-pr-${workoutId}-%`]
        );

        for (const row of stale ?? []) {
            await dbService.run('UPDATE activity_feed SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, row.id]);
            await dbService.queueSyncMutation('activity_feed', row.id, 'UPDATE', { deleted_at: now, updated_at: now });
        }
    }

    public async deleteWorkout(id: string): Promise<void> {
        const workout = await dbService.getWorkoutById(id);
        if (!workout) return;
        try {
            await dbService.withTransaction(async () => {
                const sets = await dbService.getSetsForWorkout(id);
                for (const set of sets ?? []) await dbService.delete('workout_sets', set.id);
                await this.cleanupActivityFeedForWorkout(id);
                await IronScoreService.revertScoreForWorkout(id);
                await dbService.softDelete('workouts', id);
            });
            this.invalidateCaches();
            dataEventService.emit('DATA_UPDATED');
        } catch (e) {
            logger.error('Failed to delete workout', { error: e, workoutId: id });
            throw e;
        }
    }

    public async getWorkoutHistory(): Promise<any[]> {
        const rows = await dbService.getAll<any>(`
            SELECT w.id, w.name, w.date, w.start_time, w.end_time, w.duration, w.status,
                   COUNT(DISTINCT s.id) as set_count, COUNT(DISTINCT s.exercise_id) as exercise_count
            FROM workouts w
            LEFT JOIN workout_sets s ON s.workout_id = w.id AND s.deleted_at IS NULL
            WHERE w.deleted_at IS NULL
            GROUP BY w.id ORDER BY w.date DESC, w.start_time DESC
        `);
        return rows || [];
    }

    public async getCompletedWorkoutsLastYear(): Promise<number[]> {
        const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
        const result = await dbService.getAll<{ date: number }>('SELECT date FROM workouts WHERE status = ? AND date > ?', ['completed', oneYearAgo]);
        return (result ?? []).map(r => r.date);
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
        const sql = `SELECT DISTINCT w.id, w.date FROM workouts w JOIN workout_sets s ON w.id = s.workout_id 
                     WHERE s.exercise_id = ? AND s.completed = 1 ${cutoff ? 'AND w.date > ?' : ''} 
                     ORDER BY w.date DESC LIMIT ?`;
        if (cutoff) params.push(cutoff);
        params.push(Math.max(limit, 20));
        const workouts = await dbService.getAll<{ id: string; date: number }>(sql, params);
        const history = await Promise.all((workouts ?? []).map(async (w) => {
            const sets = await dbService.getAll<WorkoutSet>('SELECT * FROM workout_sets WHERE workout_id = ? AND exercise_id = ? AND completed = 1 ORDER BY order_index ASC', [w.id, exerciseId]);
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
        await dbService.queueSyncMutation('workouts', id, 'UPDATE', updates);
        if (updates.status || updates.date) this.invalidateCaches();
    }

    public async getExercise(id: string) { return await dbService.getExerciseById(id); }

    public async delete(id: string): Promise<void> {
        try {
            await dbService.withTransaction(async () => {
                await this.cleanupActivityFeedForWorkout(id);
                const sets = await dbService.getAll<{ id: string }>('SELECT id FROM workout_sets WHERE workout_id = ?', [id]);
                for (const s of (sets ?? [])) await dbService.queueSyncMutation('workout_sets', s.id, 'DELETE');
                await dbService.queueSyncMutation('workouts', id, 'DELETE');
                await dbService.run('DELETE FROM workout_sets WHERE workout_id = ?', [id]);
                await dbService.run('DELETE FROM workouts WHERE id = ?', [id]);
            });
            dataEventService.emit('DATA_UPDATED');
            this.invalidateCaches();
            systemNotificationService.dismissPersistentWorkout();
        } catch (e) { throw e; }
    }

    public async reorderExercises(workoutId: string, newExerciseOrder: string[]) {
        const sets = await this.getSets(workoutId);
        const grouped: Record<string, WorkoutSet[]> = {};
        sets.forEach(s => {
            if (!grouped[s.exercise_id]) grouped[s.exercise_id] = [];
            grouped[s.exercise_id].push(s);
        });
        let currentOrderIndex = 0;
        for (const exId of newExerciseOrder) {
            const exerciseSets = grouped[exId] || [];
            exerciseSets.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
            for (const set of exerciseSets) {
                if (set.order_index !== currentOrderIndex) await this.updateSet(set.id, { order_index: currentOrderIndex });
                currentOrderIndex++;
            }
        }
    }

    private async upsertActivityFeedRecord(payload: { id: string; userId: string; actionType: string; referenceId: string; metadata: string; createdAt: number; updatedAt: number; }): Promise<void> {
        const existing = await dbService.getFirst<{ id: string }>('SELECT id FROM activity_feed WHERE id = ?', [payload.id]);
        if (existing?.id) {
            await dbService.run('UPDATE activity_feed SET metadata = ?, updated_at = ?, seen_at = NULL, deleted_at = NULL WHERE id = ?', [payload.metadata, payload.updatedAt, payload.id]);
            await dbService.queueSyncMutation('activity_feed', payload.id, 'UPDATE', { metadata: payload.metadata, updated_at: payload.updatedAt, seen_at: null, deleted_at: null });
            return;
        }
        await dbService.run('INSERT INTO activity_feed (id, user_id, action_type, reference_id, metadata, created_at, updated_at, kudo_count) VALUES (?, ?, ?, ?, ?, ?, ?, 0)', [payload.id, payload.userId, payload.actionType, payload.referenceId, payload.metadata, payload.createdAt, payload.updatedAt]);
        await dbService.queueSyncMutation('activity_feed', payload.id, 'INSERT', { id: payload.id, user_id: payload.userId, action_type: payload.actionType, reference_id: payload.referenceId, metadata: payload.metadata, created_at: payload.createdAt, updated_at: payload.updatedAt, kudo_count: 0 });
    }

    private generateId(): string { return uuidV4(); }
}

export const workoutService = new WorkoutService();
