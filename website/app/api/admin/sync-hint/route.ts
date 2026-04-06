import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { writeAdminAuditLog } from '../../../../src/lib/admin-security';
import { sendPushNotification } from '../../../../src/lib/firebase-admin';
import { resolveAdminApiContext } from '../themes/_auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SyncHintPayload = {
    userId: string;
    reason?: string;
};

function parsePayload(raw: unknown): SyncHintPayload | null {
    if (!raw || typeof raw !== 'object') return null;

    const source = raw as Record<string, unknown>;

    const userIdRaw = source.userId;
    const userId = typeof userIdRaw === 'string'
        ? userIdRaw.trim()
        : '';

    const reasonRaw = source.reason;
    const reason = typeof reasonRaw === 'string' ? reasonRaw.trim().slice(0, 120) : undefined;

    if (!userId || userId.length > 128) return null;

    return {
        userId,
        reason,
    };
}

export async function POST(req: NextRequest) {
    let auditUserId: string | null = null;
    let auditRole: 'viewer' | 'editor' | 'moderator' | 'superadmin' = 'viewer';

    try {
        const adminResult = await resolveAdminApiContext(req, 'moderator');
        if (!adminResult.ok) {
            return adminResult.response;
        }

        auditUserId = adminResult.admin.userId;
        auditRole = adminResult.admin.role;

        let body: unknown;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const payload = parsePayload(body);
        if (!payload) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const [profile] = await db
            .select({
                pushToken: schema.userProfiles.pushToken,
            })
            .from(schema.userProfiles)
            .where(eq(schema.userProfiles.id, payload.userId))
            .limit(1);

        if (!profile?.pushToken) {
            await writeAdminAuditLog({
                adminUserId: auditUserId,
                adminRole: auditRole,
                action: 'admin.api.sync_hint.send',
                status: 'error',
                message: 'Target user has no push token',
                targetType: 'user',
                targetId: payload.userId,
                metadata: {
                    reason: payload.reason ?? null,
                },
            });

            return NextResponse.json({ error: 'Target user has no push token' }, { status: 404 });
        }

        const pushResult = await sendPushNotification(
            profile.pushToken,
            'IronTrain',
            'Hay cambios listos para sincronizar.',
            {
                sync_hint: '1',
                source: 'admin_internal',
                reason: payload.reason ?? 'manual',
            },
        );

        if (!pushResult.success) {
            await writeAdminAuditLog({
                adminUserId: auditUserId,
                adminRole: auditRole,
                action: 'admin.api.sync_hint.send',
                status: 'error',
                message: `Push dispatch failed: ${String(pushResult.reason ?? 'unknown')}`,
                targetType: 'user',
                targetId: payload.userId,
                metadata: {
                    reason: payload.reason ?? null,
                },
            });

            return NextResponse.json({ error: 'Failed to send sync hint' }, { status: 502 });
        }

        await writeAdminAuditLog({
            adminUserId: auditUserId,
            adminRole: auditRole,
            action: 'admin.api.sync_hint.send',
            status: 'success',
            targetType: 'user',
            targetId: payload.userId,
            metadata: {
                reason: payload.reason ?? null,
            },
        });

        return NextResponse.json({ success: true, userId: payload.userId });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to send sync hint';

        if (auditUserId) {
            await writeAdminAuditLog({
                adminUserId: auditUserId,
                adminRole: auditRole,
                action: 'admin.api.sync_hint.send',
                status: 'error',
                message,
            });
        }

        return NextResponse.json({ error: message }, { status: 500 });
    }
}
