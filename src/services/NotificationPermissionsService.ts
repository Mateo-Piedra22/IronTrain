import notifee, { AuthorizationStatus } from '@notifee/react-native';
import { Alert, Linking, Platform } from 'react-native';

class NotificationPermissionsService {
    /**
     * Revisa y solicita progresivamente permisos para Notificaciones Push (Nivel OS).
     * Devuelve `true` si ya tiene permiso o si el usuario acepta.
     * Si fue denegado previamente, abre un prompt informando que debe ir a ajustes.
     */
    async requestPermission(explainContext = false): Promise<boolean> {
        try {
            const settings = await notifee.requestPermission({
                sound: true,
                announcement: true,
                badge: true,
                alert: true,
            });

            if (settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
                settings.authorizationStatus === AuthorizationStatus.PROVISIONAL) {
                return true;
            }

            if (settings.authorizationStatus === AuthorizationStatus.DENIED) {
                if (explainContext) {
                    Alert.alert(
                        'Permiso Necesario',
                        'Para alertarte cuando termine tu descanso, necesitas habilitar las notificaciones en la configuración de tu dispositivo.',
                        [
                            { text: 'Ahora no', style: 'cancel' },
                            {
                                text: 'Ir a Configuración',
                                onPress: () => {
                                    if (Platform.OS === 'ios') {
                                        Linking.openURL('app-settings:');
                                    } else {
                                        Linking.openSettings();
                                    }
                                }
                            }
                        ]
                    );
                }
                return false;
            }

            return false;
        } catch (e) {
            console.error('Error requesting notification permissions:', e);
            return false;
        }
    }

    /**
     * Check current authorization status without requesting it.
     */
    async checkPermission(): Promise<boolean> {
        try {
            const settings = await notifee.getNotificationSettings();
            return settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
                settings.authorizationStatus === AuthorizationStatus.PROVISIONAL;
        } catch (e) {
            return false;
        }
    }
}

export const notificationPermissionsService = new NotificationPermissionsService();
