import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { logger } from '../../utils/logger';
import { AppNotificationService } from '../AppNotificationService';
import { PushRegistrationService } from '../PushRegistrationService';

jest.mock('expo-device', () => ({
    isDevice: true,
}));

jest.mock('expo-constants', () => ({
    __esModule: true,
    default: {
        appOwnership: 'standalone',
        expoConfig: {
            extra: {
                eas: {
                    projectId: 'test-project-id',
                },
            },
        },
    },
}));

jest.mock('expo-notifications', () => ({
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    getExpoPushTokenAsync: jest.fn(),
    setNotificationChannelAsync: jest.fn(),
    addNotificationReceivedListener: jest.fn(),
    addNotificationResponseReceivedListener: jest.fn(),
    AndroidImportance: {
        MAX: 4,
    },
}));

jest.mock('react-native', () => ({
    Platform: {
        OS: 'ios',
    },
    Appearance: {
        getColorScheme: jest.fn(() => 'light'),
        addChangeListener: jest.fn(() => ({ remove: jest.fn() })),
        removeChangeListener: jest.fn(),
    },
}));

jest.mock('../AppNotificationService', () => ({
    AppNotificationService: {
        registerPushToken: jest.fn(),
        unregisterPushToken: jest.fn(),
    },
}));

jest.mock('../../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        captureException: jest.fn(),
    },
}));

