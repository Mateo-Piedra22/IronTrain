import { beforeEach, describe, expect, it, vi } from 'vitest';

async function setupThemesRouteHarness() {
    vi.resetModules();

    const verifyAuth = vi.fn();
    const themesReadLimit = vi.fn();
    const themesWriteLimit = vi.fn();
    const select = vi.fn();
    const transaction = vi.fn();

    vi.doMock('@/lib/auth', () => ({ verifyAuth }));
    vi.doMock('@/lib/rate-limit', () => ({
        RATE_LIMITS: {
            SOCIAL_THEMES_READ: themesReadLimit,
            SOCIAL_THEMES_WRITE: themesWriteLimit,
            SOCIAL_THEMES_INSTALL: themesWriteLimit,
        },
    }));
    vi.doMock('@/db', () => ({
        db: {
            select,
            transaction,
        },
    }));

    const route = await import('../../../app/api/social/themes/route');

    return {
        GET: route.GET,
        POST: route.POST,
        verifyAuth,
        themesReadLimit,
        themesWriteLimit,
        select,
        transaction,
    };
}

async function setupThemeVersionRouteHarness() {
    vi.resetModules();

    const verifyAuth = vi.fn();
    const themesWriteLimit = vi.fn();
    const select = vi.fn();
    const transaction = vi.fn();

    vi.doMock('@/lib/auth', () => ({ verifyAuth }));
    vi.doMock('@/lib/rate-limit', () => ({
        RATE_LIMITS: {
            SOCIAL_THEMES_WRITE: themesWriteLimit,
        },
    }));
    vi.doMock('@/db', () => ({
        db: {
            select,
            transaction,
        },
    }));

    const route = await import('../../../app/api/social/themes/[id]/version/route');

    return {
        POST: route.POST,
        verifyAuth,
        themesWriteLimit,
        select,
        transaction,
    };
}

async function setupThemeInstallRouteHarness() {
    vi.resetModules();

    const verifyAuth = vi.fn();
    const themesInstallLimit = vi.fn();
    const select = vi.fn();

    vi.doMock('@/lib/auth', () => ({ verifyAuth }));
    vi.doMock('@/lib/rate-limit', () => ({
        RATE_LIMITS: {
            SOCIAL_THEMES_INSTALL: themesInstallLimit,
        },
    }));
    vi.doMock('@/db', () => ({
        db: {
            select,
            transaction: vi.fn(),
        },
    }));

    const route = await import('../../../app/api/social/themes/[id]/install/route');

    return {
        POST: route.POST,
        verifyAuth,
        themesInstallLimit,
        select,
    };
}

function createSelectChain(limitRows: unknown[]) {
    const limit = vi.fn(async () => limitRows);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    return { from, where, limit };
}

describe('social themes routes HTTP behavior', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('GET /themes returns 401 when unauthorized', async () => {
        const harness = await setupThemesRouteHarness();
        harness.verifyAuth.mockResolvedValue(null);

        const req = new Request('http://localhost/api/social/themes', { method: 'GET' });
        const res = await harness.GET(req as any);
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.error).toBe('Unauthorized');
    });

    it('POST /themes returns 400 validation_error for invalid payload', async () => {
        const harness = await setupThemesRouteHarness();
        harness.verifyAuth.mockResolvedValue('user-1');
        harness.themesWriteLimit.mockResolvedValue({ ok: true, remaining: 5, resetAtMs: Date.now() + 1000 });

        const req = new Request('http://localhost/api/social/themes', {
            method: 'POST',
            body: JSON.stringify({ name: 'x' }),
        });

        const res = await harness.POST(req as any);
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toBe('validation_error');
    });

    it('POST /themes/:id/version returns 403 when user is not owner', async () => {
        const harness = await setupThemeVersionRouteHarness();
        harness.verifyAuth.mockResolvedValue('user-1');
        harness.themesWriteLimit.mockResolvedValue({ ok: true, remaining: 5, resetAtMs: Date.now() + 1000 });

        const selectChain = createSelectChain([
            {
                id: 'theme-1',
                ownerId: 'user-other',
                currentVersion: 1,
                deletedAt: null,
            },
        ]);

        harness.select.mockReturnValue({ from: selectChain.from });

        const req = new Request('http://localhost/api/social/themes/theme-1/version', {
            method: 'POST',
            body: JSON.stringify({
                payload: {
                    schemaVersion: 1,
                    base: { light: 'core-light', dark: 'core-dark' },
                },
            }),
        });

        const res = await harness.POST(req as any, { params: Promise.resolve({ id: 'theme-1' }) });
        const body = await res.json();

        expect(res.status).toBe(403);
        expect(body.error).toBe('forbidden');
    });

    it('POST /themes/:id/install returns 404 when theme does not exist', async () => {
        const harness = await setupThemeInstallRouteHarness();
        harness.verifyAuth.mockResolvedValue('user-1');
        harness.themesInstallLimit.mockResolvedValue({ ok: true, remaining: 5, resetAtMs: Date.now() + 1000 });

        const selectChain = createSelectChain([]);
        harness.select.mockReturnValue({ from: selectChain.from });

        const req = new Request('http://localhost/api/social/themes/theme-404/install', {
            method: 'POST',
            body: JSON.stringify({ appliedLight: true, appliedDark: false }),
        });

        const res = await harness.POST(req as any, { params: Promise.resolve({ id: 'theme-404' }) });
        const body = await res.json();

        expect(res.status).toBe(404);
        expect(body.error).toBe('not_found');
    });
});
