import { describe, expect, it } from 'vitest';
import { isClientSyncReadOnlyTable, listClientSyncReadOnlyTables } from './sync-write-policy';

describe('sync write policy', () => {
    it('marks server-authoritative tables as read-only for client sync', () => {
        expect(isClientSyncReadOnlyTable('score_events')).toBe(true);
        expect(isClientSyncReadOnlyTable('user_exercise_prs')).toBe(true);
        expect(isClientSyncReadOnlyTable('weather_logs')).toBe(true);
        expect(isClientSyncReadOnlyTable('changelogs')).toBe(true);
    });

    it('allows writable sync tables', () => {
        expect(isClientSyncReadOnlyTable('workouts')).toBe(false);
        expect(isClientSyncReadOnlyTable('workout_sets')).toBe(false);
        expect(isClientSyncReadOnlyTable('settings')).toBe(false);
    });

    it('exposes stable policy list', () => {
        const tables = listClientSyncReadOnlyTables();
        expect(tables).toContain('score_events');
        expect(tables).toContain('user_exercise_prs');
    });
});
