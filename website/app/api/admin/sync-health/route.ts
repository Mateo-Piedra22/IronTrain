import { NextRequest, NextResponse } from 'next/server';
import { getAdminContext, hasAdminRole, writeAdminAuditLog } from '../../../../src/lib/admin-security';
import { verifyAuth } from '../../../../src/lib/auth';
import { auth } from '../../../../src/lib/auth/server';
import { RATE_LIMITS } from '../../../../src/lib/rate-limit';
import { getSyncHealthReport } from '../../../../src/lib/sync-health';

export const runtime = 'nodejs';

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

function isAdminUser(userId: string): boolean {
    return ADMIN_USER_IDS.includes(userId);
}

export async function GET(req: NextRequest) {
    let auditUserId: string | null = null;
    let auditRole: 'viewer' | 'editor' | 'moderator' | 'superadmin' = 'viewer';
    try {
        let userId: string | null = null;
        try {
            const { data } = await auth.getSession();
            userId = data?.user?.id ?? null;
        } catch {
            userId = null;
        }

        if (!userId) {
            userId = await verifyAuth(req);
        }

        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!isAdminUser(userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const adminCtx = await getAdminContext();
        if (!adminCtx || adminCtx.userId !== userId || !hasAdminRole(adminCtx.role, 'viewer')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const rate = await RATE_LIMITS.ADMIN_ACTION(userId);
        if (!rate.ok) {
            return NextResponse.json(
                { error: 'Too many admin requests. Please try again later.' },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(Math.ceil((rate.resetAtMs - Date.now()) / 1000)),
                    },
                }
            );
        }

        auditUserId = adminCtx.userId;
        auditRole = adminCtx.role;

        const report = await getSyncHealthReport();

        await writeAdminAuditLog({
            adminUserId: adminCtx.userId,
            adminRole: adminCtx.role,
            action: 'admin.api.sync-health.read',
            status: 'success',
            metadata: { hasReport: !!report },
        });

        return NextResponse.json({ success: true, report });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to build sync health report';

        if (auditUserId) {
            await writeAdminAuditLog({
                adminUserId: auditUserId,
                adminRole: auditRole,
                action: 'admin.api.sync-health.read',
                status: 'error',
                message,
            });
        }

        return NextResponse.json({ error: message }, { status: 500 });
    }
}
