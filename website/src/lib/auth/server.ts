import { createNeonAuth } from '@neondatabase/auth/next/server';

export const auth = createNeonAuth({
    // En desarrollo usamos NEON_AUTH_SERVICE_URL para evitar deadlock de SSR
    // En producción usamos NEXT_PUBLIC_NEON_AUTH_URL para sincronía de cookies con el dominio
    baseUrl: (process.env.NODE_ENV === 'development' && process.env.NEON_AUTH_SERVICE_URL)
        ? process.env.NEON_AUTH_SERVICE_URL
        : process.env.NEXT_PUBLIC_NEON_AUTH_URL!,
    cookies: {
        secret: process.env.NEON_AUTH_COOKIE_SECRET!,
    },
});
