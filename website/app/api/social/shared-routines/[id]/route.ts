import { and, desc, eq, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../src/db';
import * as schema from '../../../../../src/db/schema';
import { verifyAuth } from '../../../../../src/lib/auth';
import { RATE_LIMITS } from '../../../../../src/lib/rate-limit';

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

        const [workspace] = await db
            .select()
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

        let snapshot = null as any;
        if (workspace.currentSnapshotId) {
            const [directSnapshot] = await db
                .select()
                .from(schema.sharedRoutineSnapshots)
                .where(
                    and(
                        eq(schema.sharedRoutineSnapshots.id, workspace.currentSnapshotId),
                        isNull(schema.sharedRoutineSnapshots.deletedAt),
                    ),
                )
                .limit(1);
            snapshot = directSnapshot ?? null;
        }

        if (!snapshot) {
            const [latestSnapshot] = await db
                .select()
                .from(schema.sharedRoutineSnapshots)
                .where(
                    and(
                        eq(schema.sharedRoutineSnapshots.sharedRoutineId, id),
                        isNull(schema.sharedRoutineSnapshots.deletedAt),
                    ),
                )
                .orderBy(desc(schema.sharedRoutineSnapshots.revision))
                .limit(1);
            snapshot = latestSnapshot ?? null;
        }

        if (!snapshot) {
            return NextResponse.json({ error: 'No snapshot found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            workspace: {
                id: workspace.id,
                title: workspace.title,
                ownerId: workspace.ownerId,
                editMode: workspace.editMode,
                approvalMode: workspace.approvalMode,
                currentRevision: workspace.currentRevision,
                sourceRoutineId: workspace.sourceRoutineId,
                updatedAt: workspace.updatedAt,
            },
            membership: {
                role: membership.role,
                canEdit: membership.role === 'owner' || membership.canEdit,
            },
            snapshot: {
                id: snapshot.id,
                revision: snapshot.revision,
                payload: snapshot.payload,
                createdBy: snapshot.createdBy,
                createdAt: snapshot.createdAt,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
