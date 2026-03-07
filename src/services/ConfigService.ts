import { dataEventService } from './DataEventService';
import { dbService } from './DatabaseService';

export interface NotificationPreferences {
    inApp: {
        enabled: boolean;
        restTimer: boolean;
        workoutStatus: boolean;
        updates: boolean;
        intervalTimer: boolean;
    };
    system: {
        enabled: boolean;
        restTimer: boolean;
        workoutPersistent: boolean;
        inactivityReminder: boolean;
        workoutComplete: boolean;
        intervalTimer: boolean;
        updateAvailable: boolean;
        appUpdated: boolean;
        streakReminder: boolean;
    };
    sounds: {
        restTimer: boolean;
        intervalTimer: boolean;
        workoutComplete: boolean;
        countdown: boolean;
    };
}

export interface AppConfig {
    weightUnit: 'kg' | 'lbs';
    defaultRestTimer: number;
    autoStartRestTimerOnSetComplete: boolean;
    themeMode: 'light' | 'dark' | 'system';
    language: 'en' | 'es';
    showGhostValues: boolean;
    autoFinishWorkout: boolean;

    hapticFeedbackEnabled: boolean;
    soundFeedbackEnabled: boolean;
    systemNotificationsEnabled: boolean;
    notificationPreferences: NotificationPreferences;

    analyticsDefaultRangeDays: 7 | 30 | 90 | 365;

    plateCalculatorDefaultBarWeightKg: number;
    plateCalculatorDefaultBarWeightLbs: number;
    plateCalculatorPreferFewerPlates: boolean;

    calculatorsDefault1RMFormula: 'epley' | 'brzycki' | 'lombardi';
    calculatorsRoundingKg: number;
    calculatorsRoundingLbs: number;

    exerciseCardioMetricById: Record<string, 'distance' | 'time' | 'pace' | 'speed'>;
    exerciseCardioPrimaryPRById: Record<string, 'distance' | 'time' | 'pace' | 'speed'>;
    lastViewedChangelogVersion: string;
    training_days: number[];
}

const DEFAULT_CONFIG: AppConfig = {
    weightUnit: 'kg',
    defaultRestTimer: 90,
    autoStartRestTimerOnSetComplete: true,
    themeMode: 'system',
    language: 'es',
    showGhostValues: true,
    autoFinishWorkout: false,

    hapticFeedbackEnabled: true,
    soundFeedbackEnabled: true,
    systemNotificationsEnabled: true,
    notificationPreferences: {
        inApp: { enabled: true, restTimer: true, workoutStatus: true, updates: true, intervalTimer: true },
        system: { enabled: true, restTimer: true, workoutPersistent: true, inactivityReminder: true, workoutComplete: true, intervalTimer: true, updateAvailable: true, appUpdated: true, streakReminder: true },
        sounds: { restTimer: true, intervalTimer: true, workoutComplete: true, countdown: true },
    },

    analyticsDefaultRangeDays: 30,

    plateCalculatorDefaultBarWeightKg: 20,
    plateCalculatorDefaultBarWeightLbs: 45,
    plateCalculatorPreferFewerPlates: true,

    calculatorsDefault1RMFormula: 'epley',
    calculatorsRoundingKg: 2.5,
    calculatorsRoundingLbs: 5,

    exerciseCardioMetricById: {},
    exerciseCardioPrimaryPRById: {},
    lastViewedChangelogVersion: '0.0.0',
    training_days: [1, 2, 3, 4, 5, 6], // default Mon-Sat
};

class ConfigService {
    private cache: AppConfig | null = null;

    public async init(): Promise<void> {
        await this.loadConfig();
    }

    public async reload(): Promise<void> {
        this.cache = null;
        await this.loadConfig();
    }

