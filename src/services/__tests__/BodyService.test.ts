import { Measurement } from '../../types/db';
import { bodyService } from '../BodyService';
import { dbService } from '../DatabaseService';

const localDateTimestamp = (dateStr: string): number => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).getTime();
};

jest.mock('../DatabaseService', () => ({
    dbService: {
        getAll: jest.fn(),
        getFirst: jest.fn(),
        run: jest.fn(),
        queueSyncMutation: jest.fn(),
    },
}));

describe('BodyService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getAll', () => {
        it('should return grouped body metrics by date', async () => {
            const date1 = new Date('2026-01-15T12:00:00Z').getTime();
            const date2 = new Date('2026-01-14T12:00:00Z').getTime();

            const mockMeasurements: Partial<Measurement>[] = [
                { id: '1', date: date1, type: 'weight', value: 80, unit: 'kg' },
                { id: '2', date: date1, type: 'body_fat', value: 15, unit: '%' },
                { id: '3', date: date2, type: 'weight', value: 81, unit: 'kg' },
                { id: '4', date: date2, type: 'body_fat', value: 16, unit: '%' },
            ];

            (dbService.getAll as jest.Mock).mockResolvedValue(mockMeasurements);

            const result = await bodyService.getAll();

            expect(result).toHaveLength(2);
            // Results are sorted by date descending
            expect(result[0].weight).toBe(80);
            expect(result[0].body_fat).toBe(15);
            expect(result[1].weight).toBe(81);
            expect(result[1].body_fat).toBe(16);
        });

        it('should handle measurements with only weight', async () => {
            const date1 = new Date('2026-01-15T12:00:00Z').getTime();
            const mockMeasurements: Partial<Measurement>[] = [
                { id: '1', date: date1, type: 'weight', value: 80, unit: 'kg' },
            ];

            (dbService.getAll as jest.Mock).mockResolvedValue(mockMeasurements);

            const result = await bodyService.getAll();

            expect(result).toHaveLength(1);
            expect(result[0].weight).toBe(80);
        });

        it('should handle measurements with only body fat', async () => {
            const date1 = new Date('2026-01-15T12:00:00Z').getTime();
            const mockMeasurements: Partial<Measurement>[] = [
                { id: '1', date: date1, type: 'body_fat', value: 15, unit: '%' },
            ];

            (dbService.getAll as jest.Mock).mockResolvedValue(mockMeasurements);

            const result = await bodyService.getAll();

            expect(result).toHaveLength(1);
            expect(result[0].body_fat).toBe(15);
        });

        it('should return empty array when no measurements exist', async () => {
            (dbService.getAll as jest.Mock).mockResolvedValue([]);

            const result = await bodyService.getAll();

            expect(result).toHaveLength(0);
        });

        it('should sort results by date descending', async () => {
            const date1 = new Date('2026-01-10T12:00:00Z').getTime();
            const date2 = new Date('2026-01-20T12:00:00Z').getTime();
            const date3 = new Date('2026-01-15T12:00:00Z').getTime();

            const mockMeasurements: Partial<Measurement>[] = [
                { id: '1', date: date1, type: 'weight', value: 82, unit: 'kg' },
                { id: '2', date: date2, type: 'weight', value: 80, unit: 'kg' },
                { id: '3', date: date3, type: 'weight', value: 81, unit: 'kg' },
            ];

            (dbService.getAll as jest.Mock).mockResolvedValue(mockMeasurements);

            const result = await bodyService.getAll();

            expect(result.map(r => r.weight)).toEqual([80, 81, 82]);
        });
    });

    describe('add', () => {
        it('should add both weight and body fat measurements', async () => {
            await bodyService.add('2026-01-15', 80, 15);

            expect(dbService.run).toHaveBeenCalledTimes(2);
            expect(dbService.run).toHaveBeenCalledWith(
                'INSERT INTO measurements (id, date, type, value, unit, notes) VALUES (?, ?, ?, ?, ?, ?)',
                expect.arrayContaining([expect.any(String), expect.any(Number), 'weight', 80, 'kg', null])
            );
            expect(dbService.run).toHaveBeenCalledWith(
                'INSERT INTO measurements (id, date, type, value, unit, notes) VALUES (?, ?, ?, ?, ?, ?)',
                expect.arrayContaining([expect.any(String), expect.any(Number), 'body_fat', 15, '%', null])
            );
        });

        it('should add only weight when body fat is 0', async () => {
            await bodyService.add('2026-01-15', 80, 0);

            expect(dbService.run).toHaveBeenCalledTimes(1);
            expect(dbService.queueSyncMutation).toHaveBeenCalledWith(
                'measurements',
                expect.any(String),
                'INSERT',
                expect.objectContaining({ type: 'weight', value: 80 })
            );
        });

        it('should add only body fat when weight is 0', async () => {
            await bodyService.add('2026-01-15', 0, 15);

            expect(dbService.run).toHaveBeenCalledTimes(1);
            expect(dbService.queueSyncMutation).toHaveBeenCalledWith(
                'measurements',
                expect.any(String),
                'INSERT',
                expect.objectContaining({ type: 'body_fat', value: 15 })
            );
        });

        it('should convert date string to timestamp', async () => {
            const dateStr = '2026-01-15';
            const expectedTimestamp = localDateTimestamp(dateStr);

            await bodyService.add(dateStr, 80, 15);

            expect(dbService.run).toHaveBeenCalledWith(
                'INSERT INTO measurements (id, date, type, value, unit, notes) VALUES (?, ?, ?, ?, ?, ?)',
                expect.arrayContaining([expect.any(String), expectedTimestamp, 'weight', 80, 'kg', null])
            );
        });
    });

    describe('getLatestMeasurement', () => {
        it('should return the latest measurement for a given type', async () => {
            const mockMeasurement: Partial<Measurement> = {
                id: '1',
                date: new Date('2026-01-15').getTime(),
                type: 'weight',
                value: 80,
                unit: 'kg',
            };

            (dbService.getFirst as jest.Mock).mockResolvedValue(mockMeasurement);

            const result = await bodyService.getLatestMeasurement('weight');

            expect(dbService.getFirst).toHaveBeenCalledWith(
                'SELECT * FROM measurements WHERE type = ? ORDER BY date DESC LIMIT 1',
                ['weight']
            );
            expect(result).toEqual(mockMeasurement);
        });

        it('should return null when no measurement exists', async () => {
            (dbService.getFirst as jest.Mock).mockResolvedValue(null);

            const result = await bodyService.getLatestMeasurement('weight');

            expect(result).toBeNull();
        });

        it('should get latest body fat measurement', async () => {
            (dbService.getFirst as jest.Mock).mockResolvedValue({ type: 'body_fat', value: 15 });

            await bodyService.getLatestMeasurement('body_fat');

            expect(dbService.getFirst).toHaveBeenCalledWith(
                'SELECT * FROM measurements WHERE type = ? ORDER BY date DESC LIMIT 1',
                ['body_fat']
            );
        });
    });

    describe('getHistory', () => {
        it('should return all measurements for a given type sorted by date descending', async () => {
            const mockMeasurements: Partial<Measurement>[] = [
                { id: '1', date: new Date('2026-01-15').getTime(), type: 'weight', value: 80 },
                { id: '2', date: new Date('2026-01-10').getTime(), type: 'weight', value: 81 },
            ];

            (dbService.getAll as jest.Mock).mockResolvedValue(mockMeasurements);

            const result = await bodyService.getHistory('weight');

            expect(dbService.getAll).toHaveBeenCalledWith(
                'SELECT * FROM measurements WHERE type = ? ORDER BY date DESC',
                ['weight']
            );
            expect(result).toEqual(mockMeasurements);
        });

        it('should return empty array when no history exists', async () => {
            (dbService.getAll as jest.Mock).mockResolvedValue([]);

            const result = await bodyService.getHistory('weight');

            expect(result).toHaveLength(0);
        });
    });

    describe('addMeasurement', () => {
        it('should add a measurement with all parameters', async () => {
            const date = new Date('2026-01-15').getTime();
            const notes = 'Morning measurement';

            await bodyService.addMeasurement('weight', 80, 'kg', date, notes);

            expect(dbService.run).toHaveBeenCalledWith(
                'INSERT INTO measurements (id, date, type, value, unit, notes) VALUES (?, ?, ?, ?, ?, ?)',
                expect.arrayContaining([expect.any(String), date, 'weight', 80, 'kg', notes])
            );
            expect(dbService.queueSyncMutation).toHaveBeenCalledWith(
                'measurements',
                expect.any(String),
                'INSERT',
                expect.objectContaining({
                    type: 'weight',
                    value: 80,
                    unit: 'kg',
                    notes,
                })
            );
        });

        it('should use current time when date is not provided', async () => {
            const beforeCall = Date.now();

            await bodyService.addMeasurement('weight', 80, 'kg');

            const afterCall = Date.now();

            expect(dbService.run).toHaveBeenCalledWith(
                'INSERT INTO measurements (id, date, type, value, unit, notes) VALUES (?, ?, ?, ?, ?, ?)',
                expect.arrayContaining([
                    expect.any(String),
                    expect.any(Number),
                    'weight',
                    80,
                    'kg',
                    null,
                ])
            );

            const actualDate = (dbService.run as jest.Mock).mock.calls[0][1][1];
            expect(actualDate).toBeGreaterThanOrEqual(beforeCall);
            expect(actualDate).toBeLessThanOrEqual(afterCall);
        });

        it('should use null for notes when not provided', async () => {
            await bodyService.addMeasurement('weight', 80, 'kg');

            expect(dbService.run).toHaveBeenCalledWith(
                'INSERT INTO measurements (id, date, type, value, unit, notes) VALUES (?, ?, ?, ?, ?, ?)',
                expect.arrayContaining([expect.any(String), expect.any(Number), 'weight', 80, 'kg', null])
            );
        });

        it('should return the generated measurement ID', async () => {
            const result = await bodyService.addMeasurement('weight', 80, 'kg');

            expect(typeof result).toBe('string');
            expect(result).toHaveLength(36); // UUID format
        });
    });

    describe('delete (by date group)', () => {
        it('should delete all measurements for a specific date', async () => {
            const measurementsToDelete = [
                { id: '1' },
                { id: '2' },
            ];

            (dbService.getAll as jest.Mock).mockResolvedValue(measurementsToDelete);

            await bodyService.delete('2026-01-15');

            const startOfDay = new Date(2026, 0, 15, 0, 0, 0, 0).getTime();
            const endOfDay = new Date(2026, 0, 15, 23, 59, 59, 999).getTime();

            expect(dbService.getAll).toHaveBeenCalledWith(
                'SELECT id FROM measurements WHERE date >= ? AND date <= ?',
                [startOfDay, endOfDay]
            );
            expect(dbService.queueSyncMutation).toHaveBeenCalledTimes(2);
            expect(dbService.queueSyncMutation).toHaveBeenCalledWith('measurements', '1', 'DELETE');
            expect(dbService.queueSyncMutation).toHaveBeenCalledWith('measurements', '2', 'DELETE');
            expect(dbService.run).toHaveBeenCalledWith(
                'DELETE FROM measurements WHERE date >= ? AND date <= ?',
                [startOfDay, endOfDay]
            );
        });

        it('should handle date with no measurements', async () => {
            (dbService.getAll as jest.Mock).mockResolvedValue([]);

            await bodyService.delete('2026-01-15');

            expect(dbService.queueSyncMutation).not.toHaveBeenCalled();
            expect(dbService.run).toHaveBeenCalledWith(
                'DELETE FROM measurements WHERE date >= ? AND date <= ?',
                expect.any(Array)
            );
        });
    });

    describe('deleteMeasurement', () => {
        it('should delete a specific measurement by ID', async () => {
            await bodyService.deleteMeasurement('measurement-123');

            expect(dbService.run).toHaveBeenCalledWith(
                'DELETE FROM measurements WHERE id = ?',
                ['measurement-123']
            );
            expect(dbService.queueSyncMutation).toHaveBeenCalledWith(
                'measurements',
                'measurement-123',
                'DELETE'
            );
        });
    });
});
