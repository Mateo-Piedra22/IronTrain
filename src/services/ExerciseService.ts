import { Exercise } from '../types/db';
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
        const id = crypto.randomUUID();
        await dbService.run(
            'INSERT INTO exercises (id, category_id, name, type, notes) VALUES (?, ?, ?, ?, ?)',
            [id, data.category_id, data.name, data.type, data.notes ?? null]
        );
        return id;
    }

    static async update(id: string, data: Partial<Omit<Exercise, 'id' | 'is_system'>>): Promise<void> {
        const updates: string[] = [];
        const values: any[] = [];

        if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
        if (data.category_id !== undefined) { updates.push('category_id = ?'); values.push(data.category_id); }
        if (data.type !== undefined) { updates.push('type = ?'); values.push(data.type); }
        if (data.notes !== undefined) { updates.push('notes = ?'); values.push(data.notes); }

        if (updates.length === 0) return;

        values.push(id);
        await dbService.run(`UPDATE exercises SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    static async delete(id: string): Promise<void> {
        // Safe delete check
        const setsCount = await dbService.getFirst<{ count: number }>('SELECT COUNT(*) as count FROM workout_sets WHERE exercise_id = ?', [id]);
        if (setsCount && setsCount.count > 0) {
            throw new Error('Cannot delete exercise with existing history');
        }
        await dbService.run('DELETE FROM exercises WHERE id = ?', [id]);
    }
}