describe('PushRegistrationService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset Device.isDevice mock
        (Device.isDevice as any) = true;
    });

    describe('registerForPushNotifications', () => {
        it('should return null on simulator', async () => {
            (Device.isDevice as any) = false;

            const result = await PushRegistrationService.registerForPushNotifications();

            expect(result).toBeNull();
            // Logger might not be called in current implementation
        });

        it('should return null when permission denied', async () => {
            (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
                status: 'denied',
            });
            (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
                status: 'denied',
            });

            const result = await PushRegistrationService.registerForPushNotifications();

            expect(result).toBeNull();
            expect(logger.warn).toHaveBeenCalled();
            expect(AppNotificationService.unregisterPushToken).toHaveBeenCalled();
        });

        it('should request permission when not determined', async () => {
            (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
                status: 'undetermined',
            });
            (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
                status: 'granted',
            });
            (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
                data: 'mock-push-token',
            });

            const result = await PushRegistrationService.registerForPushNotifications();

            expect(result).toBe('mock-push-token');
            expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
        });

        it('should use existing permission when granted', async () => {
            (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
                status: 'granted',
            });
            (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
                data: 'existing-token',
            });

            const result = await PushRegistrationService.registerForPushNotifications();

            expect(result).toBe('existing-token');
            expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
        });

        it('should register push token with AppNotificationService', async () => {
            (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
                status: 'granted',
            });
            (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
                data: 'token-123',
            });

            await PushRegistrationService.registerForPushNotifications();

            expect(AppNotificationService.registerPushToken).toHaveBeenCalledWith('token-123', {
                platform: Platform.OS,
                tokenType: 'expo',
            });
        });

        it('should create notification channel on Android', async () => {
            require('react-native').Platform.OS = 'android';

            (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
                status: 'granted',
            });
            (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
                data: 'token',
            });

            await PushRegistrationService.registerForPushNotifications();

            expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith('default', {
                name: 'default',
                importance: 4,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        });

        it('should not create notification channel on iOS', async () => {
            require('react-native').Platform.OS = 'ios';

            (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
                status: 'granted',
            });
            (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
                data: 'token',
            });

            await PushRegistrationService.registerForPushNotifications();

            expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
        });

        it('should warn about APNs token on iOS', async () => {
            require('react-native').Platform.OS = 'ios';

            (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
                status: 'granted',
            });
            // APNs token format (64+ hex characters)
            (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
                data: 'a'.repeat(64),
            });

            await PushRegistrationService.registerForPushNotifications();

            expect(logger.warn).toHaveBeenCalledWith(
                'Native iOS push token detectado (APNs). FCM requiere token de registro Firebase en iOS.'
            );
        });

        it('should not warn about Expo token format', async () => {
            require('react-native').Platform.OS = 'ios';

            (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
                status: 'granted',
            });
            // Expo token format (shorter, with dashes)
            (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
                data: 'ExponentPushToken[abc123]',
            });

            await PushRegistrationService.registerForPushNotifications();

            expect(logger.warn).not.toHaveBeenCalled();
        });

        it('should return null when getExpoPushTokenAsync fails', async () => {
            (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
                status: 'granted',
            });
            (Notifications.getExpoPushTokenAsync as jest.Mock).mockRejectedValue(
                new Error('Token error')
            );

            const result = await PushRegistrationService.registerForPushNotifications();

            expect(result).toBeNull();
            expect(logger.captureException).toHaveBeenCalled();
        });

        it('should handle null token from getExpoPushTokenAsync', async () => {
            (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
                status: 'granted',
            });
            (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
                data: null,
            });

            const result = await PushRegistrationService.registerForPushNotifications();

            expect(result).toBeNull();
        });

        it('should handle errors gracefully', async () => {
            (Notifications.getPermissionsAsync as jest.Mock).mockRejectedValue(
                new Error('Permission error')
            );

            const result = await PushRegistrationService.registerForPushNotifications();

            expect(result).toBeNull();
            expect(logger.captureException).toHaveBeenCalled();
        });
    });

    describe('initListeners', () => {
        it('should register foreground notification listener', () => {
            const mockRemove = jest.fn();
            const mockListener = jest.fn();

            (Notifications.addNotificationReceivedListener as jest.Mock).mockReturnValue({
                remove: mockRemove,
            });
            (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValue({
                remove: mockRemove,
            });

            const cleanup = PushRegistrationService.initListeners(mockListener);

            expect(Notifications.addNotificationReceivedListener).toHaveBeenCalled();
            expect(typeof cleanup).toBe('function');
        });

        it('should register response listener', () => {
            const mockRemove = jest.fn();
            const mockResponseHandler = jest.fn();

            (Notifications.addNotificationReceivedListener as jest.Mock).mockReturnValue({
                remove: mockRemove,
            });
            (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValue({
                remove: mockRemove,
            });

            PushRegistrationService.initListeners(undefined, mockResponseHandler);

            expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalled();
        });

        it('should call onNotification callback when notification received', () => {
            const mockRemove = jest.fn();
            const mockListener = jest.fn();
            const mockNotification = { title: 'Test' } as any;

            (Notifications.addNotificationReceivedListener as jest.Mock).mockImplementation(
                (cb) => {
                    cb(mockNotification);
                    return { remove: mockRemove };
                }
            );
            (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValue({
                remove: mockRemove,
            });

            PushRegistrationService.initListeners(mockListener);

            expect(mockListener).toHaveBeenCalledWith(mockNotification);
        });

        it('should call onResponse callback when notification response received', () => {
            const mockRemove = jest.fn();
            const mockResponseHandler = jest.fn();
            const mockResponse = { notification: { title: 'Test' } } as any;

            (Notifications.addNotificationReceivedListener as jest.Mock).mockReturnValue({
                remove: mockRemove,
            });
            (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation(
                (cb) => {
                    cb(mockResponse);
                    return { remove: mockRemove };
                }
            );

            PushRegistrationService.initListeners(undefined, mockResponseHandler);

            expect(mockResponseHandler).toHaveBeenCalledWith(mockResponse);
        });

        it('should cleanup listeners on unmount', () => {
            const mockRemove1 = jest.fn();
            const mockRemove2 = jest.fn();

            (Notifications.addNotificationReceivedListener as jest.Mock).mockReturnValue({
                remove: mockRemove1,
            });
            (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValue({
                remove: mockRemove2,
            });

            const cleanup = PushRegistrationService.initListeners();
            cleanup();

            expect(mockRemove1).toHaveBeenCalled();
            expect(mockRemove2).toHaveBeenCalled();
        });

        it('should handle undefined callbacks gracefully', () => {
            const mockRemove = jest.fn();

            (Notifications.addNotificationReceivedListener as jest.Mock).mockReturnValue({
                remove: mockRemove,
            });
            (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValue({
                remove: mockRemove,
            });

            expect(() => PushRegistrationService.initListeners()).not.toThrow();
        });
    });

    describe('looksLikeApnsToken', () => {
        it('should identify APNs token format', () => {
            // APNs tokens are 64+ hex characters
            const apnsToken = 'a'.repeat(64);
            expect((PushRegistrationService as any).looksLikeApnsToken(apnsToken)).toBe(true);
        });

        it('should reject non-APNs token formats', () => {
            const expoToken = 'ExponentPushToken[abc123]';
            expect((PushRegistrationService as any).looksLikeApnsToken(expoToken)).toBe(false);
        });

        it('should reject short hex strings', () => {
            const shortHex = 'abc123';
            expect((PushRegistrationService as any).looksLikeApnsToken(shortHex)).toBe(false);
        });
    });
});
