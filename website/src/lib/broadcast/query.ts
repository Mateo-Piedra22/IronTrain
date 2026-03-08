import type { BroadcastFeedQuery } from './types';

function normalizePlatform(raw: string | null): 'android' | 'ios' | null {
    if (!raw) return null;
    const v = raw.trim().toLowerCase();
    if (v === 'android' || v === 'ios') return v;
    return null;
}

function normalizeBool(raw: string | null): boolean {
    if (!raw) return false;
    const v = raw.trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function normalizeVersion(raw: string | null): string | null {
    if (!raw) return null;
    const v = raw.trim();
    return v.length > 0 && v.length <= 64 ? v : null;
}

export function parseBroadcastFeedQuery(url: string): BroadcastFeedQuery {
    const { searchParams } = new URL(url);

    const platform = normalizePlatform(searchParams.get('platform'));
    const version = normalizeVersion(searchParams.get('version'));

    return {
        platform,
        version,
        isFeed: normalizeBool(searchParams.get('feed')),
        includeUnreleased: normalizeBool(searchParams.get('includeUnreleased')),
    };
}
