import { dbService } from './DatabaseService';

export interface AppConfig {
    weightUnit: 'kg' | 'lbs';
    defaultRestTimer: number;
    autoStartRestTimerOnSetComplete: boolean;
    themeMode: 'light' | 'dark' | 'system';
    language: 'en' | 'es';
    showGhostValues: boolean;
    autoFinishWorkout: boolean;

    analyticsDefaultRangeDays: 7 | 30 | 90 | 365;

    plateCalculatorDefaultBarWeightKg: number;
    plateCalculatorDefaultBarWeightLbs: number;
    plateCalculatorPreferFewerPlates: boolean;

    calculatorsDefault1RMFormula: 'epley' | 'brzycki' | 'lombardi';
    calculatorsRoundingKg: number;
    calculatorsRoundingLbs: number;

    exerciseCardioMetricById: Record<string, 'distance' | 'time' | 'pace' | 'speed'>;
    exerciseCardioPrimaryPRById: Record<string, 'distance' | 'time' | 'pace' | 'speed'>;
}

const DEFAULT_CONFIG: AppConfig = {
    weightUnit: 'kg',
    defaultRestTimer: 90,
    autoStartRestTimerOnSetComplete: true,
    themeMode: 'system',
    language: 'es',
    showGhostValues: true,
    autoFinishWorkout: false,

    analyticsDefaultRangeDays: 30,

    plateCalculatorDefaultBarWeightKg: 20,
    plateCalculatorDefaultBarWeightLbs: 45,
    plateCalculatorPreferFewerPlates: true,

    calculatorsDefault1RMFormula: 'epley',
    calculatorsRoundingKg: 2.5,
    calculatorsRoundingLbs: 5,

    exerciseCardioMetricById: {},
    exerciseCardioPrimaryPRById: {},
};

class ConfigService {
    private cache: AppConfig | null = null;

    public async init(): Promise<void> {
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
                        s.key === 'plateCalculatorPreferFewerPlates'
                    ) loadedConfig[s.key] = s.value === 'true';
                    else if (
                        s.key === 'analyticsDefaultRangeDays' ||
                        s.key === 'plateCalculatorDefaultBarWeightKg' ||
                        s.key === 'plateCalculatorDefaultBarWeightLbs' ||
                        s.key === 'calculatorsRoundingKg' ||
                        s.key === 'calculatorsRoundingLbs'
                    ) loadedConfig[s.key] = parseFloat(s.value);
                    else if (s.key === 'exerciseCardioMetricById') loadedConfig[s.key] = JSON.parse(s.value);
                    else if (s.key === 'exerciseCardioPrimaryPRById') loadedConfig[s.key] = JSON.parse(s.value);
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
        
        await dbService.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, dbValue]);
    }

    public async reset(): Promise<void> {
        this.cache = { ...DEFAULT_CONFIG };
        await dbService.run('DELETE FROM settings');
    }
}

export const configService = new ConfigService();
