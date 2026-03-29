import { NextRequest, NextResponse } from 'next/server';

import { getAdminContext, hasAdminRole, writeAdminAuditLog } from '../../../../src/lib/admin-security';
import { verifyAuth } from '../../../../src/lib/auth';
import { auth } from '../../../../src/lib/auth/server';
import { RATE_LIMITS } from '../../../../src/lib/rate-limit';
import { runSocialIntegrityAudit } from '../../../../src/lib/social-integrity';

export const runtime = 'nodejs';

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

function isAdminUser(userId: string): boolean {
    return ADMIN_USER_IDS.includes(userId);
}

function parseBooleanFlag(value: string | null): boolean {
    if (!value) return false;
    return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
}

function parseUsersCsv(value: string | null): string[] {
    if (!value) return [];
    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 500);
}

async function resolveAdminUser(req: NextRequest): Promise<string | null> {
    try {
        const { data } = await auth.getSession();
        const sessionUser = data?.user?.id ?? null;
        if (sessionUser) return sessionUser;
    } catch {
        // Fall through to token auth
    }

    return verifyAuth(req);
}

export async function GET(req: NextRequest) {
    let auditUserId: string | null = null;
    let auditRole: 'viewer' | 'editor' | 'moderator' | 'superadmin' = 'viewer';

    try {
        const userId = await resolveAdminUser(req);
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

        const { searchParams } = new URL(req.url);
        const limit = Number(searchParams.get('limit') || 200);
        const userIds = parseUsersCsv(searchParams.get('users'));

        auditUserId = adminCtx.userId;
        auditRole = adminCtx.role;

        const report = await runSocialIntegrityAudit({
            limit,
            userIds,
            reconcile: false,
        });

        await writeAdminAuditLog({
            adminUserId: adminCtx.userId,
            adminRole: adminCtx.role,
            action: 'admin.api.social-integrity.audit',
            status: 'success',
            metadata: {
                mode: report.mode,
                scannedUsers: report.summary.scannedUsers,
                scoreDriftUsers: report.summary.scoreDriftUsers,
            },
        });

        return NextResponse.json({ success: true, report });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to run social integrity audit';

        if (auditUserId) {
            await writeAdminAuditLog({
                adminUserId: auditUserId,
                adminRole: auditRole,
                action: 'admin.api.social-integrity.audit',
                status: 'error',
                message,
            });
        }

        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    let auditUserId: string | null = null;
    let auditRole: 'viewer' | 'editor' | 'moderator' | 'superadmin' = 'viewer';

    try {
        const userId = await resolveAdminUser(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!isAdminUser(userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const adminCtx = await getAdminContext();
        if (!adminCtx || adminCtx.userId !== userId || !hasAdminRole(adminCtx.role, 'editor')) {
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

        const body = await req.json().catch(() => ({}));
        const limit = Number(body?.limit || 200);
        const userIds = Array.isArray(body?.userIds)
            ? body.userIds.filter((value: unknown) => typeof value === 'string').slice(0, 500)
            : parseUsersCsv(typeof body?.users === 'string' ? body.users : null);

        const reconcile = parseBooleanFlag(typeof body?.reconcile === 'string' ? body.reconcile : (body?.reconcile ? 'true' : 'false'));
        if (!reconcile) {
            return NextResponse.json({ error: 'Set reconcile=true to run a write reconciliation pass.' }, { status: 400 });
        }

        auditUserId = adminCtx.userId;
        auditRole = adminCtx.role;

        const report = await runSocialIntegrityAudit({
            limit,
            userIds,
            reconcile: true,
        });

        await writeAdminAuditLog({
            adminUserId: adminCtx.userId,
            adminRole: adminCtx.role,
            action: 'admin.api.social-integrity.reconcile',
            status: 'success',
            metadata: {
                mode: report.mode,
                scannedUsers: report.summary.scannedUsers,
                reconciledUsers: report.summary.reconciledUsers,
            },
        });

        return NextResponse.json({ success: true, report });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to run social integrity reconciliation';

        if (auditUserId) {
            await writeAdminAuditLog({
                adminUserId: auditUserId,
                adminRole: auditRole,
                action: 'admin.api.social-integrity.reconcile',
                status: 'error',
                message,
            });
        }

        return NextResponse.json({ error: message }, { status: 500 });
    }
}
