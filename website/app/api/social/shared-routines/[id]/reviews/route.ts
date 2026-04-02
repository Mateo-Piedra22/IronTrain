import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../../src/db';
import * as schema from '../../../../../../src/db/schema';
import { verifyAuth } from '../../../../../../src/lib/auth';
import { RATE_LIMITS } from '../../../../../../src/lib/rate-limit';
import { diffSharedRoutinePayload, summarizeSharedRoutinePayload } from '../../../../../../src/lib/shared-routine-diff';

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

        const [workspace] = await db
            .select({
                id: schema.sharedRoutines.id,
                currentSnapshotId: schema.sharedRoutines.currentSnapshotId,
                currentRevision: schema.sharedRoutines.currentRevision,
            })
            .from(schema.sharedRoutines)
            .where(
                and(
                    eq(schema.sharedRoutines.id, id),
                    isNull(schema.sharedRoutines.deletedAt),
                ),
            )
            .limit(1);

        if (!workspace) {
            return NextResponse.json({ error: 'Shared routine not found' }, { status: 404 });
        }

        let basePayload: Record<string, unknown> | null = null;
        if (workspace.currentSnapshotId) {
            const [snapshot] = await db
                .select({
                    payload: schema.sharedRoutineSnapshots.payload,
                })
                .from(schema.sharedRoutineSnapshots)
                .where(
                    and(
                        eq(schema.sharedRoutineSnapshots.id, workspace.currentSnapshotId),
                        isNull(schema.sharedRoutineSnapshots.deletedAt),
                    ),
                )
                .limit(1);

            if (snapshot?.payload && typeof snapshot.payload === 'object') {
                basePayload = snapshot.payload as Record<string, unknown>;
            }
        }

        if (!basePayload) {
            const [fallbackSnapshot] = await db
                .select({
                    payload: schema.sharedRoutineSnapshots.payload,
                })
                .from(schema.sharedRoutineSnapshots)
                .where(
                    and(
                        eq(schema.sharedRoutineSnapshots.sharedRoutineId, id),
                        isNull(schema.sharedRoutineSnapshots.deletedAt),
                    ),
                )
                .orderBy(desc(schema.sharedRoutineSnapshots.revision))
                .limit(1);

            if (fallbackSnapshot?.payload && typeof fallbackSnapshot.payload === 'object') {
                basePayload = fallbackSnapshot.payload as Record<string, unknown>;
            }
        }

        const reviewerIds = Array.from(
            new Set(
                reviews
                    .flatMap((review) => [review.requesterId, review.decidedBy])
                    .filter((id): id is string => typeof id === 'string' && id.length > 0),
            ),
        );

        const profiles = reviewerIds.length > 0
            ? await db
                .select({
                    id: schema.userProfiles.id,
                    displayName: schema.userProfiles.displayName,
                    username: schema.userProfiles.username,
                })
                .from(schema.userProfiles)
                .where(inArray(schema.userProfiles.id, reviewerIds))
            : [];

        const profileById = new Map(
            profiles.map((profile) => [
                profile.id,
                { displayName: profile.displayName, username: profile.username },
            ]),
        );

        return NextResponse.json({
            success: true,
            items: reviews.map((review) => ({
                id: review.id,
                requesterId: review.requesterId,
                requesterDisplayName: profileById.get(review.requesterId)?.displayName ?? null,
                requesterUsername: profileById.get(review.requesterId)?.username ?? null,
                requestedBaseRevision: review.requestedBaseRevision,
                sourceRoutineId: review.sourceRoutineId,
                candidateSummary:
                    review.candidatePayload && typeof review.candidatePayload === 'object'
                        ? summarizeSharedRoutinePayload(review.candidatePayload as Record<string, unknown>)
                        : null,
                candidateDelta:
                    basePayload
                    && review.candidatePayload
                    && typeof review.candidatePayload === 'object'
                        ? diffSharedRoutinePayload(
                            basePayload,
                            review.candidatePayload as Record<string, unknown>,
                        )
                        : null,
                status: review.status,
                decidedBy: review.decidedBy,
                decidedByDisplayName: review.decidedBy ? (profileById.get(review.decidedBy)?.displayName ?? null) : null,
                decidedByUsername: review.decidedBy ? (profileById.get(review.decidedBy)?.username ?? null) : null,
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