    public async loadConfig(): Promise<AppConfig> {
        if (this.cache) return this.cache;

        try {
            const settings = await dbService.getAll<{ key: string, value: string }>('SELECT key, value FROM settings');

            const loadedConfig: any = { ...DEFAULT_CONFIG };

            settings.forEach(s => {
                try {
                    // Try parsing JSON if value is complex, otherwise use raw string or number conversion
                    if (s.key === 'defaultRestTimer') loadedConfig[s.key] = parseInt(s.value);
                    else if (
                        s.key === 'showGhostValues' ||
                        s.key === 'autoFinishWorkout' ||
                        s.key === 'autoStartRestTimerOnSetComplete' ||
                        s.key === 'plateCalculatorPreferFewerPlates' ||
                        s.key === 'hapticFeedbackEnabled' ||
                        s.key === 'soundFeedbackEnabled' ||
                        s.key === 'systemNotificationsEnabled'
                    ) loadedConfig[s.key] = s.value === 'true';
                    else if (
                        s.key === 'analyticsDefaultRangeDays' ||
                        s.key === 'plateCalculatorDefaultBarWeightKg' ||
                        s.key === 'plateCalculatorDefaultBarWeightLbs' ||
                        s.key === 'calculatorsRoundingKg' ||
                        s.key === 'calculatorsRoundingLbs'
                    ) loadedConfig[s.key] = parseFloat(s.value);
                    else if (
                        s.key === 'exerciseCardioMetricById' ||
                        s.key === 'exerciseCardioPrimaryPRById' ||
                        s.key === 'training_days'
                    ) {
                        try {
                            loadedConfig[s.key] = JSON.parse(s.value);
                        } catch {
                            // If it's not valid JSON, it might be a raw value or null
                        }
                    }
                    else if (s.key === 'notificationPreferences') {
                        try {
                            const parsed = JSON.parse(s.value);
                            loadedConfig[s.key] = {
                                inApp: { ...DEFAULT_CONFIG.notificationPreferences.inApp, ...(parsed?.inApp ?? {}) },
                                system: { ...DEFAULT_CONFIG.notificationPreferences.system, ...(parsed?.system ?? {}) },
                                sounds: { ...DEFAULT_CONFIG.notificationPreferences.sounds, ...(parsed?.sounds ?? {}) },
                            };
                        } catch { /* fallback to default */ }
                    }
                    else loadedConfig[s.key] = s.value;
                } catch (e) {
                    console.warn(`Failed to parse setting ${s.key}`, e);
                }
            });

            const allowedRanges = new Set([7, 30, 90, 365]);
            if (!allowedRanges.has(loadedConfig.analyticsDefaultRangeDays)) {
                loadedConfig.analyticsDefaultRangeDays = DEFAULT_CONFIG.analyticsDefaultRangeDays;
            }

            const sanitizeNumber = (v: any, fallback: number) => {
                const n = typeof v === 'number' ? v : parseFloat(String(v));
                if (!Number.isFinite(n)) return fallback;
                return n;
            };

            loadedConfig.defaultRestTimer = Math.max(0, Math.round(sanitizeNumber(loadedConfig.defaultRestTimer, DEFAULT_CONFIG.defaultRestTimer)));
            loadedConfig.plateCalculatorDefaultBarWeightKg = Math.max(0, sanitizeNumber(loadedConfig.plateCalculatorDefaultBarWeightKg, DEFAULT_CONFIG.plateCalculatorDefaultBarWeightKg));
            loadedConfig.plateCalculatorDefaultBarWeightLbs = Math.max(0, sanitizeNumber(loadedConfig.plateCalculatorDefaultBarWeightLbs, DEFAULT_CONFIG.plateCalculatorDefaultBarWeightLbs));
            loadedConfig.calculatorsRoundingKg = Math.max(0.25, sanitizeNumber(loadedConfig.calculatorsRoundingKg, DEFAULT_CONFIG.calculatorsRoundingKg));
            loadedConfig.calculatorsRoundingLbs = Math.max(0.5, sanitizeNumber(loadedConfig.calculatorsRoundingLbs, DEFAULT_CONFIG.calculatorsRoundingLbs));

            const allowedCardioMetrics = new Set(['distance', 'time', 'pace', 'speed']);
            const rawMap = loadedConfig.exerciseCardioMetricById;
            const cleaned: Record<string, 'distance' | 'time' | 'pace' | 'speed'> = {};
            if (rawMap && typeof rawMap === 'object') {
                const entries = Object.entries(rawMap).slice(0, 500);
                for (const [k, v] of entries) {
                    if (typeof k !== 'string') continue;
                    if (typeof v !== 'string') continue;
                    if (!allowedCardioMetrics.has(v)) continue;
                    cleaned[k] = v as any;
                }
            }
            loadedConfig.exerciseCardioMetricById = cleaned;

            const rawPRMap = loadedConfig.exerciseCardioPrimaryPRById;
            const cleanedPR: Record<string, 'distance' | 'time' | 'pace' | 'speed'> = {};
            if (rawPRMap && typeof rawPRMap === 'object') {
                const entries = Object.entries(rawPRMap).slice(0, 500);
                for (const [k, v] of entries) {
                    if (typeof k !== 'string') continue;
                    if (typeof v !== 'string') continue;
                    if (!allowedCardioMetrics.has(v)) continue;
                    cleanedPR[k] = v as any;
                }
            }
            loadedConfig.exerciseCardioPrimaryPRById = cleanedPR;

            // Ensure training_days is always an array
            if (!Array.isArray(loadedConfig.training_days)) {
                loadedConfig.training_days = [...DEFAULT_CONFIG.training_days];
            }

            this.cache = loadedConfig;
            return loadedConfig;
        } catch (e) {
            console.error('Failed to load settings', e);
            return DEFAULT_CONFIG;
        }
    }

    public get<K extends keyof AppConfig>(key: K): AppConfig[K] {
        if (!this.cache) return DEFAULT_CONFIG[key];
        return this.cache[key];
    }

    public async set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): Promise<void> {
        if (!this.cache) this.cache = { ...DEFAULT_CONFIG };
        this.cache[key] = value;

        // Persist
        let dbValue = String(value);
        if (typeof value === 'boolean') dbValue = value ? 'true' : 'false';
        else if (typeof value === 'object') dbValue = JSON.stringify(value);

        const now = Date.now();
        await dbService.run(
            'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
            [key, dbValue, now]
        );

        // Queue for sync so it reaches the cloud
        await dbService.queueSyncMutation('settings', key, 'INSERT', { key, value: dbValue, updated_at: now });

        // Emit event for real-time UI updates
        try {
            dataEventService.emit('SETTINGS_UPDATED', { key, value });
        } catch (e) {
            // Emitter might not be ready or failed
        }
    }

    public async reset(): Promise<void> {
        this.cache = { ...DEFAULT_CONFIG };
        await dbService.run('DELETE FROM settings');
    }
}

export const configService = new ConfigService();
