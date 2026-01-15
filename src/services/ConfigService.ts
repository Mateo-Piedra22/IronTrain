import { dbService } from './DatabaseService';

export interface AppConfig {
    weightUnit: 'kg' | 'lbs';
    defaultRestTimer: number;
    themeMode: 'light' | 'dark' | 'system';
    language: 'en' | 'es';
    showGhostValues: boolean;
    autoFinishWorkout: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
    weightUnit: 'kg',
    defaultRestTimer: 90,
    themeMode: 'system',
    language: 'en',
    showGhostValues: true,
    autoFinishWorkout: false,
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
                    else if (s.key === 'showGhostValues' || s.key === 'autoFinishWorkout') loadedConfig[s.key] = s.value === 'true';
                    else loadedConfig[s.key] = s.value;
                } catch (e) {
                    console.warn(`Failed to parse setting ${s.key}`, e);
                }
            });

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
        
        await dbService.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, dbValue]);
    }

    public async reset(): Promise<void> {
        this.cache = { ...DEFAULT_CONFIG };
        await dbService.run('DELETE FROM settings');
    }
}

export const configService = new ConfigService();
