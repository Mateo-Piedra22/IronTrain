import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { AppNotificationService } from './AppNotificationService';

export class PushRegistrationService {
    private static looksLikeApnsToken(token: string): boolean {
        return /^[A-Fa-f0-9]{64,}$/.test(token);
    }

    static async registerForPushNotifications(): Promise<string | null> {
        if (!Device.isDevice) {
            console.log('Must use physical device for Push Notifications');
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
                return null;
            }

            const nativeTokenResponse = await Notifications.getDevicePushTokenAsync();
            const token = String(nativeTokenResponse?.data || '');
            const tokenType = String((nativeTokenResponse as any)?.type || Platform.OS);
            if (!token) return null;

            if (Platform.OS === 'ios' && this.looksLikeApnsToken(token)) {
                console.warn('Native iOS push token detectado (APNs). FCM requiere token de registro Firebase en iOS.');
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
            console.error('Error during push registration:', e);
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
