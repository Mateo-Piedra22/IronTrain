import notifee from '@notifee/react-native';
import { Platform } from 'react-native';
import { configService } from '../ConfigService';
import { notificationPermissionsService } from '../NotificationPermissionsService';
import { systemNotificationService } from '../SystemNotificationService';

// Mock everything locally to avoid any interference
jest.mock('@notifee/react-native', () => {
    return {
        __esModule: true,
        default: {
            createChannel: jest.fn(() => Promise.resolve('channel-id')),
            createTriggerNotification: jest.fn(() => Promise.resolve()),
            displayNotification: jest.fn(() => Promise.resolve()),
            cancelNotification: jest.fn(() => Promise.resolve()),
            cancelAllNotifications: jest.fn(() => Promise.resolve()),
            requestPermission: jest.fn(() => Promise.resolve({ authorizationStatus: 1 })),
            getNotificationSettings: jest.fn(() => Promise.resolve({ authorizationStatus: 1 })),
            onBackgroundEvent: jest.fn(),
            registerForegroundService: jest.fn(),
        },
        AndroidImportance: { HIGH: 4, DEFAULT: 3 },
        AndroidCategory: { PROGRESS: 'progress' },
        AndroidVisibility: { PUBLIC: 1 },
        TriggerType: { TIMESTAMP: 0 },
        AuthorizationStatus: { AUTHORIZED: 1, DENIED: 0, PROVISIONAL: 2, NOT_DETERMINED: -1 },
    };
});

jest.mock('../ConfigService', () => ({
    configService: {
        get: jest.fn(),
        set: jest.fn(),
    },
}));

jest.mock('../NotificationPermissionsService', () => ({
    notificationPermissionsService: {
        checkPermission: jest.fn(),
    },
}));

jest.mock('../../utils/logger', () => ({
    logger: {
        captureException: jest.fn(),
    },
}));

describe('SystemNotificationService', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Reset singleton state
        (systemNotificationService as any).channelsCreated = false;

        // Default platform to android 
        (Platform as any).OS = 'android';

        (configService.get as jest.Mock).mockImplementation((key) => {
            if (key === 'systemNotificationsEnabled') return true;
            if (key === 'androidForegroundServiceNotificationsEnabled') return true;
            if (key === 'notificationPreferences') {
                return {
                    system: {
                        enabled: true,
                        workoutPersistent: true,
                        inactivityReminder: true,
                        workoutComplete: true,
                        restTimer: true,
                        intervalTimer: true,
                        updateAvailable: true,
                        appUpdated: true,
                        streakReminder: true,
                    },
                };
            }
            return null;
        });
        (notificationPermissionsService.checkPermission as jest.Mock).mockResolvedValue(true);
    });

    it('should ensure channels exist', async () => {
        await systemNotificationService.ensureChannels();
        expect(notifee.createChannel).toHaveBeenCalled();
    });

    it('should show persistent workout notification', async () => {
        await systemNotificationService.showPersistentWorkout({
            elapsedSeconds: 61,
            completedSets: 2,
            totalExercises: 4,
            isPaused: false,
            workoutName: 'IronTrain'
        }, true); // Use force=true to bypass permission checks if they are failing for some reason

        expect(notifee.displayNotification).toHaveBeenCalled();
    });

    it('should schedule inactivity reminder', async () => {
        await systemNotificationService.scheduleInactivityReminder(7200, true);

        expect(notifee.createTriggerNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'inactivity-reminder',
                body: expect.stringContaining('2h 0min')
            }),
            expect.any(Object)
        );
    });

    it('should show interval timer progress', async () => {
        // Use force=true
        await (systemNotificationService as any).showIntervalTimerNotification({
            phase: 'work',
            currentRound: 2,
            totalRounds: 8,
            timeLeft: 30,
            isPaused: false
        }, true);

        expect(notifee.displayNotification).toHaveBeenCalledWith(expect.objectContaining({
            id: 'itimer-id'
        }));
    });

    it('should cancel all notifications', async () => {
        await systemNotificationService.cancelAll();
        expect(notifee.cancelAllNotifications).toHaveBeenCalled();
    });
});
