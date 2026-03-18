import PostHog from 'posthog-react-native';

const PH_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const PH_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

export const posthog = new PostHog(PH_KEY || '', {
    host: PH_HOST,
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
