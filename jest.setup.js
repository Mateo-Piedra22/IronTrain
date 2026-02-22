jest.mock('@notifee/react-native', () => ({
    __esModule: true,
    default: {
        createChannel: jest.fn(() => Promise.resolve('channel-id')),
        createTriggerNotification: jest.fn(() => Promise.resolve()),
        displayNotification: jest.fn(() => Promise.resolve()),
        cancelNotification: jest.fn(() => Promise.resolve()),
        requestPermission: jest.fn(() => Promise.resolve({ authorizationStatus: 1 })),
        getNotificationSettings: jest.fn(() => Promise.resolve({ authorizationStatus: 1 })),
        onBackgroundEvent: jest.fn(),
    },
    AndroidImportance: { HIGH: 4, DEFAULT: 3 },
    TriggerType: { TIMESTAMP: 0 },
    AuthorizationStatus: { AUTHORIZED: 1, DENIED: 0, PROVISIONAL: 2, NOT_DETERMINED: -1 },
}));
