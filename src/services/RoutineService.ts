import { Routine, RoutineDay, RoutineExercise } from '../types/db';
import { uuidV4 } from '../utils/uuid';
import { dbService } from './DatabaseService';

export interface RoutineWithDays extends Routine {
    days: RoutineDayWithExercises[];
}

export interface RoutineDayWithExercises extends RoutineDay {
    exercises: (RoutineExercise & { exercise_name: string; category_name?: string })[];
}

type SharedRoutinePayload = {
    routine?: Record<string, unknown>;
    routine_days?: Record<string, unknown>[];
    routine_exercises?: Record<string, unknown>[];
    exercises?: Record<string, unknown>[];
    categories?: Record<string, unknown>[];
};

type SharedExercise = {
    id?: unknown;
    origin_id?: unknown;
    name?: unknown;
    type?: unknown;
    default_increment?: unknown;
    notes?: unknown;
    category_id?: unknown;
    category_name?: unknown;
};

type SharedRoutineDay = {
    id?: unknown;
    name?: unknown;
    order_index?: unknown;
};

type SharedRoutineExercise = {
    routine_day_id?: unknown;
    exercise_id?: unknown;
    order_index?: unknown;
    notes?: unknown;
};

type SharedCategory = {
    id?: unknown;
    name?: unknown;
    color?: unknown;
    sort_order?: unknown;
    is_system?: unknown;
};

const toArray = <T>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];

const getString = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const getNumber = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;

class RoutineService {
    // --- ROUTINES ---
    public async getAllRoutines(): Promise<Routine[]> {
        return await dbService.getAll<Routine>('SELECT * FROM routines ORDER BY name ASC');
    }

    public async getRoutineDetails(routineId: string): Promise<RoutineWithDays | null> {
        const routine = await dbService.getFirst<Routine>('SELECT * FROM routines WHERE id = ?', [routineId]);
        if (!routine) return null;

        const days = await dbService.getAll<RoutineDay>('SELECT * FROM routine_days WHERE routine_id = ? ORDER BY order_index ASC', [routineId]);

        const routineDaysWithEx: RoutineDayWithExercises[] = [];

        for (const day of days) {
            const exercises = await dbService.getAll<RoutineExercise & { exercise_name: string; category_name: string }>(`
                SELECT re.*, e.name as exercise_name, c.name as category_name 
                FROM routine_exercises re
                JOIN exercises e ON re.exercise_id = e.id
                LEFT JOIN categories c ON e.category_id = c.id
                WHERE re.routine_day_id = ?
                ORDER BY re.order_index ASC
            `, [day.id]);

            routineDaysWithEx.push({
                ...day,
                exercises
            });
        }

        return {
            ...routine,
            days: routineDaysWithEx
        };
    }

    public async createRoutine(name: string, description?: string, isPublic: number = 0): Promise<string> {
        const id = uuidV4();
        await dbService.run('INSERT INTO routines (id, name, description, is_public) VALUES (?, ?, ?, ?)', [id, name, description || null, isPublic]);
        await dbService.queueSyncMutation('routines', id, 'INSERT', { id, name, description: description || null, is_public: isPublic });
        return id;
    }

    public async updateRoutine(id: string, name: string, description?: string, isPublic: number = 0): Promise<void> {
        await dbService.run('UPDATE routines SET name = ?, description = ?, is_public = ? WHERE id = ?', [name, description || null, isPublic, id]);
        await dbService.queueSyncMutation('routines', id, 'UPDATE', { name, description: description || null, is_public: isPublic });
    }

    public async deleteRoutine(id: string): Promise<void> {
        // Queue cascading deletes first from day exercises and days if needed, but SQLite handles it on the DB level.
        // For sync consistency, we should ideally fetch children and push deletes. But the server can also implement cascading delete.
        await dbService.run('DELETE FROM routines WHERE id = ?', [id]);
        await dbService.queueSyncMutation('routines', id, 'DELETE');
    }

    // --- ROUTINE DAYS ---
    public async getRoutineDayDetails(dayId: string): Promise<RoutineDayWithExercises | null> {
        const day = await dbService.getFirst<RoutineDay>('SELECT * FROM routine_days WHERE id = ?', [dayId]);
        if (!day) return null;

        const exercises = await dbService.getAll<RoutineExercise & { exercise_name: string; category_name: string }>(`
            SELECT re.*, e.name as exercise_name, c.name as category_name 
            FROM routine_exercises re
            JOIN exercises e ON re.exercise_id = e.id
            LEFT JOIN categories c ON e.category_id = c.id
            WHERE re.routine_day_id = ?
            ORDER BY re.order_index ASC
        `, [day.id]);

        return {
            ...day,
            exercises
        };
    }

