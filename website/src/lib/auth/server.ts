import { createNeonAuth } from '@neondatabase/auth/next/server';

/**
 * Instancia de autenticación para IronTrain.
 * IMPORTANTE: Usamos NEON_AUTH_SERVICE_URL (dominio interno de Neon) como baseUrl.
 * 1. Evita bucles 508 al hacer fetch directo a Neon en SSR.
 * 2. Permite que el proxy de la API funcione sin llamarse a sí mismo.
 */
export const auth = createNeonAuth({
    baseUrl: process.env.NEON_AUTH_SERVICE_URL!,
    cookies: {
        secret: process.env.NEON_AUTH_COOKIE_SECRET!,
    },
});

// Alias para compatibilidad si fuera necesario
export const authHandler = auth;
