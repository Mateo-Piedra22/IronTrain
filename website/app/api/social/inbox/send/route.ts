import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../../src/db';
import * as schema from '../../../../../src/db/schema';
import { verifyAuth } from '../../../../../src/lib/auth';
import { runDbTransaction } from '../../../../../src/lib/db-transaction';
import { recordEndpointMetric } from '../../../../../src/lib/endpoint-metrics';
import { logger } from '../../../../../src/lib/logger';
import { RATE_LIMITS } from '../../../../../src/lib/rate-limit';
import { sharedRoutinePayloadSchema } from '../../../../../src/lib/shared-routine-payload';
import { formatActorName, getUserBrief, notifyUserById } from '../../../../../src/lib/social-notifications';

const MAX_PAYLOAD_SIZE = 1_000_000; // 1MB max payload

const inboxSendSchema = z.object({
    friendId: z.string().trim().min(1),
    type: z.literal('routine'),
    payload: z.unknown(),
});

export async function POST(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) {
            recordEndpointMetric({ endpoint: 'social.inbox.send', outcome: 'error', statusCode: 401, event: 'unauthorized' });
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rateLimit = await RATE_LIMITS.SOCIAL_INBOX_SEND(userId);
        if (!rateLimit.ok) {
            recordEndpointMetric({ endpoint: 'social.inbox.send', outcome: 'error', statusCode: 429, event: 'rate_limited' });
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
        const parsed = inboxSendSchema.safeParse(body);
        if (!parsed.success) {
            recordEndpointMetric({ endpoint: 'social.inbox.send', outcome: 'error', statusCode: 400, event: 'invalid_body' });
            return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
        }
        const { friendId, payload, type } = parsed.data;

        const parsedPayload = sharedRoutinePayloadSchema.safeParse(payload);
        if (!parsedPayload.success) {
            recordEndpointMetric({ endpoint: 'social.inbox.send', outcome: 'error', statusCode: 400, event: 'invalid_payload' });
            return NextResponse.json({ error: 'Invalid routine payload', details: parsedPayload.error.flatten() }, { status: 400 });
        }

        const safePayload = parsedPayload.data;

        if (userId === friendId) {
            recordEndpointMetric({ endpoint: 'social.inbox.send', outcome: 'error', statusCode: 400, event: 'self_target' });
            return NextResponse.json({ error: 'Cannot send to yourself' }, { status: 400 });
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
            recordEndpointMetric({ endpoint: 'social.inbox.send', outcome: 'error', statusCode: 403, event: 'friendship_required' });
            return NextResponse.json({ error: 'You must be friends to send routines' }, { status: 403 });
        }

        // Serialize and validate payload size
        const payloadStr = JSON.stringify(safePayload);
        if (payloadStr.length > MAX_PAYLOAD_SIZE) {
            recordEndpointMetric({ endpoint: 'social.inbox.send', outcome: 'error', statusCode: 413, event: 'payload_too_large' });
            return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
        }

        const dedupWindowMs = 60_000;
        const dedupThreshold = new Date(Date.now() - dedupWindowMs);
        const [recentDuplicate] = await db.select({ id: schema.sharesInbox.id })
            .from(schema.sharesInbox)
            .where(and(
                eq(schema.sharesInbox.senderId, userId),
                eq(schema.sharesInbox.receiverId, friendId),
                eq(schema.sharesInbox.type, type),
                eq(schema.sharesInbox.status, 'pending'),
                isNull(schema.sharesInbox.deletedAt),
                sql`${schema.sharesInbox.updatedAt} >= ${dedupThreshold}`,
                sql`${schema.sharesInbox.payload} = ${payloadStr}::jsonb`
            ))
            .limit(1);

        if (recentDuplicate?.id) {
            logger.infoSampled('[Social/InboxSend] Deduplicated repeated share', {
                sampleRate: 0.2,
                sampleKey: `${userId}:${friendId}:${type}`,
                context: {
                    userId,
                    friendId,
                    inboxId: recentDuplicate.id,
                    type,
                },
            });
            recordEndpointMetric({ endpoint: 'social.inbox.send', outcome: 'conflict', statusCode: 200, event: 'deduplicated' });
            return NextResponse.json({
                success: true,
                deduplicated: true,
                inboxId: recentDuplicate.id,
                message: 'Already sent recently',
            });
        }

        const newId = crypto.randomUUID();
        const activityId = crypto.randomUUID();
        const routineObject = safePayload.routine;
        const routineName =
            routineObject && typeof routineObject.name === 'string'
                ? routineObject.name.slice(0, 120)
                : null;

        await runDbTransaction(async (trx) => {
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

        recordEndpointMetric({ endpoint: 'social.inbox.send', outcome: 'success', statusCode: 200, event: 'created' });
        return NextResponse.json({ success: true, message: 'Sent to inbox' });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        recordEndpointMetric({ endpoint: 'social.inbox.send', outcome: 'error', statusCode: 500, event: 'internal_error' });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
