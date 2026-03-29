import { describe, expect, test } from 'vitest';
import { applyUserReactions } from './feed';
import type { BroadcastItem } from './types';

describe('applyUserReactions', () => {
    test('sets userReacted for changelog, leaves others unchanged', () => {
        const items: BroadcastItem[] = [
            {
                id: 'c1',
                kind: 'changelog',
                uiType: null,
                title: 'v1.0.0',
                body: 'Changes',
                priority: 10,
                displayMode: null,
                actionUrl: null,
                targeting: { platform: null, version: '1.0.0', segment: 'all' },
                lifecycle: { startsAt: new Date('2026-01-01T00:00:00Z'), endsAt: null, isActive: true },
                engagement: { reactionCount: 2, userReacted: null },
                createdAt: new Date('2026-01-01T00:00:00Z'),
            },
            {
                id: 'e1',
                kind: 'global_event',
                uiType: null,
                title: 'event',
                body: 'y',
                priority: 10,
                displayMode: null,
                actionUrl: null,
                targeting: { platform: null, version: null, segment: 'all' },
                lifecycle: { startsAt: new Date('2026-01-01T00:00:00Z'), endsAt: new Date('2026-01-02T00:00:00Z'), isActive: true },
                engagement: { reactionCount: 0, userReacted: null },
                createdAt: new Date('2026-01-01T00:00:00Z'),
            },
        ];

        const out = applyUserReactions(items, {
            reactedChangelogIds: new Set(['c1']),
        });

        expect(out[0].engagement.userReacted).toBe(true);
        expect(out[1].engagement.userReacted).toBe(null);
    });
});
