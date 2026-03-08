import { describe, expect, test } from 'vitest';
import { normalizeAnnouncementPriority, sortBroadcastItems } from './normalize';
import type { BroadcastItem } from './types';

describe('broadcast normalize', () => {
    test('normalizeAnnouncementPriority maps known values', () => {
        expect(normalizeAnnouncementPriority('critical')).toBe(40);
        expect(normalizeAnnouncementPriority('high')).toBe(30);
        expect(normalizeAnnouncementPriority('normal')).toBe(20);
        expect(normalizeAnnouncementPriority('low')).toBe(10);
        expect(normalizeAnnouncementPriority('unknown')).toBe(20);
    });

    test('sortBroadcastItems sorts by priority then createdAt desc', () => {
        const base: Omit<BroadcastItem, 'id' | 'priority' | 'createdAt'> = {
            kind: 'announcement',
            uiType: 'toast',
            title: 't',
            body: 'b',
            displayMode: 'once',
            actionUrl: null,
            targeting: { platform: null, version: null, segment: null },
            lifecycle: { startsAt: null, endsAt: null, isActive: true },
            engagement: { reactionCount: 0, userReacted: null },
        };

        const a: BroadcastItem = { ...base, id: 'a', priority: 10, createdAt: new Date('2026-01-01T00:00:00Z') };
        const b: BroadcastItem = { ...base, id: 'b', priority: 20, createdAt: new Date('2026-01-01T00:00:00Z') };
        const c: BroadcastItem = { ...base, id: 'c', priority: 20, createdAt: new Date('2026-02-01T00:00:00Z') };

        const sorted = sortBroadcastItems([a, b, c]);
        expect(sorted.map((x) => x.id)).toEqual(['c', 'b', 'a']);
    });
});
