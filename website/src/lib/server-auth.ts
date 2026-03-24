import type { NextRequest } from 'next/server';
import { auth } from './auth/server';
import { logger } from './logger';

/**
 * Verify auth from a standard Headers object.
 * Use this in Server Components and Server Actions that don't have a full NextRequest.
 *
 * Falls back to session cookie if no Bearer token is present.
 */
export async function verifyAuthFromHeaders(headers: Headers): Promise<string | null> {
    // 1. JWT Bearer Token (App/Mobile)
    const authHeader = headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        if (token && token !== 'null' && token !== 'undefined') {
            try {
                const secretStr = process.env.NEON_AUTH_COOKIE_SECRET;
                if (!secretStr) {
                    logger.error('FATAL: NEON_AUTH_COOKIE_SECRET is not configured');
                } else {
                    const jose = await import('jose');
                    const secret = new TextEncoder().encode(secretStr);
                    const { payload } = await jose.jwtVerify(token, secret);
                    const userId = (payload.sub || payload.id) as string | undefined;
                    if (userId && typeof userId === 'string' && userId.trim().length > 0) {
                        return userId;
                    }
                }
            } catch {
                // Ignore JWT failure and try session fallback
            }
        }
    }

    // 2. Session cookie (Web)
    try {
        const { data: session } = await auth.getSession();
        if (session?.user?.id) {
            return session.user.id;
        }
    } catch {
        // Silently fall through
    }

    return null;
}

/**
 * Verify auth from a NextRequest (API routes).
 * Preferred version for API routes where a full NextRequest is available.
 */
export async function verifyAuth(req: NextRequest): Promise<string | null> {
    return verifyAuthFromHeaders(req.headers);
}
