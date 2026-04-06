import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    getWorkspaceWeeklyDashboardSnapshot,
    recordWorkspaceBusinessEvent,
    resetWorkspaceWeeklyMetricsForTests,
} from './workspace-weekly-metrics';

describe('workspace-weekly-metrics', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        resetWorkspaceWeeklyMetricsForTests();
    });

    it('aggregates tracked workspace events into weekly totals and series', () => {
        const now = new Date('2026-04-07T12:00:00.000Z').getTime();
        vi.spyOn(Date, 'now').mockReturnValue(now);

        recordWorkspaceBusinessEvent('workspace_sync_conflict', now);
        recordWorkspaceBusinessEvent('workspace_review_requested', now);
        recordWorkspaceBusinessEvent('workspace_invitation_sent', now);

        const yesterday = now - 24 * 60 * 60 * 1000;
        recordWorkspaceBusinessEvent('workspace_review_approved', yesterday);
        recordWorkspaceBusinessEvent('workspace_invitation_accepted', yesterday);

        const snapshot = getWorkspaceWeeklyDashboardSnapshot(7);

        expect(snapshot.windowDays).toBe(7);
        expect(snapshot.totals.conflict).toBe(1);
        expect(snapshot.totals.reviewRequested).toBe(1);
        expect(snapshot.totals.reviewApproved).toBe(1);
        expect(snapshot.totals.reviewRejected).toBe(0);
        expect(snapshot.totals.invitationSent).toBe(1);
        expect(snapshot.totals.invitationAccepted).toBe(1);
        expect(snapshot.totals.invitationRejected).toBe(0);
        expect(snapshot.totals.reviewTotal).toBe(2);
        expect(snapshot.totals.invitationTotal).toBe(2);
        expect(snapshot.series).toHaveLength(7);
    });

    it('ignores non-workspace events and clamps requested window', () => {
        const now = new Date('2026-04-07T12:00:00.000Z').getTime();
        vi.spyOn(Date, 'now').mockReturnValue(now);

        recordWorkspaceBusinessEvent('unrelated_event_name', now);

        const snapshot = getWorkspaceWeeklyDashboardSnapshot(999);

        expect(snapshot.windowDays).toBe(35);
        expect(snapshot.totals.conflict).toBe(0);
        expect(snapshot.totals.reviewTotal).toBe(0);
        expect(snapshot.totals.invitationTotal).toBe(0);
    });
});