import { createNeonAuth } from '@neondatabase/auth/next/server';

/**
 * Instancia única de autenticación.
 * 1. Forzamos NEON_AUTH_SERVICE_URL para evitar bucles 508.
 * 2. Configuramos el dominio de cookies para que el navegador las reconozca (soluciona UI desaparecida).
 */
export const auth = createNeonAuth({
    baseUrl: process.env.NEON_AUTH_SERVICE_URL!,
    cookies: {
        secret: process.env.NEON_AUTH_COOKIE_SECRET!,
        // Dominio específico para asegurar que el navegador asocie bien la sesión
        domain: 'irontrain.motiona.xyz',
    },
});

// Alias para el proxy
export const authHandler = auth;
