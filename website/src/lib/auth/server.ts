import { createNeonAuth } from '@neondatabase/auth/next/server';

/**
 * Instancia única de autenticación.
 * 1. Forzamos NEON_AUTH_SERVICE_URL para evitar bucles 508.
 * 2. Configuramos el dominio de cookies para que el navegador las reconozca (soluciona UI desaparecida).
 */
const neonAuthServiceUrl = process.env.NEON_AUTH_SERVICE_URL;
const neonAuthCookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;

const missingAuthConfig = [
    !neonAuthServiceUrl ? 'NEON_AUTH_SERVICE_URL' : null,
    !neonAuthCookieSecret ? 'NEON_AUTH_COOKIE_SECRET' : null,
].filter((value): value is string => value !== null);

const authFallback = {
    async getSession() {
        return { data: null };
    },
    async signOut() {
        return { data: null };
    },
    handler() {
        const unavailable = async () => new Response('Auth is not configured', { status: 503 });
        return {
            GET: unavailable,
            POST: unavailable,
            PUT: unavailable,
            DELETE: unavailable,
            PATCH: unavailable,
        };
    },
};

if (missingAuthConfig.length > 0) {
    console.warn(`[auth] Missing env config: ${missingAuthConfig.join(', ')}. Falling back to disabled auth.`);
}

const authInstance = missingAuthConfig.length === 0 && neonAuthServiceUrl && neonAuthCookieSecret
    ? createNeonAuth({
        baseUrl: neonAuthServiceUrl,
        cookies: {
            secret: neonAuthCookieSecret,
            // Domain is set exclusively via NEON_AUTH_COOKIE_DOMAIN environment variable.
            // Do NOT hardcode the domain here — set it in the deployment environment.
            ...(process.env.NEON_AUTH_COOKIE_DOMAIN
                ? { domain: process.env.NEON_AUTH_COOKIE_DOMAIN }
                : {}),
        },
    })
    : authFallback;

export const auth = authInstance;

// Alias para el proxy
export const authHandler = auth;
