import { describe, expect, test } from 'vitest';

import { SYNC_TABLES as SYNC_TABLES_PULL } from '../../app/api/sync/pull/route';
import { SYNC_TABLES as SYNC_TABLES_PUSH } from '../../app/api/sync/push/route';

describe('sync table lists', () => {
    test('push and pull include notification_reactions (offline-first reactions)', () => {
        expect(SYNC_TABLES_PUSH).toContain('notification_reactions');
        expect(SYNC_TABLES_PULL).toContain('notification_reactions');
    });

    test('push and pull include changelog_reactions (existing offline table)', () => {
        expect(SYNC_TABLES_PUSH).toContain('changelog_reactions');
        expect(SYNC_TABLES_PULL).toContain('changelog_reactions');
    });
});
