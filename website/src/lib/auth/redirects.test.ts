import { describe, expect, it } from 'vitest';
import {
    buildAccountCallbackUrl,
    buildAuthBridgeCallbackUrl,
    buildAuthPageUrl,
    buildSocialLinkCallbackUrl,
    getSafeMobileRedirectUri,
} from './redirects';

describe('auth redirects helpers', () => {
    it('accepts only irontrain scheme', () => {
        expect(getSafeMobileRedirectUri('irontrain://callback')).toBe('irontrain://callback');
        expect(getSafeMobileRedirectUri('https://evil.test/cb')).toBeNull();
        expect(getSafeMobileRedirectUri('javascript:alert(1)')).toBeNull();
    });

    it('builds bridge callback with safe redirectUri', () => {
        expect(buildAuthBridgeCallbackUrl('irontrain://callback')).toBe('/auth/bridge?redirectUri=irontrain%3A%2F%2Fcallback');
        expect(buildAuthBridgeCallbackUrl('https://evil.test')).toBe('/auth/bridge');
    });

    it('builds account callback with linked flags', () => {
        expect(buildSocialLinkCallbackUrl('google', 'irontrain://callback')).toBe(
            '/auth/account?redirectUri=irontrain%3A%2F%2Fcallback&linked=google'
        );
        expect(buildAccountCallbackUrl(undefined, { linked: 'google' })).toBe('/auth/account?linked=google');
    });

    it('builds auth page urls preserving safe redirectUri and params', () => {
        expect(buildAuthPageUrl('/auth/sign-in', 'irontrain://callback', { step: 'oauth' })).toBe(
            '/auth/sign-in?redirectUri=irontrain%3A%2F%2Fcallback&step=oauth'
        );
        expect(buildAuthPageUrl('/auth/sign-up', 'https://evil.test', { step: 'oauth' })).toBe('/auth/sign-up?step=oauth');
    });
});
