import notifee, { AuthorizationStatus } from '@notifee/react-native';
import { Linking, Platform } from 'react-native';
import { confirm } from '../store/confirmStore';

class NotificationPermissionsService {
    /**
     * Revisa el estado de permisos para Notificaciones Push (Nivel OS).
     * Solo retorna el estado actual; RootLayout ya maneja la lógica de registro.
     */
    async requestPermission(explainContext = false): Promise<boolean> {
        try {
            // Check status without prompting (RootLayout handles push registration)
            const settings = await notifee.getNotificationSettings();

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
