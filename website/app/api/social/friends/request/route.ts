import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../../src/db';
import * as schema from '../../../../../src/db/schema';
import { verifyAuth } from '../../../../../src/lib/auth';
import { recordEndpointMetric } from '../../../../../src/lib/endpoint-metrics';
import { logger } from '../../../../../src/lib/logger';
import { RATE_LIMITS } from '../../../../../src/lib/rate-limit';
import { formatActorName, getUserBrief, notifyUserById } from '../../../../../src/lib/social-notifications';
import { resolveFriendRequestConflict, resolveFriendRequestRaceStatus } from '../../../../../src/lib/social/friend-request-policy';
import { buildFriendshipId } from '../../../../../src/lib/social/friendship-id';

const friendRequestSchema = z.object({
    friendId: z.string().trim().min(1),
});

export async function POST(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) {
            recordEndpointMetric({ endpoint: 'social.friends.request', outcome: 'error', statusCode: 401, event: 'unauthorized' });
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rateLimit = await RATE_LIMITS.SOCIAL_FRIENDS_REQUEST(userId);
        if (!rateLimit.ok) {
            recordEndpointMetric({ endpoint: 'social.friends.request', outcome: 'error', statusCode: 429, event: 'rate_limited' });
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
        const parsed = friendRequestSchema.safeParse(body);
        if (!parsed.success) {
            recordEndpointMetric({ endpoint: 'social.friends.request', outcome: 'error', statusCode: 400, event: 'invalid_body' });
            return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
        }
        const friendId = parsed.data.friendId;

        if (friendId.length === 0) {
            recordEndpointMetric({ endpoint: 'social.friends.request', outcome: 'error', statusCode: 400, event: 'invalid_friend_id' });
            return NextResponse.json({ error: 'Invalid friend ID' }, { status: 400 });
        }

        if (userId === friendId) {
            recordEndpointMetric({ endpoint: 'social.friends.request', outcome: 'error', statusCode: 400, event: 'self_request' });
            return NextResponse.json({ error: 'Cannot add yourself' }, { status: 400 });
        }

        const relationshipId = buildFriendshipId(userId, friendId);

        // Verify target user exists
        const targetProfile = await db.select({ id: schema.userProfiles.id })
            .from(schema.userProfiles)
            .where(eq(schema.userProfiles.id, friendId));

        if (targetProfile.length === 0) {
            recordEndpointMetric({ endpoint: 'social.friends.request', outcome: 'error', statusCode: 404, event: 'target_not_found' });
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Deterministic relationship row avoids duplicate friendships under concurrent requests.
        const existing = await db.select()
            .from(schema.friendships)
            .where(eq(schema.friendships.id, relationshipId));

        if (existing.length > 0) {
            const rel = existing[0];
            const conflict = resolveFriendRequestConflict({ deletedAt: rel.deletedAt ?? null, status: rel.status });

            if (conflict.kind === 'revive_deleted') {
                await db.update(schema.friendships)
                    .set({
                        userId,
                        friendId,
                        status: 'pending',
                        deletedAt: null,
                        updatedAt: new Date(),
                    })
                    .where(eq(schema.friendships.id, relationshipId));

                const actor = await getUserBrief(userId);
                await notifyUserById(
                    friendId,
                    'Nueva solicitud de amistad',
                    `${formatActorName(actor)} quiere agregarte en IronSocial.`,
                    {
                        type: 'social_friend_request',
                        actionUrl: 'irontrain://social',
                        requestId: relationshipId,
                        fromUserId: userId,
                    }
                );

                recordEndpointMetric({ endpoint: 'social.friends.request', outcome: 'success', statusCode: 200, event: 'revived_deleted' });
                return NextResponse.json({ success: true, message: 'Request sent' });
            }

            logger.warnSampled('[Social/FriendRequest] Conflict on existing relationship', {
                sampleRate: 0.25,
                sampleKey: `${relationshipId}:${rel.status}`,
                context: {
                    userId,
                    friendId,
                    relationshipId,
                    status: rel.status,
                    conflictStatus: conflict.status,
                },
            });
            recordEndpointMetric({ endpoint: 'social.friends.request', outcome: 'conflict', statusCode: conflict.status, event: `existing_${rel.status}` });
            return NextResponse.json({ error: conflict.error }, { status: conflict.status });
        }

        const inserted = await db.insert(schema.friendships).values({
            id: relationshipId,
            userId: userId,
            friendId: friendId,
            status: 'pending',
        }).onConflictDoNothing().returning({ id: schema.friendships.id });

        if (inserted.length === 0) {
            const [raceRow] = await db.select().from(schema.friendships).where(eq(schema.friendships.id, relationshipId)).limit(1);
            const conflict = resolveFriendRequestRaceStatus(raceRow?.status);
            logger.warnSampled('[Social/FriendRequest] Race conflict on insert', {
                sampleRate: 0.25,
                sampleKey: `${relationshipId}:${raceRow?.status ?? 'unknown'}`,
                context: {
                    userId,
                    friendId,
                    relationshipId,
                    raceStatus: raceRow?.status,
                    conflictStatus: conflict.status,
                },
            });
            recordEndpointMetric({ endpoint: 'social.friends.request', outcome: 'conflict', statusCode: conflict.status, event: `race_${raceRow?.status ?? 'unknown'}` });
            return NextResponse.json({ error: conflict.error }, { status: conflict.status });
        }

        const actor = await getUserBrief(userId);
        await notifyUserById(
            friendId,
            'Nueva solicitud de amistad',
            `${formatActorName(actor)} quiere agregarte en IronSocial.`,
            {
                type: 'social_friend_request',
                actionUrl: 'irontrain://social',
                requestId: relationshipId,
                fromUserId: userId,
            }
        );

        recordEndpointMetric({ endpoint: 'social.friends.request', outcome: 'success', statusCode: 200, event: 'created' });
        return NextResponse.json({ success: true, message: 'Request sent' });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        recordEndpointMetric({ endpoint: 'social.friends.request', outcome: 'error', statusCode: 500, event: 'internal_error' });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
