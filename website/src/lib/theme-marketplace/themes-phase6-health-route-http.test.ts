import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('admin themes phase 6 health route HTTP behavior', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('GET /api/admin/themes-health returns 401 when unauthorized', async () => {
        vi.resetModules();

        const resolveAdminApiContext = vi.fn().mockResolvedValue({
            ok: false,
            response: new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'content-type': 'application/json' },
            }),
        });

        vi.doMock('../../../app/api/admin/themes/_auth', () => ({ resolveAdminApiContext }));

        const route = await import('../../../app/api/admin/themes-health/route');
        const req = new Request('http://localhost/api/admin/themes-health', { method: 'GET' });

        const res = await route.GET(req as any);
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.error).toBe('Unauthorized');
    });

    it('GET /api/admin/themes-health returns report on authorized request', async () => {
        vi.resetModules();

        const resolveAdminApiContext = vi.fn().mockResolvedValue({
            ok: true,
            admin: { userId: 'admin-1', role: 'moderator' },
        });

        const computeThemesApiSloStatus = vi.fn().mockReturnValue({
            generatedAt: new Date().toISOString(),
            thresholds: {
                maxErrorRate: 0.02,
                maxP95LatencyMs: 900,
                maxAvgLatencyMs: 450,
                minSamples: 20,
            },
            namespaces: {
                social: {
                    name: 'social',
                    totalRequests: 45,
                    successRate: 0.97,
                    errorRate: 0.01,
                    p95LatencyMs: 180,
                    avgLatencyMs: 120,
                    breachingEndpoints: [],
                    ok: true,
                },
                admin: {
                    name: 'admin',
                    totalRequests: 12,
                    successRate: 1,
                    errorRate: 0,
                    p95LatencyMs: 140,
                    avgLatencyMs: 90,
                    breachingEndpoints: [],
                    ok: true,
                },
            },
            ok: true,
            failures: [],
        });

        const writeAdminAuditLog = vi.fn().mockResolvedValue(undefined);

        vi.doMock('../../../app/api/admin/themes/_auth', () => ({ resolveAdminApiContext }));
        vi.doMock('@/lib/theme-marketplace/themes-api-slo', () => ({ computeThemesApiSloStatus }));
        vi.doMock('@/lib/admin-security', () => ({ writeAdminAuditLog }));

        const route = await import('../../../app/api/admin/themes-health/route');
        const req = new Request('http://localhost/api/admin/themes-health', { method: 'GET' });

        const res = await route.GET(req as any);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.report?.ok).toBe(true);
        expect(computeThemesApiSloStatus).toHaveBeenCalledTimes(1);
    });
});
