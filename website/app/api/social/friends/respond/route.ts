import { and, eq, isNull, or } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../../src/db';
import * as schema from '../../../../../src/db/schema';
import { verifyAuth } from '../../../../../src/lib/auth';
import { recordEndpointMetric } from '../../../../../src/lib/endpoint-metrics';
import { logger } from '../../../../../src/lib/logger';
import { RATE_LIMITS } from '../../../../../src/lib/rate-limit';
import { formatActorName, getUserBrief, notifyUserById } from '../../../../../src/lib/social-notifications';

type FriendAction = 'accept' | 'reject' | 'block' | 'remove';
const VALID_ACTIONS: FriendAction[] = ['accept', 'reject', 'block', 'remove'];
const friendRespondSchema = z.object({
    requestId: z.string().trim().min(1).max(255),
    action: z.enum(VALID_ACTIONS),
});

export async function POST(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) {
            recordEndpointMetric({ endpoint: 'social.friends.respond', outcome: 'error', statusCode: 401, event: 'unauthorized' });
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rateLimit = await RATE_LIMITS.SOCIAL_FRIENDS_RESPOND(userId);
        if (!rateLimit.ok) {
            recordEndpointMetric({ endpoint: 'social.friends.respond', outcome: 'error', statusCode: 429, event: 'rate_limited' });
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
        const parsed = friendRespondSchema.safeParse(body);
        if (!parsed.success) {
            recordEndpointMetric({ endpoint: 'social.friends.respond', outcome: 'error', statusCode: 400, event: 'invalid_body' });
            return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
        }
        const { requestId, action } = parsed.data;

        const existing = await db.select().from(schema.friendships).where(eq(schema.friendships.id, requestId));
        if (existing.length === 0) {
            recordEndpointMetric({ endpoint: 'social.friends.respond', outcome: 'error', statusCode: 404, event: 'not_found' });
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        const rel = existing[0];

        const isUserA = rel.userId === userId;
        const isUserB = rel.friendId === userId;
        if (!isUserA && !isUserB) {
            recordEndpointMetric({ endpoint: 'social.friends.respond', outcome: 'error', statusCode: 403, event: 'unauthorized_relation' });
            return NextResponse.json({ error: 'Unauthorized relation' }, { status: 403 });
        }

        const now = new Date();

        if (action === 'accept') {
            // Only the receiver (UserB) can accept a pending request
            if (!isUserB || rel.status !== 'pending') {
                recordEndpointMetric({ endpoint: 'social.friends.respond', outcome: 'error', statusCode: 400, event: 'invalid_accept' });
                return NextResponse.json({ error: 'Cannot accept: not a pending request for you' }, { status: 400 });
            }
            const accepted = await db.update(schema.friendships)
                .set({ status: 'accepted', updatedAt: now })
                .where(and(
                    eq(schema.friendships.id, requestId),
                    eq(schema.friendships.friendId, userId),
                    eq(schema.friendships.status, 'pending'),
                    isNull(schema.friendships.deletedAt)
                ))
                .returning({ id: schema.friendships.id });

            if (accepted.length === 0) {
                logger.warnSampled('[Social/FriendRespond] Accept conflict', {
                    sampleRate: 0.25,
                    sampleKey: `${requestId}:accept`,
                    context: { userId, requestId, action },
                });
                recordEndpointMetric({ endpoint: 'social.friends.respond', outcome: 'conflict', statusCode: 409, event: 'accept_conflict' });
                return NextResponse.json({ error: 'Request was already processed' }, { status: 409 });
            }

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
                recordEndpointMetric({ endpoint: 'social.friends.respond', outcome: 'error', statusCode: 400, event: 'invalid_reject' });
                return NextResponse.json({ error: 'Cannot reject: relation is not pending' }, { status: 400 });
            }
            const canRejectPending = isUserB || isUserA;
            if (!canRejectPending) {
                recordEndpointMetric({ endpoint: 'social.friends.respond', outcome: 'error', statusCode: 400, event: 'unauthorized_reject' });
                return NextResponse.json({ error: 'Cannot reject: unauthorized pending relation' }, { status: 400 });
            }
            const rejected = await db.delete(schema.friendships)
                .where(and(
                    eq(schema.friendships.id, requestId),
                    eq(schema.friendships.status, 'pending'),
                    or(eq(schema.friendships.userId, userId), eq(schema.friendships.friendId, userId)),
                ))
                .returning({ id: schema.friendships.id });

            if (rejected.length === 0) {
                logger.warnSampled('[Social/FriendRespond] Reject conflict', {
                    sampleRate: 0.25,
                    sampleKey: `${requestId}:reject`,
                    context: { userId, requestId, action },
                });
                recordEndpointMetric({ endpoint: 'social.friends.respond', outcome: 'conflict', statusCode: 409, event: 'reject_conflict' });
                return NextResponse.json({ error: 'Request was already processed' }, { status: 409 });
            }

        } else if (action === 'remove') {
            // Either party can remove an accepted friendship
            if (rel.status !== 'accepted') {
                recordEndpointMetric({ endpoint: 'social.friends.respond', outcome: 'error', statusCode: 400, event: 'invalid_remove' });
                return NextResponse.json({ error: 'Cannot remove: not an accepted friendship' }, { status: 400 });
            }
            const removed = await db.delete(schema.friendships)
                .where(and(
                    eq(schema.friendships.id, requestId),
                    eq(schema.friendships.status, 'accepted'),
                    or(eq(schema.friendships.userId, userId), eq(schema.friendships.friendId, userId)),
                ))
                .returning({ id: schema.friendships.id });

            if (removed.length === 0) {
                logger.warnSampled('[Social/FriendRespond] Remove conflict', {
                    sampleRate: 0.25,
                    sampleKey: `${requestId}:remove`,
                    context: { userId, requestId, action },
                });
                recordEndpointMetric({ endpoint: 'social.friends.respond', outcome: 'conflict', statusCode: 409, event: 'remove_conflict' });
                return NextResponse.json({ error: 'Friendship was already removed' }, { status: 409 });
            }

        } else if (action === 'block') {
            // Normalize: the blocker becomes userId, the blocked becomes friendId
            const blocked = await db.update(schema.friendships)
                .set({
                    status: 'blocked',
                    userId: userId,
                    friendId: isUserA ? rel.friendId : rel.userId,
                    updatedAt: now,
                })
                .where(and(
                    eq(schema.friendships.id, requestId),
                    or(eq(schema.friendships.userId, userId), eq(schema.friendships.friendId, userId)),
                ))
                .returning({ id: schema.friendships.id });

            if (blocked.length === 0) {
                recordEndpointMetric({ endpoint: 'social.friends.respond', outcome: 'error', statusCode: 404, event: 'block_not_found' });
                return NextResponse.json({ error: 'Friendship relation not found' }, { status: 404 });
            }
        }

        recordEndpointMetric({ endpoint: 'social.friends.respond', outcome: 'success', statusCode: 200, event: action });
        return NextResponse.json({ success: true, message: 'Action executed successfully' });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        recordEndpointMetric({ endpoint: 'social.friends.respond', outcome: 'error', statusCode: 500, event: 'internal_error' });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
