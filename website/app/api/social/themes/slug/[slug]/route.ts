import { db } from '@/db';
import * as schema from '@/db/schema';
import { verifyAuth } from '@/lib/auth';
import { createEndpointMetricRecorder } from '@/lib/endpoint-metrics';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { canReadThemePack, mapThemePackSummary } from '@/lib/theme-marketplace/service';
import { and, eq, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ slug: string }> },
) {
    const recordMetric = createEndpointMetricRecorder('social.themes.detail_by_slug');
    try {
        const userId = await verifyAuth(req);
        if (!userId) {
            recordMetric({ outcome: 'error', statusCode: 401, event: 'unauthorized' });
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rateLimit = await RATE_LIMITS.SOCIAL_THEMES_READ(userId);
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

        const { slug } = await context.params;
        if (!slug?.trim()) {
            recordMetric({ outcome: 'error', statusCode: 400, event: 'invalid_slug' });
            return NextResponse.json({ error: 'validation_error', details: { slug: ['Slug is required'] } }, { status: 400 });
        }

        const [pack] = await db
            .select()
            .from(schema.themePacks)
            .where(and(eq(schema.themePacks.slug, slug.trim()), isNull(schema.themePacks.deletedAt)))
            .limit(1);

        if (!pack) {
            recordMetric({ outcome: 'error', statusCode: 404, event: 'not_found' });
            return NextResponse.json({ error: 'not_found' }, { status: 404 });
        }

        const canRead = await canReadThemePack(userId, pack);

        if (!canRead) {
            recordMetric({ outcome: 'error', statusCode: 403, event: 'forbidden' });
            return NextResponse.json({ error: 'forbidden' }, { status: 403 });
        }

        const [currentVersion] = await db
            .select()
            .from(schema.themePackVersions)
            .where(and(eq(schema.themePackVersions.themePackId, pack.id), eq(schema.themePackVersions.version, pack.currentVersion)))
            .limit(1);

        recordMetric({ outcome: 'success', statusCode: 200, event: 'read' });
        return NextResponse.json({
            item: {
                ...mapThemePackSummary(pack),
                payload: currentVersion?.payload ?? null,
                moderationMessage: pack.moderationMessage,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        recordMetric({ outcome: 'error', statusCode: 500, event: 'internal_error' });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
