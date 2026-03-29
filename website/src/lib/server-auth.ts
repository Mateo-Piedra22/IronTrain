import type { NextRequest } from 'next/server';
import { auth } from './auth/server';
import { logger } from './logger';

const DEFAULT_CLOCK_SKEW_SECONDS = 30;
const MAX_CLOCK_SKEW_SECONDS = 120;

function resolveClockSkewSeconds(): number {
    const raw = process.env.AUTH_CLOCK_SKEW_SECONDS;
    if (!raw) return DEFAULT_CLOCK_SKEW_SECONDS;

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_CLOCK_SKEW_SECONDS;

    return Math.max(0, Math.min(MAX_CLOCK_SKEW_SECONDS, Math.floor(parsed)));
}

// Small leeway for minor clock drift between issuer and verifier.
// Increasing this value effectively extends accepted token lifetime.
const CLOCK_SKEW_SECONDS = resolveClockSkewSeconds();

function isExpired(exp: unknown): boolean {
    if (typeof exp !== 'number' || !Number.isFinite(exp)) return false;
    const nowSeconds = Math.floor(Date.now() / 1000);
    return exp + CLOCK_SKEW_SECONDS <= nowSeconds;
}

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
                    if (isExpired(payload.exp)) {
                        return null;
                    }
                    const userId = (payload.sub || payload.id) as string | undefined;
                    if (userId && typeof userId === 'string' && userId.trim().length > 0) {
                        return userId;
                    }
                }
            } catch {
                return null;
            }
        }
        return null;
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
