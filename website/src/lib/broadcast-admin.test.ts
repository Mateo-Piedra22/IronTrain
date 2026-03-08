import { describe, expect, test } from 'vitest';
import { buildDerivedGlobalEventAnnouncement } from './broadcast-admin';

describe('buildDerivedGlobalEventAnnouncement', () => {
    test('builds deterministic id and metadata', () => {
        const derived = buildDerivedGlobalEventAnnouncement({
            id: 'evt_1',
            name: 'IRON_WEEK',
            multiplier: 1.25,
            startDate: new Date('2026-01-01T00:00:00Z'),
            endDate: new Date('2026-01-02T00:00:00Z'),
            isActive: 1,
            pushSent: 0,
            createdAt: new Date('2026-01-01T00:00:00Z'),
            updatedAt: new Date('2026-01-01T00:00:00Z'),
            createdBy: null,
        });

        expect(derived.id).toBe('global-event:evt_1');
        expect(derived.type).toBe('system');
        expect(derived.priority).toBe('high');
        expect(derived.isActive).toBe(1);

        const meta = derived.metadata ? JSON.parse(derived.metadata) : null;
        expect(meta.actionUrl).toBe('irontrain://social');
        expect(meta.derivedFrom).toEqual({ kind: 'global_event', id: 'evt_1' });
    });
});
