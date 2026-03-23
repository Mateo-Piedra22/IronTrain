import { createNeonAuth } from '@neondatabase/auth/next/server';

export const auth = createNeonAuth({
    // Usamos la URL interna del servicio para llamadas desde el servidor (SSR)
    // Esto evita el bucle 508 al no pasar por el dominio público de la app.
    baseUrl: process.env.NEON_AUTH_SERVICE_URL!,
    cookies: {
        secret: process.env.NEON_AUTH_COOKIE_SECRET!,
    },
});
