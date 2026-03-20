import PostHog from 'posthog-react-native';

const PH_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const PH_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

export const posthog = new PostHog(PH_KEY || 'nop', {
    host: PH_HOST,
    captureAppLifecycleEvents: true,
    errorTracking: {
        autocapture: {
            uncaughtExceptions: true,
            unhandledRejections: true,
            console: ['error', 'warn'],
        },
    },
});

/**
 * Capture a custom event.
 */
export const capture = (eventName: string, properties?: Record<string, any>) => {
    posthog.capture(eventName, properties);
};

/**
 * Identify a user with their database ID.
 */
export const identify = (userId: string, properties?: Record<string, any>) => {
    posthog.identify(userId, properties);
};

/**
 * Alias an anonymous ID to a user ID.
 */
export const alias = (userId: string) => {
    posthog.alias(userId);
};

/**
 * Reset PostHog state on logout.
 */
export const reset = () => {
    posthog.reset();
};

/**
 * FEATURE FLAGS & EXPERIMENTS
 */

/**
 * Check if a feature flag is enabled for the current user.
 */
export const isFeatureFlagEnabled = (key: string): boolean => {
    return !!posthog.isFeatureEnabled(key);
};

/**
 * Get the value of a multivariant feature flag or experiment variant.
 */
export const getFeatureFlag = (key: string): string | boolean | undefined => {
    return posthog.getFeatureFlag(key);
};

/**
 * Get the JSON payload associated with a feature flag or variant.
 */
export const getFeatureFlagPayload = (key: string): any => {
    return posthog.getFeatureFlagPayload(key);
};

/**
 * Manually reload feature flags (useful after login).
 */
export const reloadFeatureFlags = async () => {
    await posthog.reloadFeatureFlagsAsync();
};
