import { Exercise, ExerciseType } from '../types/db';
import { capitalizeWords } from '../utils/text';
import { uuidV4 } from '../utils/uuid';
import { dataEventService } from './DataEventService';
import { dbService } from './DatabaseService';
export { Exercise };

export class ExerciseService {
    static async getAll(): Promise<Exercise[]> {
        return await dbService.getAll<Exercise>('SELECT * FROM exercises ORDER BY name ASC');
    }

    static async getDeleteImpact(id: string): Promise<{ routinesCount: number; daysCount: number; sample: { routine_name: string; day_name: string }[] }> {
        const rows = await dbService.getAll<{ routine_name: string; day_name: string }>(
            `
                SELECT r.name as routine_name, rd.name as day_name
                FROM routine_exercises re
                JOIN routine_days rd ON rd.id = re.routine_day_id
                JOIN routines r ON r.id = rd.routine_id
                WHERE re.exercise_id = ?
                  AND re.deleted_at IS NULL
                  AND rd.deleted_at IS NULL
                  AND r.deleted_at IS NULL
                ORDER BY r.name ASC, rd.order_index ASC
            `,
            [id]
        );

        const routineNames = new Set<string>();
        const dayKeys = new Set<string>();
        for (const row of rows) {
            routineNames.add(row.routine_name);
            dayKeys.add(`${row.routine_name}::${row.day_name}`);
        }

        return {
            routinesCount: routineNames.size,
            daysCount: dayKeys.size,
            sample: rows.slice(0, 5),
        };
    }

    static async getByCategory(categoryId: string): Promise<(Exercise & { badges?: any[] })[]> {
        const sql = `
            SELECT e.*, 
            (SELECT GROUP_CONCAT(b.id || '|' || b.name || '|' || b.color || '|' || COALESCE(b.icon, '') || '|' || COALESCE(b.group_name, '')) 
             FROM badges b 
             JOIN exercise_badges eb ON b.id = eb.badge_id 
             WHERE eb.exercise_id = e.id AND eb.deleted_at IS NULL AND b.deleted_at IS NULL) as badges_csv
            FROM exercises e 
            WHERE e.category_id = ? 
            ORDER BY e.name ASC
        `;
        const results = await dbService.getAll<any>(sql, [categoryId]);

        return results.map(row => {
            const badges = row.badges_csv ? row.badges_csv.split(',').map((s: string) => {
                const [id, name, color, icon, group_name] = s.split('|');
                return { id, name, color, icon: icon || undefined, group_name: group_name || undefined };
            }) : [];

            return {
                ...row,
                badges
            };
        });
    }

    static async create(data: Omit<Exercise, 'id' | 'is_system'>): Promise<string> {
        const id = uuidV4();
        const name = capitalizeWords(data.name);
        await dbService.run(
            'INSERT INTO exercises (id, category_id, name, type, notes) VALUES (?, ?, ?, ?, ?)',
            [id, data.category_id, name, data.type, data.notes ?? null]
        );
        await dbService.queueSyncMutation('exercises', id, 'INSERT', { id, category_id: data.category_id, name, type: data.type, notes: data.notes ?? null, is_system: 0 });

        // Emit for real-time UI updates
        dataEventService.emit('DATA_UPDATED');

        return id;
    }

    static async update(id: string, data: Partial<Omit<Exercise, 'id' | 'is_system'>>): Promise<void> {
        const existing = await dbService.getFirst<Pick<Exercise, 'type'>>('SELECT type FROM exercises WHERE id = ?', [id]);
        if (!existing) throw new Error('Exercise not found');

        const updates: string[] = [];
        const values: any[] = [];

        const normalizedName = data.name !== undefined ? capitalizeWords(data.name) : undefined;

        if (normalizedName !== undefined) { updates.push('name = ?'); values.push(normalizedName); }
        if (data.category_id !== undefined) { updates.push('category_id = ?'); values.push(data.category_id); }
        if (data.type !== undefined) { updates.push('type = ?'); values.push(data.type); }
        if (data.notes !== undefined) { updates.push('notes = ?'); values.push(data.notes); }

        if (updates.length === 0) return;

        const nextType: ExerciseType = (data.type as ExerciseType) ?? (existing.type as ExerciseType);
        const prevType: ExerciseType = existing.type as ExerciseType;
        const typeChanged = data.type !== undefined && prevType !== nextType;

        try {
            await dbService.withTransaction(async () => {
                values.push(id);
                await dbService.run(`UPDATE exercises SET ${updates.join(', ')} WHERE id = ?`, values);

                if (typeChanged) {
                    if (nextType === 'distance_time') {
                        await dbService.run(
                            `UPDATE workout_sets
                             SET weight = NULL,
                                 reps = NULL,
                                 distance = CASE WHEN distance IS NULL THEN NULL WHEN distance < 0 THEN NULL ELSE distance END,
                                 time = CASE WHEN time IS NULL THEN NULL WHEN time < 0 THEN NULL ELSE time END
                             WHERE exercise_id = ?`,
                            [id]
                        );
                    } else if (nextType === 'reps_only') {
                        await dbService.run(
                            `UPDATE workout_sets
                             SET weight = NULL,
                                 distance = NULL,
                                 time = NULL,
                                 reps = CASE WHEN reps IS NULL THEN NULL WHEN reps < 0 THEN NULL ELSE reps END
                             WHERE exercise_id = ?`,
                            [id]
                        );
                    } else if (nextType === 'weight_only') {
                        await dbService.run(
                            `UPDATE workout_sets
                             SET reps = NULL,
                                 distance = NULL,
                                 time = NULL,
                                 weight = CASE WHEN weight IS NULL THEN NULL WHEN weight < 0 THEN NULL ELSE weight END
                             WHERE exercise_id = ?`,
                            [id]
                        );
                    } else {
                        await dbService.run(
                            `UPDATE workout_sets
                             SET distance = NULL,
                                 time = NULL,
                                 weight = CASE WHEN weight IS NULL THEN NULL WHEN weight < 0 THEN NULL ELSE weight END,
                                 reps = CASE WHEN reps IS NULL THEN NULL WHEN reps < 0 THEN NULL ELSE reps END
                             WHERE exercise_id = ?`,
                            [id]
                        );
                    }
                }
            });
            await dbService.queueSyncMutation('exercises', id, 'UPDATE', data);

            // Emit for real-time UI updates
            dataEventService.emit('DATA_UPDATED');
        } catch (e) {
            throw e;
        }
    }

