import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '../db/schema';
import { getSharedRoutineRetentionPolicy } from './shared-routine-retention-policy';
import { getWorkspaceWeeklyDashboardSnapshot } from './workspace-weekly-metrics';

type WindowDays = 7 | 30;

type CollaborationWindowReport = {
    days: WindowDays;
    activity: {
        reviewRequested: number;
        reviewApproved: number;
        reviewRejected: number;
        invitationSent: number;
        invitationAccepted: number;
        invitationRejected: number;
        rollbackExecuted: number;
        conflictCount: number;
    };
    quality: {
        conflictPer100Reviews: number;
        invitationAcceptanceRatePct: number;
    };
};

export type WorkspaceCollaborationHealthReport = {
    generatedAt: string;
    adoption: {
        activeWorkspaces: number;
        workspacesWith2PlusMembers: number;
        workspacesWith3PlusMembers: number;
        pendingInvitations: number;
        pendingReviews: number;
    };
    windows: {
        last7Days: CollaborationWindowReport;
        last30Days: CollaborationWindowReport;
    };
    retentionPolicy: ReturnType<typeof getSharedRoutineRetentionPolicy>;
};

async function countRows(
    fromBuilder: Promise<Array<{ total: number }>>
): Promise<number> {
    const rows = await fromBuilder;
    return Number(rows[0]?.total ?? 0);
}

async function getWindowReport(days: WindowDays): Promise<CollaborationWindowReport> {
    const now = Date.now();
    const fromDate = new Date(now - days * 24 * 60 * 60 * 1000);

    const [
        reviewRequested,
        reviewApproved,
        reviewRejected,
        invitationSent,
        invitationAccepted,
        invitationRejected,
        rollbackExecuted,
    ] = await Promise.all([
        countRows(
            db
                .select({ total: sql<number>`count(*)`.mapWith(Number) })
                .from(schema.sharedRoutineReviewRequests)
                .where(and(isNull(schema.sharedRoutineReviewRequests.deletedAt), gte(schema.sharedRoutineReviewRequests.createdAt, fromDate)))
        ),
        countRows(
            db
                .select({ total: sql<number>`count(*)`.mapWith(Number) })
                .from(schema.sharedRoutineReviewRequests)
                .where(and(
                    isNull(schema.sharedRoutineReviewRequests.deletedAt),
                    eq(schema.sharedRoutineReviewRequests.status, 'approved'),
                    gte(schema.sharedRoutineReviewRequests.decidedAt, fromDate)
                ))
        ),
        countRows(
            db
                .select({ total: sql<number>`count(*)`.mapWith(Number) })
                .from(schema.sharedRoutineReviewRequests)
                .where(and(
                    isNull(schema.sharedRoutineReviewRequests.deletedAt),
                    eq(schema.sharedRoutineReviewRequests.status, 'rejected'),
                    gte(schema.sharedRoutineReviewRequests.decidedAt, fromDate)
                ))
        ),
        countRows(
            db
                .select({ total: sql<number>`count(*)`.mapWith(Number) })
                .from(schema.sharedRoutineInvitations)
                .where(and(isNull(schema.sharedRoutineInvitations.deletedAt), gte(schema.sharedRoutineInvitations.createdAt, fromDate)))
        ),
        countRows(
            db
                .select({ total: sql<number>`count(*)`.mapWith(Number) })
                .from(schema.sharedRoutineInvitations)
                .where(and(
                    isNull(schema.sharedRoutineInvitations.deletedAt),
                    eq(schema.sharedRoutineInvitations.status, 'accepted'),
                    gte(schema.sharedRoutineInvitations.respondedAt, fromDate)
                ))
        ),
        countRows(
            db
                .select({ total: sql<number>`count(*)`.mapWith(Number) })
                .from(schema.sharedRoutineInvitations)
                .where(and(
                    isNull(schema.sharedRoutineInvitations.deletedAt),
                    eq(schema.sharedRoutineInvitations.status, 'rejected'),
                    gte(schema.sharedRoutineInvitations.respondedAt, fromDate)
                ))
        ),
        countRows(
            db
                .select({ total: sql<number>`count(*)`.mapWith(Number) })
                .from(schema.sharedRoutineChanges)
                .where(and(
                    isNull(schema.sharedRoutineChanges.deletedAt),
                    eq(schema.sharedRoutineChanges.actionType, 'rollback'),
                    gte(schema.sharedRoutineChanges.createdAt, fromDate)
                ))
        ),
    ]);

    const eventWindow = getWorkspaceWeeklyDashboardSnapshot(days);
    const conflictCount = eventWindow.totals.conflict;

    const reviewTotal = reviewRequested;
    const invitationDecisions = invitationAccepted + invitationRejected;

    const quality = {
        conflictPer100Reviews: reviewTotal > 0 ? Number(((conflictCount / reviewTotal) * 100).toFixed(2)) : 0,
        invitationAcceptanceRatePct: invitationDecisions > 0
            ? Number(((invitationAccepted / invitationDecisions) * 100).toFixed(2))
            : 0,
    };

    return {
        days,
        activity: {
            reviewRequested,
            reviewApproved,
            reviewRejected,
            invitationSent,
            invitationAccepted,
            invitationRejected,
            rollbackExecuted,
            conflictCount,
        },
        quality,
    };
}

async function getAdoptionSnapshot() {
    const [activeWorkspacesRows, pendingInvitationsRows, pendingReviewsRows, memberRows] = await Promise.all([
        db
            .select({ total: sql<number>`count(*)`.mapWith(Number) })
            .from(schema.sharedRoutines)
            .where(isNull(schema.sharedRoutines.deletedAt)),
        db
            .select({ total: sql<number>`count(*)`.mapWith(Number) })
            .from(schema.sharedRoutineInvitations)
            .where(and(isNull(schema.sharedRoutineInvitations.deletedAt), eq(schema.sharedRoutineInvitations.status, 'pending'))),
        db
            .select({ total: sql<number>`count(*)`.mapWith(Number) })
            .from(schema.sharedRoutineReviewRequests)
            .where(and(isNull(schema.sharedRoutineReviewRequests.deletedAt), eq(schema.sharedRoutineReviewRequests.status, 'pending'))),
        db
            .select({
                sharedRoutineId: schema.sharedRoutineMembers.sharedRoutineId,
                total: sql<number>`count(*)`.mapWith(Number),
            })
            .from(schema.sharedRoutineMembers)
            .where(isNull(schema.sharedRoutineMembers.deletedAt))
            .groupBy(schema.sharedRoutineMembers.sharedRoutineId),
    ]);

    const with2 = memberRows.filter((row) => row.total >= 2).length;
    const with3 = memberRows.filter((row) => row.total >= 3).length;

    return {
        activeWorkspaces: Number(activeWorkspacesRows[0]?.total ?? 0),
        workspacesWith2PlusMembers: with2,
        workspacesWith3PlusMembers: with3,
        pendingInvitations: Number(pendingInvitationsRows[0]?.total ?? 0),
        pendingReviews: Number(pendingReviewsRows[0]?.total ?? 0),
    };
}

export async function getWorkspaceCollaborationHealthReport(): Promise<WorkspaceCollaborationHealthReport> {
    const [adoption, last7Days, last30Days] = await Promise.all([
        getAdoptionSnapshot(),
        getWindowReport(7),
        getWindowReport(30),
    ]);

    return {
        generatedAt: new Date().toISOString(),
        adoption,
        windows: {
            last7Days,
            last30Days,
        },
        retentionPolicy: getSharedRoutineRetentionPolicy(),
    };
}
