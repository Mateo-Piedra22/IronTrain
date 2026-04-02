import { beforeEach, describe, expect, it, vi } from 'vitest';

function createSelectChain(limitRows: unknown[]) {
    const limit = vi.fn(async () => limitRows);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    return { from, where, limit };
}

describe('social themes phase 4 routes HTTP behavior', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('POST /themes/:id/rate returns 401 when unauthorized', async () => {
        vi.resetModules();

        const verifyAuth = vi.fn().mockResolvedValue(null);
        const interactLimit = vi.fn();

        vi.doMock('@/lib/auth', () => ({ verifyAuth }));
        vi.doMock('@/lib/rate-limit', () => ({
            RATE_LIMITS: {
                SOCIAL_THEMES_INTERACT: interactLimit,
            },
        }));

        const route = await import('../../../app/api/social/themes/[id]/rate/route');
        const req = new Request('http://localhost/api/social/themes/theme-1/rate', {
            method: 'POST',
            body: JSON.stringify({ rating: 5 }),
        });

        const res = await route.POST(req as any, { params: Promise.resolve({ id: 'theme-1' }) });
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.error).toBe('Unauthorized');
    });

    it('POST /themes/:id/rate returns 400 validation_error for invalid rating', async () => {
        vi.resetModules();

        const verifyAuth = vi.fn().mockResolvedValue('user-1');
        const interactLimit = vi.fn().mockResolvedValue({ ok: true, remaining: 5, resetAtMs: Date.now() + 1000 });

        vi.doMock('@/lib/auth', () => ({ verifyAuth }));
        vi.doMock('@/lib/rate-limit', () => ({
            RATE_LIMITS: {
                SOCIAL_THEMES_INTERACT: interactLimit,
            },
        }));

        const route = await import('../../../app/api/social/themes/[id]/rate/route');
        const req = new Request('http://localhost/api/social/themes/theme-1/rate', {
            method: 'POST',
            body: JSON.stringify({ rating: 7 }),
        });

        const res = await route.POST(req as any, { params: Promise.resolve({ id: 'theme-1' }) });
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toBe('validation_error');
    });

    it('POST /themes/:id/feedback returns 403 when theme is private and requester is not owner', async () => {
        vi.resetModules();

        const verifyAuth = vi.fn().mockResolvedValue('user-1');
        const interactLimit = vi.fn().mockResolvedValue({ ok: true, remaining: 5, resetAtMs: Date.now() + 1000 });
        const select = vi.fn();

        vi.doMock('@/lib/auth', () => ({ verifyAuth }));
        vi.doMock('@/lib/rate-limit', () => ({
            RATE_LIMITS: {
                SOCIAL_THEMES_INTERACT: interactLimit,
            },
        }));
        vi.doMock('@/db', () => ({
            db: {
                select,
            },
        }));

        const selectChain = createSelectChain([
            {
                id: 'theme-1',
                ownerId: 'owner-9',
                visibility: 'private',
                status: 'draft',
                deletedAt: null,
            },
        ]);

        select.mockReturnValue({ from: selectChain.from });

        const route = await import('../../../app/api/social/themes/[id]/feedback/route');
        const req = new Request('http://localhost/api/social/themes/theme-1/feedback', {
            method: 'POST',
            body: JSON.stringify({ kind: 'issue', message: 'Texto de feedback válido' }),
        });

        const res = await route.POST(req as any, { params: Promise.resolve({ id: 'theme-1' }) });
        const body = await res.json();

        expect(res.status).toBe(403);
        expect(body.error).toBe('forbidden');
    });

    it('POST /themes/:id/report returns 400 validation_error for invalid reason', async () => {
        vi.resetModules();

        const verifyAuth = vi.fn().mockResolvedValue('user-1');
        const interactLimit = vi.fn().mockResolvedValue({ ok: true, remaining: 5, resetAtMs: Date.now() + 1000 });

        vi.doMock('@/lib/auth', () => ({ verifyAuth }));
        vi.doMock('@/lib/rate-limit', () => ({
            RATE_LIMITS: {
                SOCIAL_THEMES_INTERACT: interactLimit,
            },
        }));

        const route = await import('../../../app/api/social/themes/[id]/report/route');
        const req = new Request('http://localhost/api/social/themes/theme-1/report', {
            method: 'POST',
            body: JSON.stringify({ reason: 'invalid_reason', details: 'x' }),
        });

        const res = await route.POST(req as any, { params: Promise.resolve({ id: 'theme-1' }) });
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toBe('validation_error');
    });
});
