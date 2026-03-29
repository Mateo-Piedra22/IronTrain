import notifee, { AuthorizationStatus } from '@notifee/react-native';
import * as SecureStore from 'expo-secure-store';
import { Linking, Platform } from 'react-native';
import { confirm } from '../store/confirmStore';
import { logger } from '../utils/logger';

const NOTIFICATION_PERMISSION_PROMPTED_KEY = 'irontrain_notification_prompted_v1';

class NotificationPermissionsService {
    /**
     * Revisa el estado de permisos para Notificaciones Push (Nivel OS).
     * Solo retorna el estado actual; RootLayout ya maneja la lógica de registro.
     */
    async requestPermission(explainContext = false): Promise<boolean> {
        try {
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

            if (settings.authorizationStatus === AuthorizationStatus.NOT_DETERMINED) {
                const req = await notifee.requestPermission();
                return req.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
                    req.authorizationStatus === AuthorizationStatus.PROVISIONAL;
            }

            return false;
        } catch (e) {
            logger.captureException(e, { scope: 'NotificationPermissionsService.requestPermission' });
            return false;
        }
    }

    async requestPermissionIfNeeded(explainContext = false): Promise<boolean> {
        try {
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
            if (settings.authorizationStatus === AuthorizationStatus.NOT_DETERMINED) {
                return await this.requestPermission(explainContext);
            }
            return false;
        } catch (e) {
            logger.captureException(e, { scope: 'NotificationPermissionsService.requestPermissionIfNeeded' });
            return false;
        }
    }

    async requestPermissionOnce(explainContext = false): Promise<boolean> {
        try {
            const prompted = await SecureStore.getItemAsync(NOTIFICATION_PERMISSION_PROMPTED_KEY);
            if (prompted === 'true') {
                return await this.requestPermissionIfNeeded(false);
            }

            const req = await notifee.requestPermission();
            const granted = req.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
                req.authorizationStatus === AuthorizationStatus.PROVISIONAL;
            await SecureStore.setItemAsync(NOTIFICATION_PERMISSION_PROMPTED_KEY, 'true');
            return granted;
        } catch (e) {
            logger.captureException(e, { scope: 'NotificationPermissionsService.requestPermissionOnce' });
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
            logger.captureException(e, { scope: 'NotificationPermissionsService.checkPermission' });
            return false;
        }
    }

    /**
     * Sets the application badge count (iOS only usually, but some Android launchers support it).
     */
    async setBadgeCount(count: number): Promise<void> {
        try {
            await notifee.setBadgeCount(count);
        } catch (e) {
            logger.captureException(e, { scope: 'NotificationPermissionsService.setBadgeCount' });
        }
    }
}

export const notificationPermissionsService = new NotificationPermissionsService();
