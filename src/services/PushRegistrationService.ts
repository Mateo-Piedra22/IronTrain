import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { logger } from '../utils/logger';
import { AppNotificationService } from './AppNotificationService';

export class PushRegistrationService {
    private static looksLikeApnsToken(token: string): boolean {
        return /^[A-Fa-f0-9]{64,}$/.test(token);
    }

    static async registerForPushNotifications(): Promise<string | null> {
        if (Constants.appOwnership === 'expo') {
            logger.info('Push remoto deshabilitado en Expo Go (SDK 53+). Usar development build para push notifications.');
            return null;
        }

        if (!Device.isDevice) {
            logger.info('Must use physical device for Push Notifications');
            return null;
        }

        try {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                logger.warn('Failed to get push token for push notification!');
                await AppNotificationService.unregisterPushToken();
                return null;
            }

            // use getExpoPushTokenAsync as it handles provider initialization better in managed/prebuild
            const tokenResponse = await Notifications.getExpoPushTokenAsync({
                projectId: '76d89df6-9ab1-4903-af08-64d0bc630646'
            });
            const token = tokenResponse.data;
            const tokenType = 'expo';
            if (!token) return null;

            if (Platform.OS === 'ios' && this.looksLikeApnsToken(token)) {
                logger.warn('Native iOS push token detectado (APNs). FCM requiere token de registro Firebase en iOS.');
            }

            await AppNotificationService.registerPushToken(token, {
                platform: Platform.OS,
                tokenType,
            });

            if (Platform.OS === 'android') {
                Notifications.setNotificationChannelAsync('default', {
                    name: 'default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF231F7C',
                });
            }

            return token;
        } catch (e) {
            logger.captureException(e, { scope: 'PushRegistrationService.registerForPushNotifications' });
            return null;
        }
    }

    static initListeners(
        onNotification?: (notification: Notifications.Notification) => void,
        onResponse?: (response: Notifications.NotificationResponse) => void
    ) {
        // Foreground listener
        const subscription = Notifications.addNotificationReceivedListener(notification => {
            if (onNotification) onNotification(notification);
        });

        // Response listener (user clicked on notification)
        const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
            if (onResponse) onResponse(response);
        });

        return () => {
            subscription.remove();
            responseSubscription.remove();
        };
    }
}
