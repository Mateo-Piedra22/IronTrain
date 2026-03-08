import { and, eq, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const userId = await verifyAuth(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { notificationId } = body;

        if (!notificationId) {
            return NextResponse.json({ error: 'Notification ID is required' }, { status: 400 });
        }

        // 1. Check if reaction exists
        const [existing] = await db.select()
            .from(schema.notificationReactions)
            .where(
                and(
                    eq(schema.notificationReactions.notificationId, notificationId),
                    eq(schema.notificationReactions.userId, userId)
                )
            );

        let action: 'added' | 'removed';

        if (existing) {
            // Already liked, remove it (toggle)
            await db.delete(schema.notificationReactions)
                .where(
                    and(
                        eq(schema.notificationReactions.notificationId, notificationId),
                        eq(schema.notificationReactions.userId, userId)
                    )
                );

            // Decrement counter
            await db.update(schema.adminNotifications)
                .set({
                    reactionCount: sql`${schema.adminNotifications.reactionCount} - 1`,
                    updatedAt: new Date()
                })
                .where(eq(schema.adminNotifications.id, notificationId));

            action = 'removed';
        } else {
            // Not liked, add it
            await db.insert(schema.notificationReactions).values({
                id: crypto.randomUUID(),
                notificationId,
                userId,
                type: 'kudos'
            });

            // Increment counter
            await db.update(schema.adminNotifications)
                .set({
                    reactionCount: sql`${schema.adminNotifications.reactionCount} + 1`,
                    updatedAt: new Date()
                })
                .where(eq(schema.adminNotifications.id, notificationId));

            action = 'added';
        }

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