    public async addRoutineDay(routineId: string, name: string, orderIndex: number): Promise<string> {
        const id = uuidV4();
        await dbService.run('INSERT INTO routine_days (id, routine_id, name, order_index) VALUES (?, ?, ?, ?)', [id, routineId, name, orderIndex]);
        await dbService.queueSyncMutation('routine_days', id, 'INSERT', { id, routine_id: routineId, name, order_index: orderIndex });
        return id;
    }

    public async updateRoutineDay(id: string, name: string, orderIndex: number): Promise<void> {
        await dbService.run('UPDATE routine_days SET name = ?, order_index = ? WHERE id = ?', [name, orderIndex, id]);
        await dbService.queueSyncMutation('routine_days', id, 'UPDATE', { name, order_index: orderIndex });
    }

    public async deleteRoutineDay(id: string): Promise<void> {
        await dbService.run('DELETE FROM routine_days WHERE id = ?', [id]);
        await dbService.queueSyncMutation('routine_days', id, 'DELETE');
    }

    public async reorderRoutineDays(updates: { id: string; order_index: number }[]): Promise<void> {
        await dbService.withTransaction(async () => {
            for (const update of updates) {
                await dbService.run('UPDATE routine_days SET order_index = ? WHERE id = ?', [update.order_index, update.id]);
                await dbService.queueSyncMutation('routine_days', update.id, 'UPDATE', { order_index: update.order_index });
            }
        });
    }

    // --- ROUTINE EXERCISES ---
    public async addRoutineExercise(routineDayId: string, exerciseId: string, orderIndex: number, notes?: string): Promise<string> {
        const id = uuidV4();
        await dbService.run(
            'INSERT INTO routine_exercises (id, routine_day_id, exercise_id, order_index, notes) VALUES (?, ?, ?, ?, ?)',
            [id, routineDayId, exerciseId, orderIndex, notes || null]
        );
        await dbService.queueSyncMutation('routine_exercises', id, 'INSERT', { id, routine_day_id: routineDayId, exercise_id: exerciseId, order_index: orderIndex, notes: notes || null });
        return id;
    }

    public async updateRoutineExercise(id: string, orderIndex: number, notes?: string): Promise<void> {
        await dbService.run('UPDATE routine_exercises SET order_index = ?, notes = ? WHERE id = ?', [orderIndex, notes || null, id]);
        await dbService.queueSyncMutation('routine_exercises', id, 'UPDATE', { order_index: orderIndex, notes: notes || null });
    }

    public async deleteRoutineExercise(id: string): Promise<void> {
        await dbService.run('DELETE FROM routine_exercises WHERE id = ?', [id]);
        await dbService.queueSyncMutation('routine_exercises', id, 'DELETE');
    }

    public async reorderRoutineExercises(updates: { id: string; order_index: number }[]): Promise<void> {
        await dbService.withTransaction(async () => {
            for (const update of updates) {
                await dbService.run('UPDATE routine_exercises SET order_index = ? WHERE id = ?', [update.order_index, update.id]);
                await dbService.queueSyncMutation('routine_exercises', update.id, 'UPDATE', { order_index: update.order_index });
            }
        });
    }

