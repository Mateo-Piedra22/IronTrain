import { PostHog } from 'posthog-node';

const PH_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const PH_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let posthogClient: PostHog | null = null;

export const getPostHogServer = () => {
    if (!posthogClient && PH_KEY) {
        posthogClient = new PostHog(PH_KEY, {
            host: PH_HOST,
        });
    }
    return posthogClient;
};

/**
 * Capture a server-side event.
 */
export const captureServerEvent = async (userId: string, eventName: string, properties?: Record<string, any>) => {
    const client = getPostHogServer();
    if (client) {
        client.capture({
            distinctId: userId,
            event: eventName,
            properties: {
                ...properties,
                $lib: 'posthog-node',
                env: process.env.NODE_ENV,
            },
        });
        await client.shutdown();
    }
};
