import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCanonicalAppOrigin, getNeonAuthServiceBaseUrl, shouldEnforceCanonicalAuthOrigin } from './src/lib/auth/runtime';

const SAME_ORIGIN_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const AUTH_BYPASS_PATHS = ['/api/webhooks/', '/api/auth/exchange', '/api/auth/'];
const MAX_REDIRECT_URI_LENGTH = 512;

/**
 * Neon Auth session verifier parameter name.
 * After OAuth callback, Neon Auth redirects to callbackURL with this parameter.
 * The middleware must exchange it for session cookies to complete the flow.
 */
const NEON_AUTH_SESSION_VERIFIER_PARAM = 'neon_auth_session_verifier';
const NEON_AUTH_BASE_URL = getNeonAuthServiceBaseUrl() || '';
const CANONICAL_APP_ORIGIN = getCanonicalAppOrigin();
const DEBUG_OAUTH_EXCHANGE = process.env.AUTH_DEBUG_OAUTH_EXCHANGE === '1';
const NEON_AUTH_ORIGIN = (() => {
    if (!NEON_AUTH_BASE_URL) return null;
    try {
        return new URL(NEON_AUTH_BASE_URL).origin;
    } catch {
        return null;
    }
})();

function parseCookieNames(cookieHeader: string): string[] {
    if (!cookieHeader) return [];
    return cookieHeader
        .split(';')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => entry.split('=')[0]?.trim() || '')
        .filter(Boolean);
}

function countLikelyNeonCookies(cookieNames: string[]): number {
    return cookieNames.filter((name) => {
        const lower = name.toLowerCase();
        return lower.includes('neon') || lower.includes('auth') || lower.includes('session');
    }).length;
}

function getSetCookieNames(setCookieHeaders: string[]): string[] {
    return setCookieHeaders
        .map((raw) => raw.split(';')[0]?.split('=')[0]?.trim() || '')
        .filter(Boolean);
}

function resolveCanonicalAuthRedirectUrl(request: NextRequest): URL | null {
    if (!shouldEnforceCanonicalAuthOrigin()) return null;
    if (!CANONICAL_APP_ORIGIN) return null;

    const { pathname } = request.nextUrl;
    const isAuthPath = pathname === '/auth'
        || pathname.startsWith('/auth/')
        || pathname.startsWith('/api/auth/');

    if (!isAuthPath) return null;

    if (request.nextUrl.origin === CANONICAL_APP_ORIGIN) {
        return null;
    }

    const target = request.nextUrl.clone();
    const canonical = new URL(CANONICAL_APP_ORIGIN);
    target.protocol = canonical.protocol;
    target.host = canonical.host;
    return target;
}

function isAllowedOrigin(originOrReferer: string | null, requestOrigin: string): boolean {
    if (!originOrReferer) return false;
    try {
        return new URL(originOrReferer).origin === requestOrigin;
    } catch {
        return false;
    }
}

// Presence-only check used for middleware flow decisions.
// Token integrity/claims are validated downstream by auth handlers.
function hasBearerToken(req: NextRequest): boolean {
    const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
    return typeof authHeader === 'string' && authHeader.startsWith('Bearer ');
}

function hasLikelyAuthCookie(req: NextRequest): boolean {
    const names = req.cookies.getAll().map((cookie) => cookie.name.toLowerCase());
    return names.some((name) => (name.includes('auth') || name.includes('session')) && name.includes('neon'));
}

function getSafeRedirectUri(raw: string | null): string | null {
    if (!raw) return null;
    const candidate = raw.trim();
    if (!candidate || candidate.length > MAX_REDIRECT_URI_LENGTH) {
        return null;
    }

    try {
        const parsed = new URL(candidate);
        if (parsed.protocol !== 'irontrain:') {
            return null;
        }
        return parsed.toString();
    } catch {
        return null;
    }
}

/**
 * CSRF Protection Global
 * 
 * Verifica que las requests state-changing (POST/PUT/DELETE/PATCH) vengan
 * de la app oficial y no de un sitio malicioso.
 * 
 * Excepciones:
 * - GET, HEAD, OPTIONS (métodos seguros)
 * - Webhooks (GitHub, Stripe, etc.)
 * - Auth exchange (tiene su propia protección)
 */
