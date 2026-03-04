import { Routine, RoutineDay, RoutineExercise } from '../types/db';
import { uuidV4 } from '../utils/uuid';
import { dbService } from './DatabaseService';

export interface RoutineWithDays extends Routine {
    days: RoutineDayWithExercises[];
}

export interface RoutineDayWithExercises extends RoutineDay {
    exercises: (RoutineExercise & { exercise_name: string; category_name?: string })[];
}

class RoutineService {
    // --- ROUTINES ---
    public async getAllRoutines(): Promise<Routine[]> {
        const db = dbService.getDatabase();
        return await db.getAllAsync<Routine>('SELECT * FROM routines ORDER BY name ASC');
    }

    public async getRoutineDetails(routineId: string): Promise<RoutineWithDays | null> {
        const db = dbService.getDatabase();

        const routine = await db.getFirstAsync<Routine>('SELECT * FROM routines WHERE id = ?', [routineId]);
        if (!routine) return null;

        const days = await db.getAllAsync<RoutineDay>('SELECT * FROM routine_days WHERE routine_id = ? ORDER BY order_index ASC', [routineId]);

        const routineDaysWithEx: RoutineDayWithExercises[] = [];

        for (const day of days) {
            const exercises = await db.getAllAsync<RoutineExercise & { exercise_name: string; category_name: string }>(`
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
        const db = dbService.getDatabase();
        const day = await db.getFirstAsync<RoutineDay>('SELECT * FROM routine_days WHERE id = ?', [dayId]);
        if (!day) return null;

        const exercises = await db.getAllAsync<RoutineExercise & { exercise_name: string; category_name: string }>(`
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
        try {
            await dbService.run('BEGIN TRANSACTION');
            for (const update of updates) {
                await dbService.run('UPDATE routine_days SET order_index = ? WHERE id = ?', [update.order_index, update.id]);
                await dbService.queueSyncMutation('routine_days', update.id, 'UPDATE', { order_index: update.order_index });
            }
            await dbService.run('COMMIT');
        } catch (e) {
            await dbService.run('ROLLBACK');
            throw e;
        }
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
        try {
            await dbService.run('BEGIN TRANSACTION');
            for (const update of updates) {
                await dbService.run('UPDATE routine_exercises SET order_index = ? WHERE id = ?', [update.order_index, update.id]);
                await dbService.queueSyncMutation('routine_exercises', update.id, 'UPDATE', { order_index: update.order_index });
            }
            await dbService.run('COMMIT');
        } catch (e) {
            await dbService.run('ROLLBACK');
            throw e;
        }
    }

    // --- P2P IMPORTATION ---
    public async importSharedRoutine(payload: any): Promise<string> {
        // payload = { routine, routine_days, routine_exercises, exercises }
        const { routine, routine_days, routine_exercises, exercises } = payload;

        try {
            await dbService.run('BEGIN TRANSACTION');

            // 1. Resolve Exercises (De-duplication by origin_id or name matching)
            const exerciseMap = new Map<string, string>(); // Maps old remote ID => new local ID
            for (const ex of exercises) {
                // Check if we have an exercise with this originId OR same name
                const originTarget = ex.origin_id || ex.id;
                const existing = await dbService.getDatabase().getFirstAsync<{ id: string }>(
                    'SELECT id FROM exercises WHERE origin_id = ? OR name COLLATE NOCASE = ?',
                    [originTarget, ex.name]
                );

                if (existing) {
                    exerciseMap.set(ex.id, existing.id);
                } else {
                    const newExId = uuidV4();
                    // Assumes uncategorized, can be handled better if we import categories too, but lets fallback to 'uncategorized' or generic system category
                    const defaultCat = await dbService.getDatabase().getFirstAsync<{ id: string }>('SELECT id FROM categories LIMIT 1');
                    await dbService.run(
                        'INSERT INTO exercises (id, category_id, name, type, default_increment, notes, is_system, origin_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [newExId, defaultCat?.id || 'sys-cat-1', ex.name, ex.type, ex.default_increment, ex.notes, 0, originTarget]
                    );
                    await dbService.queueSyncMutation('exercises', newExId, 'INSERT', {
                        id: newExId, category_id: defaultCat?.id || 'sys-cat-1', name: ex.name, type: ex.type, default_increment: ex.default_increment, notes: ex.notes, is_system: 0, origin_id: originTarget
                    });
                    exerciseMap.set(ex.id, newExId);
                }
            }

            // 2. Insert Routine (New ID to avoid overriding user's own if it's identical UUID)
            const newRoutineId = uuidV4();
            await dbService.run('INSERT INTO routines (id, name, description) VALUES (?, ?, ?)', [newRoutineId, routine.name, routine.description]);
            await dbService.queueSyncMutation('routines', newRoutineId, 'INSERT', { id: newRoutineId, name: routine.name, description: routine.description });

            // 3. Insert Days
            const dayMap = new Map<string, string>();
            for (const day of routine_days) {
                const newDayId = uuidV4();
                await dbService.run('INSERT INTO routine_days (id, routine_id, name, order_index) VALUES (?, ?, ?, ?)', [newDayId, newRoutineId, day.name, day.order_index]);
                await dbService.queueSyncMutation('routine_days', newDayId, 'INSERT', { id: newDayId, routine_id: newRoutineId, name: day.name, order_index: day.order_index });
                dayMap.set(day.id, newDayId);
            }

            // 4. Insert Routine Exercises
            for (const re of routine_exercises) {
                const mappedDayId = dayMap.get(re.routine_day_id);
                const mappedExId = exerciseMap.get(re.exercise_id);

                if (mappedDayId && mappedExId) {
                    const newReId = uuidV4();
                    await dbService.run(
                        'INSERT INTO routine_exercises (id, routine_day_id, exercise_id, order_index, notes) VALUES (?, ?, ?, ?, ?)',
                        [newReId, mappedDayId, mappedExId, re.order_index, re.notes]
                    );
                    await dbService.queueSyncMutation('routine_exercises', newReId, 'INSERT', {
                        id: newReId, routine_day_id: mappedDayId, exercise_id: mappedExId, order_index: re.order_index, notes: re.notes
                    });
                }
            }

            await dbService.run('COMMIT');
            return newRoutineId;

        } catch (e) {
            await dbService.run('ROLLBACK');
            throw e;
        }
    }

    public async exportRoutine(routineId: string): Promise<any> {
        const db = dbService.getDatabase();

        const routine = await db.getFirstAsync('SELECT * FROM routines WHERE id = ?', [routineId]);
        if (!routine) throw new Error('Routine not found');

        const routine_days = await db.getAllAsync('SELECT * FROM routine_days WHERE routine_id = ?', [routineId]);
        let routine_exercises: any[] = [];
        let exercises: any[] = [];

        if (routine_days.length > 0) {
            const dayIds = routine_days.map((d: any) => d.id);
            const dayPlaceholders = dayIds.map(() => '?').join(',');
            routine_exercises = await db.getAllAsync(
                `SELECT * FROM routine_exercises WHERE routine_day_id IN (${dayPlaceholders})`,
                dayIds
            );

            if (routine_exercises.length > 0) {
                const exIds = routine_exercises.map((re: any) => re.exercise_id);
                const exPlaceholders = exIds.map(() => '?').join(',');
                exercises = await db.getAllAsync(
                    `SELECT * FROM exercises WHERE id IN (${exPlaceholders})`,
                    exIds
                );
            }
        }

        return { routine, routine_days, routine_exercises, exercises };
    }
}

export const routineService = new RoutineService();
