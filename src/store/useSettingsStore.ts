import { create } from 'zustand';
import { dataEventService } from '../services/DataEventService';
import { settingsService } from '../services/SettingsService';

interface SettingsState {
    unitSystem: 'metric' | 'imperial';
    alwaysOn: boolean;
    trainingDays: number[];
    loadSettings: () => Promise<void>;
    setUnitSystem: (val: 'metric' | 'imperial') => Promise<void>;
    setAlwaysOn: (val: boolean) => Promise<void>;
    setTrainingDays: (days: number[]) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
    unitSystem: 'metric',
    alwaysOn: false,
    trainingDays: [1, 2, 3, 4, 5, 6], // default to Mon-Sat 
    loadSettings: async () => {
        const unitSystem = await settingsService.getSetting('unit_system');
        const alwaysOn = await settingsService.getSetting('always_on');
        const trainingDaysRaw = await settingsService.getSetting('training_days');

        set({
            unitSystem: (unitSystem as 'metric' | 'imperial') || 'metric',
            alwaysOn: alwaysOn === 'true',
            trainingDays: trainingDaysRaw ? JSON.parse(trainingDaysRaw) : [1, 2, 3, 4, 5, 6]
        });
    },
    setUnitSystem: async (val) => {
        await settingsService.setSetting('unit_system', val);
        set({ unitSystem: val });
    },
    setAlwaysOn: async (val) => {
        await settingsService.setSetting('always_on', val ? 'true' : 'false');
        set({ alwaysOn: val });
    },
    setTrainingDays: async (days) => {
        await settingsService.setSetting('training_days', JSON.stringify(days));
        set({ trainingDays: days });
    }
}));

// Listen for global settings updates (e.g. from SyncService or ConfigService)
dataEventService.subscribe('SETTINGS_UPDATED', () => {
    useSettingsStore.getState().loadSettings();
});
