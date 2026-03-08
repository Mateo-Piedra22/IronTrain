import type { BroadcastItem } from './BroadcastFeedService';

export type BroadcastInterruptionDecision =
    | { kind: 'none' }
    | { kind: 'whats_new'; release: { version: string; items: string[] } }
    | { kind: 'announcement'; announcement: BroadcastItem };

type SeenState = {
    isSeen: (id: string) => Promise<boolean>;
};

function isAnnouncementInterruptCandidate(item: BroadcastItem): boolean {
    if (item.kind !== 'announcement') return false;
    if (!item.lifecycle.isActive) return false;
    if (item.uiType !== 'modal' && item.uiType !== 'toast' && item.uiType !== 'system') return false;
    if (item.displayMode !== 'once' && item.displayMode !== 'always' && item.displayMode !== 'until_closed') return false;
    return true;
}

function isWhatsNewCandidate(item: BroadcastItem, currentVersion: string): boolean {
    if (item.kind !== 'changelog') return false;
    const version = item.targeting.version;
    if (!version) return false;
    return String(version).trim() === String(currentVersion).trim();
}

function releaseFromItem(item: BroadcastItem): { version: string; items: string[] } {
    const version = item.targeting.version ?? '0.0.0';
    const raw = typeof item.body === 'string' ? item.body : '';
    const items = raw
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .slice(0, 50);

    return { version, items };
}

export async function decideGlobalInterruption(params: {
    items: BroadcastItem[];
    seen: SeenState;
    currentVersion: string;
}): Promise<BroadcastInterruptionDecision> {
    const items = Array.isArray(params.items) ? params.items : [];

    for (const item of items) {
        if (!isWhatsNewCandidate(item, params.currentVersion)) continue;

        const seenKey = `whats_new:${item.targeting.version ?? item.id}`;
        const already = await params.seen.isSeen(seenKey);
        if (!already) {
            return { kind: 'whats_new', release: releaseFromItem(item) };
        }
    }

    const announcementCandidates = items
        .filter(isAnnouncementInterruptCandidate)
        .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    for (const item of announcementCandidates) {
        const mode = item.displayMode;
        if (mode === 'always') {
            return { kind: 'announcement', announcement: item };
        }

        const already = await params.seen.isSeen(item.id);
        if (!already) {
            return { kind: 'announcement', announcement: item };
        }
    }

    return { kind: 'none' };
}
