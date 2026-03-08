import { describe, expect, test } from 'vitest';
import { _unsafeClearRateLimitBucketsForTests, checkRateLimit } from './rate-limit';

describe('checkRateLimit', () => {
    test('allows first request and decrements remaining', () => {
        _unsafeClearRateLimitBucketsForTests();
        const r = checkRateLimit({ key: 'k', limit: 3, windowMs: 1000, nowMs: 10 });
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.remaining).toBe(2);
            expect(r.resetAtMs).toBe(1010);
        }
    });

    test('blocks when limit exceeded within window', () => {
        _unsafeClearRateLimitBucketsForTests();
        const nowMs = 1;
        expect(checkRateLimit({ key: 'k', limit: 2, windowMs: 1000, nowMs }).ok).toBe(true);
        expect(checkRateLimit({ key: 'k', limit: 2, windowMs: 1000, nowMs }).ok).toBe(true);
        const third = checkRateLimit({ key: 'k', limit: 2, windowMs: 1000, nowMs });
        expect(third.ok).toBe(false);
    });

    test('resets after window passes', () => {
        _unsafeClearRateLimitBucketsForTests();
        const first = checkRateLimit({ key: 'k', limit: 1, windowMs: 1000, nowMs: 10 });
        expect(first.ok).toBe(true);
        const blocked = checkRateLimit({ key: 'k', limit: 1, windowMs: 1000, nowMs: 11 });
        expect(blocked.ok).toBe(false);
        const after = checkRateLimit({ key: 'k', limit: 1, windowMs: 1000, nowMs: 1011 });
        expect(after.ok).toBe(true);
    });
});
