import { describe, expect, test } from 'vitest';
import { parseBroadcastFeedQuery } from './query';

describe('parseBroadcastFeedQuery', () => {
    test('parses basic params', () => {
        const q = parseBroadcastFeedQuery('https://x.test/api/broadcast/feed?platform=android&version=1.2.3&feed=true&includeUnreleased=1');
        expect(q.platform).toBe('android');
        expect(q.version).toBe('1.2.3');
        expect(q.isFeed).toBe(true);
        expect(q.includeUnreleased).toBe(true);
    });

    test('normalizes invalid values to null/false', () => {
        const q = parseBroadcastFeedQuery('https://x.test/api/broadcast/feed?platform=windows&version=');
        expect(q.platform).toBe(null);
        expect(q.version).toBe(null);
        expect(q.isFeed).toBe(false);
        expect(q.includeUnreleased).toBe(false);
    });
});
