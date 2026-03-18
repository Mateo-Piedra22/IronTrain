'use client';

import posthog from 'posthog-js';

const PH_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const PH_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

export const initPostHog = () => {
    if (typeof window !== 'undefined' && PH_KEY) {
        posthog.init(PH_KEY, {
            api_host: PH_HOST,
            capture_pageview: false, // We'll handle this manually for more control
            capture_pageleave: true,
            persistence: 'localStorage',
            session_recording: {},
        });
    }
};

/**
 * Capture a custom event.
 * naming convention: snake_case (e.g. workout_completed)
 */
export const captureEvent = (eventName: string, properties?: Record<string, any>) => {
    if (typeof window !== 'undefined') {
        posthog.capture(eventName, properties);
    }
};

/**
 * Identify a user with their database ID.
 */
export const identifyUser = (userId: string, properties?: Record<string, any>) => {
    if (typeof window !== 'undefined') {
        posthog.identify(userId, properties);
    }
};

/**
 * Alias an anonymous ID to a user ID.
 * Use this during the first login.
 */
export const aliasUser = (userId: string) => {
    if (typeof window !== 'undefined') {
        posthog.alias(userId);
    }
};

/**
 * Reset PostHog state on logout.
 */
export const resetUser = () => {
    if (typeof window !== 'undefined') {
        posthog.reset();
    }
};
