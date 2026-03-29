import { and, eq, inArray } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../../src/db';
import * as schema from '../../../../../src/db/schema';
import { verifyAuth } from '../../../../../src/lib/auth';
import { RATE_LIMITS } from '../../../../../src/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const batchSeenItemSchema = z.object({
    id: z.string().trim().min(1).max(255),
    feedType: z.enum(['direct_share', 'activity_log']),
});

const batchSeenPayloadSchema = z.object({
    items: z.array(batchSeenItemSchema).min(1).max(100),
});

export async function POST(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Rate limiting
        const rateLimit = await RATE_LIMITS.SOCIAL_INBOX_BATCH_SEEN(userId);
        if (!rateLimit.ok) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                { 
                    status: 429,
                    headers: { 
                        'Retry-After': String(Math.ceil((rateLimit.resetAtMs - Date.now()) / 1000)),
                        'X-RateLimit-Remaining': String(rateLimit.remaining),
                        'X-RateLimit-Reset': String(rateLimit.resetAtMs),
                    }
                }
            );
        }

        const body = await req.json().catch(() => null);
        const parsed = batchSeenPayloadSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
        }

        const capped = parsed.data.items;

        const now = new Date();
        const directShareIds: string[] = [];
        const activityLogIds: string[] = [];
        const skippedIndices: number[] = [];

        for (let i = 0; i < capped.length; i++) {
            const item = capped[i];
            if (item.feedType === 'direct_share') {
                directShareIds.push(item.id);
            } else if (item.feedType === 'activity_log') {
                activityLogIds.push(item.id);
            } else {
                skippedIndices.push(i);
            }
        }

        // Batch update direct shares (only if user is the receiver)
        if (directShareIds.length > 0) {
            await db.update(schema.sharesInbox)
                .set({ seenAt: now, updatedAt: now })
                .where(
                    and(
                        inArray(schema.sharesInbox.id, directShareIds),
                        eq(schema.sharesInbox.receiverId, userId)
                    )
                );
        }

        // Batch update activity feed (only if user is the activity owner)
        if (activityLogIds.length > 0) {
            await db.update(schema.activityFeed)
                .set({ seenAt: now, updatedAt: now })
                .where(
                    and(
                        inArray(schema.activityFeed.id, activityLogIds),
                        eq(schema.activityFeed.userId, userId)
                    )
                );
        }

        return NextResponse.json({
            success: true,
            processed: directShareIds.length + activityLogIds.length,
            skipped: skippedIndices,
            warning: skippedIndices.length > 0 ? `${skippedIndices.length} items were invalid and skipped` : undefined
        });
    } catch (e: unknown) {
        const error = e as Error;
        const message = error.message || 'Internal server error';
        return NextResponse.json({
            error: message,
            code: 'BATCH_SEEN_FAILED',
            details: error.toString()
        }, { status: 500 });
    }
}