    // --- P2P IMPORTATION ---
    public async importSharedRoutine(payload: SharedRoutinePayload): Promise<string> {
        const routine = payload?.routine;
        const routineDays = toArray<SharedRoutineDay>(payload?.routine_days);
        const routineExercises = toArray<SharedRoutineExercise>(payload?.routine_exercises);
        const exercises = toArray<SharedExercise>(payload?.exercises);
        const categories = toArray<SharedCategory>(payload?.categories);
        const routineName = getString(routine?.name) || 'Rutina importada';
        const routineDescription = getString(routine?.description);

        try {
            let newRoutineId = '';
            await dbService.withTransaction(async () => {
                const ensureDefaultCategoryId = async (): Promise<string> => {
                    const existing = await dbService.getFirst<{ id: string }>('SELECT id FROM categories ORDER BY sort_order ASC LIMIT 1');
                    if (existing?.id) return existing.id;
                    const newId = uuidV4();
                    await dbService.run('INSERT INTO categories (id, name, is_system, sort_order, color) VALUES (?, ?, ?, ?, ?)', [newId, 'General', 0, 9999, null]);
                    await dbService.queueSyncMutation('categories', newId, 'INSERT', { id: newId, name: 'General', is_system: 0, sort_order: 9999, color: null });
                    return newId;
                };

                const defaultCategoryId = await ensureDefaultCategoryId();
                const categoryMap = new Map<string, string>();
                const categoryNameCache = new Map<string, string>();

                for (const cat of categories) {
                    const remoteId = getString(cat.id);
                    const name = getString(cat.name);
                    if (!remoteId || !name) continue;
                    const existing = await dbService.getFirst<{ id: string }>(
                        'SELECT id FROM categories WHERE name COLLATE NOCASE = ?',
                        [name]
                    );
                    if (existing?.id) {
                        categoryMap.set(remoteId, existing.id);
                        categoryNameCache.set(name.toLowerCase(), existing.id);
                        continue;
                    }
                    const newCatId = uuidV4();
                    const color = getString(cat.color);
                    const sortOrder = getNumber(cat.sort_order) ?? 0;
                    const isSystem = getNumber(cat.is_system) ?? 0;
                    await dbService.run(
                        'INSERT INTO categories (id, name, is_system, sort_order, color) VALUES (?, ?, ?, ?, ?)',
                        [newCatId, name, isSystem, sortOrder, color]
                    );
                    await dbService.queueSyncMutation('categories', newCatId, 'INSERT', {
                        id: newCatId,
                        name,
                        is_system: isSystem,
                        sort_order: sortOrder,
                        color
                    });
                    categoryMap.set(remoteId, newCatId);
                    categoryNameCache.set(name.toLowerCase(), newCatId);
                }

                const resolveCategoryId = async (exercise: SharedExercise): Promise<string> => {
                    const remoteCategoryId = getString(exercise.category_id);
                    if (remoteCategoryId && categoryMap.has(remoteCategoryId)) {
                        return categoryMap.get(remoteCategoryId) as string;
                    }
                    const categoryName = getString(exercise.category_name);
                    if (categoryName) {
                        const cached = categoryNameCache.get(categoryName.toLowerCase());
                        if (cached) return cached;
                        const existing = await dbService.getFirst<{ id: string }>(
                            'SELECT id FROM categories WHERE name COLLATE NOCASE = ?',
                            [categoryName]
                        );
                        if (existing?.id) {
                            categoryNameCache.set(categoryName.toLowerCase(), existing.id);
                            return existing.id;
                        }
                        const newCatId = uuidV4();
                        await dbService.run(
                            'INSERT INTO categories (id, name, is_system, sort_order, color) VALUES (?, ?, ?, ?, ?)',
                            [newCatId, categoryName, 0, 9999, null]
                        );
                        await dbService.queueSyncMutation('categories', newCatId, 'INSERT', {
                            id: newCatId,
                            name: categoryName,
                            is_system: 0,
                            sort_order: 9999,
                            color: null
                        });
                        categoryNameCache.set(categoryName.toLowerCase(), newCatId);
                        return newCatId;
                    }
                    return defaultCategoryId;
                };

                // 1. Resolve Exercises (De-duplication by origin_id or name matching)
                const exerciseMap = new Map<string, string>(); // Maps old remote ID => new local ID
                for (const ex of exercises) {
                    const originTarget = getString(ex.origin_id) || getString(ex.id);
                    const exerciseName = getString(ex.name);
                    const remoteExerciseId = getString(ex.id);
                    if (!originTarget || !exerciseName || !remoteExerciseId) continue;
                    const existing = await dbService.getFirst<{ id: string }>(
                        'SELECT id FROM exercises WHERE origin_id = ? OR name COLLATE NOCASE = ?',
                        [originTarget, exerciseName]
                    );

                    if (existing?.id) {
                        exerciseMap.set(remoteExerciseId, existing.id);
                    } else {
                        const categoryId = await resolveCategoryId(ex);
                        const newExId = uuidV4();
                        const exerciseType = getString(ex.type) || 'weight_reps';
                        const defaultIncrement = getNumber(ex.default_increment) ?? 2.5;
                        const notes = getString(ex.notes);
                        await dbService.run(
                            'INSERT INTO exercises (id, category_id, name, type, default_increment, notes, is_system, origin_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                            [newExId, categoryId, exerciseName, exerciseType, defaultIncrement, notes, 0, originTarget]
                        );
                        await dbService.queueSyncMutation('exercises', newExId, 'INSERT', {
                            id: newExId,
                            category_id: categoryId,
                            name: exerciseName,
                            type: exerciseType,
                            default_increment: defaultIncrement,
                            notes,
                            is_system: 0,
                            origin_id: originTarget
                        });
                        exerciseMap.set(remoteExerciseId, newExId);
                    }
                }

                // 2. Insert Routine (New ID to avoid overriding user's own if it's identical UUID)
                newRoutineId = uuidV4();
                await dbService.run('INSERT INTO routines (id, name, description) VALUES (?, ?, ?)', [newRoutineId, routineName, routineDescription]);
                await dbService.queueSyncMutation('routines', newRoutineId, 'INSERT', { id: newRoutineId, name: routineName, description: routineDescription });

                // 3. Insert Days
                const dayMap = new Map<string, string>();
                for (const day of routineDays) {
                    const remoteDayId = getString(day.id);
                    const dayName = getString(day.name);
                    const orderIndex = getNumber(day.order_index);
                    if (!remoteDayId || !dayName || orderIndex === null) continue;
                    const newDayId = uuidV4();
                    await dbService.run('INSERT INTO routine_days (id, routine_id, name, order_index) VALUES (?, ?, ?, ?)', [newDayId, newRoutineId, dayName, orderIndex]);
                    await dbService.queueSyncMutation('routine_days', newDayId, 'INSERT', { id: newDayId, routine_id: newRoutineId, name: dayName, order_index: orderIndex });
                    dayMap.set(remoteDayId, newDayId);
                }

                // 4. Insert Routine Exercises
                for (const re of routineExercises) {
                    const remoteDayId = getString(re.routine_day_id);
                    const remoteExerciseId = getString(re.exercise_id);
                    const orderIndex = getNumber(re.order_index);
                    if (!remoteDayId || !remoteExerciseId || orderIndex === null) continue;
                    const mappedDayId = dayMap.get(remoteDayId);
                    const mappedExId = exerciseMap.get(remoteExerciseId);

                    if (mappedDayId && mappedExId) {
                        const notes = getString(re.notes);
                        const newReId = uuidV4();
                        await dbService.run(
                            'INSERT INTO routine_exercises (id, routine_day_id, exercise_id, order_index, notes) VALUES (?, ?, ?, ?, ?)',
                            [newReId, mappedDayId, mappedExId, orderIndex, notes]
                        );
                        await dbService.queueSyncMutation('routine_exercises', newReId, 'INSERT', {
                            id: newReId,
                            routine_day_id: mappedDayId,
                            exercise_id: mappedExId,
                            order_index: orderIndex,
                            notes
                        });
                    }
                }
            });

            return newRoutineId;

        } catch (e) {
            throw e;
        }
    }

