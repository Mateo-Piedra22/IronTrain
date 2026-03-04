import { Goal } from '../types/db';
import { uuidV4 } from '../utils/uuid';
import { dbService } from './DatabaseService';

export class GoalsService {
    static async getActiveGoals(): Promise<Goal[]> {
        return await dbService.getAll<Goal>('SELECT * FROM goals WHERE completed = 0 ORDER BY title ASC');
    }

    static async getCompletedGoals(): Promise<Goal[]> {
        return await dbService.getAll<Goal>('SELECT * FROM goals WHERE completed = 1 ORDER BY title ASC');
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
        await dbService.queueSyncMutation('goals', id, 'INSERT', { id, title, target_value: data.targetValue, current_value: currentValue, type: 'exercise_weight', completed: 0 });
        return id;
    }

    static async deleteGoal(id: string): Promise<void> {
        await dbService.run('DELETE FROM goals WHERE id = ?', [id]);
        await dbService.queueSyncMutation('goals', id, 'DELETE');
    }

    static async completeGoal(id: string): Promise<string> {
        const goal = await dbService.getFirst<Goal>('SELECT * FROM goals WHERE id = ?', [id]);
        if (!goal) {
            throw new Error('Meta no encontrada');
        }
        await dbService.run('UPDATE goals SET completed = 1, current_value = target_value WHERE id = ?', [id]);
        await dbService.queueSyncMutation('goals', id, 'UPDATE', { completed: 1, current_value: goal.target_value });
        return goal.title;
    }

    static async reopenGoal(id: string): Promise<void> {
        await dbService.run('UPDATE goals SET completed = 0 WHERE id = ?', [id]);
        await dbService.queueSyncMutation('goals', id, 'UPDATE', { completed: 0 });
    }
}
