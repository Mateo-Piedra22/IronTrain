import { PlateInventory, Setting } from '../types/db';
import { uuidV4 } from '../utils/uuid';
import { dbService } from './DatabaseService';

export class SettingsService {

    // --- General Settings ---

    public async getSetting(key: string): Promise<string | null> {
        const res = await dbService.getFirst<Setting>('SELECT * FROM settings WHERE key = ?', [key]);
        return res ? res.value : null;
    }

    public async setSetting(key: string, value: string, description?: string): Promise<void> {
        const now = Date.now();
        // Upsert
        await dbService.run(
            `INSERT INTO settings (key, value, description, updated_at) VALUES (?, ?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET value=excluded.value, description=excluded.description, updated_at=excluded.updated_at`,
            [key, value, description || null, now]
        );
        // Queue for sync
        await dbService.queueSyncMutation('settings', key, 'INSERT', { key, value, description, updated_at: now });
    }

    // --- Plate Inventory ---

    public async getPlateInventory(): Promise<PlateInventory[]> {
        return await dbService.getAll<PlateInventory>('SELECT * FROM plate_inventory ORDER BY weight DESC');
    }

    public async updatePlateInventory(plates: PlateInventory[]): Promise<void> {
        try {
            await dbService.withTransaction(async () => {
                // Clear existing
                await dbService.run('DELETE FROM plate_inventory');

                // Insert new
                for (const p of plates) {
                    const id = uuidV4();
                    await dbService.run(
                        'INSERT INTO plate_inventory (id, weight, count, available, type, unit, color) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [id, p.weight, p.count, p.count, p.type, p.unit, p.color || null]
                    );
                }
            });
        } catch (error) {
            throw error;
        }
    }

    // Default Inventory Setup
    public async seedDefaultInventory(): Promise<void> {
        const current = await this.getPlateInventory();
        if (current.length > 0) return;

        const defaults: PlateInventory[] = [
            { weight: 20, count: 4, type: 'standard', unit: 'kg' },
            { weight: 15, count: 2, type: 'standard', unit: 'kg' },
            { weight: 10, count: 2, type: 'standard', unit: 'kg' },
            { weight: 5, count: 2, type: 'standard', unit: 'kg' },
            { weight: 2.5, count: 2, type: 'standard', unit: 'kg' },
            { weight: 1.25, count: 2, type: 'standard', unit: 'kg' },
        ];

        await this.updatePlateInventory(defaults);
    }
}

export const settingsService = new SettingsService();
