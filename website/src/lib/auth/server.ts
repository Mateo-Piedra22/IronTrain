import { createNeonAuth } from '@neondatabase/auth/next/server';

export const auth = createNeonAuth({
    // IMPORTANTE: Siempre usamos la URL externa del servicio en el servidor
    // Esto evita que el servidor se consulte a sí mismo en un bucle (error 508)
    // y soluciona el deadlock de SSR en desarrollo.
    baseUrl: process.env.NEON_AUTH_SERVICE_URL || process.env.NEXT_PUBLIC_NEON_AUTH_URL!,
    cookies: {
        secret: process.env.NEON_AUTH_COOKIE_SECRET!,
    },
});
