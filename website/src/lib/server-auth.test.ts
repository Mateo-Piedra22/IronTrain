import { jwtVerify } from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auth } from './auth/server';
import { verifyAuthFromHeaders } from './server-auth';

vi.mock('jose', () => ({
    jwtVerify: vi.fn(),
}));

vi.mock('./auth/server', () => ({
    auth: {
        getSession: vi.fn(),
    },
}));

describe('server-auth utility', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns user id from valid bearer token payload.sub', async () => {
        vi.stubEnv('NEON_AUTH_COOKIE_SECRET', 'test-secret');
        (jwtVerify as any).mockResolvedValue({ payload: { sub: 'user-sub-1' } });

        const headers = new Headers({ Authorization: 'Bearer valid-token' });
        const userId = await verifyAuthFromHeaders(headers);

        expect(userId).toBe('user-sub-1');
        expect(auth.getSession).not.toHaveBeenCalled();
    });

    it('returns null for expired bearer token and does not fallback to session', async () => {
        vi.stubEnv('NEON_AUTH_COOKIE_SECRET', 'test-secret');
        const nowSeconds = Math.floor(Date.now() / 1000);
        (jwtVerify as any).mockResolvedValue({ payload: { sub: 'user-sub-1', exp: nowSeconds - 3600 } });
        (auth.getSession as any).mockResolvedValue({ data: { user: { id: 'session-user' } } });

        const headers = new Headers({ Authorization: 'Bearer expired-token' });
        const userId = await verifyAuthFromHeaders(headers);

        expect(userId).toBeNull();
        expect(auth.getSession).not.toHaveBeenCalled();
    });

    it('returns null for invalid bearer token and does not fallback to session', async () => {
        vi.stubEnv('NEON_AUTH_COOKIE_SECRET', 'test-secret');
        (jwtVerify as any).mockRejectedValue(new Error('invalid token'));
        (auth.getSession as any).mockResolvedValue({ data: { user: { id: 'session-user' } } });

        const headers = new Headers({ Authorization: 'Bearer invalid-token' });
        const userId = await verifyAuthFromHeaders(headers);

        expect(userId).toBeNull();
        expect(auth.getSession).not.toHaveBeenCalled();
    });

    it('returns null if no authorization header is present', async () => {
        (auth.getSession as any).mockResolvedValue({ data: { session: null } });
        const headers = new Headers();
        const userId = await verifyAuthFromHeaders(headers);

        expect(userId).toBeNull();
    });

    it('falls back to session cookie user id when no bearer header exists', async () => {
        (auth.getSession as any).mockResolvedValue({ data: { user: { id: 'session-user-id' } } });

        const headers = new Headers();
        const userId = await verifyAuthFromHeaders(headers);

        expect(userId).toBe('session-user-id');
    });
});
