import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const SAME_ORIGIN_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const AUTH_BYPASS_PATHS = ['/api/webhooks/', '/api/auth/exchange'];

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
    // Content-Security-Policy
    const csp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://assets.vercel.com https://vercel.live",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: https: blob:",
        "font-src 'self' https://fonts.gstatic.com",
        "connect-src 'self' https://api.openweathermap.org https://assets.vercel.com https://vercel-vitals.axiom.co https://vercel.live wss://vercel.live",
        "frame-src 'none'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
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

export async function middleware(request: NextRequest) {
    const { nextUrl } = request;
    const { pathname } = nextUrl;
    const redirectUri = nextUrl.searchParams.get('redirectUri');

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-url', request.url);

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
    if (redirectUri && pathname.startsWith('/auth/')) {
        const response = NextResponse.next({
            request: {
                headers: requestHeaders,
            },
        });
        response.cookies.set('redirect_uri', redirectUri, {
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
