import { configService } from '../ConfigService';
import { dbService } from '../DatabaseService';
import { dataEventService } from '../DataEventService';

jest.mock('../DatabaseService', () => ({
    dbService: {
        getAll: jest.fn(),
        run: jest.fn(),
        queueSyncMutation: jest.fn(),
    },
}));

jest.mock('../DataEventService', () => ({
    dataEventService: {
        emit: jest.fn(),
    },
}));

describe('ConfigService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset cache
        (configService as any).cache = null;
    });

    describe('init', () => {
        it('should load config on init', async () => {
            (dbService.getAll as jest.Mock).mockResolvedValue([]);

            await configService.init();

            expect(dbService.getAll).toHaveBeenCalledWith('SELECT key, value FROM settings');
        });
    });

    describe('reload', () => {
        it('should clear cache and reload config', async () => {
            (dbService.getAll as jest.Mock).mockResolvedValue([]);

            await configService.init();
            jest.clearAllMocks();

            await configService.reload();

            expect(dbService.getAll).toHaveBeenCalledTimes(1);
        });
    });

    describe('loadConfig', () => {
        it('should return cached config if available', async () => {
            (dbService.getAll as jest.Mock).mockResolvedValue([]);

            await configService.loadConfig();
            jest.clearAllMocks();

            const result = await configService.loadConfig();

            expect(dbService.getAll).not.toHaveBeenCalled();
            expect(result).toBeDefined();
        });

        it('should return default config when no settings exist', async () => {
            (dbService.getAll as jest.Mock).mockResolvedValue([]);

            const result = await configService.loadConfig();

            expect(result.weightUnit).toBe('kg');
            expect(result.defaultRestTimer).toBe(90);
            expect(result.themeMode).toBe('system');
            expect(result.language).toBe('es');
        });

        it('should parse boolean settings correctly', async () => {
            (dbService.getAll as jest.Mock).mockResolvedValue([
                { key: 'showGhostValues', value: 'true' },
                { key: 'autoFinishWorkout', value: 'false' },
                { key: 'hapticFeedbackEnabled', value: 'true' },
            ]);

            const result = await configService.loadConfig();

            expect(result.showGhostValues).toBe(true);
            expect(result.autoFinishWorkout).toBe(false);
            expect(result.hapticFeedbackEnabled).toBe(true);
        });

        it('should parse number settings correctly', async () => {
            (dbService.getAll as jest.Mock).mockResolvedValue([
                { key: 'defaultRestTimer', value: '120' },
                { key: 'plateCalculatorDefaultBarWeightKg', value: '25' },
                { key: 'calculatorsRoundingKg', value: '2.5' },
            ]);

            const result = await configService.loadConfig();

            expect(result.defaultRestTimer).toBe(120);
            expect(result.plateCalculatorDefaultBarWeightKg).toBe(25);
            expect(result.calculatorsRoundingKg).toBe(2.5);
        });

        it('should parse JSON settings correctly', async () => {
            const notificationPrefs = {
                inApp: { enabled: true, restTimer: false },
                system: { enabled: true },
                sounds: { restTimer: true },
            };

            (dbService.getAll as jest.Mock).mockResolvedValue([
                { key: 'notificationPreferences', value: JSON.stringify(notificationPrefs) },
                { key: 'training_days', value: '[1, 3, 5]' },
                { key: 'exerciseCardioMetricById', value: '{"run": "distance"}' },
            ]);

            const result = await configService.loadConfig();

            expect(result.notificationPreferences.inApp.enabled).toBe(true);
            expect(result.notificationPreferences.inApp.restTimer).toBe(false);
            expect(result.training_days).toEqual([1, 3, 5]);
            expect(result.exerciseCardioMetricById).toEqual({ run: 'distance' });
        });

        it('should handle invalid JSON gracefully', async () => {
            (dbService.getAll as jest.Mock).mockResolvedValue([
                { key: 'notificationPreferences', value: 'invalid json' },
                { key: 'training_days', value: 'not an array' },
            ]);

            const result = await configService.loadConfig();

            // Should fall back to defaults
            expect(result.notificationPreferences.inApp.enabled).toBe(true);
            expect(result.training_days).toEqual([1, 2, 3, 4, 5, 6]);
        });

        it('should sanitize analyticsDefaultRangeDays to allowed values', async () => {
            (dbService.getAll as jest.Mock).mockResolvedValue([
                { key: 'analyticsDefaultRangeDays', value: '45' }, // Invalid value
            ]);

            const result = await configService.loadConfig();

            expect(result.analyticsDefaultRangeDays).toBe(30); // Default
        });

        it('should accept valid analyticsDefaultRangeDays values', async () => {
            const validRanges = [7, 30, 90, 365];

            for (const range of validRanges) {
                jest.clearAllMocks();
                (dbService.getAll as jest.Mock).mockResolvedValue([
                    { key: 'analyticsDefaultRangeDays', value: String(range) },
                ]);
                // Reset cache
                (configService as any).cache = null;

                const result = await configService.loadConfig();
                expect(result.analyticsDefaultRangeDays).toBe(range);
            }
        });

        it('should sanitize cardio metrics to allowed values', async () => {
            (dbService.getAll as jest.Mock).mockResolvedValue([
                {
                    key: 'exerciseCardioMetricById',
                    value: JSON.stringify({
                        run: 'distance',
                        bike: 'invalid',
                        swim: 'time',
                        row: 'pace',
                    }),
                },
            ]);

            const result = await configService.loadConfig();

            expect(result.exerciseCardioMetricById).toEqual({
                run: 'distance',
                swim: 'time',
                row: 'pace',
            });
        });

        it('should ensure training_days is always an array', async () => {
            (dbService.getAll as jest.Mock).mockResolvedValue([
                { key: 'training_days', value: 'not an array' },
            ]);

            const result = await configService.loadConfig();

            expect(Array.isArray(result.training_days)).toBe(true);
            expect(result.training_days).toEqual([1, 2, 3, 4, 5, 6]);
        });

        it('should handle runningWorkoutTimerWorkoutId edge cases', async () => {
            (dbService.getAll as jest.Mock).mockResolvedValue([
                { key: 'runningWorkoutTimerWorkoutId', value: 'null' },
            ]);

            const result = await configService.loadConfig();

            expect(result.runningWorkoutTimerWorkoutId).toBeNull();
        });

        it('should handle runningWorkoutTimerStartTimestamp edge cases', async () => {
            (dbService.getAll as jest.Mock).mockResolvedValue([
                { key: 'runningWorkoutTimerStartTimestamp', value: 'invalid' },
            ]);

            const result = await configService.loadConfig();

            expect(result.runningWorkoutTimerStartTimestamp).toBeNull();
        });

        it('should sanitize notificationPreferences with defaults', async () => {
            const partialPrefs = {
                inApp: { restTimer: false },
                system: { workoutComplete: false },
            };

            (dbService.getAll as jest.Mock).mockResolvedValue([
                { key: 'notificationPreferences', value: JSON.stringify(partialPrefs) },
            ]);

            const result = await configService.loadConfig();

            expect(result.notificationPreferences.inApp.enabled).toBe(true); // Default
            expect(result.notificationPreferences.inApp.restTimer).toBe(false); // Overridden
            expect(result.notificationPreferences.system.enabled).toBe(true); // Default
            expect(result.notificationPreferences.system.workoutComplete).toBe(false); // Overridden
        });

        it('should handle load errors gracefully', async () => {
            (dbService.getAll as jest.Mock).mockRejectedValue(new Error('DB error'));

            const result = await configService.loadConfig();

            expect(result).toBeDefined();
            expect(result.weightUnit).toBe('kg'); // Default
        });
    });

    describe('get', () => {
        beforeEach(async () => {
            (dbService.getAll as jest.Mock).mockResolvedValue([]);
            await configService.init();
        });

        it('should return value for valid key', () => {
            const result = configService.get('weightUnit');
            expect(result).toBe('kg');
        });

        it('should return default when cache is not loaded', () => {
            (configService as any).cache = null;
            const result = configService.get('weightUnit');
            expect(result).toBe('kg');
        });

        it('should return undefined for unknown keys', () => {
            const result = configService.get('unknownKey' as any);
            expect(result).toBeUndefined();
        });
    });

    describe('set', () => {
        beforeEach(async () => {
            (dbService.getAll as jest.Mock).mockResolvedValue([]);
            await configService.init();
        });

        it('should set boolean value and persist to DB', async () => {
            await configService.set('showGhostValues', false);

            expect(dbService.run).toHaveBeenCalledWith(
                'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
                expect.arrayContaining(['showGhostValues', 'false', expect.any(Number)])
            );
            expect(configService.get('showGhostValues')).toBe(false);
        });

        it('should set number value and persist to DB', async () => {
            await configService.set('defaultRestTimer', 120);

            expect(dbService.run).toHaveBeenCalledWith(
                'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
                expect.arrayContaining(['defaultRestTimer', '120', expect.any(Number)])
            );
            expect(configService.get('defaultRestTimer')).toBe(120);
        });

        it('should set object value as JSON string', async () => {
            const value = { enabled: true, restTimer: false };
            await configService.set('exerciseCardioMetricById' as any, value as any);

            expect(dbService.run).toHaveBeenCalledWith(
                'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
                expect.arrayContaining(['exerciseCardioMetricById', JSON.stringify(value), expect.any(Number)])
            );
        });

        it('should queue sync mutation for non-local settings', async () => {
            await configService.set('weightUnit', 'lbs');

            expect(dbService.queueSyncMutation).toHaveBeenCalledWith(
                'settings',
                'weightUnit',
                'INSERT',
                expect.objectContaining({ key: 'weightUnit', value: 'lbs' })
            );
        });

        it('should NOT queue sync mutation for local-only settings', async () => {
            await configService.set('runningWorkoutTimerWorkoutId', 'w1');

            expect(dbService.queueSyncMutation).not.toHaveBeenCalled();
        });

        it('should emit SETTINGS_UPDATED event', async () => {
            await configService.set('themeMode', 'dark');

            expect(dataEventService.emit).toHaveBeenCalledWith(
                'SETTINGS_UPDATED',
                expect.objectContaining({ key: 'themeMode', value: 'dark' })
            );
        });

        it('should initialize cache if null', async () => {
            (configService as any).cache = null;

            await configService.set('weightUnit', 'lbs');

            expect((configService as any).cache).toBeDefined();
        });
    });

    describe('getGeneric', () => {
        beforeEach(async () => {
            (dbService.getAll as jest.Mock).mockResolvedValue([]);
            await configService.init();
        });

        it('should return value for any string key', () => {
            (configService as any).cache = { weightUnit: configService.get('weightUnit'), customKey: 'customValue' };

            const result = configService.getGeneric('customKey');
            expect(result).toBe('customValue');
        });

        it('should return null when cache is not loaded', () => {
            (configService as any).cache = null;
            const result = configService.getGeneric('anyKey');
            expect(result).toBeNull();
        });

        it('should return null for non-existent keys', () => {
            const result = configService.getGeneric('nonExistent');
            expect(result).toBeNull();
        });
    });

    describe('setGeneric', () => {
        beforeEach(async () => {
            (dbService.getAll as jest.Mock).mockResolvedValue([]);
            await configService.init();
        });

        it('should set any string key', async () => {
            await configService.setGeneric('customKey', 'customValue');

            expect(dbService.run).toHaveBeenCalledWith(
                'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
                expect.arrayContaining(['customKey', 'customValue', expect.any(Number)])
            );
        });

        it('should emit SETTINGS_UPDATED event', async () => {
            await configService.setGeneric('customKey', 'customValue');

            expect(dataEventService.emit).toHaveBeenCalledWith(
                'SETTINGS_UPDATED',
                expect.objectContaining({ key: 'customKey', value: 'customValue' })
            );
        });
    });

    describe('reset', () => {
        it('should reset cache to defaults', async () => {
            (dbService.getAll as jest.Mock).mockResolvedValue([
                { key: 'weightUnit', value: 'lbs' },
            ]);
            await configService.init();

            expect(configService.get('weightUnit')).toBe('lbs');

            await configService.reset();

            expect(configService.get('weightUnit')).toBe('kg');
        });

        it('should delete all settings from DB', async () => {
            await configService.reset();

            expect(dbService.run).toHaveBeenCalledWith('DELETE FROM settings');
        });
    });

    describe('Local-only Keys', () => {
        beforeEach(async () => {
            (dbService.getAll as jest.Mock).mockResolvedValue([]);
            await configService.init();
        });

        it('should not sync runningWorkoutTimerWorkoutId', async () => {
            await configService.set('runningWorkoutTimerWorkoutId', 'w1');
            expect(dbService.queueSyncMutation).not.toHaveBeenCalled();
        });

        it('should not sync runningWorkoutTimerStartTimestamp', async () => {
            await configService.set('runningWorkoutTimerStartTimestamp', Date.now());
            expect(dbService.queueSyncMutation).not.toHaveBeenCalled();
        });

        it('should not sync runningWorkoutTimerBaseSeconds', async () => {
            await configService.set('runningWorkoutTimerBaseSeconds', 300);
            expect(dbService.queueSyncMutation).not.toHaveBeenCalled();
        });

        it('should sync regular settings', async () => {
            await configService.set('weightUnit', 'lbs');
            expect(dbService.queueSyncMutation).toHaveBeenCalled();
        });
    });
});
