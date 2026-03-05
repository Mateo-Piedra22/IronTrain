import { format } from 'date-fns';
import { Measurement, MeasurementType } from '../types/db';
import { uuidV4 } from '../utils/uuid';
import { dbService } from './DatabaseService';

export interface BodyMetric {
    id: string; // Group ID or Date string? Let's use Date string as ID for grouping
    date: string;
    weight?: number;
    body_fat?: number;
}

export class BodyService {

    public async getAll(): Promise<BodyMetric[]> {
        const measurements = await dbService.getAll<Measurement>('SELECT * FROM measurements ORDER BY date DESC');

        const groups: Record<string, BodyMetric> = {};

        measurements.forEach(m => {
            const dateStr = format(new Date(m.date), 'yyyy-MM-dd');
            if (!groups[dateStr]) {
                groups[dateStr] = { id: dateStr, date: dateStr };
            }
            if (m.type === 'weight') groups[dateStr].weight = m.value;
            if (m.type === 'body_fat') groups[dateStr].body_fat = m.value;
        });

        return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
    }

    public async add(dateStr: string, weight: number, fat: number): Promise<void> {
        const date = new Date(dateStr).getTime();
        if (weight) await this.addMeasurement('weight', weight, 'kg', date);
        if (fat) await this.addMeasurement('body_fat', fat, '%', date);
    }

    /* Original methods preserved/adapted */
    public async getLatestMeasurement(type: MeasurementType): Promise<Measurement | null> {
        return await dbService.getFirst<Measurement>(
            'SELECT * FROM measurements WHERE type = ? ORDER BY date DESC LIMIT 1',
            [type]
        );
    }

    public async getHistory(type: MeasurementType): Promise<Measurement[]> {
        return await dbService.getAll<Measurement>(
            'SELECT * FROM measurements WHERE type = ? ORDER BY date DESC',
            [type]
        );
    }

    public async addMeasurement(type: MeasurementType, value: number, unit: string, date?: number, notes?: string): Promise<string> {
        const id = this.generateId();
        const timestamp = date || Date.now();

        await dbService.run(
            'INSERT INTO measurements (id, date, type, value, unit, notes) VALUES (?, ?, ?, ?, ?, ?)',
            [id, timestamp, type, value, unit, notes || null]
        );
        await dbService.queueSyncMutation('measurements', id, 'INSERT', { id, date: timestamp, type, value, unit, notes: notes || null });
        return id;
    }

    // Delete by Date Group (deletes all measurements for that date)
    public async delete(dateStr: string): Promise<void> {
        // Need to parse date range or generic date match?
        // Timestamps vary.
        // For simplicity in this logic, we assume we want to delete ALL measurements on that day.
        // We'll filter measurements by range.
        const start = new Date(dateStr).setHours(0, 0, 0, 0);
        const end = new Date(dateStr).setHours(23, 59, 59, 999);
        const toDelete = await dbService.getAll<{ id: string }>('SELECT id FROM measurements WHERE date >= ? AND date <= ?', [start, end]);
        for (const m of toDelete) {
            await dbService.queueSyncMutation('measurements', m.id, 'DELETE');
        }
        await dbService.run('DELETE FROM measurements WHERE date >= ? AND date <= ?', [start, end]);
    }

    public async deleteMeasurement(id: string): Promise<void> {
        await dbService.run('DELETE FROM measurements WHERE id = ?', [id]);
        await dbService.queueSyncMutation('measurements', id, 'DELETE');
    }

    private generateId(): string {
        return uuidV4();
    }
}

export const bodyService = new BodyService();
