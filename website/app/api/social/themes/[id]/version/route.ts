import { db } from '@/db';
import * as schema from '@/db/schema';
import { verifyAuth } from '@/lib/auth';
import { createEndpointMetricRecorder } from '@/lib/endpoint-metrics';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { createThemeVersionSchema } from '@/lib/theme-marketplace/service';
import { and, eq, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    const recordMetric = createEndpointMetricRecorder('social.themes.version.create');
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
        const parsed = createThemeVersionSchema.safeParse(body ?? {});
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

        const now = new Date();
        const nextVersion = (pack.currentVersion ?? 0) + 1;

        await db.transaction(async (tx: any) => {
            await tx.insert(schema.themePackVersions).values({
                id: crypto.randomUUID(),
                themePackId: id,
                version: nextVersion,
                payload: parsed.data.payload,
                changelog: parsed.data.changelog ?? null,
                createdBy: userId,
                createdAt: now,
            });

            await tx.update(schema.themePacks).set({
                currentVersion: nextVersion,
                updatedAt: now,
            }).where(eq(schema.themePacks.id, id));
        });

        recordMetric({ outcome: 'success', statusCode: 200, event: 'version_created' });
        return NextResponse.json({ success: true, version: nextVersion });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        recordMetric({ outcome: 'error', statusCode: 500, event: 'internal_error' });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
