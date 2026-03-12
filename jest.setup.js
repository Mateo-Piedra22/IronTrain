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
        registerForegroundService: jest.fn(),
    },
    AndroidImportance: { HIGH: 4, DEFAULT: 3 },
    TriggerType: { TIMESTAMP: 0 },
    AuthorizationStatus: { AUTHORIZED: 1, DENIED: 0, PROVISIONAL: 2, NOT_DETERMINED: -1 },
}));

jest.mock('expo-secure-store', () => ({
    __esModule: true,
    getItemAsync: jest.fn(async () => null),
    setItemAsync: jest.fn(async () => undefined),
    deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-audio', () => {
    const player = {
        volume: 1,
        loop: false,
        play: jest.fn(),
        pause: jest.fn(),
        seekTo: jest.fn(async () => undefined),
        remove: jest.fn(),
    };
    return {
        __esModule: true,
        createAudioPlayer: jest.fn(() => ({ ...player })),
        setAudioModeAsync: jest.fn(async () => undefined),
        setIsAudioActiveAsync: jest.fn(async () => undefined),
    };
});

jest.mock('react-native-reanimated', () => {
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.default.call = () => { };
    return Reanimated;
});
