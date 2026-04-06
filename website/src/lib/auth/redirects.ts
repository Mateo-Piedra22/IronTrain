const MAX_REDIRECT_URI_LENGTH = 512;

function getAppOrigin(): string {
    if (typeof window !== 'undefined' && window.location?.origin) {
        return window.location.origin;
    }

    const envOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (envOrigin) {
        return envOrigin.replace(/\/$/, '');
    }

    return 'http://localhost:3000';
}

export function toAbsoluteAppUrl(pathOrUrl: string): string {
    const normalized = pathOrUrl.trim();
    if (!normalized) return `${getAppOrigin()}/`;

    try {
        return new URL(normalized).toString();
    } catch {
        const base = getAppOrigin();
        return normalized.startsWith('/') ? `${base}${normalized}` : `${base}/${normalized}`;
    }
}

function sanitizeMobileRedirectUri(raw: string | null | undefined): string | null {
    if (!raw) return null;

    const candidate = raw.trim();
    if (!candidate || candidate.length > MAX_REDIRECT_URI_LENGTH) {
        return null;
    }

    try {
        const parsed = new URL(candidate);
        if (parsed.protocol !== 'irontrain:') return null;
        return parsed.toString();
    } catch {
        return null;
    }
}

export function buildAuthBridgeCallbackUrl(rawRedirectUri?: string | null): string {
    const sanitizedRedirectUri = sanitizeMobileRedirectUri(rawRedirectUri);
    if (!sanitizedRedirectUri) {
        return '/auth/bridge';
    }

    const params = new URLSearchParams({ redirectUri: sanitizedRedirectUri });
    return `/auth/bridge?${params.toString()}`;
}

type CallbackParams = Record<string, string | null | undefined>;

function appendQuery(path: string, params: CallbackParams): string {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
        if (typeof value !== 'string') continue;
        const normalized = value.trim();
        if (!normalized) continue;
        query.set(key, normalized);
    }

    const encoded = query.toString();
    if (!encoded) return path;
    return `${path}${path.includes('?') ? '&' : '?'}${encoded}`;
}

export function buildAccountCallbackUrl(
    rawRedirectUri?: string | null,
    extraParams?: CallbackParams,
): string {
    const sanitizedRedirectUri = sanitizeMobileRedirectUri(rawRedirectUri);
    return appendQuery('/auth/account', {
        redirectUri: sanitizedRedirectUri,
        ...extraParams,
    });
}

export function buildAuthPageUrl(
    path: '/auth/sign-in' | '/auth/sign-up' | '/auth/account' | '/auth/bridge',
    rawRedirectUri?: string | null,
    extraParams?: CallbackParams,
): string {
    const sanitizedRedirectUri = sanitizeMobileRedirectUri(rawRedirectUri);
    return appendQuery(path, {
        redirectUri: sanitizedRedirectUri,
        ...extraParams,
    });
}

export function buildSocialLinkCallbackUrl(provider: 'google', rawRedirectUri?: string | null): string {
    return buildAccountCallbackUrl(rawRedirectUri, { linked: provider });
}

export function getSafeMobileRedirectUri(rawRedirectUri?: string | null): string | null {
    return sanitizeMobileRedirectUri(rawRedirectUri);
}
