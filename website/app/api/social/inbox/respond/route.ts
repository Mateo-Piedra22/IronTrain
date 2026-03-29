import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../../src/db';
import * as schema from '../../../../../src/db/schema';
import { verifyAuth } from '../../../../../src/lib/auth';
import { recordEndpointMetric } from '../../../../../src/lib/endpoint-metrics';
import { logger } from '../../../../../src/lib/logger';
import { RATE_LIMITS } from '../../../../../src/lib/rate-limit';
import { formatActorName, getUserBrief, notifyUserById } from '../../../../../src/lib/social-notifications';

const inboxRespondSchema = z.object({
    inboxId: z.string().trim().min(1).max(255),
    action: z.enum(['accept', 'reject']),
});

export async function POST(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) {
            recordEndpointMetric({ endpoint: 'social.inbox.respond', outcome: 'error', statusCode: 401, event: 'unauthorized' });
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rateLimit = await RATE_LIMITS.SOCIAL_INBOX_RESPOND(userId);
        if (!rateLimit.ok) {
            recordEndpointMetric({ endpoint: 'social.inbox.respond', outcome: 'error', statusCode: 429, event: 'rate_limited' });
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
        const parsed = inboxRespondSchema.safeParse(body);
        if (!parsed.success) {
            recordEndpointMetric({ endpoint: 'social.inbox.respond', outcome: 'error', statusCode: 400, event: 'invalid_body' });
            return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
        }
        const { inboxId, action } = parsed.data;

        const existing = await db.select().from(schema.sharesInbox).where(eq(schema.sharesInbox.id, inboxId));
        if (existing.length === 0) {
            recordEndpointMetric({ endpoint: 'social.inbox.respond', outcome: 'error', statusCode: 404, event: 'not_found' });
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const item = existing[0];

        if (item.receiverId !== userId) {
            recordEndpointMetric({ endpoint: 'social.inbox.respond', outcome: 'error', statusCode: 403, event: 'unauthorized_relation' });
            return NextResponse.json({ error: 'Unauthorized relation' }, { status: 403 });
        }
        if (item.status !== 'pending') {
            recordEndpointMetric({ endpoint: 'social.inbox.respond', outcome: 'conflict', statusCode: 400, event: 'already_responded_precheck' });
            return NextResponse.json({ error: 'Item already responded to' }, { status: 400 });
        }

        const now = new Date();
        let applied = false;

        if (action === 'accept') {
            const updated = await db.update(schema.sharesInbox)
                .set({ status: 'accepted', updatedAt: now, seenAt: now })
                .where(and(
                    eq(schema.sharesInbox.id, inboxId),
                    eq(schema.sharesInbox.receiverId, userId),
                    eq(schema.sharesInbox.status, 'pending')
                ))
                .returning({ id: schema.sharesInbox.id });
            applied = updated.length > 0;
        } else {
            // Reject: set status, mark as seen and soft-delete
            const updated = await db.update(schema.sharesInbox)
                .set({ status: 'rejected', deletedAt: now, updatedAt: now, seenAt: now })
                .where(and(
                    eq(schema.sharesInbox.id, inboxId),
                    eq(schema.sharesInbox.receiverId, userId),
                    eq(schema.sharesInbox.status, 'pending')
                ))
                .returning({ id: schema.sharesInbox.id });
            applied = updated.length > 0;
        }

        if (!applied) {
            logger.warnSampled('[Social/InboxRespond] Conflict on pending transition', {
                sampleRate: 0.25,
                sampleKey: `${inboxId}:${action}`,
                context: { userId, inboxId, action },
            });
            recordEndpointMetric({ endpoint: 'social.inbox.respond', outcome: 'conflict', statusCode: 409, event: `${action}_conflict` });
            return NextResponse.json({ error: 'Item already responded to' }, { status: 409 });
        }

        const actor = await getUserBrief(userId);
        await notifyUserById(
            item.senderId,
            action === 'accept' ? 'Compartido aceptado' : 'Compartido rechazado',
            action === 'accept'
                ? `${formatActorName(actor)} aceptó la rutina que compartiste.`
                : `${formatActorName(actor)} rechazó la rutina que compartiste.`,
            {
                type: action === 'accept' ? 'social_share_accept' : 'social_share_reject',
                actionUrl: 'irontrain://social',
                inboxId,
                fromUserId: userId,
            }
        );

        recordEndpointMetric({ endpoint: 'social.inbox.respond', outcome: 'success', statusCode: 200, event: action });
        return NextResponse.json({ success: true, message: 'Action executed' });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        recordEndpointMetric({ endpoint: 'social.inbox.respond', outcome: 'error', statusCode: 500, event: 'internal_error' });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
