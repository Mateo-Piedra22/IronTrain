import { describe, expect, it } from 'vitest';
import { computeNextCursor } from './pull-cursor';

describe('computeNextCursor', () => {
    it('returns null when there are no more rows', () => {
        const rows = [{ updatedAt: 1000 }, { updatedAt: 2000 }];
        expect(computeNextCursor(rows, 2)).toBeNull();
    });

    it('computes offset for boundary timestamp', () => {
        const rows = [
            { updatedAt: 1000 },
            { updatedAt: 2000 },
            { updatedAt: 2000 },
            { updatedAt: 3000 },
        ];

        expect(computeNextCursor(rows, 3)).toBe('2000-2');
    });

    it('handles null/invalid updatedAt values as zero timestamp', () => {
        const rows = [
            { updatedAt: null },
            { updatedAt: 'invalid-date' },
            { updatedAt: 5 },
            { updatedAt: 10 },
        ];

        expect(computeNextCursor(rows, 3)).toBe('5-1');
    });
});
