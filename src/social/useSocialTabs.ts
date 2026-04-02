import { useCallback, useState } from 'react';

export type SocialTabKey = 'feed' | 'leaderboard' | 'friends';
export type SocialFriendsSubTab = 'friends' | 'search';

export function useSocialTabs() {
    const [activeTab, setActiveTab] = useState<SocialTabKey>('feed');
    const [friendsSubTab, setFriendsSubTab] = useState<SocialFriendsSubTab>('friends');

    const switchTab = useCallback((tab: SocialTabKey) => {
        setActiveTab(tab);
        if (tab !== 'friends') {
            setFriendsSubTab('friends');
        }
    }, []);

    return {
        activeTab,
        setActiveTab,
        friendsSubTab,
        setFriendsSubTab,
        switchTab,
    };
}
