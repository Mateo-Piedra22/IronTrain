import notifee, { AuthorizationStatus } from '@notifee/react-native';
import { Linking, Platform } from 'react-native';
import { confirm } from '../store/confirmStore';

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
                    confirm.ask(
                        'Permiso Necesario',
                        'Para alertarte cuando termine tu descanso, necesitas habilitar las notificaciones en la configuración de tu dispositivo.',
                        () => {
                            if (Platform.OS === 'ios') {
                                Linking.openURL('app-settings:');
                            } else {
                                Linking.openSettings();
                            }
                        },
                        'Ir a Configuración'
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
