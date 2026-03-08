import { eq, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';
import { runDbTransaction } from '../../../../src/lib/db-transaction';
import { buildNotificationReactionId, parseNotificationReactPayload } from '../../../../src/lib/notifications-react';

export async function POST(request: NextRequest) {
    try {
        const userId = await verifyAuth(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const parsed = parseNotificationReactPayload(body);
        if (!parsed.ok) {
            return NextResponse.json({ error: parsed.error }, { status: 400 });
        }

        const notificationId = parsed.value.notificationId;
        const reactionId = buildNotificationReactionId(notificationId, userId);
        const now = new Date();

        let action: 'added' | 'removed' = 'added';

        await runDbTransaction(async (trx) => {
            const [existing] = await trx.select()
                .from(schema.notificationReactions)
                .where(eq(schema.notificationReactions.id, reactionId))
                .limit(1);

            if (existing && existing.deletedAt === null) {
                await trx.update(schema.notificationReactions)
                    .set({ deletedAt: now, updatedAt: now })
                    .where(eq(schema.notificationReactions.id, reactionId));

                await trx.update(schema.adminNotifications)
                    .set({
                        reactionCount: sql`GREATEST(0, ${schema.adminNotifications.reactionCount} - 1)`,
                        updatedAt: now,
                    })
                    .where(eq(schema.adminNotifications.id, notificationId));

                action = 'removed';
                return;
            }

            if (existing) {
                await trx.update(schema.notificationReactions)
                    .set({ deletedAt: null, updatedAt: now, type: 'kudos' })
                    .where(eq(schema.notificationReactions.id, reactionId));
            } else {
                await trx.insert(schema.notificationReactions)
                    .values({
                        id: reactionId,
                        notificationId,
                        userId,
                        type: 'kudos',
                        createdAt: now,
                        updatedAt: now,
                        deletedAt: null,
                    });
            }

            await trx.update(schema.adminNotifications)
                .set({
                    reactionCount: sql`${schema.adminNotifications.reactionCount} + 1`,
                    updatedAt: now,
                })
                .where(eq(schema.adminNotifications.id, notificationId));

            action = 'added';
        });

        // Fetch updated count
        const [notification] = await db.select({ count: schema.adminNotifications.reactionCount })
            .from(schema.adminNotifications)
            .where(eq(schema.adminNotifications.id, notificationId));

        return NextResponse.json({
            action,
            reactionCount: notification?.count || 0
        });

    } catch (error) {
        console.error('Error toggling notification reaction:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
