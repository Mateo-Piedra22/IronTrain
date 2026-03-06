import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../src/db';
import * as schema from '../../../../../src/db/schema';
import { verifyAuth } from '../../../../../src/lib/auth';
import { formatActorName, getUserBrief, notifyUserById } from '../../../../../src/lib/social-notifications';

const MAX_PAYLOAD_SIZE = 1_000_000; // 1MB max payload

export async function POST(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { friendId, payload, type } = body;

        if (!friendId || typeof friendId !== 'string') {
            return NextResponse.json({ error: 'Invalid friendId' }, { status: 400 });
        }
        if (userId === friendId) {
            return NextResponse.json({ error: 'Cannot send to yourself' }, { status: 400 });
        }
        if (!payload || typeof payload !== 'object') {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }
        if (!type || typeof type !== 'string' || !['routine'].includes(type)) {
            return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
        }

        // Verify accepted friendship exists
        const existing = await db.select()
            .from(schema.friendships)
            .where(
                and(
                    or(
                        and(eq(schema.friendships.userId, userId), eq(schema.friendships.friendId, friendId)),
                        and(eq(schema.friendships.userId, friendId), eq(schema.friendships.friendId, userId))
                    ),
                    eq(schema.friendships.status, 'accepted'),
                    isNull(schema.friendships.deletedAt)
                )
            );

        if (existing.length === 0) {
            return NextResponse.json({ error: 'You must be friends to send routines' }, { status: 403 });
        }

        // Serialize and validate payload size
        const payloadStr = JSON.stringify(payload);
        if (payloadStr.length > MAX_PAYLOAD_SIZE) {
            return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
        }

        const newId = crypto.randomUUID();
        const activityId = crypto.randomUUID();
        const routineName =
            typeof (payload as { routine?: { name?: unknown } }).routine?.name === 'string'
                ? (payload as { routine: { name: string } }).routine.name.slice(0, 120)
                : null;

        await db.transaction(async (trx) => {
            await trx.insert(schema.sharesInbox).values({
                id: newId,
                senderId: userId,
                receiverId: friendId,
                payload: payloadStr,
                type: type,
                status: 'pending',
            });

            await trx.update(schema.userProfiles)
                .set({ shareStats: sql`COALESCE(${schema.userProfiles.shareStats}, 0) + 1` })
                .where(eq(schema.userProfiles.id, userId));

            await trx.insert(schema.activityFeed).values({
                id: activityId,
                userId,
                actionType: 'routine_shared',
                referenceId: newId,
                metadata: JSON.stringify({
                    inboxId: newId,
                    receiverId: friendId,
                    routineName,
                }),
            });
        });

        const actor = await getUserBrief(userId);
        await notifyUserById(
            friendId,
            'Nueva rutina compartida',
            `${formatActorName(actor)} te envió${routineName ? ` "${routineName}"` : ' una rutina'} en IronSocial.`,
            {
                type: 'social_routine_share',
                actionUrl: 'irontrain://social',
                inboxId: newId,
                fromUserId: userId,
            }
        );

        return NextResponse.json({ success: true, message: 'Sent to inbox' });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
