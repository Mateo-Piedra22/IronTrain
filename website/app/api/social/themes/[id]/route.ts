import { db } from '@/db';
import * as schema from '@/db/schema';
import { verifyAuth } from '@/lib/auth';
import { createEndpointMetricRecorder } from '@/lib/endpoint-metrics';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { canReadThemePack, mapThemePackSummary } from '@/lib/theme-marketplace/service';
import { and, eq, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const patchThemePackSchema = z.object({
    visibility: z.enum(['private', 'friends', 'public']).optional(),
    name: z.string().trim().min(3).max(80).optional(),
    description: z.string().trim().max(240).nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(24)).max(8).optional(),
});

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    const recordMetric = createEndpointMetricRecorder('social.themes.detail');
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

export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    const recordMetric = createEndpointMetricRecorder('social.themes.update');
    try {
        const userId = await verifyAuth(req);
        if (!userId) {
            recordMetric({ outcome: 'error', statusCode: 401, event: 'unauthorized' });
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rateLimit = await RATE_LIMITS.SOCIAL_THEMES_WRITE(userId);
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
        const parsed = patchThemePackSchema.safeParse(body ?? {});
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

        if (pack.ownerId !== userId) {
            recordMetric({ outcome: 'error', statusCode: 403, event: 'forbidden' });
            return NextResponse.json({ error: 'forbidden' }, { status: 403 });
        }

        const next = parsed.data;
        const now = new Date();
        const nextStatus = next.visibility === 'public'
            ? 'pending_review'
            : next.visibility === 'friends'
                ? 'approved'
                : 'draft';

        await db
            .update(schema.themePacks)
            .set({
                visibility: next.visibility ?? pack.visibility,
                name: next.name ?? pack.name,
                description: next.description === undefined ? pack.description : next.description,
                tags: next.tags ?? pack.tags,
                status: next.visibility ? nextStatus : pack.status,
                updatedAt: now,
            })
            .where(eq(schema.themePacks.id, id));

        const [updated] = await db
            .select()
            .from(schema.themePacks)
            .where(and(eq(schema.themePacks.id, id), isNull(schema.themePacks.deletedAt)))
            .limit(1);

        recordMetric({ outcome: 'success', statusCode: 200, event: 'updated' });
        return NextResponse.json({ item: updated ? mapThemePackSummary(updated) : null });
    } catch (error) {
        if (error instanceof z.ZodError) {
            recordMetric({ outcome: 'error', statusCode: 400, event: 'validation_error' });
            return NextResponse.json({ error: 'validation_error', details: error.flatten() }, { status: 400 });
        }
        const message = error instanceof Error ? error.message : 'Internal server error';
        recordMetric({ outcome: 'error', statusCode: 500, event: 'internal_error' });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
