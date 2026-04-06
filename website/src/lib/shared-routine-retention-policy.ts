export type SharedRoutineRetentionPolicy = {
    snapshots: {
        keepLastPerWorkspace: number;
        minAgeDaysForArchiveCandidate: number;
        hardDeleteAfterDays: number;
    };
    changes: {
        keepLastPerWorkspace: number;
        minAgeDaysForArchiveCandidate: number;
        hardDeleteAfterDays: number;
    };
    protectedRules: {
        protectCurrentWorkspaceSnapshot: true;
        protectSnapshotsReferencedByPendingReviews: true;
        protectRecentRollbackChangesDays: number;
    };
    cadence: {
        dryRunWeekly: true;
        executionMonthly: true;
    };
};

export const SHARED_ROUTINE_RETENTION_POLICY_V1: SharedRoutineRetentionPolicy = {
    snapshots: {
        keepLastPerWorkspace: 30,
        minAgeDaysForArchiveCandidate: 120,
        hardDeleteAfterDays: 365,
    },
    changes: {
        keepLastPerWorkspace: 200,
        minAgeDaysForArchiveCandidate: 90,
        hardDeleteAfterDays: 240,
    },
    protectedRules: {
        protectCurrentWorkspaceSnapshot: true,
        protectSnapshotsReferencedByPendingReviews: true,
        protectRecentRollbackChangesDays: 180,
    },
    cadence: {
        dryRunWeekly: true,
        executionMonthly: true,
    },
};

export function getSharedRoutineRetentionPolicy(): SharedRoutineRetentionPolicy {
    return SHARED_ROUTINE_RETENTION_POLICY_V1;
}
