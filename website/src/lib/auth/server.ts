import { createNeonAuth } from '@neondatabase/auth/next/server';

// Instancia para el HANDLER de la API (Proxy)
// Usamos la URL pública para que el router de Better Auth reconozca los paths entrantes.
export const authHandler = createNeonAuth({
    baseUrl: process.env.NEXT_PUBLIC_NEON_AUTH_URL!,
    cookies: {
        secret: process.env.NEON_AUTH_COOKIE_SECRET!,
    },
});

// Instancia para llamadas desde el SERVIDOR (SSR / getSession)
// Usamos la URL interna para evitar el bucle 508 (Loop Detected) en Next.js.
export const auth = createNeonAuth({
    baseUrl: process.env.NEON_AUTH_SERVICE_URL!,
    cookies: {
        secret: process.env.NEON_AUTH_COOKIE_SECRET!,
    },
});
