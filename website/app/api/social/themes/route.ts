import { db } from '@/db';
import * as schema from '@/db/schema';
import { verifyAuth } from '@/lib/auth';
import { createEndpointMetricRecorder } from '@/lib/endpoint-metrics';
import { RATE_LIMITS } from '@/lib/rate-limit';
import {
    buildThemeListFilters,
    createThemePackSchema,
    getAcceptedFriendIds,
    mapThemePackSummary,
    normalizeTags,
    parseThemeListQuery,
    resolveUniqueThemeSlug,
    slugifyThemeName,
} from '@/lib/theme-marketplace/service';
import { and, desc, eq, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function toThemeListOrder(sort: 'trending' | 'new' | 'top') {
    if (sort === 'new') return [desc(schema.themePacks.createdAt)];
    if (sort === 'top') return [desc(schema.themePacks.ratingAvg), desc(schema.themePacks.ratingCount), desc(schema.themePacks.updatedAt)];
    return [desc(schema.themePacks.appliesCount), desc(schema.themePacks.downloadsCount), desc(schema.themePacks.updatedAt)];
}

export async function GET(req: NextRequest) {
    const recordMetric = createEndpointMetricRecorder('social.themes.list');
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

        const query = parseThemeListQuery(new URL(req.url));
        const friendIds = query.scope === 'friends' ? await getAcceptedFriendIds(userId) : [];
        const filters = buildThemeListFilters(userId, query, friendIds);

        const [{ count }] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(schema.themePacks)
            .where(and(...filters));

        const offset = (query.page - 1) * query.pageSize;

        const itemsRows = await db
            .select()
            .from(schema.themePacks)
            .where(and(...filters))
            .orderBy(...toThemeListOrder(query.sort))
            .limit(query.pageSize)
            .offset(offset);

        recordMetric({ outcome: 'success', statusCode: 200, event: 'listed' });
        return NextResponse.json({
            items: itemsRows.map(mapThemePackSummary),
            page: query.page,
            pageSize: query.pageSize,
            total: count ?? 0,
        });
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

export async function POST(req: NextRequest) {
    const recordMetric = createEndpointMetricRecorder('social.themes.create');
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

        const body = await req.json().catch(() => null);
        const parsed = createThemePackSchema.safeParse(body ?? {});
        if (!parsed.success) {
            recordMetric({ outcome: 'error', statusCode: 400, event: 'validation_error' });
            return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 400 });
        }

        if (!parsed.data.supportsLight && !parsed.data.supportsDark) {
            recordMetric({ outcome: 'error', statusCode: 400, event: 'invalid_modes' });
            return NextResponse.json({ error: 'validation_error', details: { supports: ['At least one mode must be enabled'] } }, { status: 400 });
        }

        const now = new Date();
        const id = crypto.randomUUID();
        const versionId = crypto.randomUUID();
        const slugBase = slugifyThemeName(parsed.data.name);
        const slug = await resolveUniqueThemeSlug(slugBase);
        const tags = normalizeTags(parsed.data.tags ?? []);

        await db.transaction(async (tx: any) => {
            await tx.insert(schema.themePacks).values({
                id,
                ownerId: userId,
                slug,
                name: parsed.data.name,
                description: parsed.data.description ?? null,
                tags,
                supportsLight: parsed.data.supportsLight,
                supportsDark: parsed.data.supportsDark,
                visibility: parsed.data.visibility,
                status: 'draft',
                currentVersion: 1,
                createdAt: now,
                updatedAt: now,
            });

            await tx.insert(schema.themePackVersions).values({
                id: versionId,
                themePackId: id,
                version: 1,
                payload: parsed.data.payload,
                changelog: 'Initial version',
                createdBy: userId,
                createdAt: now,
            });
        });

        const [created] = await db
            .select()
            .from(schema.themePacks)
            .where(and(eq(schema.themePacks.id, id), eq(schema.themePacks.ownerId, userId)))
            .limit(1);

        recordMetric({ outcome: 'success', statusCode: 201, event: 'created' });
        return NextResponse.json({ item: created ? mapThemePackSummary(created) : null }, { status: 201 });
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
