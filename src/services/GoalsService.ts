import { Goal } from '../types/db';
import { uuidV4 } from '../utils/uuid';
import { dbService } from './DatabaseService';

export class GoalsService {
    static async getActiveGoals(): Promise<Goal[]> {
        return await dbService.getAll<Goal>('SELECT * FROM goals WHERE completed = 0 ORDER BY title ASC');
    }

    static async createGoal(data: { title: string; targetValue: number; currentValue?: number }): Promise<string> {
        const title = data.title.trim();
        if (!title) {
            throw new Error('El título es obligatorio');
        }
        if (!Number.isFinite(data.targetValue) || data.targetValue <= 0) {
            throw new Error('El objetivo debe ser mayor que 0');
        }
        const currentValue = Number.isFinite(data.currentValue ?? 0) ? (data.currentValue ?? 0) : 0;

        const id = uuidV4();
        await dbService.run(
            'INSERT INTO goals (id, title, target_value, current_value, type, completed) VALUES (?, ?, ?, ?, ?, ?)',
            [id, title, data.targetValue, currentValue, 'exercise_weight', 0]
        );
        return id;
    }

    static async deleteGoal(id: string): Promise<void> {
        await dbService.run('DELETE FROM goals WHERE id = ?', [id]);
    }

    static async completeGoal(id: string): Promise<void> {
        await dbService.run('UPDATE goals SET completed = 1 WHERE id = ?', [id]);
    }
}
