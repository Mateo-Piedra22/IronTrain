export function formatTimeSeconds(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds || 0));
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    if (hh > 0) return `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    return `${mm}:${String(ss).padStart(2, '0')}`;
}

export function formatTimeSecondsCompact(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds || 0));
    if (s < 60) return `${s}s`;
    return formatTimeSeconds(s);
}

export type ParseTimeResult =
    | { ok: true; seconds: number | null }
    | { ok: false; error: 'invalid_format' | 'negative' };

export function parseFlexibleTimeToSeconds(text: string): ParseTimeResult {
    const t = (text ?? '').trim();
    if (!t) return { ok: true, seconds: null };

    const lower = t.toLowerCase();
    const unitSuffix = lower.endsWith('s') || lower.endsWith('m') || lower.endsWith('h');
    if (unitSuffix) {
        const numPart = lower.slice(0, -1).trim();
        const n = Number(numPart);
        if (!Number.isFinite(n)) return { ok: false, error: 'invalid_format' };
        if (n < 0) return { ok: false, error: 'negative' };
        if (lower.endsWith('s')) return { ok: true, seconds: Math.floor(n) };
        if (lower.endsWith('m')) return { ok: true, seconds: Math.floor(n * 60) };
        return { ok: true, seconds: Math.floor(n * 3600) };
    }

    if (t.includes(':')) {
        const parts = t.split(':').map((p) => p.trim());
        if (parts.some((p) => p.length === 0)) return { ok: false, error: 'invalid_format' };
        if (parts.length === 2) {
            const mm = Number(parts[0]);
            const ss = Number(parts[1]);
            if (!Number.isFinite(mm) || !Number.isFinite(ss)) return { ok: false, error: 'invalid_format' };
            if (mm < 0 || ss < 0) return { ok: false, error: 'negative' };
            return { ok: true, seconds: Math.floor(mm) * 60 + Math.floor(ss) };
        }
        if (parts.length === 3) {
            const hh = Number(parts[0]);
            const mm = Number(parts[1]);
            const ss = Number(parts[2]);
            if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) return { ok: false, error: 'invalid_format' };
            if (hh < 0 || mm < 0 || ss < 0) return { ok: false, error: 'negative' };
            return { ok: true, seconds: Math.floor(hh) * 3600 + Math.floor(mm) * 60 + Math.floor(ss) };
        }
        return { ok: false, error: 'invalid_format' };
    }

    const n = Number(t);
    if (!Number.isFinite(n)) return { ok: false, error: 'invalid_format' };
    if (n < 0) return { ok: false, error: 'negative' };
    return { ok: true, seconds: Math.floor(n) };
}
