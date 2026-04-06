jest.mock('@notifee/react-native', () => ({
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

jest.mock('@shopify/flash-list', () => {
    return {
        __esModule: true,
        FlashList: () => null,
    };
});

jest.mock('react-native-reanimated/mock', () => {
    const RN = require('react-native');
    const Animated = {
        View: RN.View,
        Text: RN.Text,
        Image: RN.Image,
        ScrollView: RN.ScrollView,
        FlatList: RN.FlatList,
        createAnimatedComponent: (Component) => Component,
    };

    return {
        __esModule: true,
        default: Animated,
        ...Animated,
        useSharedValue: (value) => ({ value }),
        useAnimatedStyle: (updater) => updater(),
        useAnimatedProps: (updater) => updater(),
        useDerivedValue: (updater) => ({ value: updater() }),
        withTiming: (value) => value,
        withSpring: (value) => value,
        withDelay: (_delay, value) => value,
        withRepeat: (value) => value,
        withSequence: (...values) => values[values.length - 1],
        interpolate: (value, input, output) => {
            if (!Array.isArray(input) || !Array.isArray(output) || input.length < 2 || output.length < 2) {
                return value;
            }
            const [inputStart, inputEnd] = input;
            const [outputStart, outputEnd] = output;
            if (inputEnd === inputStart) {
                return outputStart;
            }
            const progress = (value - inputStart) / (inputEnd - inputStart);
            return outputStart + (outputEnd - outputStart) * progress;
        },
        runOnJS: (fn) => fn,
        runOnUI: (fn) => fn,
        cancelAnimation: () => undefined,
        Extrapolate: {
            CLAMP: 'clamp',
            EXTEND: 'extend',
            IDENTITY: 'identity',
        },
        Easing: {
            linear: (t) => t,
            ease: (t) => t,
            inOut: (fn) => fn,
            out: (fn) => fn,
            in: (fn) => fn,
        },
    };
});

jest.mock('react-native-reanimated', () => {
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.default.call = () => { };
    return Reanimated;
});

jest.mock('posthog-react-native', () => {
    const mockPostHog = {
        capture: jest.fn(),
        identify: jest.fn(),
        alias: jest.fn(),
        reset: jest.fn(),
        isFeatureEnabled: jest.fn(),
        getFeatureFlag: jest.fn(),
        getFeatureFlagPayload: jest.fn(),
        reloadFeatureFlagsAsync: jest.fn(async () => undefined),
    };
    return {
        __esModule: true,
        default: jest.fn(() => mockPostHog),
        PostHog: jest.fn(() => mockPostHog),
    };
});
