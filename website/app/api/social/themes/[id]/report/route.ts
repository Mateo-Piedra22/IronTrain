import { db } from '@/db';
import * as schema from '@/db/schema';
import { verifyAuth } from '@/lib/auth';
import { createEndpointMetricRecorder } from '@/lib/endpoint-metrics';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { canReadThemePack, createThemeReportSchema } from '@/lib/theme-marketplace/service';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const REPORT_DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    const recordMetric = createEndpointMetricRecorder('social.themes.report');
    try {
        const userId = await verifyAuth(req);
        if (!userId) {
            recordMetric({ outcome: 'error', statusCode: 401, event: 'unauthorized' });
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rateLimit = await RATE_LIMITS.SOCIAL_THEMES_INTERACT(userId);
        if (!rateLimit.ok) {
            recordMetric({ outcome: 'error', statusCode: 429, event: 'rate_limited' });
            return NextResponse.json(
                { error: 'rate_limited' },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(Math.ceil((rateLimit.resetAtMs - Date.now()) / 1000)),
                    },
                },
            );
        }

        const { id } = await context.params;
        const body = await req.json().catch(() => null);
        const parsed = createThemeReportSchema.safeParse(body ?? {});
        if (!parsed.success) {
            recordMetric({ outcome: 'error', statusCode: 400, event: 'validation_error' });
            return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 400 });
        }

        const [pack] = await db
            .select()
            .from(schema.themePacks)
            .where(and(eq(schema.themePacks.id, id), isNull(schema.themePacks.deletedAt)))
            .limit(1);

        if (!pack) {
            recordMetric({ outcome: 'error', statusCode: 404, event: 'not_found' });
            return NextResponse.json({ error: 'not_found' }, { status: 404 });
        }

        const canReport = await canReadThemePack(userId, pack);
        if (!canReport) {
            recordMetric({ outcome: 'error', statusCode: 403, event: 'forbidden' });
            return NextResponse.json({ error: 'forbidden' }, { status: 403 });
        }

        const now = new Date();
        const dedupThreshold = new Date(now.getTime() - REPORT_DEDUP_WINDOW_MS);

        const [recentReport] = await db
            .select({ id: schema.themePackReports.id })
            .from(schema.themePackReports)
            .where(
                and(
                    eq(schema.themePackReports.themePackId, id),
                    eq(schema.themePackReports.reporterUserId, userId),
                    eq(schema.themePackReports.reason, parsed.data.reason),
                    eq(schema.themePackReports.status, 'open'),
                    gt(schema.themePackReports.createdAt, dedupThreshold),
                ),
            )
            .limit(1);

        if (recentReport?.id) {
            recordMetric({ outcome: 'ignored', statusCode: 200, event: 'deduplicated' });
            return NextResponse.json({
                success: true,
                deduplicated: true,
                item: {
                    id: recentReport.id,
                    themePackId: id,
                    reason: parsed.data.reason,
                    status: 'open',
                },
            });
        }

        const reportId = crypto.randomUUID();

        await db.insert(schema.themePackReports).values({
            id: reportId,
            themePackId: id,
            reporterUserId: userId,
            reason: parsed.data.reason,
            details: parsed.data.details ?? null,
            status: 'open',
            createdAt: now,
            updatedAt: now,
        });

        recordMetric({ outcome: 'success', statusCode: 200, event: 'created' });
        return NextResponse.json({
            success: true,
            item: {
                id: reportId,
                themePackId: id,
                reason: parsed.data.reason,
                status: 'open',
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        recordMetric({ outcome: 'error', statusCode: 500, event: 'internal_error' });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
