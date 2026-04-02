import { db } from '@/db';
import * as schema from '@/db/schema';
import { verifyAuth } from '@/lib/auth';
import { createEndpointMetricRecorder } from '@/lib/endpoint-metrics';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { canReadThemePack } from '@/lib/theme-marketplace/service';
import { and, eq, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    const recordMetric = createEndpointMetricRecorder('social.themes.export');
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

        const { id } = await context.params;

        const [pack] = await db
            .select()
            .from(schema.themePacks)
            .where(and(eq(schema.themePacks.id, id), isNull(schema.themePacks.deletedAt)))
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

        if (!currentVersion?.payload) {
            recordMetric({ outcome: 'error', statusCode: 404, event: 'version_not_found' });
            return NextResponse.json({ error: 'not_found' }, { status: 404 });
        }

        const exportPayload = {
            ...currentVersion.payload,
            meta: {
                ...(typeof currentVersion.payload === 'object' && currentVersion.payload && 'meta' in currentVersion.payload
                    ? ((currentVersion.payload as Record<string, unknown>).meta as Record<string, unknown> ?? {})
                    : {}),
                name: pack.name,
                description: pack.description,
                tags: Array.isArray(pack.tags) ? pack.tags : [],
                slug: pack.slug,
                exportedAt: new Date().toISOString(),
                version: pack.currentVersion,
            },
        };

        recordMetric({ outcome: 'success', statusCode: 200, event: 'exported' });
        return NextResponse.json(exportPayload, {
            headers: {
                'Content-Disposition': `attachment; filename="theme-${pack.slug}-v${pack.currentVersion}.json"`,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        recordMetric({ outcome: 'error', statusCode: 500, event: 'internal_error' });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
