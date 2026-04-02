import { writeAdminAuditLog } from '@/lib/admin-security';
import { createEndpointMetricRecorder } from '@/lib/endpoint-metrics';
import { computeThemesApiSloStatus } from '@/lib/theme-marketplace/themes-api-slo';
import { NextRequest, NextResponse } from 'next/server';
import { resolveAdminApiContext } from '../themes/_auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
    const recordMetric = createEndpointMetricRecorder('admin.themes.health.read');
    let auditUserId: string | null = null;
    let auditRole: 'viewer' | 'editor' | 'moderator' | 'superadmin' = 'viewer';

    try {
        const adminResult = await resolveAdminApiContext(req, 'viewer');
        if (!adminResult.ok) {
            const status = adminResult.response.status;
            recordMetric({ outcome: 'error', statusCode: status, event: status === 429 ? 'rate_limited' : 'access_denied' });
            return adminResult.response;
        }

        auditUserId = adminResult.admin.userId;
        auditRole = adminResult.admin.role;

        const sloStatus = computeThemesApiSloStatus();

        await writeAdminAuditLog({
            adminUserId: adminResult.admin.userId,
            adminRole: adminResult.admin.role,
            action: 'admin.api.themes.health.read',
            status: 'success',
            metadata: {
                ok: sloStatus.ok,
                failures: sloStatus.failures,
                socialRequests: sloStatus.namespaces.social.totalRequests,
                adminRequests: sloStatus.namespaces.admin.totalRequests,
            },
        });

        recordMetric({ outcome: 'success', statusCode: 200, event: sloStatus.ok ? 'healthy' : 'degraded' });
        return NextResponse.json({
            success: true,
            report: sloStatus,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to build themes SLO report';

        if (auditUserId) {
            await writeAdminAuditLog({
                adminUserId: auditUserId,
                adminRole: auditRole,
                action: 'admin.api.themes.health.read',
                status: 'error',
                message,
            });
        }

        recordMetric({ outcome: 'error', statusCode: 500, event: 'internal_error' });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
