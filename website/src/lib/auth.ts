import * as jose from 'jose';
import { NextRequest } from 'next/server';
import { logger } from './logger';

/**
 * Verifies the JWT Bearer token from the Authorization header.
 * Returns the user ID (sub or id claim) if valid, null otherwise.
 * 
 * Uses NEON_AUTH_COOKIE_SECRET from environment variables.
 * Throws if the secret is not configured (Zero Trust: no fallback secrets).
 */
export async function verifyAuth(req: NextRequest): Promise<string | null> {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.split(' ')[1];
    if (!token || token === 'null' || token === 'undefined') return null;

    try {
        const secretStr = process.env.NEON_AUTH_COOKIE_SECRET;
        if (!secretStr) {
            logger.error('FATAL: NEON_AUTH_COOKIE_SECRET is not configured');
            return null;
        }

        const secret = new TextEncoder().encode(secretStr);
        const { payload } = await jose.jwtVerify(token, secret);

        const userId = (payload.sub || payload.id) as string | undefined;
        if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
            return null;
        }

        return userId;
    } catch {
        return null;
    }
}
