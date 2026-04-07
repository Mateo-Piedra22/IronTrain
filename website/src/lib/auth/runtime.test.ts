import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCanonicalAppOrigin, getNeonAuthServiceBaseUrl, getSafeNeonAuthCookieDomain, shouldEnforceCanonicalAuthOrigin } from './runtime';

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('auth runtime helpers', () => {
    it('normalizes canonical app origin', () => {
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://irontrain.motiona.xyz/some/path?ignored=yes');
        expect(getCanonicalAppOrigin()).toBe('https://irontrain.motiona.xyz');
    });

    it('normalizes neon auth service url preserving configured base path', () => {
        vi.stubEnv('NEON_AUTH_BASE_URL', 'https://ep-falling-wind-aca65w0x.neonauth.sa-east-1.aws.neon.tech/neondb/auth/');
        expect(getNeonAuthServiceBaseUrl()).toBe('https://ep-falling-wind-aca65w0x.neonauth.sa-east-1.aws.neon.tech/neondb/auth');
    });

    it('enforces canonical auth origin only in production and non-local hosts', () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://irontrain.motiona.xyz');
        expect(shouldEnforceCanonicalAuthOrigin()).toBe(true);

        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
        expect(shouldEnforceCanonicalAuthOrigin()).toBe(false);
    });

    it('accepts cookie domain only when it matches canonical app host', () => {
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://irontrain.motiona.xyz');
        vi.stubEnv('NEON_AUTH_COOKIE_DOMAIN', 'motiona.xyz');
        expect(getSafeNeonAuthCookieDomain()).toBe('motiona.xyz');

        vi.stubEnv('NEON_AUTH_COOKIE_DOMAIN', 'evil.test');
        expect(getSafeNeonAuthCookieDomain()).toBeNull();
    });
});
