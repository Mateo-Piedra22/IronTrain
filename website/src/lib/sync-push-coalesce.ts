import type { PushOperation } from './sync-push-defer';

function asObject(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object') return null;
    return value as Record<string, unknown>;
}

function getCoalesceIdentity(op: PushOperation): string | null {
    const payload = asObject(op.payload);

    if (op.table === 'settings') {
        const key = typeof payload?.key === 'string' ? payload.key : (typeof op.recordId === 'string' ? op.recordId : null);
        return key ? `${op.table}:${key}` : null;
    }

    const id = typeof payload?.id === 'string' ? payload.id : (typeof op.recordId === 'string' ? op.recordId : null);
    return id ? `${op.table}:${id}` : null;
}

function mergePayload(prevPayload: unknown, nextPayload: unknown): unknown {
    const prev = asObject(prevPayload);
    const next = asObject(nextPayload);
    if (!prev && !next) return undefined;
    if (!prev) return next;
    if (!next) return prev;
    return { ...prev, ...next };
}

function mergeOperations(previous: PushOperation, next: PushOperation): PushOperation | null {
    if (next.operation === 'DELETE') {
        if (previous.operation === 'INSERT') {
            return null;
        }
        return {
            ...next,
            recordId: next.recordId ?? previous.recordId,
        };
    }

    if (next.operation === 'INSERT') {
        return {
            ...next,
            payload: mergePayload(previous.payload, next.payload),
            recordId: next.recordId ?? previous.recordId,
        };
    }

    if (next.operation === 'UPDATE') {
        if (previous.operation === 'INSERT') {
            return {
                ...next,
                operation: 'INSERT',
                payload: mergePayload(previous.payload, next.payload),
                recordId: next.recordId ?? previous.recordId,
            };
        }

        return {
            ...next,
            payload: mergePayload(previous.payload, next.payload),
            recordId: next.recordId ?? previous.recordId,
        };
    }

    return next;
}

export function coalescePushOperations(operations: PushOperation[]): PushOperation[] {
    const result: Array<PushOperation | null> = [];
    const indexByIdentity = new Map<string, number>();

    for (const op of operations) {
        const identity = getCoalesceIdentity(op);
        if (!identity) {
            result.push(op);
            continue;
        }

        const existingIndex = indexByIdentity.get(identity);
        if (existingIndex === undefined) {
            result.push(op);
            indexByIdentity.set(identity, result.length - 1);
            continue;
        }

        const previous = result[existingIndex];
        if (!previous) {
            result.push(op);
            indexByIdentity.set(identity, result.length - 1);
            continue;
        }

        const merged = mergeOperations(previous, op);
        if (merged === null) {
            result[existingIndex] = null;
            indexByIdentity.delete(identity);
            continue;
        }

        result[existingIndex] = merged;
    }

    return result.filter((item): item is PushOperation => item !== null);
}
