import { describe, expect, it } from 'vitest';
import { buildFriendshipId } from './friendship-id';

describe('buildFriendshipId', () => {
    it('is order-independent', () => {
        const a = buildFriendshipId('u1', 'u2');
        const b = buildFriendshipId('u2', 'u1');
        expect(a).toBe(b);
    });

    it('keeps deterministic prefix and participants', () => {
        const id = buildFriendshipId('alice', 'bob');
        expect(id.startsWith('friendship:')).toBe(true);
        expect(id).toBe('friendship:alice:bob');
    });
});
