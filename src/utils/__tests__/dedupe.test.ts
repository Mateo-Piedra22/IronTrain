import { dedupeByInboxKey, getInboxKey } from '../dedupe';

describe('dedupeByInboxKey', () => {
    it('uses feedType:id as key and does not collide across feed types', () => {
        const items = [
            { id: 'same', feedType: 'direct_share', createdAt: 1 },
            { id: 'same', feedType: 'activity_log', createdAt: 2 },
        ];

        const deduped = dedupeByInboxKey(items);
        expect(deduped).toHaveLength(2);
        expect(deduped.map(getInboxKey)).toEqual(['direct_share:same', 'activity_log:same']);
    });

    it('treats missing feedType as direct_share', () => {
        const items = [
            { id: 'a', feedType: null },
            { id: 'a' },
        ];

        const deduped = dedupeByInboxKey(items);
        expect(deduped).toHaveLength(1);
        expect(getInboxKey(deduped[0]!)).toBe('direct_share:a');
    });

    it('keeps first occurrence of each composite key', () => {
        const items = [
            { id: 'x', feedType: 'activity_log', value: 1 },
            { id: 'x', feedType: 'activity_log', value: 2 },
        ];

        const deduped = dedupeByInboxKey(items);
        expect(deduped).toHaveLength(1);
        expect(deduped[0]!.value).toBe(1);
    });
});
