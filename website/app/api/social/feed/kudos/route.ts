import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../../src/db';
import * as schema from '../../../../../src/db/schema';
import { verifyAuth } from '../../../../../src/lib/auth';
import { runDbTransaction } from '../../../../../src/lib/db-transaction';
import { RATE_LIMITS } from '../../../../../src/lib/rate-limit';
import { formatActorName, getUserBrief, notifyUserById } from '../../../../../src/lib/social-notifications';

const kudoPayloadSchema = z.object({
    feedId: z.string().trim().min(1).max(255),
});

export async function POST(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const rateLimit = await RATE_LIMITS.SOCIAL_FEED_KUDOS(userId);
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

        const body = await req.json().catch(() => null);
        const parsed = kudoPayloadSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
        }

        const normalizedFeedId = parsed.data.feedId;

        const feedItems = await db
            .select({
                id: schema.activityFeed.id,
                ownerId: schema.activityFeed.userId,
            })
            .from(schema.activityFeed)
            .where(
                and(
                    eq(schema.activityFeed.id, normalizedFeedId),
                    isNull(schema.activityFeed.deletedAt)
                )
            )
            .limit(1);

        if (feedItems.length === 0) {
            return NextResponse.json({ error: 'Feed item not found' }, { status: 404 });
        }

        const feedOwnerId = feedItems[0].ownerId;

        if (feedOwnerId !== userId) {
            const relations = await db
                .select({ id: schema.friendships.id })
                .from(schema.friendships)
                .where(
                    and(
                        eq(schema.friendships.status, 'accepted'),
                        isNull(schema.friendships.deletedAt),
                        or(
                            and(eq(schema.friendships.userId, userId), eq(schema.friendships.friendId, feedOwnerId)),
                            and(eq(schema.friendships.userId, feedOwnerId), eq(schema.friendships.friendId, userId))
                        )
                    )
                )
                .limit(1);

            if (relations.length === 0) {
                return NextResponse.json({ error: 'Not allowed to react to this feed item' }, { status: 403 });
            }
        }

        const kudoId = `${normalizedFeedId}:${userId}`;
        const now = new Date();
        let action: 'added' | 'removed' = 'added';

        await runDbTransaction(async (trx) => {
            const [row] = await trx
                .select()
                .from(schema.kudos)
                .where(eq(schema.kudos.id, kudoId))
                .limit(1);

            if (row && row.deletedAt === null) {
                await trx
                    .update(schema.kudos)
                    .set({ deletedAt: now, updatedAt: now })
                    .where(eq(schema.kudos.id, kudoId));
                await trx
                    .update(schema.activityFeed)
                    .set({
                        kudoCount: sql`GREATEST(0, ${schema.activityFeed.kudoCount} - 1)`,
                        updatedAt: now,
                    })
                    .where(eq(schema.activityFeed.id, normalizedFeedId));
                action = 'removed';
                return;
            }

            if (row) {
                await trx
                    .update(schema.kudos)
                    .set({ deletedAt: null, updatedAt: now })
                    .where(eq(schema.kudos.id, kudoId));
            } else {
                await trx.insert(schema.kudos).values({
                    id: kudoId,
                    feedId: normalizedFeedId,
                    giverId: userId,
                    createdAt: now,
                    updatedAt: now,
                });
            }

            await trx
                .update(schema.activityFeed)
                .set({
                    kudoCount: sql`${schema.activityFeed.kudoCount} + 1`,
                    updatedAt: now,
                })
                .where(eq(schema.activityFeed.id, normalizedFeedId));
            action = 'added';
        });

        if (action === 'added' && feedOwnerId !== userId) {
            const actor = await getUserBrief(userId);
            await notifyUserById(
                feedOwnerId,
                'Nuevo kudo en tu actividad',
                `${formatActorName(actor)} reaccionó a tu actividad.`,
                {
                    type: 'social_kudo',
                    actionUrl: 'irontrain://social',
                    feedId: normalizedFeedId,
                    fromUserId: userId,
                }
            );
        }

        return NextResponse.json({ success: true, action });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
