import { AdminRole, getAdminContext, hasAdminRole } from '@/lib/admin-security';
import { verifyAuth } from '@/lib/auth';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

function isAdminUser(userId: string): boolean {
    return ADMIN_USER_IDS.includes(userId);
}

async function resolveAdminUser(req: NextRequest): Promise<string | null> {
    try {
        const { auth } = await import('@/lib/auth/server');
        const { data } = await auth.getSession();
        const sessionUser = data?.user?.id ?? null;
        if (sessionUser) return sessionUser;
    } catch {
        // fallback to token auth
    }

    return verifyAuth(req);
}

export type AdminApiContext = {
    userId: string;
    role: AdminRole;
};

export async function resolveAdminApiContext(
    req: NextRequest,
    requiredRole: AdminRole,
): Promise<{ ok: true; admin: AdminApiContext } | { ok: false; response: NextResponse }> {
    const userId = await resolveAdminUser(req);
    if (!userId) {
        return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    if (!isAdminUser(userId)) {
        return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    const adminCtx = await getAdminContext();
    if (!adminCtx || adminCtx.userId !== userId || !hasAdminRole(adminCtx.role, requiredRole)) {
        return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    const rate = await RATE_LIMITS.ADMIN_ACTION(userId);
    if (!rate.ok) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: 'Too many admin requests. Please try again later.' },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(Math.ceil((rate.resetAtMs - Date.now()) / 1000)),
                    },
                },
            ),
        };
    }

    return { ok: true, admin: { userId: adminCtx.userId, role: adminCtx.role } };
}