    static async delete(id: string): Promise<void> {
        const exercise = await dbService.getFirst<Pick<Exercise, 'is_system'>>('SELECT is_system FROM exercises WHERE id = ?', [id]);
        if (!exercise) {
            throw new Error('Exercise not found');
        }
        if (exercise.is_system) {
            throw new Error('Cannot delete system exercise');
        }

        // Safe delete check
        const setsCount = await dbService.getFirst<{ count: number }>('SELECT COUNT(*) as count FROM workout_sets WHERE exercise_id = ?', [id]);
        if (setsCount && setsCount.count > 0) {
            throw new Error('Cannot delete exercise with existing history');
        }

        const linkedRoutineExercises = await dbService.getAll<{ id: string }>(
            'SELECT id FROM routine_exercises WHERE exercise_id = ? AND deleted_at IS NULL',
            [id]
        );

        await dbService.withTransaction(async () => {
            await dbService.run('DELETE FROM routine_exercises WHERE exercise_id = ?', [id]);
            await dbService.run('DELETE FROM exercises WHERE id = ?', [id]);
        });

        for (const row of linkedRoutineExercises) {
            await dbService.queueSyncMutation('routine_exercises', row.id, 'DELETE');
        }

        await dbService.queueSyncMutation('exercises', id, 'DELETE');

        // Emit for real-time UI updates
        dataEventService.emit('DATA_UPDATED');
    }

    static async search(query: string, categoryId?: string): Promise<(Exercise & { category_name: string; category_color: string; badges: any[] })[]> {
        let sql = `
            SELECT e.*, c.name as category_name, c.color as category_color,
            (SELECT GROUP_CONCAT(b.id || '|' || b.name || '|' || b.color || '|' || COALESCE(b.icon, '') || '|' || COALESCE(b.group_name, '')) 
             FROM badges b 
             JOIN exercise_badges eb ON b.id = eb.badge_id 
             WHERE eb.exercise_id = e.id AND eb.deleted_at IS NULL AND b.deleted_at IS NULL) as badges_csv
            FROM exercises e
            LEFT JOIN categories c ON e.category_id = c.id
            WHERE 1=1
        `;
        const params: any[] = [];

        if (query) {
            sql += ` AND e.name LIKE ?`;
            params.push(`%${query}%`);
        }

        if (categoryId && categoryId !== 'all') {
            sql += ` AND e.category_id = ?`;
            params.push(categoryId);
        }

        sql += ` ORDER BY e.name ASC`;

        const results = await dbService.getAll<any>(sql, params);

        return results.map(row => {
            const badges = row.badges_csv ? row.badges_csv.split(',').map((s: string) => {
                const [id, name, color, icon, group_name] = s.split('|');
                return { id, name, color, icon: icon || undefined, group_name: group_name || undefined };
            }) : [];

            return {
                ...row,
                badges
            };
        });
    }

    static async getById(id: string): Promise<(Exercise & { category_name: string; category_color: string; badges: any[] }) | null> {
        const sql = `
            SELECT e.*, c.name as category_name, c.color as category_color,
            (SELECT GROUP_CONCAT(b.id || '|' || b.name || '|' || b.color || '|' || COALESCE(b.icon, '') || '|' || COALESCE(b.group_name, '')) 
             FROM badges b 
             JOIN exercise_badges eb ON b.id = eb.badge_id 
             WHERE eb.exercise_id = e.id AND eb.deleted_at IS NULL AND b.deleted_at IS NULL) as badges_csv
            FROM exercises e
            LEFT JOIN categories c ON e.category_id = c.id
            WHERE e.id = ?
        `;
        const row = await dbService.getFirst<any>(sql, [id]);
        if (!row) return null;

        const badges = row.badges_csv ? row.badges_csv.split(',').map((s: string) => {
            const [bid, name, color, icon, group_name] = s.split('|');
            return { id: bid, name, color, icon: icon || undefined, group_name: group_name || undefined };
        }) : [];

        return {
            ...row,
            badges
        };
    }
}



