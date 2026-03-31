import { and, desc, eq, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../../src/db';
import * as schema from '../../../../../../src/db/schema';
import { verifyAuth } from '../../../../../../src/lib/auth';
import { RATE_LIMITS } from '../../../../../../src/lib/rate-limit';

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const rateLimit = await RATE_LIMITS.SOCIAL_SHARED_ROUTINES_READ(userId);
        if (!rateLimit.ok) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }

        const { id } = await context.params;

        const [membership] = await db
            .select()
            .from(schema.sharedRoutineMembers)
            .where(
                and(
                    eq(schema.sharedRoutineMembers.sharedRoutineId, id),
                    eq(schema.sharedRoutineMembers.userId, userId),
                    isNull(schema.sharedRoutineMembers.deletedAt),
                ),
            )
            .limit(1);

        if (!membership) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const reviews = await db
            .select()
            .from(schema.sharedRoutineReviewRequests)
            .where(
                and(
                    eq(schema.sharedRoutineReviewRequests.sharedRoutineId, id),
                    isNull(schema.sharedRoutineReviewRequests.deletedAt),
                ),
            )
            .orderBy(desc(schema.sharedRoutineReviewRequests.createdAt))
            .limit(50);

        return NextResponse.json({
            success: true,
            items: reviews.map((review) => ({
                id: review.id,
                requesterId: review.requesterId,
                requestedBaseRevision: review.requestedBaseRevision,
                sourceRoutineId: review.sourceRoutineId,
                status: review.status,
                decidedBy: review.decidedBy,
                decidedAt: review.decidedAt,
                decisionNote: review.decisionNote,
                createdAt: review.createdAt,
                updatedAt: review.updatedAt,
            })),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
