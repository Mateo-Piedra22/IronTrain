import notifee, { AuthorizationStatus } from '@notifee/react-native';
import * as SecureStore from 'expo-secure-store';
import { Linking } from 'react-native';
import { confirm } from '../../store/confirmStore';
import { logger } from '../../utils/logger';
import { notificationPermissionsService } from '../NotificationPermissionsService';

jest.mock('@notifee/react-native', () => ({
    __esModule: true,
    default: {
        getNotificationSettings: jest.fn(),
        requestPermission: jest.fn(),
    },
    AuthorizationStatus: {
        AUTHORIZED: 1,
        PROVISIONAL: 2,
        DENIED: 3,
        NOT_DETERMINED: 4,
    },
}));

jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
}));

jest.mock('react-native', () => ({
    Linking: {
        openURL: jest.fn(),
        openSettings: jest.fn(),
    },
    Platform: {
        OS: 'ios',
    },
}));

jest.mock('../../store/confirmStore', () => ({
    confirm: {
        ask: jest.fn(),
    },
}));

jest.mock('../../utils/logger', () => ({
    logger: {
        captureException: jest.fn(),
    },
}));

describe('NotificationPermissionsService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('requestPermission', () => {
        it('should return true when already authorized', async () => {
            (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
                authorizationStatus: AuthorizationStatus.AUTHORIZED,
            });

            const result = await notificationPermissionsService.requestPermission();

            expect(result).toBe(true);
            expect(notifee.requestPermission).not.toHaveBeenCalled();
        });

        it('should return true when provisionally authorized', async () => {
            (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
                authorizationStatus: AuthorizationStatus.PROVISIONAL,
            });

            const result = await notificationPermissionsService.requestPermission();

            expect(result).toBe(true);
            expect(notifee.requestPermission).not.toHaveBeenCalled();
        });

        it('should show confirmation dialog when denied and explainContext is true', async () => {
            (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
                authorizationStatus: AuthorizationStatus.DENIED,
            });

            const result = await notificationPermissionsService.requestPermission(true);

            expect(result).toBe(false);
            expect(confirm.ask).toHaveBeenCalledWith(
                'Permiso Necesario',
                expect.any(String),
                expect.any(Function),
                'Ir a Configuración'
            );
        });

        it('should not show confirmation dialog when denied and explainContext is false', async () => {
            (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
                authorizationStatus: AuthorizationStatus.DENIED,
            });

            const result = await notificationPermissionsService.requestPermission(false);

            expect(result).toBe(false);
            expect(confirm.ask).not.toHaveBeenCalled();
        });

        it('should request permission when not determined', async () => {
            (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
                authorizationStatus: AuthorizationStatus.NOT_DETERMINED,
            });
            (notifee.requestPermission as jest.Mock).mockResolvedValue({
                authorizationStatus: AuthorizationStatus.AUTHORIZED,
            });

            const result = await notificationPermissionsService.requestPermission();

            expect(notifee.requestPermission).toHaveBeenCalled();
            expect(result).toBe(true);
        });

        it('should return false when request is denied', async () => {
            (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
                authorizationStatus: AuthorizationStatus.NOT_DETERMINED,
            });
            (notifee.requestPermission as jest.Mock).mockResolvedValue({
                authorizationStatus: AuthorizationStatus.DENIED,
            });

            const result = await notificationPermissionsService.requestPermission();

            expect(result).toBe(false);
        });

        it('should return false when request returns not determined', async () => {
            (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
                authorizationStatus: AuthorizationStatus.NOT_DETERMINED,
            });
            (notifee.requestPermission as jest.Mock).mockResolvedValue({
                authorizationStatus: AuthorizationStatus.NOT_DETERMINED,
            });

            const result = await notificationPermissionsService.requestPermission();

            expect(result).toBe(false);
        });

        it('should handle errors gracefully', async () => {
            (notifee.getNotificationSettings as jest.Mock).mockRejectedValue(new Error('Settings error'));

            const result = await notificationPermissionsService.requestPermission();

            expect(result).toBe(false);
            expect(logger.captureException).toHaveBeenCalled();
        });

        it('should open app settings on iOS when denied', async () => {
            (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
                authorizationStatus: AuthorizationStatus.DENIED,
            });

            await notificationPermissionsService.requestPermission(true);

            const callback = (confirm.ask as jest.Mock).mock.calls[0][2];
            callback();

            expect(Linking.openURL).toHaveBeenCalledWith('app-settings:');
        });

        it('should open system settings on Android when denied', async () => {
            require('react-native').Platform.OS = 'android';

            (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
                authorizationStatus: AuthorizationStatus.DENIED,
            });

            await notificationPermissionsService.requestPermission(true);

            const callback = (confirm.ask as jest.Mock).mock.calls[0][2];
            callback();

            expect(Linking.openSettings).toHaveBeenCalled();
        });
    });

    describe('requestPermissionIfNeeded', () => {
        it('should return true when already authorized', async () => {
            (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
                authorizationStatus: AuthorizationStatus.AUTHORIZED,
            });

            const result = await notificationPermissionsService.requestPermissionIfNeeded();

            expect(result).toBe(true);
            expect(notifee.requestPermission).not.toHaveBeenCalled();
        });

        it('should return true when provisionally authorized', async () => {
            (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
                authorizationStatus: AuthorizationStatus.PROVISIONAL,
            });

            const result = await notificationPermissionsService.requestPermissionIfNeeded();

            expect(result).toBe(true);
        });

        it('should show confirmation dialog when denied', async () => {
            (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
                authorizationStatus: AuthorizationStatus.DENIED,
            });

            const result = await notificationPermissionsService.requestPermissionIfNeeded(true);

            expect(result).toBe(false);
            expect(confirm.ask).toHaveBeenCalled();
        });

        it('should request permission when not determined', async () => {
            (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
                authorizationStatus: AuthorizationStatus.NOT_DETERMINED,
            });
            (notifee.requestPermission as jest.Mock).mockResolvedValue({
                authorizationStatus: AuthorizationStatus.AUTHORIZED,
            });

            const result = await notificationPermissionsService.requestPermissionIfNeeded();

            expect(result).toBe(true);
            expect(notifee.requestPermission).toHaveBeenCalled();
        });

        it('should handle errors gracefully', async () => {
            (notifee.getNotificationSettings as jest.Mock).mockRejectedValue(new Error('Settings error'));

            const result = await notificationPermissionsService.requestPermissionIfNeeded();

            expect(result).toBe(false);
            expect(logger.captureException).toHaveBeenCalled();
        });
    });

    describe('requestPermissionOnce', () => {
        it('should return true if already authorized', async () => {
            (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
                authorizationStatus: AuthorizationStatus.AUTHORIZED,
            });
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('true');

            const result = await notificationPermissionsService.requestPermissionOnce();

            expect(result).toBe(true);
            // Should check settings first before requesting
            expect(notifee.getNotificationSettings).toHaveBeenCalled();
        });

        it('should request permission if not prompted before', async () => {
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
            (notifee.requestPermission as jest.Mock).mockResolvedValue({
                authorizationStatus: AuthorizationStatus.AUTHORIZED,
            });

            const result = await notificationPermissionsService.requestPermissionOnce();

            expect(result).toBe(true);
            expect(notifee.requestPermission).toHaveBeenCalledTimes(1);
            expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
                'irontrain_notification_prompted_v1',
                'true'
            );
        });

        it('should not prompt again if already prompted', async () => {
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('true');
            (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
                authorizationStatus: AuthorizationStatus.AUTHORIZED,
            });

            await notificationPermissionsService.requestPermissionOnce(false);

            // Should check settings but not request since already authorized
            expect(notifee.getNotificationSettings).toHaveBeenCalled();
        });

        it('should prompt with explainContext on first time', async () => {
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
            (notifee.requestPermission as jest.Mock).mockResolvedValue({
                authorizationStatus: AuthorizationStatus.NOT_DETERMINED,
            });

            await notificationPermissionsService.requestPermissionOnce(true);

            expect(notifee.requestPermission).toHaveBeenCalled();
        });

        it('should handle SecureStore errors gracefully', async () => {
            (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('SecureStore error'));

            const result = await notificationPermissionsService.requestPermissionOnce();

            expect(result).toBe(false);
            expect(logger.captureException).toHaveBeenCalled();
        });
    });

    describe('checkPermission', () => {
        it('should return true when authorized', async () => {
            (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
                authorizationStatus: AuthorizationStatus.AUTHORIZED,
            });

            const result = await notificationPermissionsService.checkPermission();

            expect(result).toBe(true);
        });

        it('should return true when provisionally authorized', async () => {
            (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
                authorizationStatus: AuthorizationStatus.PROVISIONAL,
            });

            const result = await notificationPermissionsService.checkPermission();

            expect(result).toBe(true);
        });

        it('should return false when denied', async () => {
            (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
                authorizationStatus: AuthorizationStatus.DENIED,
            });

            const result = await notificationPermissionsService.checkPermission();

            expect(result).toBe(false);
        });

        it('should return false when not determined', async () => {
            (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
                authorizationStatus: AuthorizationStatus.NOT_DETERMINED,
            });

            const result = await notificationPermissionsService.checkPermission();

            expect(result).toBe(false);
        });

        it('should handle errors gracefully', async () => {
            (notifee.getNotificationSettings as jest.Mock).mockRejectedValue(new Error('Settings error'));

            const result = await notificationPermissionsService.checkPermission();

            expect(result).toBe(false);
            expect(logger.captureException).toHaveBeenCalled();
        });

        it('should not request permission, only check', async () => {
            (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
                authorizationStatus: AuthorizationStatus.NOT_DETERMINED,
            });

            await notificationPermissionsService.checkPermission();

            expect(notifee.requestPermission).not.toHaveBeenCalled();
        });
    });

    describe('Platform-specific behavior', () => {
        it('should handle iOS settings URL correctly', async () => {
            require('react-native').Platform.OS = 'ios';

            (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
                authorizationStatus: AuthorizationStatus.DENIED,
            });

            await notificationPermissionsService.requestPermission(true);

            const callback = (confirm.ask as jest.Mock).mock.calls[0][2];
            callback();

            expect(Linking.openURL).toHaveBeenCalledWith('app-settings:');
            expect(Linking.openSettings).not.toHaveBeenCalled();
        });

        it('should handle Android settings correctly', async () => {
            require('react-native').Platform.OS = 'android';

            (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({
                authorizationStatus: AuthorizationStatus.DENIED,
            });

            await notificationPermissionsService.requestPermission(true);

            const callback = (confirm.ask as jest.Mock).mock.calls[0][2];
            callback();

            expect(Linking.openSettings).toHaveBeenCalled();
            expect(Linking.openURL).not.toHaveBeenCalledWith('app-settings:');
        });
    });
});
