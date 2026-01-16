import { Exercise, ExerciseType } from '../types/db';
import { uuidV4 } from '../utils/uuid';
import { dbService } from './DatabaseService';
export { Exercise };

export class ExerciseService {
    static async getAll(): Promise<Exercise[]> {
        return await dbService.getAll<Exercise>('SELECT * FROM exercises ORDER BY name ASC');
    }

    static async getByCategory(categoryId: string): Promise<Exercise[]> {
        return await dbService.getAll<Exercise>('SELECT * FROM exercises WHERE category_id = ? ORDER BY name ASC', [categoryId]);
    }

    static async create(data: Omit<Exercise, 'id' | 'is_system'>): Promise<string> {
        const id = uuidV4();
        await dbService.run(
            'INSERT INTO exercises (id, category_id, name, type, notes) VALUES (?, ?, ?, ?, ?)',
            [id, data.category_id, data.name, data.type, data.notes ?? null]
        );
        return id;
    }

    static async update(id: string, data: Partial<Omit<Exercise, 'id' | 'is_system'>>): Promise<void> {
        const existing = await dbService.getFirst<Pick<Exercise, 'type'>>('SELECT type FROM exercises WHERE id = ?', [id]);
        if (!existing) throw new Error('Exercise not found');

        const updates: string[] = [];
        const values: any[] = [];

        if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
        if (data.category_id !== undefined) { updates.push('category_id = ?'); values.push(data.category_id); }
        if (data.type !== undefined) { updates.push('type = ?'); values.push(data.type); }
        if (data.notes !== undefined) { updates.push('notes = ?'); values.push(data.notes); }

        if (updates.length === 0) return;

        const nextType: ExerciseType = (data.type as ExerciseType) ?? (existing.type as ExerciseType);
        const prevType: ExerciseType = existing.type as ExerciseType;
        const typeChanged = data.type !== undefined && prevType !== nextType;

        try {
            await dbService.run('BEGIN TRANSACTION');
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

            await dbService.run('COMMIT');
        } catch (e) {
            try { await dbService.run('ROLLBACK'); } catch { }
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
        await dbService.run('DELETE FROM exercises WHERE id = ?', [id]);
    }

    static async search(query: string, categoryId?: string): Promise<(Exercise & { category_name: string; category_color: string })[]> {
        let sql = `
            SELECT e.*, c.name as category_name, c.color as category_color
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

        return await dbService.getAll(sql, params);
    }
}

