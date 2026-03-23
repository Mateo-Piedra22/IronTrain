import { createNeonAuth } from '@neondatabase/auth/next/server';

/**
 * Instancia única de autenticación.
 * Forzamos NEON_AUTH_SERVICE_URL para evitar bucles 508 de autorreferencia.
 */
export const auth = createNeonAuth({
    baseUrl: process.env.NEON_AUTH_SERVICE_URL!,
    cookies: {
        secret: process.env.NEON_AUTH_COOKIE_SECRET!,
    },
});

// Exportamos authHandler como alias de auth para el proxy
export const authHandler = auth;
