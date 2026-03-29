export type PullCursorRow = {
    updatedAt?: Date | string | number | null;
};

function logWarning(message: string, meta?: unknown): void {
    // Centralized logging hook for this module; currently delegates to console.
    if (meta !== undefined) {
        console.warn(message, meta);
    } else {
        console.warn(message);
    }
}

function toTimestamp(value: Date | string | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            logWarning('toTimestamp received a non-finite number for updatedAt; defaulting to 0.', { value });
            return 0;
        }
        return value;
    }
    const parsed = new Date(value).getTime();
    if (!Number.isFinite(parsed)) {
        logWarning('toTimestamp failed to parse a valid date for updatedAt; defaulting to 0.', { value });
        return 0;
    }
    return parsed;
}

export function computeNextCursor(filteredRows: PullCursorRow[], pageSize: number): string | null {
    if (pageSize <= 0) return null;
    if (filteredRows.length <= pageSize) return null;

    const boundaryIndex = pageSize - 1;
    const lastMs = toTimestamp(filteredRows[boundaryIndex]?.updatedAt);

    let nextOffset = 0;
    for (let i = 0; i <= boundaryIndex; i++) {
        const t = toTimestamp(filteredRows[i]?.updatedAt);
        if (t === lastMs) nextOffset++;
    }

    return `${lastMs}-${nextOffset}`;
}
