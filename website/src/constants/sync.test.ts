import { describe, expect, test } from 'vitest';
import { SYNC_TABLES } from './sync';

describe('sync table lists', () => {
    test('push and pull include notification_reactions', () => {
        expect(SYNC_TABLES).toContain('notification_reactions');
    });

    test('push and pull include changelog_reactions (existing offline table)', () => {
        expect(SYNC_TABLES).toContain('changelog_reactions');
    });
});
