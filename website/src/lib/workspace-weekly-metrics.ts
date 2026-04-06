const WORKSPACE_TRACKED_EVENTS = new Set([
    'workspace_sync_conflict',
    'workspace_review_requested',
    'workspace_review_approved',
    'workspace_review_rejected',
    'workspace_invitation_sent',
    'workspace_invitation_accepted',
    'workspace_invitation_rejected',
    'workspace_rollback_executed',
]);

const RETENTION_DAYS = 35;

type DailyWorkspaceCounts = {
    conflict: number;
    reviewRequested: number;
    reviewApproved: number;
    reviewRejected: number;
    invitationSent: number;
    invitationAccepted: number;
    invitationRejected: number;
    rollbackExecuted: number;
};

export type WorkspaceWeeklySeriesRow = DailyWorkspaceCounts & {
    date: string;
    reviewTotal: number;
    invitationTotal: number;
};

export type WorkspaceWeeklyDashboardSnapshot = {
    generatedAt: string;
    windowDays: number;
    totals: DailyWorkspaceCounts & {
        reviewTotal: number;
        invitationTotal: number;
    };
    series: WorkspaceWeeklySeriesRow[];
};

const eventCountersByDay = new Map<string, DailyWorkspaceCounts>();

function createEmptyDailyCounts(): DailyWorkspaceCounts {
    return {
        conflict: 0,
        reviewRequested: 0,
        reviewApproved: 0,
        reviewRejected: 0,
        invitationSent: 0,
        invitationAccepted: 0,
        invitationRejected: 0,
        rollbackExecuted: 0,
    };
}

function toDateKey(timestampMs: number): string {
    return new Date(timestampMs).toISOString().slice(0, 10);
}

function toStartOfDayMs(timestampMs: number): number {
    const date = new Date(timestampMs);
    date.setUTCHours(0, 0, 0, 0);
    return date.getTime();
}

function incrementCounter(counts: DailyWorkspaceCounts, eventName: string): void {
    switch (eventName) {
        case 'workspace_sync_conflict':
            counts.conflict += 1;
            return;
        case 'workspace_review_requested':
            counts.reviewRequested += 1;
            return;
        case 'workspace_review_approved':
            counts.reviewApproved += 1;
            return;
        case 'workspace_review_rejected':
            counts.reviewRejected += 1;
            return;
        case 'workspace_invitation_sent':
            counts.invitationSent += 1;
            return;
        case 'workspace_invitation_accepted':
            counts.invitationAccepted += 1;
            return;
        case 'workspace_invitation_rejected':
            counts.invitationRejected += 1;
            return;
        case 'workspace_rollback_executed':
            counts.rollbackExecuted += 1;
            return;
        default:
            return;
    }
}

function pruneRetention(nowMs: number): void {
    const cutoffMs = toStartOfDayMs(nowMs - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    for (const key of eventCountersByDay.keys()) {
        const keyMs = Date.parse(`${key}T00:00:00.000Z`);
        if (Number.isNaN(keyMs)) continue;
        if (keyMs < cutoffMs) {
            eventCountersByDay.delete(key);
        }
    }
}

export function recordWorkspaceBusinessEvent(eventName: string, occurredAtMs = Date.now()): void {
    if (!WORKSPACE_TRACKED_EVENTS.has(eventName)) return;
    const dayKey = toDateKey(occurredAtMs);
    const counts = eventCountersByDay.get(dayKey) ?? createEmptyDailyCounts();
    incrementCounter(counts, eventName);
    eventCountersByDay.set(dayKey, counts);
    pruneRetention(occurredAtMs);
}

export function getWorkspaceWeeklyDashboardSnapshot(windowDays = 7): WorkspaceWeeklyDashboardSnapshot {
    const normalizedWindowDays = Math.min(Math.max(Math.floor(windowDays), 1), RETENTION_DAYS);
    const nowMs = Date.now();
    pruneRetention(nowMs);

    const nowDayMs = toStartOfDayMs(nowMs);
    const series: WorkspaceWeeklySeriesRow[] = [];
    const totals = {
        ...createEmptyDailyCounts(),
        reviewTotal: 0,
        invitationTotal: 0,
    };

    for (let dayOffset = normalizedWindowDays - 1; dayOffset >= 0; dayOffset -= 1) {
        const dayMs = nowDayMs - dayOffset * 24 * 60 * 60 * 1000;
        const dayKey = toDateKey(dayMs);
        const counts = eventCountersByDay.get(dayKey) ?? createEmptyDailyCounts();
        const reviewTotal = counts.reviewRequested + counts.reviewApproved + counts.reviewRejected;
        const invitationTotal = counts.invitationSent + counts.invitationAccepted + counts.invitationRejected;

        series.push({
            date: dayKey,
            conflict: counts.conflict,
            reviewRequested: counts.reviewRequested,
            reviewApproved: counts.reviewApproved,
            reviewRejected: counts.reviewRejected,
            invitationSent: counts.invitationSent,
            invitationAccepted: counts.invitationAccepted,
            invitationRejected: counts.invitationRejected,
            rollbackExecuted: counts.rollbackExecuted,
            reviewTotal,
            invitationTotal,
        });

        totals.conflict += counts.conflict;
        totals.reviewRequested += counts.reviewRequested;
        totals.reviewApproved += counts.reviewApproved;
        totals.reviewRejected += counts.reviewRejected;
        totals.invitationSent += counts.invitationSent;
        totals.invitationAccepted += counts.invitationAccepted;
        totals.invitationRejected += counts.invitationRejected;
        totals.rollbackExecuted += counts.rollbackExecuted;
        totals.reviewTotal += reviewTotal;
        totals.invitationTotal += invitationTotal;
    }

    return {
        generatedAt: new Date(nowMs).toISOString(),
        windowDays: normalizedWindowDays,
        totals,
        series,
    };
}

export function resetWorkspaceWeeklyMetricsForTests(): void {
    eventCountersByDay.clear();
}