function requireCSRF(req: NextRequest): NextResponse | null {
    const method = req.method;
    
    // Métodos seguros no requieren CSRF
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        return null;
    }
    
    // Excepciones para webhooks y auth
    const { pathname, origin: requestOrigin } = req.nextUrl;
    if (AUTH_BYPASS_PATHS.some((prefix) => pathname.startsWith(prefix))) {
        return null;
    }

    // Mobile/native authenticated requests typically include Bearer token and no Origin/Referer.
    if (hasBearerToken(req)) {
        return null;
    }

    if (!SAME_ORIGIN_METHODS.has(method)) {
        return null;
    }

    const origin = req.headers.get('origin');
    const referer = req.headers.get('referer');
    const sameOrigin = isAllowedOrigin(origin, requestOrigin) || isAllowedOrigin(referer, requestOrigin);

    if (!sameOrigin) {
        return NextResponse.json(
            { error: 'CSRF validation failed: origin mismatch' },
            { status: 403 }
        );
    }
    
    return null;
}

/**
 * Security Headers Globales
 * 
 * Agrega headers de seguridad a TODAS las respuestas:
 * - Content-Security-Policy (CSP)
 * - X-Frame-Options (clickjacking)
 * - X-Content-Type-Options (MIME sniffing)
 * - Strict-Transport-Security (HSTS)
 * - X-XSS-Protection
 * - Referrer-Policy
 * - Permissions-Policy
 */
function addSecurityHeaders(response: NextResponse, pathname: string): NextResponse {
    const connectSrcParts = [
        "connect-src 'self'",
        'https://api.openweathermap.org',
        'https://assets.vercel.com',
        'https://vercel-vitals.axiom.co',
        'https://vercel.live',
        'wss://vercel.live',
        'https://*.neonauth.sa-east-1.aws.neon.tech',
    ];
    if (NEON_AUTH_ORIGIN) {
        connectSrcParts.push(NEON_AUTH_ORIGIN);
    }

    const formActionParts = [
        "form-action 'self'",
        'https://accounts.google.com',
        'https://*.neonauth.sa-east-1.aws.neon.tech',
    ];
    if (NEON_AUTH_ORIGIN) {
        formActionParts.push(NEON_AUTH_ORIGIN);
    }

    // Content-Security-Policy
    const csp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://assets.vercel.com https://vercel.live",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: https: blob:",
        "font-src 'self' https://fonts.gstatic.com",
        connectSrcParts.join(' '),
        "frame-src 'none'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "base-uri 'self'",
        formActionParts.join(' '),
    ].join('; ');
    
    response.headers.set('Content-Security-Policy', csp);
    
    // X-Frame-Options (prevenir clickjacking)
    response.headers.set('X-Frame-Options', 'DENY');
    
    // X-Content-Type-Options (prevenir MIME sniffing)
    response.headers.set('X-Content-Type-Options', 'nosniff');
    
    // Strict-Transport-Security (HSTS) - 1 año con subdominios
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    
    // X-XSS-Protection (legacy pero útil)
    response.headers.set('X-XSS-Protection', '1; mode=block');
    
    // Referrer-Policy
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions-Policy (feature policy)
    response.headers.set(
        'Permissions-Policy',
        'camera=(), microphone=(), geolocation=(self), payment=(), usb=(), accelerometer=(), gyroscope=()'
    );
    
    // Cache control para API routes (no cachear datos sensibles)
    if (pathname.startsWith('/api/')) {
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
    }
    
    return response;
}

/**
 * OAuth Session Verifier Exchange
 *
 * After Google OAuth callback, Neon Auth redirects back to our domain with:
 *   ?neon_auth_session_verifier=TOKEN
 *
 * This function exchanges that verifier for session cookies by calling
 * /get-session on the Neon Auth upstream with the challenge cookie.
 * Without this step, no OAuth flow can complete.
 */
