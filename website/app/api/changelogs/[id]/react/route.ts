import { and, count, eq, isNull, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../../src/db';
import * as schema from '../../../../../src/db/schema';
import { verifyAuth } from '../../../../../src/lib/auth';
import { runDbTransaction } from '../../../../../src/lib/db-transaction';
import { RATE_LIMITS } from '../../../../../src/lib/rate-limit';

const reactionPayloadSchema = z.object({
    type: z.string().trim().min(1).max(64).optional(),
});

const getClientIp = (request: NextRequest): string => {
    const forwardedFor = request.headers.get('x-forwarded-for') ?? 'unknown';
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const clientIp = getClientIp(request);
        const userId = await verifyAuth(request);

        const rateKey = userId ? userId : `anon:${clientIp}`;
        const rateLimit = await RATE_LIMITS.CHANGELOG_REACT(rateKey);
        if (!rateLimit.ok) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(Math.ceil((rateLimit.resetAtMs - Date.now()) / 1000)),
                    },
                }
            );
        }

        const [aggregate] = await db
            .select({
                total: count(),
                userReacted: userId
                    ? sql<boolean>`bool_or(${schema.changelogReactions.userId} = ${userId})`
                    : sql<boolean>`false`,
            })
            .from(schema.changelogReactions)
            .where(and(
                eq(schema.changelogReactions.changelogId, id),
                isNull(schema.changelogReactions.deletedAt)
            ));

        return NextResponse.json({
            total: Number(aggregate?.total || 0),
            userReacted: Boolean(aggregate?.userReacted),
        });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to fetch reactions' }, { status: 500 });
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authedUserId = await verifyAuth(request);
        if (!authedUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const rateLimit = await RATE_LIMITS.CHANGELOG_REACT(authedUserId);
        if (!rateLimit.ok) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(Math.ceil((rateLimit.resetAtMs - Date.now()) / 1000)),
                    },
                }
            );
        }

        const { id } = await params;
        const body = await request.json().catch(() => null);
        const parsed = reactionPayloadSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
        }

        const type = parsed.data.type ?? 'kudos';

        const reactionId = `${id}-${authedUserId}`;
        const now = new Date();
        let status: 'added' | 'removed' = 'added';

        await runDbTransaction(async (trx) => {
            const [existing] = await trx.select()
                .from(schema.changelogReactions)
                .where(eq(schema.changelogReactions.id, reactionId))
                .limit(1);

            if (existing && existing.deletedAt === null) {
                await trx.update(schema.changelogReactions)
                    .set({ deletedAt: now, updatedAt: now })
                    .where(eq(schema.changelogReactions.id, reactionId));
                await trx.update(schema.changelogs)
                    .set({
                        reactionCount: sql`GREATEST(0, ${schema.changelogs.reactionCount} - 1)`,
                        updatedAt: now,
                    })
                    .where(eq(schema.changelogs.id, id));
                status = 'removed';
                return;
            }

            if (existing) {
                await trx.update(schema.changelogReactions)
                    .set({ type, deletedAt: null, updatedAt: now })
                    .where(eq(schema.changelogReactions.id, reactionId));
            } else {
                await trx.insert(schema.changelogReactions)
                    .values({
                        id: reactionId,
                        changelogId: id,
                        userId: authedUserId,
                        type,
                        createdAt: now,
                        updatedAt: now,
                    });
            }

            await trx.update(schema.changelogs)
                .set({
                    reactionCount: sql`${schema.changelogs.reactionCount} + 1`,
                    updatedAt: now,
                })
                .where(eq(schema.changelogs.id, id));
            status = 'added';
        });

        return NextResponse.json({ status });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to react';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
