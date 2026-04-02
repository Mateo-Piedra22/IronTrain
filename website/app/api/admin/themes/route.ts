import { db } from '@/db';
import * as schema from '@/db/schema';
import { writeAdminAuditLog } from '@/lib/admin-security';
import { createEndpointMetricRecorder } from '@/lib/endpoint-metrics';
import { and, desc, eq, ilike, inArray, isNull, or, sql, SQL } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveAdminApiContext } from './_auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const querySchema = z.object({
    status: z
        .enum(['pending_review', 'approved', 'rejected', 'suspended', 'draft', 'all'])
        .default('pending_review'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    q: z.string().trim().max(80).optional(),
});

export async function GET(req: NextRequest) {
    const recordMetric = createEndpointMetricRecorder('admin.themes.list');
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
            status: url.searchParams.get('status') ?? 'pending_review',
            page: url.searchParams.get('page') ?? '1',
            pageSize: url.searchParams.get('pageSize') ?? '25',
            q: url.searchParams.get('q') ?? undefined,
        });

        if (!parsed.success) {
            recordMetric({ outcome: 'error', statusCode: 400, event: 'validation_error' });
            return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 400 });
        }

        const filters: SQL<unknown>[] = [isNull(schema.themePacks.deletedAt)];

        if (parsed.data.status !== 'all') {
            filters.push(eq(schema.themePacks.status, parsed.data.status));
        } else {
            filters.push(inArray(schema.themePacks.status, ['pending_review', 'approved', 'rejected', 'suspended', 'draft']));
        }

        if (parsed.data.q) {
            const pattern = `%${parsed.data.q}%`;
            filters.push(
                or(
                    ilike(schema.themePacks.name, pattern),
                    ilike(schema.themePacks.slug, pattern),
                    ilike(sql`coalesce(${schema.userProfiles.username}, '')`, pattern),
                ) as SQL<unknown>,
            );
        }

        const [{ count }] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(schema.themePacks)
            .leftJoin(schema.userProfiles, eq(schema.userProfiles.id, schema.themePacks.ownerId))
            .where(and(...filters));

        const offset = (parsed.data.page - 1) * parsed.data.pageSize;

        const rows = await db
            .select({
                id: schema.themePacks.id,
                slug: schema.themePacks.slug,
                ownerId: schema.themePacks.ownerId,
                ownerUsername: schema.userProfiles.username,
                name: schema.themePacks.name,
                visibility: schema.themePacks.visibility,
                status: schema.themePacks.status,
                moderationMessage: schema.themePacks.moderationMessage,
                downloadsCount: schema.themePacks.downloadsCount,
                appliesCount: schema.themePacks.appliesCount,
                ratingAvg: schema.themePacks.ratingAvg,
                ratingCount: schema.themePacks.ratingCount,
                createdAt: schema.themePacks.createdAt,
                updatedAt: schema.themePacks.updatedAt,
            })
            .from(schema.themePacks)
            .leftJoin(schema.userProfiles, eq(schema.userProfiles.id, schema.themePacks.ownerId))
            .where(and(...filters))
            .orderBy(desc(schema.themePacks.updatedAt))
            .limit(parsed.data.pageSize)
            .offset(offset);

        await writeAdminAuditLog({
            adminUserId: adminResult.admin.userId,
            adminRole: adminResult.admin.role,
            action: 'admin.api.themes.list',
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
        const message = error instanceof Error ? error.message : 'Failed to read themes moderation queue';

        if (auditUserId) {
            await writeAdminAuditLog({
                adminUserId: auditUserId,
                adminRole: auditRole,
                action: 'admin.api.themes.list',
                status: 'error',
                message,
            });
        }

        recordMetric({ outcome: 'error', statusCode: 500, event: 'internal_error' });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
