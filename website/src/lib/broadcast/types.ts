export type BroadcastKind = 'changelog' | 'announcement' | 'global_event';

export type BroadcastTargeting = {
    platform: 'android' | 'ios' | 'all' | null;
    version: string | null;
    segment: 'all' | 'new' | 'active' | 'inactive' | 'premium' | null;
};

export type BroadcastLifecycle = {
    startsAt: Date | null;
    endsAt: Date | null;
    isActive: boolean;
};

export type BroadcastEngagement = {
    reactionCount: number;
    userReacted: boolean | null;
};

export type BroadcastItem = {
    id: string;
    kind: BroadcastKind;
    uiType: 'toast' | 'modal' | 'system' | null;
    title: string;
    body: string;
    priority: number;
    displayMode: 'once' | 'always' | 'until_closed' | null;
    actionUrl: string | null;
    targeting: BroadcastTargeting;
    lifecycle: BroadcastLifecycle;
    engagement: BroadcastEngagement;
    createdAt: Date;
};

export type BroadcastFeedQuery = {
    platform: 'android' | 'ios' | null;
    version: string | null;
    isFeed: boolean;
    includeUnreleased: boolean;
};
