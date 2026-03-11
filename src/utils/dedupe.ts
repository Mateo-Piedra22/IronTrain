export type InboxKeyInput = {
    id: string;
    feedType?: string | null;
};

export const getInboxKey = (item: InboxKeyInput): string => {
    const feedType = item.feedType && item.feedType.trim().length > 0 ? item.feedType.trim() : 'direct_share';
    return `${feedType}:${item.id}`;
};

export const dedupeByInboxKey = <T extends InboxKeyInput>(items: readonly T[]): T[] => {
    const map = new Map<string, T>();

    for (const item of items) {
        const key = getInboxKey(item);
        if (!map.has(key)) {
            map.set(key, item);
        }
    }

    return Array.from(map.values());
};
