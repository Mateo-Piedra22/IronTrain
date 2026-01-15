import { Category } from '../types/db';
import { dbService } from './DatabaseService';
export { Category };

export class CategoryService {
    static UNCATEGORIZED_ID = 'uncategorized';
    static UNCATEGORIZED_NAME = 'Sin categoría';

    static async getAll(): Promise<Category[]> {
        return await dbService.getAll<Category>('SELECT * FROM categories ORDER BY name ASC');
    }

    static async getById(id: string): Promise<Category | null> {
        return await dbService.getFirst<Category>('SELECT * FROM categories WHERE id = ?', [id]);
    }

    static async ensureUncategorizedCategory(): Promise<string> {
        const byId = await dbService.getFirst<Pick<Category, 'id'>>('SELECT id FROM categories WHERE id = ?', [CategoryService.UNCATEGORIZED_ID]);
        if (byId?.id) return byId.id;

        const byName = await dbService.getFirst<Pick<Category, 'id'>>('SELECT id FROM categories WHERE name = ?', [CategoryService.UNCATEGORIZED_NAME]);
        if (byName?.id) return byName.id;

        await dbService.run(
            'INSERT INTO categories (id, name, is_system, sort_order, color) VALUES (?, ?, 1, ?, ?)',
            [CategoryService.UNCATEGORIZED_ID, CategoryService.UNCATEGORIZED_NAME, 9999, '#94a3b8']
        );
        return CategoryService.UNCATEGORIZED_ID;
    }

    static async getDeletionImpact(id: string): Promise<{ exerciseCount: number; sampleExerciseNames: string[] }> {
        const category = await CategoryService.getById(id);
        if (!category) {
            throw new Error('Category not found');
        }
        const exerciseCount = await dbService.getFirst<{ count: number }>('SELECT COUNT(*) as count FROM exercises WHERE category_id = ?', [id]);
        const exerciseNames = await dbService.getAll<{ name: string }>(
            'SELECT name FROM exercises WHERE category_id = ? ORDER BY name ASC LIMIT 10',
            [id]
        );
        return {
            exerciseCount: exerciseCount?.count ?? 0,
            sampleExerciseNames: exerciseNames.map((x) => x.name)
        };
    }

    static async create(name: string, color: string = '#3b82f6'): Promise<string> {
        const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        await dbService.run('INSERT INTO categories (id, name, color, is_system) VALUES (?, ?, ?, 0)', [id, name, color]);
        return id;
    }

    static async update(id: string, name: string, color?: string): Promise<void> {
        const category = await CategoryService.getById(id);
        if (!category) {
            throw new Error('Category not found');
        }
        const isProtectedUncategorized =
            category.id === CategoryService.UNCATEGORIZED_ID ||
            (category.is_system === 1 && category.name === CategoryService.UNCATEGORIZED_NAME);
        if (isProtectedUncategorized) {
            throw new Error('Cannot edit uncategorized category');
        }

        if (color) {
            await dbService.run('UPDATE categories SET name = ?, color = ? WHERE id = ?', [name, color, id]);
        } else {
            await dbService.run('UPDATE categories SET name = ? WHERE id = ?', [name, id]);
        }
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

    static async deleteAndReassignExercises(id: string, targetCategoryId?: string): Promise<void> {
        const category = await CategoryService.getById(id);
        if (!category) {
            throw new Error('Category not found');
        }
        if (category.is_system) {
            throw new Error('Cannot delete system category');
        }

        const fallbackTargetId = await CategoryService.ensureUncategorizedCategory();
        const toCategoryId = targetCategoryId ?? fallbackTargetId;

        if (id === toCategoryId) {
            throw new Error('Cannot reassign to the same category');
        }

        await dbService.run('BEGIN TRANSACTION');
        try {
            await dbService.run('UPDATE exercises SET category_id = ? WHERE category_id = ?', [toCategoryId, id]);
            await dbService.run('DELETE FROM categories WHERE id = ?', [id]);
            await dbService.run('COMMIT');
        } catch (e) {
            await dbService.run('ROLLBACK');
            throw e;
        }
    }
}
