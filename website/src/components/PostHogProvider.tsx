'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { ReactNode, Suspense, useEffect } from 'react';
import { initPostHog } from '../lib/posthog';

function PostHogPageview() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (pathname) {
            let url = window.origin + pathname;
            if (searchParams && searchParams.toString()) {
                url = url + `?${searchParams.toString()}`;
            }
            posthog.capture('$pageview', {
                $current_url: url,
            });
        }
    }, [pathname, searchParams]);

    return null;
}

interface PHProviderProps {
    children: ReactNode;
    userId?: string;
    userEmail?: string;
}

export function PHProvider({ children, userId, userEmail }: PHProviderProps) {
    useEffect(() => {
        initPostHog();
    }, []);

    useEffect(() => {
        if (userId) {
            posthog.identify(userId, userEmail ? { email: userEmail } : {});
        } else {
            posthog.reset();
        }
    }, [userId, userEmail]);

    return (
        <PostHogProvider client={posthog}>
            <Suspense fallback={null}>
                <PostHogPageview />
            </Suspense>
            {children}
        </PostHogProvider>
    );
}
