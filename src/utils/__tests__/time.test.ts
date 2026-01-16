import { formatTimeSeconds, formatTimeSecondsCompact, parseFlexibleTimeToSeconds } from '../time';

describe('time utils', () => {
    test('formatTimeSeconds formats mm:ss and hh:mm:ss', () => {
        expect(formatTimeSeconds(0)).toBe('0:00');
        expect(formatTimeSeconds(5)).toBe('0:05');
        expect(formatTimeSeconds(65)).toBe('1:05');
        expect(formatTimeSeconds(3661)).toBe('1:01:01');
    });

    test('formatTimeSecondsCompact uses s for under a minute', () => {
        expect(formatTimeSecondsCompact(5)).toBe('5s');
        expect(formatTimeSecondsCompact(65)).toBe('1:05');
    });

    test('parseFlexibleTimeToSeconds supports suffixes', () => {
        expect(parseFlexibleTimeToSeconds('10m')).toEqual({ ok: true, seconds: 600 });
        expect(parseFlexibleTimeToSeconds('90s')).toEqual({ ok: true, seconds: 90 });
        expect(parseFlexibleTimeToSeconds('1h')).toEqual({ ok: true, seconds: 3600 });
    });

    test('parseFlexibleTimeToSeconds supports mm:ss and hh:mm:ss', () => {
        expect(parseFlexibleTimeToSeconds('5:00')).toEqual({ ok: true, seconds: 300 });
        expect(parseFlexibleTimeToSeconds('1:02:03')).toEqual({ ok: true, seconds: 3723 });
    });

    test('parseFlexibleTimeToSeconds treats bare numbers as seconds', () => {
        expect(parseFlexibleTimeToSeconds('5')).toEqual({ ok: true, seconds: 5 });
        expect(parseFlexibleTimeToSeconds('300')).toEqual({ ok: true, seconds: 300 });
    });

    test('parseFlexibleTimeToSeconds handles empty and invalid', () => {
        expect(parseFlexibleTimeToSeconds('')).toEqual({ ok: true, seconds: null });
        expect(parseFlexibleTimeToSeconds('abc')).toEqual({ ok: false, error: 'invalid_format' });
        expect(parseFlexibleTimeToSeconds('-1')).toEqual({ ok: false, error: 'negative' });
    });
});

