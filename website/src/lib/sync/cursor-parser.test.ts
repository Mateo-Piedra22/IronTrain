import { describe, expect, it } from 'vitest';
import { parseSyncCursor } from './cursor-parser';

describe('parseSyncCursor', () => {
    it('returns epoch fallback when cursor is missing', () => {
        const parsed = parseSyncCursor(null);
        expect(parsed.sinceDate.getTime()).toBe(0);
        expect(parsed.tieBreakerOffset).toBe(0);
    });

    it('parses plain timestamp cursor', () => {
        const parsed = parseSyncCursor('123456');
        expect(parsed.sinceDate.getTime()).toBe(123456);
        expect(parsed.tieBreakerOffset).toBe(0);
    });

    it('parses timestamp-offset cursor', () => {
        const parsed = parseSyncCursor('999-7');
        expect(parsed.sinceDate.getTime()).toBe(999);
        expect(parsed.tieBreakerOffset).toBe(7);
    });

    it('falls back safely on malformed cursor', () => {
        const parsed = parseSyncCursor('abc-def');
        expect(parsed.sinceDate.getTime()).toBe(0);
        expect(parsed.tieBreakerOffset).toBe(0);
    });

    it('normalizes negative values to safe fallback', () => {
        const parsed = parseSyncCursor('-100--4');
        expect(parsed.sinceDate.getTime()).toBe(0);
        expect(parsed.tieBreakerOffset).toBe(0);
    });
});
