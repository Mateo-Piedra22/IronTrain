import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('admin themes phase 5 routes HTTP behavior', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('GET /api/admin/themes returns 401 when unauthorized', async () => {
        vi.resetModules();

        const resolveAdminApiContext = vi.fn().mockResolvedValue({
            ok: false,
            response: new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'content-type': 'application/json' },
            }),
        });

        vi.doMock('../../../app/api/admin/themes/_auth', () => ({ resolveAdminApiContext }));

        const route = await import('../../../app/api/admin/themes/route');
        const req = new Request('http://localhost/api/admin/themes', { method: 'GET' });

        const res = await route.GET(req as any);
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.error).toBe('Unauthorized');
    });

    it('GET /api/admin/themes/reports returns 403 when role is insufficient', async () => {
        vi.resetModules();

        const resolveAdminApiContext = vi.fn().mockResolvedValue({
            ok: false,
            response: new Response(JSON.stringify({ error: 'Forbidden' }), {
                status: 403,
                headers: { 'content-type': 'application/json' },
            }),
        });

        vi.doMock('../../../app/api/admin/themes/_auth', () => ({ resolveAdminApiContext }));

        const route = await import('../../../app/api/admin/themes/reports/route');
        const req = new Request('http://localhost/api/admin/themes/reports', { method: 'GET' });

        const res = await route.GET(req as any);
        const body = await res.json();

        expect(res.status).toBe(403);
        expect(body.error).toBe('Forbidden');
    });

    it('POST /api/admin/themes/:id/reject returns 400 on invalid message payload', async () => {
        vi.resetModules();

        const resolveAdminApiContext = vi.fn().mockResolvedValue({
            ok: true,
            admin: { userId: 'admin-1', role: 'moderator' },
        });

        const applyThemeModerationAction = vi.fn();
        const writeAdminAuditLog = vi.fn().mockResolvedValue(undefined);

        vi.doMock('../../../app/api/admin/themes/_auth', () => ({ resolveAdminApiContext }));
        vi.doMock('@/lib/theme-marketplace/admin-moderation', () => ({ applyThemeModerationAction }));
        vi.doMock('@/lib/admin-security', () => ({ writeAdminAuditLog }));

        const route = await import('../../../app/api/admin/themes/[id]/reject/route');
        const req = new Request('http://localhost/api/admin/themes/theme-1/reject', {
            method: 'POST',
            body: JSON.stringify({ message: 999 }),
        });

        const res = await route.POST(req as any, { params: Promise.resolve({ id: 'theme-1' }) });
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toBe('validation_error');
        expect(applyThemeModerationAction).not.toHaveBeenCalled();
    });

    it('POST /api/admin/themes/:id/suspend returns 404 when theme pack is missing', async () => {
        vi.resetModules();

        const resolveAdminApiContext = vi.fn().mockResolvedValue({
            ok: true,
            admin: { userId: 'admin-1', role: 'moderator' },
        });

        const applyThemeModerationAction = vi.fn().mockRejectedValue(new Error('THEME_PACK_NOT_FOUND'));
        const writeAdminAuditLog = vi.fn().mockResolvedValue(undefined);

        vi.doMock('../../../app/api/admin/themes/_auth', () => ({ resolveAdminApiContext }));
        vi.doMock('@/lib/theme-marketplace/admin-moderation', () => ({ applyThemeModerationAction }));
        vi.doMock('@/lib/admin-security', () => ({ writeAdminAuditLog }));

        const route = await import('../../../app/api/admin/themes/[id]/suspend/route');
        const req = new Request('http://localhost/api/admin/themes/theme-404/suspend', {
            method: 'POST',
            body: JSON.stringify({ message: 'policy violation' }),
        });

        const res = await route.POST(req as any, { params: Promise.resolve({ id: 'theme-404' }) });
        const body = await res.json();

        expect(res.status).toBe(404);
        expect(body.error).toBe('not_found');
    });
});