    public async exportRoutine(routineId: string): Promise<any> {
        const routine = await dbService.getFirst('SELECT * FROM routines WHERE id = ?', [routineId]);
        if (!routine) throw new Error('Routine not found');

        const routine_days = await dbService.getAll('SELECT * FROM routine_days WHERE routine_id = ?', [routineId]);
        let routine_exercises: any[] = [];
        let exercises: any[] = [];
        let categories: any[] = [];

        if (routine_days.length > 0) {
            const dayIds = routine_days.map((d: any) => d.id);
            const dayPlaceholders = dayIds.map(() => '?').join(',');
            routine_exercises = await dbService.getAll(
                `SELECT * FROM routine_exercises WHERE routine_day_id IN (${dayPlaceholders})`,
                dayIds
            );

            if (routine_exercises.length > 0) {
                const exIds = routine_exercises.map((re: any) => re.exercise_id);
                const exPlaceholders = exIds.map(() => '?').join(',');
                exercises = await dbService.getAll(
                    `SELECT * FROM exercises WHERE id IN (${exPlaceholders})`,
                    exIds
                );
            }
        }

        if (exercises.length > 0) {
            const categoryIds = Array.from(new Set(exercises.map((ex: any) => ex.category_id).filter(Boolean)));
            if (categoryIds.length > 0) {
                const categoryPlaceholders = categoryIds.map(() => '?').join(',');
                categories = await dbService.getAll(
                    `SELECT * FROM categories WHERE id IN (${categoryPlaceholders})`,
                    categoryIds
                );
            }
        }

        return { routine, routine_days, routine_exercises, exercises, categories };
    }
}

export const routineService = new RoutineService();
