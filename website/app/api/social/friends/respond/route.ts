import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../src/db';
import * as schema from '../../../../../src/db/schema';
import { verifyAuth } from '../../../../../src/lib/auth';
import { formatActorName, getUserBrief, notifyUserById } from '../../../../../src/lib/social-notifications';

type FriendAction = 'accept' | 'reject' | 'block' | 'remove';
const VALID_ACTIONS: FriendAction[] = ['accept', 'reject', 'block', 'remove'];

export async function POST(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { requestId, action } = body;

        if (!requestId || typeof requestId !== 'string') {
            return NextResponse.json({ error: 'Invalid requestId' }, { status: 400 });
        }
        if (!action || !VALID_ACTIONS.includes(action as FriendAction)) {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        const existing = await db.select().from(schema.friendships).where(eq(schema.friendships.id, requestId));
        if (existing.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const rel = existing[0];

        const isUserA = rel.userId === userId;
        const isUserB = rel.friendId === userId;
        if (!isUserA && !isUserB) return NextResponse.json({ error: 'Unauthorized relation' }, { status: 403 });

        const now = new Date();

        if (action === 'accept') {
            // Only the receiver (UserB) can accept a pending request
            if (!isUserB || rel.status !== 'pending') {
                return NextResponse.json({ error: 'Cannot accept: not a pending request for you' }, { status: 400 });
            }
            await db.update(schema.friendships)
                .set({ status: 'accepted', updatedAt: now })
                .where(eq(schema.friendships.id, requestId));

            const receiverId = userId;
            const requesterId = isUserA ? rel.friendId : rel.userId;
            const actor = await getUserBrief(receiverId);
            await notifyUserById(
                requesterId,
                'Solicitud aceptada',
                `${formatActorName(actor)} aceptó tu solicitud de amistad.`,
                {
                    type: 'social_friend_accept',
                    actionUrl: 'irontrain://social',
                    friendId: receiverId,
                }
            );

        } else if (action === 'reject') {
            if (rel.status !== 'pending') {
                return NextResponse.json({ error: 'Cannot reject: relation is not pending' }, { status: 400 });
            }
            const canRejectPending = isUserB || isUserA;
            if (!canRejectPending) {
                return NextResponse.json({ error: 'Cannot reject: unauthorized pending relation' }, { status: 400 });
            }
            await db.delete(schema.friendships).where(eq(schema.friendships.id, requestId));

        } else if (action === 'remove') {
            // Either party can remove an accepted friendship
            if (rel.status !== 'accepted') {
                return NextResponse.json({ error: 'Cannot remove: not an accepted friendship' }, { status: 400 });
            }
            await db.delete(schema.friendships).where(eq(schema.friendships.id, requestId));

        } else if (action === 'block') {
            // Normalize: the blocker becomes userId, the blocked becomes friendId
            await db.update(schema.friendships)
                .set({
                    status: 'blocked',
                    userId: userId,
                    friendId: isUserA ? rel.friendId : rel.userId,
                    updatedAt: now,
                })
                .where(eq(schema.friendships.id, requestId));
        }

        return NextResponse.json({ success: true, message: 'Action executed successfully' });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
