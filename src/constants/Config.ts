import Constants from 'expo-constants';

/**
 * IronTrain Configuration constants
 * 
 * Uses environment variables for security and flexibility.
 * These are processed by Expo's EXPO_PUBLIC_ mechanism.
 */

const getBackendUrl = () => {
    // Priority 1: Environment variable (EXPO_PUBLIC_API_URL)
    if (process.env.EXPO_PUBLIC_API_URL) {
        return process.env.EXPO_PUBLIC_API_URL;
    }

    // Priority 2: Expo extra config (app.json)
    const extra = Constants.expoConfig?.extra as any;
    if (extra?.backendUrl) {
        return extra.backendUrl;
    }

    // Fallback (Safe default)
    return 'https://irontrain.motiona.xyz';
};

const getUpdateFeedUrl = () => {
    // Priority 1: Environment variable (EXPO_PUBLIC_UPDATE_FEED_URL)
    if (process.env.EXPO_PUBLIC_UPDATE_FEED_URL) {
        return process.env.EXPO_PUBLIC_UPDATE_FEED_URL;
    }

    // Priority 2: Expo extra config (app.json)
    const extra = Constants.expoConfig?.extra as any;
    if (extra?.updateFeedUrl) {
        return extra.updateFeedUrl;
    }

    // Fallback (Safe default)
    return 'https://irontrain.motiona.xyz/releases.json';
};

export const Config = {
    API_URL: getBackendUrl(),
    UPDATE_FEED_URL: getUpdateFeedUrl(),

    // Add other non-secret configuration here
    APP_SCHEME: 'irontrain',
};
