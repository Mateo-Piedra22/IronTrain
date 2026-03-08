export type NotificationReactPayload = {
    notificationId: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== 'object') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

function clampString(input: unknown, maxLen: number): string {
    if (typeof input !== 'string') return '';
    const trimmed = input.trim();
    if (!trimmed) return '';
    return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

export function parseNotificationReactPayload(raw: unknown): { ok: true; value: NotificationReactPayload } | { ok: false; error: string } {
    if (!isPlainObject(raw)) return { ok: false, error: 'Invalid JSON body' };

    const notificationId = clampString(raw.notificationId, 128);
    if (!notificationId) return { ok: false, error: 'Notification ID is required' };

    return { ok: true, value: { notificationId } };
}

export function buildNotificationReactionId(notificationId: string, userId: string): string {
    return `${notificationId}-${userId}`;
}
