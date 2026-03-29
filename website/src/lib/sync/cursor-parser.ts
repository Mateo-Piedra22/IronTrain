export type ParsedSyncCursor = {
    sinceDate: Date;
    tieBreakerOffset: number;
};

const EPOCH = new Date(0);

function toFiniteInt(value: string | null | undefined): number | null {
    if (!value) return null;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return null;
    return parsed;
}

export function parseSyncCursor(cursorParam: string | null | undefined): ParsedSyncCursor {
    if (!cursorParam) {
        return { sinceDate: EPOCH, tieBreakerOffset: 0 };
    }

    if (!cursorParam.includes('-')) {
        const ts = toFiniteInt(cursorParam);
        // Timestamps are expected to be Unix epoch millis (non-negative); treat negative values as malformed cursors and reset to EPOCH.
        if (ts === null || ts < 0) return { sinceDate: EPOCH, tieBreakerOffset: 0 };
        return { sinceDate: new Date(ts), tieBreakerOffset: 0 };
    }

    const [tsPart, offsetPart] = cursorParam.split('-', 2);
    const ts = toFiniteInt(tsPart);
    const offset = toFiniteInt(offsetPart);

    if (ts === null || ts < 0) return { sinceDate: EPOCH, tieBreakerOffset: 0 };

    return {
        sinceDate: new Date(ts),
        tieBreakerOffset: offset !== null && offset > 0 ? offset : 0,
    };
}
