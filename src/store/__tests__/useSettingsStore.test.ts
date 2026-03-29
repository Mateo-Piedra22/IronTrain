import { act, renderHook } from '@testing-library/react-native';
import { settingsService } from '../../services/SettingsService';
import { useSettingsStore } from '../useSettingsStore';

jest.mock('../../services/SettingsService', () => ({
    settingsService: {
        getSetting: jest.fn(),
        setSetting: jest.fn(),
    }
}));

describe('useSettingsStore', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        act(() => {
            useSettingsStore.setState({
                unitSystem: 'metric',
                alwaysOn: false,
                trainingDays: [1, 2, 3, 4, 5, 6],
                serverStatus: { mode: 'normal' }
            });
        });
    });

    it('should initialize with default values', () => {
        const { result } = renderHook(() => useSettingsStore());
        expect(result.current.unitSystem).toBe('metric');
        expect(result.current.alwaysOn).toBe(false);
        expect(result.current.trainingDays).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('should load settings from settingsService', async () => {
        (settingsService.getSetting as jest.Mock).mockImplementation(async (key) => {
            if (key === 'unit_system') return 'imperial';
            if (key === 'always_on') return 'true';
            if (key === 'training_days') return JSON.stringify([1, 3, 5]);
            return null;
        });

        const { result } = renderHook(() => useSettingsStore());

        await act(async () => {
            await result.current.loadSettings();
        });

        expect(result.current.unitSystem).toBe('imperial');
        expect(result.current.alwaysOn).toBe(true);
        expect(result.current.trainingDays).toEqual([1, 3, 5]);
    });

    it('should update unit system and persist it', async () => {
        const { result } = renderHook(() => useSettingsStore());

        await act(async () => {
            await result.current.setUnitSystem('imperial');
        });

        expect(result.current.unitSystem).toBe('imperial');
        expect(settingsService.setSetting).toHaveBeenCalledWith('unit_system', 'imperial');
    });

    it('should update alwaysOn and persist it', async () => {
        const { result } = renderHook(() => useSettingsStore());

        await act(async () => {
            await result.current.setAlwaysOn(true);
        });

        expect(result.current.alwaysOn).toBe(true);
        expect(settingsService.setSetting).toHaveBeenCalledWith('always_on', 'true');
    });

    it('should allow setting server status', () => {
        const { result } = renderHook(() => useSettingsStore());

        act(() => {
            result.current.setServerStatus({ mode: 'maintenance', message: 'Down for update' });
        });

        expect(result.current.serverStatus).toEqual({ mode: 'maintenance', message: 'Down for update' });
    });
});
