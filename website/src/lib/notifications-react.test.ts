import { describe, expect, test } from 'vitest';
import { buildNotificationReactionId, parseNotificationReactPayload } from './notifications-react';

describe('notifications-react', () => {
    test('parseNotificationReactPayload rejects missing notificationId', () => {
        const res = parseNotificationReactPayload({});
        expect(res.ok).toBe(false);
    });

    test('parseNotificationReactPayload accepts notificationId', () => {
        const res = parseNotificationReactPayload({ notificationId: 'n1' });
        expect(res.ok).toBe(true);
        if (res.ok) expect(res.value.notificationId).toBe('n1');
    });

    test('buildNotificationReactionId is deterministic', () => {
        expect(buildNotificationReactionId('n1', 'u1')).toBe('n1-u1');
    });
});
