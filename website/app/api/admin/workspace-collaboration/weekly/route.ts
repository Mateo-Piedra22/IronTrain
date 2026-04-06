import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminContext, hasAdminRole, writeAdminAuditLog } from '../../../../../src/lib/admin-security';
import { verifyAuth } from '../../../../../src/lib/auth';
import { auth } from '../../../../../src/lib/auth/server';
import { RATE_LIMITS } from '../../../../../src/lib/rate-limit';
import { getWorkspaceWeeklyDashboardSnapshot } from '../../../../../src/lib/workspace-weekly-metrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

const querySchema = z.object({
    days: z.coerce.number().int().min(1).max(35).optional(),
});

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

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAdminUser(userId)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

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

        const parsed = querySchema.safeParse({
            days: req.nextUrl.searchParams.get('days') ?? undefined,
        });

        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
        }

        const days = parsed.data.days ?? 7;
        const report = getWorkspaceWeeklyDashboardSnapshot(days);

        await writeAdminAuditLog({
            adminUserId: adminCtx.userId,
            adminRole: adminCtx.role,
            action: 'admin.api.workspace-collaboration.weekly.read',
            status: 'success',
            metadata: { days },
        });

        return NextResponse.json({ success: true, report });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to build workspace weekly dashboard';

        if (auditUserId) {
            await writeAdminAuditLog({
                adminUserId: auditUserId,
                adminRole: auditRole,
                action: 'admin.api.workspace-collaboration.weekly.read',
                status: 'error',
                message,
            });
        }

        return NextResponse.json({ error: message }, { status: 500 });
    }
}