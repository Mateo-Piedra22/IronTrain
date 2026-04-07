import { auth } from '../../../../src/lib/auth/server';

/**
 * Auth Proxy — Delegated to @neondatabase/auth SDK
 *
 * The SDK's authApiHandler already handles:
 * - Cookie domain rewriting (via cookies.domain config)
 * - Session data minting (signed JWT in __Secure-neon-auth.local.session_data)
 * - OAuth state/challenge cookie management
 * - Response header allowlisting
 *
 * DO NOT wrap auth.handler() with custom cookie logic — it corrupts OAuth state cookies
 * and causes state_mismatch errors when Google redirects back to Neon Auth.
 */
const handlers = auth.handler();

export const GET = handlers.GET;
export const POST = handlers.POST;
export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
export const PATCH = handlers.PATCH;
