import type { BroadcastItem } from '../BroadcastFeedService';
import { decideGlobalInterruption } from '../BroadcastInterruptionPolicy';

function baseItem(overrides: Partial<BroadcastItem>): BroadcastItem {
    return {
        id: 'id',
        kind: 'announcement',
        uiType: 'modal',
        title: 'Title',
        body: 'Body',
        priority: 10,
        displayMode: 'once',
        actionUrl: null,
        lifecycle: { startsAt: null, endsAt: null, isActive: true },
        engagement: { reactionCount: 0, userReacted: null },
        targeting: { platform: null, version: null, segment: 'all' },
        createdAt: new Date().toISOString(),
        ...overrides,
    };
}

describe('BroadcastInterruptionPolicy', () => {
    test('prefers whats_new when current version changelog is unseen', async () => {
        const items: BroadcastItem[] = [
            baseItem({
                id: 'cl_1',
                kind: 'changelog',
                uiType: null,
                title: 'Versión 1.2.3',
                body: '- A\n- B',
                priority: 1,
                displayMode: null,
                actionUrl: 'irontrain://changelog',
                targeting: { platform: null, version: '1.2.3', segment: 'all' },
                lifecycle: { startsAt: null, endsAt: null, isActive: true },
            }),
            baseItem({ id: 'n1', kind: 'announcement', uiType: 'modal', priority: 999, displayMode: 'always' }),
        ];

        const seen = {
            isSeen: jest.fn(async (id: string) => id !== 'whats_new:1.2.3' ? true : false),
        };

        const decision = await decideGlobalInterruption({ items, seen, currentVersion: '1.2.3' });
        expect(decision.kind).toBe('whats_new');
        if (decision.kind === 'whats_new') {
            expect(decision.release.version).toBe('1.2.3');
            expect(decision.release.items).toEqual(['- A', '- B']);
        }
    });

    test('returns announcement when whats_new is already seen and announcement is unseen', async () => {
        const items: BroadcastItem[] = [
            baseItem({
                id: 'cl_1',
                kind: 'changelog',
                uiType: null,
                title: 'Versión 1.2.3',
                body: '- A',
                priority: 1,
                displayMode: null,
                actionUrl: 'irontrain://changelog',
                targeting: { platform: null, version: '1.2.3', segment: 'all' },
                lifecycle: { startsAt: null, endsAt: null, isActive: true },
            }),
            baseItem({ id: 'n1', kind: 'announcement', uiType: 'toast', priority: 50, displayMode: 'once' }),
        ];

        const seen = {
            isSeen: jest.fn(async (id: string) => {
                if (id === 'whats_new:1.2.3') return true;
                if (id === 'n1') return false;
                return true;
            }),
        };

        const decision = await decideGlobalInterruption({ items, seen, currentVersion: '1.2.3' });
        expect(decision.kind).toBe('announcement');
        if (decision.kind === 'announcement') {
            expect(decision.announcement.id).toBe('n1');
            expect(decision.announcement.uiType).toBe('toast');
        }
    });

    test('picks highest priority announcement among candidates', async () => {
        const items: BroadcastItem[] = [
            baseItem({ id: 'a', kind: 'announcement', uiType: 'modal', priority: 10, displayMode: 'once' }),
            baseItem({ id: 'b', kind: 'announcement', uiType: 'toast', priority: 99, displayMode: 'once' }),
        ];

        const seen = {
            isSeen: jest.fn(async () => false),
        };

        const decision = await decideGlobalInterruption({ items, seen, currentVersion: '0.0.0' });
        expect(decision.kind).toBe('announcement');
        if (decision.kind === 'announcement') {
            expect(decision.announcement.id).toBe('b');
        }
    });

    test('returns none when everything is seen and no always announcement exists', async () => {
        const items: BroadcastItem[] = [
            baseItem({ id: 'n1', kind: 'announcement', uiType: 'modal', priority: 10, displayMode: 'once' }),
        ];

        const seen = {
            isSeen: jest.fn(async () => true),
        };

        const decision = await decideGlobalInterruption({ items, seen, currentVersion: '0.0.0' });
        expect(decision.kind).toBe('none');
    });
});
