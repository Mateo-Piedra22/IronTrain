'use client';

import { useEffect } from 'react';

type BridgeAppRedirectProps = {
    appUrl: string;
    delayMs?: number;
};

export function BridgeAppRedirect({ appUrl, delayMs = 1500 }: BridgeAppRedirectProps) {
    useEffect(() => {
        document.cookie = 'redirect_uri=; Max-Age=0; path=/; SameSite=Lax';

        const timeout = window.setTimeout(() => {
            window.location.assign(appUrl);
        }, delayMs);

        return () => {
            window.clearTimeout(timeout);
        };
    }, [appUrl, delayMs]);

    return null;
}
