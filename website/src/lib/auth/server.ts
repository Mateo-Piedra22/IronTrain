import { createNeonAuth } from '@neondatabase/auth/next/server';

export const auth = createNeonAuth({
    baseUrl: process.env.NEON_AUTH_BASE_URL || 'https://ep-auth-ironhub.neonauth.us-east-1.aws.neon.tech/neondb/auth',
    cookies: {
        secret: process.env.NEON_AUTH_COOKIE_SECRET || 'a-very-long-super-secret-key-that-should-be-in-env-at-least-32-chars',
    },
});
