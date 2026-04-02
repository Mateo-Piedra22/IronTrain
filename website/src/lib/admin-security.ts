import { randomUUID } from 'node:crypto';
import { db } from '../db';
import * as schema from '../db/schema';
import { RATE_LIMITS } from './rate-limit';

export type AdminRole = 'viewer' | 'editor' | 'moderator' | 'superadmin';

const parseEnvList = (value: string | undefined): string[] =>
    (value || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);

const SUPERADMIN_IDS = parseEnvList(process.env.ADMIN_SUPER_USER_IDS);
const MODERATOR_IDS = parseEnvList(process.env.ADMIN_MODERATOR_USER_IDS);
const EDITOR_IDS = parseEnvList(process.env.ADMIN_EDITOR_USER_IDS);
const LEGACY_ADMIN_IDS = parseEnvList(process.env.ADMIN_USER_IDS);

const ROLE_ORDER: Record<AdminRole, number> = {
    viewer: 0,
    editor: 1,
    moderator: 2,
    superadmin: 3,
};

const resolveAdminRole = (userId: string): AdminRole | null => {
    if (SUPERADMIN_IDS.includes(userId) || LEGACY_ADMIN_IDS.includes(userId)) return 'superadmin';
    if (MODERATOR_IDS.includes(userId)) return 'moderator';
    if (EDITOR_IDS.includes(userId)) return 'editor';
    return null;
};

export type AdminContext = {
    userId: string;
    role: AdminRole;
};

export async function getAdminContext(): Promise<AdminContext | null> {
    try {
        const { auth } = await import('./auth/server');
        const { data: session } = await auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return null;

        const role = resolveAdminRole(userId);
        if (!role) return null;

        return { userId, role };
    } catch {
        return null;
    }
}

export function hasAdminRole(current: AdminRole, required: AdminRole): boolean {
    return ROLE_ORDER[current] >= ROLE_ORDER[required];
}

export async function enforceAdminAction(params: {
    action: string;
    requiredRole?: AdminRole;
}): Promise<AdminContext> {
    const requiredRole = params.requiredRole ?? 'viewer';
    const admin = await getAdminContext();
    if (!admin) {
        throw new Error('UNAUTHORIZED_ADMIN_ACCESS');
    }
    if (!hasAdminRole(admin.role, requiredRole)) {
        throw new Error('FORBIDDEN_ADMIN_ROLE');
    }

    const rate = await RATE_LIMITS.ADMIN_ACTION(admin.userId);
    if (!rate.ok) {
        throw new Error('ADMIN_RATE_LIMITED');
    }

    return admin;
}

export async function writeAdminAuditLog(params: {
    adminUserId: string;
    adminRole: AdminRole;
    action: string;
    status: 'success' | 'error' | 'denied';
    message?: string;
    targetType?: string;
    targetId?: string | null;
    metadata?: Record<string, unknown>;
}): Promise<void> {
    try {
        await db.insert(schema.adminAuditLogs).values({
            id: randomUUID(),
            adminUserId: params.adminUserId,
            adminRole: params.adminRole,
            action: params.action,
            status: params.status,
            message: params.message ?? null,
            targetType: params.targetType ?? null,
            targetId: params.targetId ?? null,
            metadata: params.metadata ?? null,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const code = (error as { code?: string } | null | undefined)?.code;
        // 42P01 is the standard Postgres error code for "undefined_table"
        if (code === '42P01') {
            console.warn('[admin-security] admin_audit_logs table missing; skipping audit write');
            return;
        }
        throw error;
    }
}
