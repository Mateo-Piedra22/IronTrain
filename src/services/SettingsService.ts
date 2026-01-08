import { PlateInventory, Setting } from '../types/db';
import { dbService } from './DatabaseService';

export class SettingsService {

    // --- General Settings ---

    public async getSetting(key: string): Promise<string | null> {
        const db = dbService.getDatabase();
        const res = await db.getFirstAsync<Setting>('SELECT * FROM settings WHERE key = ?', [key]);
        return res ? res.value : null;
    }

    public async setSetting(key: string, value: string, description?: string): Promise<void> {
        // Upsert
        await dbService.run(
            `INSERT INTO settings (key, value, description) VALUES (?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET value=excluded.value, description=excluded.description`,
            [key, value, description || null]
        );
    }

    // --- Plate Inventory ---

    public async getPlateInventory(): Promise<PlateInventory[]> {
        const db = dbService.getDatabase();
        return await db.getAllAsync<PlateInventory>('SELECT * FROM plate_inventory ORDER BY weight DESC');
    }

    public async updatePlateInventory(plates: PlateInventory[]): Promise<void> {
        // Clear and replace strategy for simplicity (inventory is small)
        // Transaction would be best but simple approach:
        await dbService.run('DELETE FROM plate_inventory');

        for (const p of plates) {
            await dbService.run(
                'INSERT INTO plate_inventory (weight, count, type, unit) VALUES (?, ?, ?, ?)',
                [p.weight, p.count, p.type, p.unit]
            );
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