async function handleOAuthVerifierExchange(
    request: NextRequest,
    verifier: string,
): Promise<NextResponse | null> {
    const buildFailureRedirect = () => {
        const cleanUrl = request.nextUrl.clone();
        cleanUrl.searchParams.delete(NEON_AUTH_SESSION_VERIFIER_PARAM);
        if (!cleanUrl.searchParams.get('error')) {
            cleanUrl.searchParams.set('error', 'state_mismatch');
        }
        return NextResponse.redirect(cleanUrl);
    };

    try {
        const requestHost = request.headers.get('host') || request.nextUrl.host;
        const requestPath = request.nextUrl.pathname;

        if (!NEON_AUTH_BASE_URL) {
            console.error('[middleware] Missing NEON_AUTH_BASE_URL for OAuth verifier exchange');
            return buildFailureRedirect();
        }

        const requestOrigin = request.nextUrl.origin;
        const proxyUrl = new URL('/api/auth/get-session', requestOrigin);
        proxyUrl.searchParams.set(NEON_AUTH_SESSION_VERIFIER_PARAM, verifier);

        const cookieHeader = request.headers.get('cookie') || '';
        const cookieNames = parseCookieNames(cookieHeader);
        const cookieCount = cookieNames.length;
        const neonCookieCount = countLikelyNeonCookies(cookieNames);

        if (DEBUG_OAUTH_EXCHANGE) {
            console.info('[middleware] OAuth verifier exchange start', {
                requestHost,
                requestPath,
                proxyHost: proxyUrl.host,
                upstreamHost: new URL(NEON_AUTH_BASE_URL).host,
                cookieCount,
                neonCookieCount,
            });
        }

        const response = await fetch(proxyUrl.toString(), {
            method: 'GET',
            headers: {
                'Cookie': cookieHeader,
                'x-neon-auth-middleware': 'true',
            },
            signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
            console.error('[middleware] OAuth verifier exchange failed', {
                requestHost,
                requestPath,
                proxyHost: proxyUrl.host,
                upstreamHost: new URL(NEON_AUTH_BASE_URL).host,
                status: response.status,
                statusText: response.statusText,
                cookieCount,
                neonCookieCount,
            });
            return buildFailureRedirect();
        }

        // Build NextResponse redirect that strips the verifier from the URL
        const cleanUrl = request.nextUrl.clone();
        cleanUrl.searchParams.delete(NEON_AUTH_SESSION_VERIFIER_PARAM);

        const redirectResponse = NextResponse.redirect(cleanUrl);

        // Forward all Set-Cookie headers from the upstream response
        const setCookieHeaders = response.headers.getSetCookie();
        const setCookieNames = getSetCookieNames(setCookieHeaders);

        if (DEBUG_OAUTH_EXCHANGE) {
            console.info('[middleware] OAuth verifier exchange success', {
                requestHost,
                requestPath,
                proxyHost: proxyUrl.host,
                upstreamHost: new URL(NEON_AUTH_BASE_URL).host,
                status: response.status,
                setCookieCount: setCookieHeaders.length,
                setCookieNames,
            });
        }

        for (const cookie of setCookieHeaders) {
            redirectResponse.headers.append('Set-Cookie', cookie);
        }

        return redirectResponse;
    } catch (error) {
        console.error('[middleware] OAuth verifier exchange error', {
            requestHost: request.headers.get('host') || request.nextUrl.host,
            requestPath: request.nextUrl.pathname,
            error: error instanceof Error ? error.message : String(error),
        });
        return buildFailureRedirect();
    }
}

export async function middleware(request: NextRequest) {
    const { nextUrl } = request;
    const { pathname } = nextUrl;

    const canonicalRedirect = resolveCanonicalAuthRedirectUrl(request);
    if (canonicalRedirect) {
        return NextResponse.redirect(canonicalRedirect, 308);
    }

    const redirectUri = nextUrl.searchParams.get('redirectUri');
    const safeRedirectUri = getSafeRedirectUri(redirectUri);

    const normalizedLeadingSpacePath = pathname.replace(/^\/(?:%20|\s)+/i, '/');
    if (normalizedLeadingSpacePath !== pathname) {
        const target = nextUrl.clone();
        target.pathname = normalizedLeadingSpacePath;
        return NextResponse.redirect(target);
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-url', request.url);

    // ──────────────────────────────────────────────────────────
    // OAuth Session Verifier Exchange (CRITICAL for Google Auth)
    // After Neon Auth processes the Google callback, it redirects
    // back to our domain with ?neon_auth_session_verifier=TOKEN.
    // We MUST exchange this for session cookies here.
    // ──────────────────────────────────────────────────────────
    const verifier = pathname.startsWith('/api/auth/')
        ? null
        : nextUrl.searchParams.get(NEON_AUTH_SESSION_VERIFIER_PARAM);

    if (verifier) {
        const exchangeResult = await handleOAuthVerifierExchange(request, verifier);
        if (exchangeResult) {
            return addSecurityHeaders(exchangeResult, pathname);
        }
        // If exchange fails, continue — let the page handle the error
    }

    // CSRF Protection para API routes
    if (pathname.startsWith('/api/')) {
        const csrfError = requireCSRF(request);
        if (csrfError) {
            return csrfError;
        }
    }

    // Admin Route Protection
    if (pathname.startsWith('/admin') && !hasLikelyAuthCookie(request)) {
        if (!hasBearerToken(request)) {
            return NextResponse.redirect(new URL('/auth/sign-in', request.url));
        }
    }

    // If we have a redirectUri, we want to save it in a cookie
    // so the bridge page can send the user back to the correct app link.
    if (safeRedirectUri && pathname.startsWith('/auth/')) {
        const response = NextResponse.next({
            request: {
                headers: requestHeaders,
            },
        });
        response.cookies.set('redirect_uri', safeRedirectUri, {
            path: '/',
            maxAge: 600, // 10 minutes
            httpOnly: true,
            sameSite: 'lax',
        });
        return addSecurityHeaders(response, pathname);
    }

    const response = NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });
    
    return addSecurityHeaders(response, pathname);
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
