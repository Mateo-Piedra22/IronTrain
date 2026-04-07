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

function normalizeCookieDomain(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const candidate = raw.trim().replace(/^\.+/, '');
    if (!candidate) return null;

    if (candidate.includes('/') || candidate.includes(':') || candidate.includes(' ')) {
        return null;
    }

    return candidate.toLowerCase();
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

export function getSafeNeonAuthCookieDomain(): string | null {
    const cookieDomain = normalizeCookieDomain(process.env.NEON_AUTH_COOKIE_DOMAIN);
    if (!cookieDomain) return null;

    const canonicalOrigin = getCanonicalAppOrigin();
    if (!canonicalOrigin) {
        return cookieDomain;
    }

    const appHost = new URL(canonicalOrigin).hostname.toLowerCase();
    const matchesHost = appHost === cookieDomain || appHost.endsWith(`.${cookieDomain}`);
    if (!matchesHost) {
        return null;
    }

    return cookieDomain;
}
