import { create } from 'zustand';
import { DatabaseService } from '../services/db';

interface SettingsState {
    unitSystem: 'metric' | 'imperial';
    alwaysOn: boolean;
    loadSettings: () => Promise<void>;
    setUnitSystem: (val: 'metric' | 'imperial') => Promise<void>;
    setAlwaysOn: (val: boolean) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
    unitSystem: 'metric',
    alwaysOn: false,
    loadSettings: async () => {
        const db = DatabaseService.getDb();
        const s = await db.getFirstAsync<{ unit_system: string, always_on: number }>('SELECT * FROM settings WHERE id = 1');
        if (s) {
            set({
                unitSystem: s.unit_system as 'metric' | 'imperial',
                alwaysOn: !!s.always_on
            });
        }
    },
    setUnitSystem: async (val) => {
        const db = DatabaseService.getDb();
        await db.runAsync('UPDATE settings SET unit_system = ? WHERE id = 1', [val]);
        set({ unitSystem: val });
    },
    setAlwaysOn: async (val) => {
        const db = DatabaseService.getDb();
        await db.runAsync('UPDATE settings SET always_on = ? WHERE id = 1', [val ? 1 : 0]);
        set({ alwaysOn: val });
    }
}));
