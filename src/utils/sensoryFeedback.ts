import * as Haptics from 'expo-haptics';
import { Platform, Vibration } from 'react-native';
import { configService } from '../services/ConfigService';

export type SensoryFeedbackType =
    | 'selection'
    | 'tapLight'
    | 'tapMedium'
    | 'success'
    | 'warning'
    | 'error';

const FALLBACK_VIBRATION_MS: Record<SensoryFeedbackType, number> = {
    selection: 8,
    tapLight: 12,
    tapMedium: 20,
    success: 24,
    warning: 28,
    error: 34,
};

const canUseHaptics = (): boolean => {
    return configService.get('hapticFeedbackEnabled');
};

export const triggerSensoryFeedback = async (type: SensoryFeedbackType): Promise<void> => {
    if (!canUseHaptics()) return;

    try {
        switch (type) {
            case 'selection':
                await Haptics.selectionAsync();
                return;
            case 'tapLight':
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                return;
            case 'tapMedium':
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                return;
            case 'success':
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                return;
            case 'warning':
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                return;
            case 'error':
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                return;
        }
    } catch {
        if (Platform.OS === 'android') {
            Vibration.vibrate(FALLBACK_VIBRATION_MS[type]);
        }
    }
};
