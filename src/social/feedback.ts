import * as Haptics from 'expo-haptics';

export const feedbackSelection = () => {
    Haptics.selectionAsync().catch(() => undefined);
};

export const feedbackSuccess = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
};

export const feedbackWarning = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
};

export const feedbackError = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
};

export const feedbackSoftImpact = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
};
