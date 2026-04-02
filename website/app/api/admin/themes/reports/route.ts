import { db } from '@/db';
import * as schema from '@/db/schema';
import { writeAdminAuditLog } from '@/lib/admin-security';
import { createEndpointMetricRecorder } from '@/lib/endpoint-metrics';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveAdminApiContext } from '../_auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const querySchema = z.object({
    status: z.enum(['open', 'resolved', 'dismissed', 'all']).default('open'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export async function GET(req: NextRequest) {
    const recordMetric = createEndpointMetricRecorder('admin.themes.reports.list');
    let auditUserId: string | null = null;
    let auditRole: 'viewer' | 'editor' | 'moderator' | 'superadmin' = 'viewer';

    try {
        const adminResult = await resolveAdminApiContext(req, 'moderator');
        if (!adminResult.ok) {
            const status = adminResult.response.status;
            recordMetric({ outcome: 'error', statusCode: status, event: status === 429 ? 'rate_limited' : 'access_denied' });
            return adminResult.response;
        }

        auditUserId = adminResult.admin.userId;
        auditRole = adminResult.admin.role;

        const url = new URL(req.url);
        const parsed = querySchema.safeParse({
            status: url.searchParams.get('status') ?? 'open',
            page: url.searchParams.get('page') ?? '1',
            pageSize: url.searchParams.get('pageSize') ?? '25',
        });

        if (!parsed.success) {
            recordMetric({ outcome: 'error', statusCode: 400, event: 'validation_error' });
            return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 400 });
        }

        const reportStatuses = parsed.data.status === 'all'
            ? ['open', 'resolved', 'dismissed']
            : [parsed.data.status];

        const filters = [
            inArray(schema.themePackReports.status, reportStatuses),
            isNull(schema.themePacks.deletedAt),
        ];

        const [{ count }] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(schema.themePackReports)
            .innerJoin(schema.themePacks, eq(schema.themePacks.id, schema.themePackReports.themePackId))
            .where(and(...filters));

        const offset = (parsed.data.page - 1) * parsed.data.pageSize;

        const rows = await db
            .select({
                id: schema.themePackReports.id,
                themePackId: schema.themePackReports.themePackId,
                reporterUserId: schema.themePackReports.reporterUserId,
                reason: schema.themePackReports.reason,
                details: schema.themePackReports.details,
                status: schema.themePackReports.status,
                createdAt: schema.themePackReports.createdAt,
                updatedAt: schema.themePackReports.updatedAt,
                themeSlug: schema.themePacks.slug,
                themeName: schema.themePacks.name,
                themeStatus: schema.themePacks.status,
                ownerId: schema.themePacks.ownerId,
            })
            .from(schema.themePackReports)
            .innerJoin(schema.themePacks, eq(schema.themePacks.id, schema.themePackReports.themePackId))
            .where(and(...filters))
            .orderBy(desc(schema.themePackReports.createdAt))
            .limit(parsed.data.pageSize)
            .offset(offset);

        await writeAdminAuditLog({
            adminUserId: adminResult.admin.userId,
            adminRole: adminResult.admin.role,
            action: 'admin.api.themes.reports.list',
            status: 'success',
            metadata: {
                status: parsed.data.status,
                page: parsed.data.page,
                pageSize: parsed.data.pageSize,
                total: Number(count ?? 0),
            },
        });

        recordMetric({ outcome: 'success', statusCode: 200, event: 'listed' });
        return NextResponse.json({
            items: rows,
            page: parsed.data.page,
            pageSize: parsed.data.pageSize,
            total: Number(count ?? 0),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to read theme reports queue';

        if (auditUserId) {
            await writeAdminAuditLog({
                adminUserId: auditUserId,
                adminRole: auditRole,
                action: 'admin.api.themes.reports.list',
                status: 'error',
                message,
            });
        }

        recordMetric({ outcome: 'error', statusCode: 500, event: 'internal_error' });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
