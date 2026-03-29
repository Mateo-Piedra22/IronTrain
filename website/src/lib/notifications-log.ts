export type NotificationLogAction = 'seen' | 'clicked' | 'closed';

export type NotificationLogPayload = {
    id: string;
    action: NotificationLogAction;
    metadata: Record<string, unknown> | null;
};

const ALLOWED_ACTIONS: ReadonlySet<string> = new Set(['seen', 'clicked', 'closed']);

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

export function parseNotificationLogPayload(raw: unknown): { ok: true; value: NotificationLogPayload } | { ok: false; error: string } {
    if (!isPlainObject(raw)) return { ok: false, error: 'Invalid JSON body' };

    const id = clampString(raw.id, 128);
    const actionRaw = clampString(raw.action, 16);

    if (!id) return { ok: false, error: 'Missing required fields' };
    if (!actionRaw || !ALLOWED_ACTIONS.has(actionRaw)) return { ok: false, error: 'Invalid action' };

    const metadataRaw = raw.metadata;
    if (metadataRaw === undefined || metadataRaw === null) {
        return { ok: true, value: { id, action: actionRaw as NotificationLogAction, metadata: null } };
    }

    if (!isPlainObject(metadataRaw)) return { ok: false, error: 'Invalid metadata' };

    // Implement a size check to pass the test and protect the database from oversized payloads
    if (JSON.stringify(metadataRaw).length > 2048) {
        return { ok: false, error: 'Metadata too large' };
    }

    return { ok: true, value: { id, action: actionRaw as NotificationLogAction, metadata: metadataRaw } };
}
