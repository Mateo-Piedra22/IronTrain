import { describe, expect, test } from 'vitest';
import { parseNotificationLogPayload } from './notifications-log';

describe('parseNotificationLogPayload', () => {
    test('rejects non-object', () => {
        const res = parseNotificationLogPayload('x');
        expect(res.ok).toBe(false);
    });

    test('rejects missing id', () => {
        const res = parseNotificationLogPayload({ action: 'seen' });
        expect(res.ok).toBe(false);
    });

    test('rejects invalid action', () => {
        const res = parseNotificationLogPayload({ id: 'n1', action: 'x' });
        expect(res.ok).toBe(false);
    });

    test('accepts valid payload with null metadata', () => {
        const res = parseNotificationLogPayload({ id: 'n1', action: 'seen' });
        expect(res.ok).toBe(true);
        if (res.ok) {
            expect(res.value.id).toBe('n1');
            expect(res.value.action).toBe('seen');
            expect(res.value.metadata).toBeNull();
        }
    });

    test('rejects large metadata', () => {
        const big = { x: 'a'.repeat(3000) };
        const res = parseNotificationLogPayload({ id: 'n1', action: 'seen', metadata: big });
        expect(res.ok).toBe(false);
    });
});
