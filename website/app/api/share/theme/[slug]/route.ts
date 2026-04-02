import { db } from '@/db';
import * as schema from '@/db/schema';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { and, eq, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

const getClientIp = (request: NextRequest): string => {
    const forwardedFor = request.headers.get('x-forwarded-for') ?? 'unknown';
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ slug: string }> },
) {
    try {
        const clientIp = getClientIp(req);
        const rateLimit = await RATE_LIMITS.SHARE_THEME(`anon:${clientIp}`);
        if (!rateLimit.ok) {
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
            return NextResponse.json({ error: 'validation_error', details: { slug: ['Slug is required'] } }, { status: 400 });
        }

        const [pack] = await db
            .select()
            .from(schema.themePacks)
            .where(
                and(
                    eq(schema.themePacks.slug, slug.trim()),
                    isNull(schema.themePacks.deletedAt),
                    eq(schema.themePacks.visibility, 'public'),
                    eq(schema.themePacks.status, 'approved'),
                ),
            )
            .limit(1);

        if (!pack) {
            return NextResponse.json({ error: 'not_found' }, { status: 404 });
        }

        const [currentVersion] = await db
            .select()
            .from(schema.themePackVersions)
            .where(and(eq(schema.themePackVersions.themePackId, pack.id), eq(schema.themePackVersions.version, pack.currentVersion)))
            .limit(1);

        if (!currentVersion?.payload) {
            return NextResponse.json({ error: 'not_found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: {
                id: pack.id,
                slug: pack.slug,
                name: pack.name,
                description: pack.description,
                tags: Array.isArray(pack.tags) ? pack.tags : [],
                supportsLight: pack.supportsLight,
                supportsDark: pack.supportsDark,
                version: pack.currentVersion,
                payload: currentVersion.payload,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
