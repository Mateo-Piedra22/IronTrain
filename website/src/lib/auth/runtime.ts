function parseUrl(raw: string | null | undefined): URL | null {
    if (!raw) return null;
    const candidate = raw.trim();
    if (!candidate) return null;

    try {
        return new URL(candidate);
    } catch {
        return null;
    }
}

export function getCanonicalAppOrigin(): string | null {
    const parsed = parseUrl(process.env.NEXT_PUBLIC_APP_URL);
    return parsed ? parsed.origin : null;
}

export function shouldEnforceCanonicalAuthOrigin(): boolean {
    if (process.env.NODE_ENV !== 'production') return false;

    const origin = getCanonicalAppOrigin();
    if (!origin) return false;

    const hostname = new URL(origin).hostname.toLowerCase();
    const isLocalHost = hostname === 'localhost'
        || hostname === '127.0.0.1'
        || hostname.endsWith('.local');

    return !isLocalHost;
}

export function getNeonAuthServiceBaseUrl(): string | null {
    const parsed = parseUrl(process.env.NEON_AUTH_BASE_URL || process.env.NEON_AUTH_SERVICE_URL);
    if (!parsed) return null;

    const normalizedPath = parsed.pathname.replace(/\/+$/, '');
    if (!normalizedPath || normalizedPath === '/') {
        return parsed.origin;
    }

    return `${parsed.origin}${normalizedPath}`;
}
