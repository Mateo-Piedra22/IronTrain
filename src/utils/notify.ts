import { AppState, Platform } from 'react-native';
import { configService } from '../services/ConfigService';
import { BannerMessage, ToastType, useNotificationStore } from '../store/notificationStore';
import { logger } from './logger';
import { triggerSensoryFeedback } from './sensoryFeedback';

type NotifeeModule = typeof import('@notifee/react-native');

const notifeeModule: NotifeeModule | null = (() => {
    try {
        return require('@notifee/react-native') as NotifeeModule;
    } catch {
        return null;
    }
})();

const notifee = (notifeeModule?.default ?? {
    onBackgroundEvent: () => undefined,
    registerForegroundService: () => undefined,
    createChannel: async () => undefined,
    displayNotification: async () => undefined,
}) as any;

const AndroidImportance = notifeeModule?.AndroidImportance ?? { DEFAULT: 3 };

notifee.onBackgroundEvent(async ({ type, detail }: { type: string; detail: unknown }) => {
    // For now, no background interactions logic like "Stop timer" handled here.
    // But this wrapper suppresses the "No background handler" warning in Notifee.
    logger.debug('Notifee background event', { type, detail });
});

if (Platform.OS === 'android' && notifeeModule?.default?.registerForegroundService) {
    try {
        notifee.registerForegroundService((_notification: unknown) => {
            const enabled = !!configService.get('androidForegroundServiceNotificationsEnabled');
            if (!enabled) {
                return Promise.resolve();
            }
            return new Promise(() => undefined);
        });
    } catch (e) {
        logger.captureException(e, { scope: 'notify.registerForegroundService', message: 'Failed to register Notifee foreground service' });
        configService.set('androidForegroundServiceNotificationsEnabled', false).catch(() => undefined);
    }
}

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
        logger.captureException(e, { scope: 'notify.showOsNotification', message: 'Failed to display OS notification' });
    }
};

export const notify = {
    toast: (title: string, message?: string, type: ToastType = 'info', duration: number = 3000, onPress?: () => void) => {
        // Haptic feedback strategy based on type
        if (type === 'success') {
            void triggerSensoryFeedback('success');
        } else if (type === 'error') {
            void triggerSensoryFeedback('error');
        } else if (type === 'warning') {
            void triggerSensoryFeedback('warning');
        } else {
            void triggerSensoryFeedback('tapLight');
        }

        if (AppState.currentState !== 'active') {
            showOsNotification(title, message || '');
            return 'os_notify';
        }

        return useNotificationStore.getState().addToast({ title, message, type, duration, onPress });
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
        void triggerSensoryFeedback('tapMedium');
    },
    clearBanner: () => useNotificationStore.getState().clearGlobalBanner(),
};
