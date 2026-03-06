import { Badge, ExerciseBadge } from '../types/db';
import { uuidV4 } from '../utils/uuid';
import { dbService } from './DatabaseService';

class BadgeService {
    public async getAllBadges(): Promise<Badge[]> {
        return await dbService.getAll<Badge>('SELECT * FROM badges WHERE deleted_at IS NULL ORDER BY is_system DESC, group_name ASC, name ASC');
    }

    public async getBadgesByExerciseId(exerciseId: string): Promise<Badge[]> {
        const sql = `
            SELECT b.* 
            FROM badges b
            JOIN exercise_badges eb ON b.id = eb.badge_id
            WHERE eb.exercise_id = ? AND eb.deleted_at IS NULL AND b.deleted_at IS NULL
        `;
        return await dbService.getAll<Badge>(sql, [exerciseId]);
    }

    public async getBadgeAssociationsForExercise(exerciseId: string): Promise<ExerciseBadge[]> {
        return await dbService.getAll<ExerciseBadge>(
            'SELECT * FROM exercise_badges WHERE exercise_id = ? AND deleted_at IS NULL',
            [exerciseId]
        );
    }

    public async updateExerciseBadges(exerciseId: string, badgeIds: string[]): Promise<void> {
        const current = await this.getBadgeAssociationsForExercise(exerciseId);
        const currentIds = new Set(current.map(a => a.badge_id));
        const targetIds = new Set(badgeIds);
        const now = Date.now();

        // Detect additions
        const toAdd = badgeIds.filter(id => !currentIds.has(id));
        // Detect removals
        const toRemove = current.filter(a => !targetIds.has(a.badge_id));

        await dbService.withTransaction(async () => {
            // Soft delete removals
            for (const assoc of toRemove) {
                await dbService.run(
                    'UPDATE exercise_badges SET deleted_at = ?, updated_at = ? WHERE id = ?',
                    [now, now, assoc.id]
                );
                await dbService.queueSyncMutation('exercise_badges', assoc.id, 'DELETE');
            }

            // Upsert additions (check if it existed as deleted before to avoid duplicates)
            for (const bId of toAdd) {
                const existing = await dbService.getFirst<{ id: string }>(
                    'SELECT id FROM exercise_badges WHERE exercise_id = ? AND badge_id = ?',
                    [exerciseId, bId]
                );

                if (existing) {
                    await dbService.run(
                        'UPDATE exercise_badges SET deleted_at = NULL, updated_at = ? WHERE id = ?',
                        [now, existing.id]
                    );
                    await dbService.queueSyncMutation('exercise_badges', existing.id, 'UPDATE', { deleted_at: null, updated_at: now });
                } else {
                    const id = uuidV4();
                    await dbService.run(
                        'INSERT INTO exercise_badges (id, exercise_id, badge_id, updated_at) VALUES (?, ?, ?, ?)',
                        [id, exerciseId, bId, now]
                    );
                    await dbService.queueSyncMutation('exercise_badges', id, 'INSERT', {
                        id, exercise_id: exerciseId, badge_id: bId, updated_at: now
                    });
                }
            }
        });
    }

    public async createCustomBadge(badge: Omit<Badge, 'id' | 'is_system' | 'updated_at'>): Promise<Badge> {
        const id = uuidV4();
        const now = Date.now();
        const newBadge: Badge = {
            ...badge,
            id,
            is_system: 0,
            updated_at: now
        };

        await dbService.run(
            'INSERT INTO badges (id, name, color, icon, group_name, is_system, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?)',
            [id, badge.name, badge.color, badge.icon || null, badge.group_name || null, now]
        );
        await dbService.queueSyncMutation('badges', id, 'INSERT', {
            id, name: badge.name, color: badge.color, icon: badge.icon || null, group_name: badge.group_name || null, is_system: 0, updated_at: now
        });

        return newBadge;
    }

    public async updateBadge(id: string, updates: Partial<Omit<Badge, 'id' | 'is_system' | 'updated_at'>>): Promise<void> {
        const now = Date.now();
        const fields = Object.values(updates).length > 0 ? Object.keys(updates) : [];
        if (fields.length === 0) return;

        const setClause = fields.map(f => `${f === 'group_name' ? 'group_name' : f} = ?`).join(', ');
        const values = [...Object.values(updates), now, id];

        await dbService.run(
            `UPDATE badges SET ${setClause}, updated_at = ? WHERE id = ?`,
            values
        );
        await dbService.queueSyncMutation('badges', id, 'UPDATE', { ...updates, updated_at: now });
    }

    public async deleteBadge(id: string): Promise<void> {
        const now = Date.now();
        await dbService.withTransaction(async () => {
            // Soft delete badge
            await dbService.run('UPDATE badges SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
            await dbService.queueSyncMutation('badges', id, 'DELETE');

            // Soft delete associations
            const assocs = await dbService.getAll<{ id: string }>('SELECT id FROM exercise_badges WHERE badge_id = ? AND deleted_at IS NULL', [id]);
            for (const assoc of assocs) {
                await dbService.run('UPDATE exercise_badges SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, assoc.id]);
                await dbService.queueSyncMutation('exercise_badges', assoc.id, 'DELETE');
            }
        });
    }
}

export const badgeService = new BadgeService();

