import { writeAdminAuditLog } from '@/lib/admin-security';
import { createEndpointMetricRecorder } from '@/lib/endpoint-metrics';
import { applyThemeModerationAction, ThemeModerationAction } from '@/lib/theme-marketplace/admin-moderation';
import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveAdminApiContext } from '../_auth';

const bodySchema = z.object({
    message: z.string().trim().max(280).optional(),
});

export async function handleThemeModerationRequest(
    req: NextRequest,
    context: { params: Promise<{ id: string }> },
    action: ThemeModerationAction,
) {
    const recordMetric = createEndpointMetricRecorder(`admin.themes.${action}`);
    let auditUserId: string | null = null;
    let auditRole: 'viewer' | 'editor' | 'moderator' | 'superadmin' = 'viewer';
    let targetId: string | null = null;

    try {
        const adminResult = await resolveAdminApiContext(req, 'moderator');
        if (!adminResult.ok) {
            const status = adminResult.response.status;
            recordMetric({ outcome: 'error', statusCode: status, event: status === 429 ? 'rate_limited' : 'access_denied' });
            return adminResult.response;
        }

        auditUserId = adminResult.admin.userId;
        auditRole = adminResult.admin.role;

        const { id } = await context.params;
        targetId = id;

        const parsedBody = bodySchema.safeParse(await req.json().catch(() => ({})));
        if (!parsedBody.success) {
            recordMetric({ outcome: 'error', statusCode: 400, event: 'validation_error' });
            return NextResponse.json({ error: 'validation_error', details: parsedBody.error.flatten() }, { status: 400 });
        }

        const result = await applyThemeModerationAction({
            themePackId: id,
            action,
            moderationMessage: parsedBody.data.message,
        });

        revalidatePath('/admin');
        revalidatePath('/feed');

        await writeAdminAuditLog({
            adminUserId: adminResult.admin.userId,
            adminRole: adminResult.admin.role,
            action: `admin.api.themes.${action}`,
            status: 'success',
            targetType: 'theme_pack',
            targetId: id,
            metadata: {
                previousStatus: result.previousStatus,
                nextStatus: result.status,
                resolvedReports: result.resolvedReports,
            },
        });

        recordMetric({ outcome: 'success', statusCode: 200, event: action });
        return NextResponse.json({
            success: true,
            item: result,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to moderate theme pack';

        const status = message === 'THEME_PACK_NOT_FOUND' ? 404 : 500;

        if (auditUserId) {
            await writeAdminAuditLog({
                adminUserId: auditUserId,
                adminRole: auditRole,
                action: `admin.api.themes.${action}`,
                status: 'error',
                message,
                targetType: 'theme_pack',
                targetId,
            });
        }

        recordMetric({ outcome: 'error', statusCode: status, event: message === 'THEME_PACK_NOT_FOUND' ? 'not_found' : 'internal_error' });
        return NextResponse.json({ error: message === 'THEME_PACK_NOT_FOUND' ? 'not_found' : message }, { status });
    }
}
