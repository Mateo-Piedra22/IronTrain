import { beforeEach, describe, expect, it, vi } from 'vitest';

function createSelectChain(limitRows: unknown[]) {
    const limit = vi.fn(async () => limitRows);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    return { from, where, limit };
}

describe('social themes phase 3 routes HTTP behavior', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('GET /themes/slug/:slug returns 401 when unauthorized', async () => {
        vi.resetModules();

        const verifyAuth = vi.fn().mockResolvedValue(null);
        const themesReadLimit = vi.fn();

        vi.doMock('@/lib/auth', () => ({ verifyAuth }));
        vi.doMock('@/lib/rate-limit', () => ({
            RATE_LIMITS: {
                SOCIAL_THEMES_READ: themesReadLimit,
            },
        }));

        const route = await import('../../../app/api/social/themes/slug/[slug]/route');
        const req = new Request('http://localhost/api/social/themes/slug/nord-iron', { method: 'GET' });
        const res = await route.GET(req as any, { params: Promise.resolve({ slug: 'nord-iron' }) });
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.error).toBe('Unauthorized');
    });

    it('GET /themes/:id/export returns 401 when unauthorized', async () => {
        vi.resetModules();

        const verifyAuth = vi.fn().mockResolvedValue(null);
        const themesReadLimit = vi.fn();

        vi.doMock('@/lib/auth', () => ({ verifyAuth }));
        vi.doMock('@/lib/rate-limit', () => ({
            RATE_LIMITS: {
                SOCIAL_THEMES_READ: themesReadLimit,
            },
        }));

        const route = await import('../../../app/api/social/themes/[id]/export/route');
        const req = new Request('http://localhost/api/social/themes/theme-1/export', { method: 'GET' });
        const res = await route.GET(req as any, { params: Promise.resolve({ id: 'theme-1' }) });
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.error).toBe('Unauthorized');
    });

    it('GET /api/share/theme/:slug returns 404 when theme does not exist', async () => {
        vi.resetModules();

        const shareThemeLimit = vi.fn().mockResolvedValue({ ok: true, remaining: 10, resetAtMs: Date.now() + 1000 });
        const select = vi.fn();

        vi.doMock('@/lib/rate-limit', () => ({
            RATE_LIMITS: {
                SHARE_THEME: shareThemeLimit,
            },
        }));
        vi.doMock('@/db', () => ({
            db: {
                select,
            },
        }));

        const chain = createSelectChain([]);
        select.mockReturnValue({ from: chain.from });

        const route = await import('../../../app/api/share/theme/[slug]/route');
        const req = new Request('http://localhost/api/share/theme/nord-iron', { method: 'GET' });
        const res = await route.GET(req as any, { params: Promise.resolve({ slug: 'nord-iron' }) });
        const body = await res.json();

        expect(res.status).toBe(404);
        expect(body.error).toBe('not_found');
    });

    it('GET /api/share/theme/:slug returns 429 on rate limit', async () => {
        vi.resetModules();

        const shareThemeLimit = vi.fn().mockResolvedValue({ ok: false, remaining: 0, resetAtMs: Date.now() + 5000 });

        vi.doMock('@/lib/rate-limit', () => ({
            RATE_LIMITS: {
                SHARE_THEME: shareThemeLimit,
            },
        }));

        const route = await import('../../../app/api/share/theme/[slug]/route');
        const req = new Request('http://localhost/api/share/theme/nord-iron', { method: 'GET' });
        const res = await route.GET(req as any, { params: Promise.resolve({ slug: 'nord-iron' }) });
        const body = await res.json();

        expect(res.status).toBe(429);
        expect(body.error).toBe('rate_limited');
    });

    it('GET /api/share/theme/:slug returns 200 with normalized payload when public theme exists', async () => {
        vi.resetModules();

        const shareThemeLimit = vi.fn().mockResolvedValue({ ok: true, remaining: 9, resetAtMs: Date.now() + 3000 });
        const select = vi.fn();

        vi.doMock('@/lib/rate-limit', () => ({
            RATE_LIMITS: {
                SHARE_THEME: shareThemeLimit,
            },
        }));
        vi.doMock('@/db', () => ({
            db: {
                select,
            },
        }));

        const packChain = createSelectChain([
            {
                id: 'theme_123',
                slug: 'nord-iron',
                name: 'Nord Iron',
                description: 'Tema de prueba',
                tags: ['nord'],
                supportsLight: true,
                supportsDark: true,
                currentVersion: 2,
            },
        ]);
        const versionChain = createSelectChain([
            {
                payload: {
                    schemaVersion: 1,
                    lightPatch: { primary: { DEFAULT: '#112233' } },
                    darkPatch: { primary: { DEFAULT: '#445566' } },
                },
            },
        ]);

        select
            .mockReturnValueOnce({ from: packChain.from })
            .mockReturnValueOnce({ from: versionChain.from });

        const route = await import('../../../app/api/share/theme/[slug]/route');
        const req = new Request('http://localhost/api/share/theme/nord-iron', { method: 'GET' });
        const res = await route.GET(req as any, { params: Promise.resolve({ slug: 'nord-iron' }) });
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toMatchObject({
            success: true,
            data: {
                id: 'theme_123',
                slug: 'nord-iron',
                supportsLight: true,
                supportsDark: true,
                version: 2,
            },
        });
        expect(body.data.payload.lightPatch.primary.DEFAULT).toBe('#112233');
    });
});
