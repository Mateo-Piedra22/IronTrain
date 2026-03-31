import { SocialFriend, SocialInboxItem } from '@/src/services/SocialService';
import { buildActivityVisualSummary, buildStories, selectActivityFeed, selectIncomingFriendRequests, selectNotificationShares } from '@/src/social/socialSelectors';

describe('socialSelectors', () => {
    const feedItem: SocialInboxItem = {
        id: 'a1',
        feedType: 'activity_log',
        senderId: 'u1',
        senderName: 'Mateo',
        senderUsername: 'mateo',
        actionType: 'pr_broken',
        metadata: JSON.stringify({ exerciseName: 'Bench Press', weight: 100, reps: 5, unit: 'kg' }),
        kudosCount: 2,
        hasKudoed: false,
        createdAt: new Date().toISOString(),
        seenAt: null,
    };

    const shareItem: SocialInboxItem = {
        id: 's1',
        feedType: 'direct_share',
        senderId: 'u2',
        senderName: 'Ana',
        senderUsername: 'ana',
        type: 'routine',
        payload: { id: 'r1' },
        status: 'pending',
        createdAt: new Date().toISOString(),
        seenAt: null,
    };

    it('selects only activity feed items', () => {
        const result = selectActivityFeed([shareItem, feedItem], 'u0');
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('a1');
    });

    it('selects only direct share notifications', () => {
        const result = selectNotificationShares([shareItem, feedItem]);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('s1');
    });

    it('selects incoming friend requests only', () => {
        const friends: SocialFriend[] = [
            { id: 'f1', friendId: 'u2', displayName: 'Ana', username: 'ana', status: 'pending', isSender: false },
            { id: 'f2', friendId: 'u3', displayName: 'Luis', username: 'luis', status: 'pending', isSender: true },
            { id: 'f3', friendId: 'u4', displayName: 'Sofi', username: 'sofi', status: 'accepted', isSender: false },
        ];

        const result = selectIncomingFriendRequests(friends);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('f1');
    });

    it('builds visual summary from PR metadata', () => {
        const summary = buildActivityVisualSummary(feedItem);
        expect(summary.badge).toBe('PR');
        expect(summary.highlightValue).toContain('100kg');
    });

    it('builds stories grouped by user', () => {
        const older = { ...feedItem, id: 'a0', createdAt: new Date(Date.now() - 100000).toISOString() };
        const result = buildStories([older, feedItem]);
        expect(result).toHaveLength(1);
        expect(result[0].userId).toBe('u1');
    });
});
