import { Category } from '../types/db';
import { dbService } from './DatabaseService';
export { Category };

export class CategoryService {
    static async getAll(): Promise<Category[]> {
        return await dbService.getAll<Category>('SELECT * FROM categories ORDER BY name ASC');
    }

    static async getById(id: string): Promise<Category | null> {
        return await dbService.getFirst<Category>('SELECT * FROM categories WHERE id = ?', [id]);
    }

    static async create(name: string): Promise<string> {
        const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        await dbService.run('INSERT INTO categories (id, name, is_system) VALUES (?, ?, 0)', [id, name]);
        return id;
    }

    static async update(id: string, name: string): Promise<void> {
        await dbService.run('UPDATE categories SET name = ? WHERE id = ?', [name, id]);
    }

    static async delete(id: string): Promise<void> {
        // Check if system category
        const category = await dbService.getFirst<Category>('SELECT is_system FROM categories WHERE id = ?', [id]);
        if (category?.is_system) {
            throw new Error('Cannot delete system category');
        }

        // Check for exercises
        const exerciseCount = await dbService.getFirst<{ count: number }>('SELECT COUNT(*) as count FROM exercises WHERE category_id = ?', [id]);
        if (exerciseCount && exerciseCount.count > 0) {
            throw new Error('Cannot delete category with existing exercises');
        }

        await dbService.run('DELETE FROM categories WHERE id = ?', [id]);
    }
}
