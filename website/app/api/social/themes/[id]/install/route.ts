import { db } from '@/db';
import * as schema from '@/db/schema';
import { verifyAuth } from '@/lib/auth';
import { createEndpointMetricRecorder } from '@/lib/endpoint-metrics';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { canReadThemePack, installThemePackSchema } from '@/lib/theme-marketplace/service';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    const recordMetric = createEndpointMetricRecorder('social.themes.install');
    try {
        const userId = await verifyAuth(req);
        if (!userId) {
            recordMetric({ outcome: 'error', statusCode: 401, event: 'unauthorized' });
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rateLimit = await RATE_LIMITS.SOCIAL_THEMES_INSTALL(userId);
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
        const parsed = installThemePackSchema.safeParse(body ?? {});
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

        const canInstall = await canReadThemePack(userId, pack);

        if (!canInstall) {
            recordMetric({ outcome: 'error', statusCode: 403, event: 'forbidden' });
            return NextResponse.json({ error: 'forbidden' }, { status: 403 });
        }

        const now = new Date();

        await db.transaction(async (tx: any) => {
            await tx
                .insert(schema.themePackInstalls)
                .values({
                    id: crypto.randomUUID(),
                    themePackId: id,
                    userId,
                    installedVersion: pack.currentVersion,
                    appliedLight: parsed.data.appliedLight,
                    appliedDark: parsed.data.appliedDark,
                    installedAt: now,
                    updatedAt: now,
                })
                .onConflictDoUpdate({
                    target: [schema.themePackInstalls.themePackId, schema.themePackInstalls.userId],
                    set: {
                        installedVersion: pack.currentVersion,
                        appliedLight: parsed.data.appliedLight,
                        appliedDark: parsed.data.appliedDark,
                        updatedAt: now,
                    },
                });

            await tx.update(schema.themePacks).set({
                downloadsCount: sql`${schema.themePacks.downloadsCount} + 1`,
                appliesCount: parsed.data.appliedLight || parsed.data.appliedDark
                    ? sql`${schema.themePacks.appliesCount} + 1`
                    : schema.themePacks.appliesCount,
                updatedAt: now,
            }).where(eq(schema.themePacks.id, id));
        });

        recordMetric({ outcome: 'success', statusCode: 200, event: 'installed' });
        return NextResponse.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        recordMetric({ outcome: 'error', statusCode: 500, event: 'internal_error' });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
