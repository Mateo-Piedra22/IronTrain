import {
    SocialFriend,
    SocialInboxItem,
    SocialLeaderboardEntry,
    SocialProfile,
    SocialSearchUser,
} from '@/src/services/SocialService';
import {
    buildStories,
    selectActivityFeed,
    selectIncomingFriendRequests,
    selectNotificationShares,
} from '@/src/social/socialSelectors';
import { useMemo } from 'react';

type RankingScope = 'global' | 'friends';
type FeedTypeFilter = 'all' | 'pr' | 'workout' | 'routine';

interface UseSocialDerivedDataInput {
    profile: SocialProfile | null;
    friends: SocialFriend[];
    inbox: SocialInboxItem[];
    leaderboard: SocialLeaderboardEntry[];
    rankingScope: RankingScope;
    searchResults: SocialSearchUser[];
    feedShowSeen: boolean;
    hiddenFeedIds: string[];
    feedTypeFilter: FeedTypeFilter;
    trainingDays: number[];
}

export function useSocialDerivedData({
    profile,
    friends,
    inbox,
    leaderboard,
    rankingScope,
    searchResults,
    feedShowSeen,
    hiddenFeedIds,
    feedTypeFilter,
    trainingDays,
}: UseSocialDerivedDataInput) {
    const incomingFriendRequestsList = useMemo(() => selectIncomingFriendRequests(friends), [friends]);
    const activityFeedBase = useMemo(() => selectActivityFeed(inbox, profile?.id), [inbox, profile?.id]);
    const notificationShares = useMemo(() => selectNotificationShares(inbox), [inbox]);
    const activityFeedItems = useMemo(() => activityFeedBase, [activityFeedBase]);

    const stories = useMemo(
        () => buildStories(activityFeedItems.filter(item => item.senderId !== profile?.id)),
        [activityFeedItems, profile?.id]
    );

    const incomingFriendRequests = incomingFriendRequestsList.length;
    const pendingRoutinesCount = notificationShares.filter(i => i.status === 'pending' && !i.seenAt).length;
    const unseenActivitiesCount = activityFeedItems.filter(i => !i.seenAt).length;
    const totalUnseenCount = incomingFriendRequests + pendingRoutinesCount + unseenActivitiesCount;
    const pendingNotificationsCount = incomingFriendRequests + pendingRoutinesCount;
    const hasActiveFeedFilters = feedShowSeen || feedTypeFilter !== 'all' || hiddenFeedIds.length > 0;

    const myLeaderboardEntry = useMemo(() => {
        if (!profile?.id) return null;
        return leaderboard.find((entry) => entry.id === profile.id) || null;
    }, [leaderboard, profile?.id]);

    const acceptedFriendIds = useMemo(() => {
        const ids = new Set<string>();
        for (const friend of friends) {
            if (friend.status === 'accepted') {
                ids.add(friend.id);
                ids.add(friend.friendId);
            }
        }
        return ids;
    }, [friends]);

    const filteredLeaderboard = useMemo(() => {
        if (rankingScope === 'global') return leaderboard;
        return leaderboard.filter((entry) => entry.id === profile?.id || acceptedFriendIds.has(entry.id));
    }, [leaderboard, rankingScope, profile?.id, acceptedFriendIds]);

    const networkSectionMeta = useMemo(() => ({
        ranking: filteredLeaderboard.length,
        friends: friends.length,
        discover: searchResults.length,
    }), [filteredLeaderboard.length, friends.length, searchResults.length]);

    const communityFeedItems = useMemo(() => {
        return activityFeedItems.filter((item) => item.senderId !== profile?.id);
    }, [activityFeedItems, profile?.id]);

    const filteredCommunityFeedItems = useMemo(() => {
        return communityFeedItems.filter((item) => {
            if (!feedShowSeen && item.seenAt) return false;
            if (hiddenFeedIds.includes(item.id)) return false;

            if (feedTypeFilter === 'pr') return item.actionType === 'pr_broken';
            if (feedTypeFilter === 'workout') return item.actionType === 'workout_completed';
            if (feedTypeFilter === 'routine') return item.actionType === 'routine_shared';
            return true;
        });
    }, [communityFeedItems, feedShowSeen, hiddenFeedIds, feedTypeFilter]);

    const visibleUnseenFeedCount = useMemo(() => {
        return filteredCommunityFeedItems.filter((item) => !item.seenAt).length;
    }, [filteredCommunityFeedItems]);

    const profileWallItems = useMemo(() => {
        return activityFeedItems.filter((item) => item.senderId === profile?.id);
    }, [activityFeedItems, profile?.id]);

    const notificationActivityAlerts = useMemo(() => {
        return activityFeedItems
            .filter((item) => !item.seenAt && item.senderId !== profile?.id)
            .slice(0, 20);
    }, [activityFeedItems, profile?.id]);

    const hasPendingNotifications = pendingNotificationsCount > 0 || notificationActivityAlerts.length > 0;

    const weeklyGoalDays = Math.max(trainingDays.length, 1);
    const weeklyWorkouts = myLeaderboardEntry?.stats?.workoutsWeekly || 0;
    const weeklyProgress = Math.min(weeklyWorkouts, weeklyGoalDays);
    const weeklyProgressRatio = Math.min(1, weeklyProgress / weeklyGoalDays);

    return {
        incomingFriendRequestsList,
        activityFeedItems,
        notificationShares,
        stories,
        incomingFriendRequests,
        pendingRoutinesCount,
        totalUnseenCount,
        pendingNotificationsCount,
        hasPendingNotifications,
        myLeaderboardEntry,
        filteredLeaderboard,
        networkSectionMeta,
        filteredCommunityFeedItems,
        visibleUnseenFeedCount,
        hasActiveFeedFilters,
        profileWallItems,
        notificationActivityAlerts,
        weeklyGoalDays,
        weeklyProgress,
        weeklyProgressRatio,
    };
}
