import notifee, { AndroidImportance } from '@notifee/react-native';
import * as Haptics from 'expo-haptics';
import { AppState } from 'react-native';
import { BannerMessage, ToastType, useNotificationStore } from '../store/notificationStore';

notifee.onBackgroundEvent(async ({ type, detail }) => {
    // For now, no background interactions logic like "Stop timer" handled here.
    // But this wrapper suppresses the "No background handler" warning in Notifee.
    console.log('Notifee background event', type, detail);
});

const showOsNotification = async (title: string, message: string) => {
    try {
        await notifee.createChannel({
            id: 'general',
            name: 'Notificaciones Generales',
            importance: AndroidImportance.DEFAULT,
        });

        await notifee.displayNotification({
            title,
            body: message,
            android: {
                channelId: 'general',
            },
            ios: {
                sound: 'default',
            }
        });
    } catch (e) {
        console.warn('Failed to display OS notification', e);
    }
};

export const notify = {
    toast: (title: string, message?: string, type: ToastType = 'info', duration: number = 3000) => {
        // Haptic feedback strategy based on type
        if (type === 'success') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
        } else if (type === 'error') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
        } else if (type === 'warning') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => { });
        } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
        }

        if (AppState.currentState !== 'active') {
            showOsNotification(title, message || '');
            return 'os_notify';
        }

        return useNotificationStore.getState().addToast({ title, message, type, duration });
    },
    success: (title: string, message?: string, duration?: number) => notify.toast(title, message, 'success', duration),
    error: (title: string, message?: string, duration?: number) => notify.toast(title, message, 'error', duration ?? 5000), // Errors stay longer
    info: (title: string, message?: string, duration?: number) => notify.toast(title, message, 'info', duration),
    warning: (title: string, message?: string, duration?: number) => notify.toast(title, message, 'warning', duration ?? 4000),

    banner: (message: string, type: BannerMessage['type'] = 'info', actionLabel?: string, onAction?: () => void, dismissible = true) => {
        if (AppState.currentState !== 'active') {
            showOsNotification('IronTrain', message);
            return;
        }
        useNotificationStore.getState().setGlobalBanner({ message, type, actionLabel, onAction, dismissible });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    },
    clearBanner: () => useNotificationStore.getState().clearGlobalBanner(),
};
