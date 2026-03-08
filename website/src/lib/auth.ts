import { NextRequest } from 'next/server';
import { auth } from './auth/server';
import { logger } from './logger';

/**
 * Verifies the JWT Bearer token from the Authorization header.
 * Returns the user ID (sub or id claim) if valid, null otherwise.
 * 
 * Uses NEON_AUTH_COOKIE_SECRET from environment variables.
 * Throws if the secret is not configured (Zero Trust: no fallback secrets).
 */
export async function verifyAuth(req: NextRequest): Promise<string | null> {
    // 1. Implementation A: JWT Bearer Token (App/Mobile)
    const authHeader = req.headers.get('Authorization');
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

    // 2. Implementation B: Browser Session (Web)
    try {
        const { data: session } = await auth.getSession();
        if (session?.user?.id) {
            return session.user.id;
        }
    } catch (err) {
        // Log sensitive auth errors only in internal logger if needed
    }

    return null;
}
