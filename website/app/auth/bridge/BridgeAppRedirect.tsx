'use client';

import { useEffect, useMemo, useState } from 'react';

type BridgeAppRedirectProps = {
    appUrl?: string;
    targetUrl?: string;
    delayMs?: number;
    label?: string;
    clearRedirectCookie?: boolean;
};

export function BridgeAppRedirect({
    appUrl,
    targetUrl,
    delayMs = 1500,
    label = 'destino',
    clearRedirectCookie = false,
}: BridgeAppRedirectProps) {
    const destination = targetUrl || appUrl;
    const [remainingMs, setRemainingMs] = useState(delayMs);

    const percentComplete = useMemo(() => {
        if (delayMs <= 0) return 100;
        const clamped = Math.max(0, Math.min(delayMs, remainingMs));
        return Math.round(((delayMs - clamped) / delayMs) * 100);
    }, [delayMs, remainingMs]);

    useEffect(() => {
        if (!destination) return;

        if (clearRedirectCookie) {
            document.cookie = 'redirect_uri=; Max-Age=0; path=/; SameSite=Lax';
        }

        setRemainingMs(delayMs);

        const tick = window.setInterval(() => {
            setRemainingMs((previous) => Math.max(0, previous - 100));
        }, 100);

        const timeout = window.setTimeout(() => {
            window.location.assign(destination);
        }, delayMs);

        return () => {
            window.clearInterval(tick);
            window.clearTimeout(timeout);
        };
    }, [clearRedirectCookie, delayMs, destination]);

    if (!destination) return null;

    const seconds = Math.max(1, Math.ceil(remainingMs / 1000));

    return (
        <div className="space-y-2 pt-2">
            <div className="w-full h-1.5 bg-[#1a1a2e]/10 rounded-full overflow-hidden">
                <div
                    className="h-full bg-[#1a1a2e] transition-all duration-100"
                    style={{ width: `${percentComplete}%` }}
                />
            </div>
            <p className="text-[10px] opacity-50 uppercase tracking-[0.2em]">
                Redirigiendo a {label} en {seconds}s
            </p>
        </div>
    );
}
