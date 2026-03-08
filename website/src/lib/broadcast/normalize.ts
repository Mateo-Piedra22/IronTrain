import type { BroadcastItem, BroadcastTargeting } from './types';

function clampText(input: unknown, maxLen: number): string {
    if (typeof input !== 'string') return '';
    const v = input.trim();
    if (!v) return '';
    return v.length > maxLen ? v.slice(0, maxLen) : v;
}

export function normalizeAnnouncementPriority(raw: unknown): number {
    const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (v === 'critical') return 40;
    if (v === 'high') return 30;
    if (v === 'normal') return 20;
    if (v === 'low') return 10;
    return 20;
}

export function normalizeTargeting(params: {
    targetPlatform: unknown;
    targetVersion: unknown;
    targetSegment: unknown;
}): BroadcastTargeting {
    const platformRaw = typeof params.targetPlatform === 'string' ? params.targetPlatform.trim().toLowerCase() : '';
    const platform: BroadcastTargeting['platform'] =
        platformRaw === 'android' ? 'android'
            : platformRaw === 'ios' ? 'ios'
                : platformRaw === 'all' ? 'all'
                    : null;

    const version = clampText(params.targetVersion, 64) || null;

    const segmentRaw = typeof params.targetSegment === 'string' ? params.targetSegment.trim().toLowerCase() : '';
    const segment: BroadcastTargeting['segment'] =
        segmentRaw === 'all' ? 'all'
            : segmentRaw === 'new' ? 'new'
                : segmentRaw === 'active' ? 'active'
                    : segmentRaw === 'inactive' ? 'inactive'
                        : segmentRaw === 'premium' ? 'premium'
                            : null;

    return {
        platform,
        version,
        segment,
    };
}

export function sortBroadcastItems(items: BroadcastItem[]): BroadcastItem[] {
    return [...items].sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority;
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        if (aTime !== bTime) return bTime - aTime;
        return a.id.localeCompare(b.id);
    });
}
