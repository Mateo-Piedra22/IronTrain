import { useColors } from '@/src/hooks/useColors';
import { useDataReload } from '@/src/hooks/useDataReload';
import { useSharedSpaceSummary } from '@/src/hooks/useSharedSpaceSummary';
import { configService } from '@/src/services/ConfigService';
import { SocialFriend, SocialService } from '@/src/services/SocialService';
import { feedbackSelection, feedbackSoftImpact } from '@/src/social/feedback';
import { buildStories } from '@/src/social/socialSelectors';
import { useSocialActions } from '@/src/social/useSocialActions';
import { useSocialDerivedData } from '@/src/social/useSocialDerivedData';
import { useSocialRealtimeLifecycle } from '@/src/social/useSocialRealtimeLifecycle';
import { useSocialSearch } from '@/src/social/useSocialSearch';
import { useSocialTabs } from '@/src/social/useSocialTabs';
import { useAuthStore } from '@/src/store/authStore';
import { useNotificationStore } from '@/src/store/notificationStore';
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { useSocialStore } from '@/src/store/useSocialStore';
import { withAlpha } from '@/src/theme';
import * as analytics from '@/src/utils/analytics';
import { logger } from '@/src/utils/logger';
import * as Linking from 'expo-linking';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { Bell, CloudRain, Flame, Globe, Search, Settings, Trophy, UserCircle2, Users, Zap } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, LayoutAnimation, Modal, Platform, RefreshControl, ScrollView, Text, TouchableOpacity, UIManager, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { FriendsTab } from '@/components/social/FriendsTab';
import { LeaderboardTab } from '@/components/social/LeaderboardTab';
import { ProfileCard } from '@/components/social/ProfileCard';
import { SearchTab } from '@/components/social/SearchTab';
import { SharedSpaceHubModal } from '@/components/social/SharedSpaceHubModal';
import { useSocialStyles } from '@/components/social/social.styles';
import SocialFeedTab from '@/components/social/SocialFeedTab';
import {
    FriendDetailModal,
    GlobalEventModal,
    ProfileEditModal,
    ScoreInfoModal,
    WeatherBonusModal
} from '@/components/social/SocialModals';
import SocialNotificationsModal from '@/components/social/SocialNotificationsModal';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { formatSharedSpaceStatus, sharedSpaceCopy } from '@/src/social/sharedSpaceCopy';
import { sharedSpaceFeedback } from '@/src/social/sharedSpaceFeedback';
import { IronTrainLogo } from '../../components/IronTrainLogo';

const FEED_FILTERS_KEY = 'social_feed_filters_v1';
const BOOSTS_HINT_SEEN_KEY = 'social_boosts_hint_seen_v1';

export default function SocialTab() {
    const { user, login } = useAuthStore();
    const colors = useColors();
    const styles = useSocialStyles();
    const addToast = useNotificationStore(state => state.addToast);
    const router = useRouter();
    const navigation = useNavigation();

    // -- STATE --
    const {
        activeTab,
        setActiveTab,
        friendsSubTab,
        setFriendsSubTab,
        switchTab,
    } = useSocialTabs();
    const [refreshing, setRefreshing] = useState(false);

    // Global Data
    const {
        profile, leaderboard, friends, inbox, setInbox,
        loading, refreshingLocation, locationPermissionDenied, lastKnownLocation,
        loadData, refreshLocation, weatherHistory, loadWeatherHistory,
        realtimeConnected, realtimeSource, lastRealtimeSyncAt, startRealtimeSync, stopRealtimeSync,
    } = useSocialStore(useShallow((state) => ({
        profile: state.profile,
        leaderboard: state.leaderboard,
        friends: state.friends,
        inbox: state.inbox,
        setInbox: state.setInbox,
        loading: state.loading,
        refreshingLocation: state.refreshingLocation,
        locationPermissionDenied: state.locationPermissionDenied,
        lastKnownLocation: state.lastKnownLocation,
        loadData: state.loadData,
        refreshLocation: state.refreshLocation,
        weatherHistory: state.weatherHistory,
        loadWeatherHistory: state.loadWeatherHistory,
        realtimeConnected: state.realtimeConnected,
        realtimeSource: state.realtimeSource,
        lastRealtimeSyncAt: state.lastRealtimeSyncAt,
        startRealtimeSync: state.startRealtimeSync,
        stopRealtimeSync: state.stopRealtimeSync,
    })));

    // UI State
    const {
        searchQuery,
        setSearchQuery,
        searchResults,
        setSearchResults,
        searching,
        handleSearch,
    } = useSocialSearch({
        enabled: friendsSubTab === 'search',
        onError: () => addToast({ type: 'error', title: 'Error de búsqueda' }),
    });
    const [selectedFriend, setSelectedFriend] = useState<SocialFriend | null>(null);
    const [friendActionLoading, setFriendActionLoading] = useState(false);
    const [isScoreModalVisible, setIsScoreModalVisible] = useState(false);
    const [isEventModalVisible, setIsEventModalVisible] = useState(false);
    const [isWeatherModalVisible, setIsWeatherModalVisible] = useState(false);
    const [isMyProfileModalVisible, setIsMyProfileModalVisible] = useState(false);
    const [isProfileQuickPanelVisible, setIsProfileQuickPanelVisible] = useState(false);
    const [isFeedControlsExpanded, setIsFeedControlsExpanded] = useState(false);
    const [isNotificationsModalVisible, setIsNotificationsModalVisible] = useState(false);
    const [isWorkspaceHubVisible, setIsWorkspaceHubVisible] = useState(false);
    const [openingWorkspaceHub, setOpeningWorkspaceHub] = useState(false);
    const [isProfileExpanded, setIsProfileExpanded] = useState(false);
    const [isGoalsExpanded, setIsGoalsExpanded] = useState(false);
    const [showSeen, setShowSeen] = useState(false);
    const [hiddenFeedIds, setHiddenFeedIds] = useState<string[]>([]);
    const [trainingDays, setTrainingDays] = useState<number[]>([]);
    const [isFeedFiltersHydrated, setIsFeedFiltersHydrated] = useState(false);
    const [showBoostsHint, setShowBoostsHint] = useState(false);

    const {
        workspaceCount,
        pendingReviewsCount,
        reload: reloadSharedWorkspaceSummary,
    } = useSharedSpaceSummary({ includePendingReviews: true });

    // Leaderboard state
    const [rankingSegment, setRankingSegment] = useState<'weekly' | 'monthly' | 'lifetime'>('weekly');
    const [hideOwnActivity, setHideOwnActivity] = useState(false);
    const [typeFilter, setTypeFilter] = useState<'all' | 'pr' | 'workout' | 'routine'>('all');
    const [expandedFriendId, setExpandedFriendId] = useState<string | null>(null);
    const [comparisons, setComparisons] = useState<Record<string, any>>({});
    const [loadingCompare, setLoadingCompare] = useState(false);
    const feedTypeOptions: Array<{ value: 'all' | 'workout' | 'pr' | 'routine'; label: string }> = [
        { value: 'all', label: 'Todo' },
        { value: 'workout', label: 'Entrenos' },
        { value: 'pr', label: 'PRs' },
        { value: 'routine', label: 'Rutinas' },
    ];

    const {
        incomingFriendRequestsList,
        activityFeedItems: allActivityFeedItems,
        notificationShares,
        notificationActivityAlerts,
    } = useSocialDerivedData({
        profile,
        friends,
        inbox,
        leaderboard,
        rankingScope: 'global',
        searchResults,
        feedShowSeen: false,
        hiddenFeedIds,
        feedTypeFilter: 'all',
        trainingDays,
    });

    const activityFeedItems = useMemo(() => {
        return allActivityFeedItems.filter((item) => {
            if (!showSeen && item.seenAt) return false;
            if (hideOwnActivity && profile?.id && item.senderId === profile.id) return false;
            if (typeFilter === 'all') return true;
            if (typeFilter === 'pr') return item.actionType === 'pr_broken';
            if (typeFilter === 'workout') return item.actionType === 'workout_completed';
            if (typeFilter === 'routine') return item.actionType === 'routine_shared';
            return true;
        });
    }, [allActivityFeedItems, showSeen, hideOwnActivity, profile?.id, typeFilter]);
    const stories = useMemo(() => buildStories(activityFeedItems.filter(item => item.senderId !== profile?.id)), [activityFeedItems, profile?.id]);
    const selectedFriendUserId = useMemo(() => {
        if (!selectedFriend) return null;
        return selectedFriend.friendId || selectedFriend.id;
    }, [selectedFriend]);
    const selectedFriendLeaderboardEntry = useMemo(() => {
        if (!selectedFriendUserId) return null;
        return leaderboard.find((entry) => entry.id === selectedFriendUserId) ?? null;
    }, [selectedFriendUserId, leaderboard]);
    const selectedFriendComparisonPreview = useMemo(() => {
        if (!selectedFriendUserId) return [];
        return comparisons[selectedFriendUserId] ?? [];
    }, [selectedFriendUserId, comparisons]);

    const incomingFriendRequests = incomingFriendRequestsList.length;
    const pendingRoutinesCount = notificationShares.filter(i => i.status === 'pending' && !i.seenAt).length;
    const unseenActivitiesCount = activityFeedItems.filter(i => !i.seenAt).length;
    const totalUnseenCount = incomingFriendRequests + pendingRoutinesCount + unseenActivitiesCount;
    const pendingNotificationsCount = incomingFriendRequests + pendingRoutinesCount;

    // Profile Edit forms
    const [displayName, setDisplayName] = useState('');
    const [username, setUsername] = useState('');
    const [isPublic, setIsPublic] = useState(true);
    const [savingProfile, setSavingProfile] = useState(false);

    useFocusEffect(
        useCallback(() => {
            analytics.capture('social_tab_viewed');
            reloadSharedWorkspaceSummary();
        }, [reloadSharedWorkspaceSummary])
    );

    const loadTrainingDays = useCallback(async () => {
        const rawDays = configService.get('training_days');
        setTrainingDays(Array.isArray(rawDays) ? rawDays : [1, 2, 3, 4, 5, 6]);
    }, []);

    const fetchInitialData = useCallback(async (force = false, silent = false) => {
        if (!user) return;
        await loadData(force, silent);
        const p = useSocialStore.getState().profile;
        if (p) {
            setDisplayName(p.displayName || '');
            setUsername(p.username || '');
            const val = p.is_public !== undefined ? p.is_public : p.isPublic;
            setIsPublic(val !== 0 && val !== false);
        }
        setRefreshing(false);
    }, [user, loadData]);

    useDataReload(() => fetchInitialData(true, true), ['DATA_UPDATED', 'SYNC_COMPLETED', 'SOCIAL_UPDATED']);

    useEffect(() => {
        if (user) fetchInitialData();
    }, [user, fetchInitialData]);

    useEffect(() => {
        try {
            navigation.setOptions({
                tabBarBadge: totalUnseenCount > 0 ? totalUnseenCount : undefined,
            } as any);
        } catch {
            // no-op
        }
    }, [navigation, totalUnseenCount]);

    useDataReload(loadTrainingDays, ['SETTINGS_UPDATED']);

    useEffect(() => {
        const raw = (configService as any).get(FEED_FILTERS_KEY) as {
            showSeen?: boolean;
            hideOwnActivity?: boolean;
            typeFilter?: 'all' | 'pr' | 'workout' | 'routine';
        } | null;

        if (raw) {
            if (typeof raw.showSeen === 'boolean') setShowSeen(raw.showSeen);
            if (typeof raw.hideOwnActivity === 'boolean') setHideOwnActivity(raw.hideOwnActivity);
            if (raw.typeFilter && ['all', 'pr', 'workout', 'routine'].includes(raw.typeFilter)) {
                setTypeFilter(raw.typeFilter);
            }
        }

        setIsFeedFiltersHydrated(true);
    }, []);

    useEffect(() => {
        const seen = (configService as any).get(BOOSTS_HINT_SEEN_KEY) as boolean | null;
        setShowBoostsHint(seen !== true);
    }, []);

    useEffect(() => {
        if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
            UIManager.setLayoutAnimationEnabledExperimental(true);
        }
    }, []);

    useEffect(() => {
        if (!isFeedFiltersHydrated) return;

        const save = async () => {
            try {
                await (configService as any).set(FEED_FILTERS_KEY, {
                    showSeen,
                    hideOwnActivity,
                    typeFilter,
                });
            } catch (err) {
                logger.captureException(err, { scope: 'SocialTab.persistFeedFilters' });
            }
        };
        void save();
    }, [showSeen, hideOwnActivity, typeFilter, isFeedFiltersHydrated]);

    useFocusEffect(
        useCallback(() => {
            const handleBack = () => {
                if (isProfileQuickPanelVisible) {
                    setIsProfileQuickPanelVisible(false);
                    return true;
                }

                if (isNotificationsModalVisible) {
                    setIsNotificationsModalVisible(false);
                    return true;
                }

                if (activeTab !== 'feed') {
                    setIsProfileQuickPanelVisible(false);
                    setActiveTab('feed');
                    setFriendsSubTab('friends');
                    return true;
                }

                return false;
            };

            const backSubscription = BackHandler.addEventListener('hardwareBackPress', handleBack);
            const removeSubscription = (navigation as any).addListener?.('beforeRemove', (event: any) => {
                if (isProfileQuickPanelVisible) {
                    event.preventDefault();
                    setIsProfileQuickPanelVisible(false);
                    return;
                }

                if (isNotificationsModalVisible) {
                    event.preventDefault();
                    setIsNotificationsModalVisible(false);
                    return;
                }

                if (activeTab !== 'feed') {
                    event.preventDefault();
                    setIsProfileQuickPanelVisible(false);
                    setActiveTab('feed');
                    setFriendsSubTab('friends');
                }
            });

            return () => {
                backSubscription.remove();
                removeSubscription?.();
            };
        }, [
            activeTab,
            isNotificationsModalVisible,
            isProfileQuickPanelVisible,
            navigation,
        ])
    );

    useSocialRealtimeLifecycle({
        enabled: !!user,
        loadTrainingDays,
        refreshLocation,
        startRealtimeSync,
        stopRealtimeSync,
        onViewed: () => analytics.capture('social_tab_viewed'),
    });

    const handleRefresh = () => {
        setRefreshing(true);
        // Refresh data from API
        fetchInitialData(true);
        // Also quietly refresh GPS location in background since user explicitly pulled to refresh
        refreshLocation(true);
    };

    const handleOpenPublicRoutines = useCallback(async () => {
        Alert.alert(
            'Abrir enlace externo',
            'Vas a salir de la app para abrir el marketplace de rutinas.',
            [
                {
                    text: 'Cancelar',
                    style: 'cancel',
                },
                {
                    text: 'Abrir',
                    onPress: async () => {
                        try {
                            await Linking.openURL('https://irontrain.motiona.xyz/feed');
                        } catch {
                            addToast({ type: 'error', title: 'Error', message: 'No se pudo abrir la página de rutinas públicas.' });
                        }
                    },
                },
            ],
            { cancelable: true },
        );
    }, [addToast]);

    const handleUpdateProfile = async () => {
        if (!displayName.trim() || displayName.length < 2) {
            addToast({ type: 'error', title: 'Nombre muy corto' });
            return;
        }
        setSavingProfile(true);
        try {
            await SocialService.updateProfile(
                displayName.trim(),
                username.trim() || null,
                isPublic ? 1 : 0
            );
            setIsMyProfileModalVisible(false);
            fetchInitialData(true);
            addToast({ type: 'success', title: 'Perfil actualizado' });
        } catch (err: any) {
            addToast({ type: 'error', title: 'Error', message: err.message });
        } finally {
            setSavingProfile(false);
        }
    };

    const handleExpandFriend = async (friendId: string) => {
        if (profile?.id && friendId === profile.id) {
            return;
        }
        if (expandedFriendId === friendId) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setExpandedFriendId(null);
            return;
        }

        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedFriendId(friendId);

        // Load comparison if not already loaded
        if (!comparisons[friendId]) {
            setLoadingCompare(true);
            try {
                const data = await SocialService.compareFriend(friendId);
                setComparisons(prev => ({ ...prev, [friendId]: data }));
            } catch (err) {
                logger.captureException(err, { scope: 'SocialTab.compareFriend' });
                addToast({ type: 'error', title: 'Comparación', message: 'No se pudo comparar la fuerza en este momento.' });
            } finally {
                setLoadingCompare(false);
            }
        }
    };

    const handleToggleTrainingDay = async (dayId: number) => {
        const isSelected = trainingDays.includes(dayId);
        const newDays = isSelected
            ? trainingDays.filter(d => d !== dayId)
            : [...trainingDays, dayId].sort((a, b) => a - b);

        setTrainingDays(newDays);
        try {
            await configService.set('training_days', newDays);
            await useSettingsStore.getState().setTrainingDays(newDays);
            try {
                await SocialService.updateTrainingDays(newDays);
            } catch (networkError) {
                logger.captureException(networkError, { scope: 'SocialTab.updateTrainingDaysRemote' });
            }
        } catch (err) {
            logger.captureException(err, { scope: 'SocialTab.updateTrainingDays' });
            addToast({ type: 'error', title: 'Meta semanal', message: 'No se pudo guardar tu configuración.' });
        }
    };

    const filteredCommunityFeedItems = useMemo(
        () => activityFeedItems.filter((item) => item.senderId !== profile?.id),
        [activityFeedItems, profile?.id]
    );

    const {
        handleSendFriendRequest,
        handleAcceptFriend,
        handleRejectFriend,
        handleFriendModalAction,
        handleInboxResponse,
        handleToggleKudo,
        handleMarkAsSeen,
        handleMarkAllAsSeen,
        handleCopyProfileId,
    } = useSocialActions({
        addToast,
        fetchInitialData,
        setSearchResults,
        selectedFriend,
        setSelectedFriend,
        setFriendActionLoading,
        setInbox,
        notificationShares,
        filteredCommunityFeedItems,
        hiddenFeedIds,
        setHiddenFeedIds,
        profileId: profile?.id,
    });

    const handleOpenFriendInRanking = async (friendUserId: string) => {
        setSelectedFriend(null);
        setActiveTab('leaderboard');
        await handleExpandFriend(friendUserId);
    };

    const handleClearFeedNotifications = useCallback(async () => {
        const unseenActivity = allActivityFeedItems.filter(item => !item.seenAt);
        const unseenShares = notificationShares.filter(item => !item.seenAt);
        const totalUnseen = unseenActivity.length + unseenShares.length;

        if (totalUnseen === 0) {
            addToast({ type: 'info', title: 'Feed limpio', message: 'No hay notificaciones pendientes.' });
            return;
        }

        const now = new Date().toISOString();
        const unseenIds = new Set([...unseenActivity, ...unseenShares].map(item => item.id));
        setInbox(current => current.map(item => unseenIds.has(item.id) ? ({ ...item, seenAt: item.seenAt || now }) : item));
        setShowSeen(false);

        try {
            await Promise.all([
                ...unseenActivity.map((item) => SocialService.markAsSeen(item.id, 'activity_log')),
                unseenShares.length > 0 ? SocialService.markAllAsSeen(unseenShares) : Promise.resolve(),
            ]);
            addToast({ type: 'success', title: 'Notificaciones limpiadas', message: `${totalUnseen} elementos marcados como vistos.` });
        } catch (err) {
            logger.captureException(err, { scope: 'SocialTab.clearFeedNotifications' });
            addToast({ type: 'error', title: 'Sincronización', message: 'Se marcaron localmente, pero hubo un problema al sincronizar.' });
        }
    }, [allActivityFeedItems, notificationShares, setInbox, addToast]);

    const handleSwitchTab = useCallback((tab: 'feed' | 'leaderboard' | 'friends') => {
        feedbackSelection();
        setIsProfileQuickPanelVisible(false);
        switchTab(tab);
    }, [switchTab]);

    const handleOpenWorkspaceHub = useCallback(() => {
        if (openingWorkspaceHub) return;
        sharedSpaceFeedback.openHub();
        setOpeningWorkspaceHub(true);
        setIsWorkspaceHubVisible(true);
        setTimeout(() => setOpeningWorkspaceHub(false), 220);
    }, [openingWorkspaceHub]);

    const renderSectionHeader = useCallback((title: string) => {
        return (
            <View style={{ marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.inboxStatusTitle}>{title}</Text>
                <TouchableOpacity style={styles.archiveToggle} onPress={() => handleSwitchTab('feed')}>
                    <Text style={styles.archiveToggleText}>Volver al feed</Text>
                </TouchableOpacity>
            </View>
        );
    }, [styles, handleSwitchTab]);

    const renderSharedProfileHeader = useCallback(() => {
        if (!profile) return null;

        const hasActiveFeedFilters = showSeen || hideOwnActivity || typeFilter !== 'all';
        const eventMultiplier = profile.activeEvent?.multiplier ?? 1;
        const eventTitle = (profile.activeEvent?.title || 'Evento especial').trim();
        const eventTitleLower = eventTitle.toLowerCase();
        const weatherMultiplier = profile.weatherBonus?.multiplier ?? 1;
        const weatherBoostActive = Boolean(profile.weatherBonus?.isActive) || weatherMultiplier > 1;
        const hasBoosts = eventMultiplier > 1 || weatherBoostActive;
        const weatherCondition = (profile.weatherBonus?.condition || '').toLowerCase();

        let eventChipLabel = eventTitle.length > 24 ? 'Evento especial' : eventTitle;
        let eventChipBorder = colors.primary.DEFAULT;
        let eventChipType: 'default' | 'streak' | 'pr' | 'weather' = 'default';

        if (eventTitleLower.includes('racha') || eventTitleLower.includes('streak')) {
            eventChipLabel = 'Evento de racha';
            eventChipBorder = colors.red || colors.primary.DEFAULT;
            eventChipType = 'streak';
        } else if (eventTitleLower.includes('pr') || eventTitleLower.includes('récord') || eventTitleLower.includes('record')) {
            eventChipLabel = 'Evento de PR';
            eventChipBorder = colors.yellow || colors.primary.DEFAULT;
            eventChipType = 'pr';
        } else if (eventTitleLower.includes('clima') || eventTitleLower.includes('weather')) {
            eventChipLabel = 'Evento climático';
            eventChipBorder = colors.blue || colors.primary.DEFAULT;
            eventChipType = 'weather';
        }

        let weatherChipLabel = 'Clima exigente';
        let weatherChipBorder = colors.primary.DEFAULT;

        if (weatherCondition.includes('frio') || weatherCondition.includes('frío') || weatherCondition.includes('cold') || weatherCondition.includes('nieve') || weatherCondition.includes('snow')) {
            weatherChipLabel = 'Frío extremo';
            weatherChipBorder = colors.blue || colors.primary.DEFAULT;
        } else if (weatherCondition.includes('calor') || weatherCondition.includes('heat') || weatherCondition.includes('hot')) {
            weatherChipLabel = 'Calor extremo';
            weatherChipBorder = colors.red || colors.primary.DEFAULT;
        } else if (weatherCondition.includes('lluv') || weatherCondition.includes('rain') || weatherCondition.includes('torment') || weatherCondition.includes('storm')) {
            weatherChipLabel = 'Lluvia/Tormenta';
            weatherChipBorder = colors.blue || colors.primary.DEFAULT;
        } else if (weatherCondition.includes('viento') || weatherCondition.includes('wind')) {
            weatherChipLabel = 'Viento fuerte';
            weatherChipBorder = colors.yellow || colors.primary.DEFAULT;
        }

        const baseWorkoutPoints = profile.scoreConfig?.workoutCompletePoints ?? 0;
        const streakMultiplier = profile.streakMultiplier ?? 1;
        const effectiveWorkoutPoints = Math.round(baseWorkoutPoints * eventMultiplier * (weatherBoostActive ? weatherMultiplier : 1) * streakMultiplier);

        return (
            <View style={{ marginBottom: 14 }}>
                <View style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 12, gap: 10 }}>
                        <View style={{ gap: 3 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Text style={styles.inboxStatusTitle}>Feed de comunidad</Text>
                                <TouchableOpacity
                                    style={styles.archiveToggle}
                                    onPress={() => {
                                        feedbackSoftImpact();
                                        setIsFeedControlsExpanded((prev) => !prev);
                                    }}
                                >
                                    {isFeedControlsExpanded ? (
                                        <Text style={styles.archiveToggleText}>Ocultar ajustes</Text>
                                    ) : (
                                        <Settings size={16} color={colors.textMuted} />
                                    )}
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.friendStatus}>Vista limpia por defecto, con filtros bajo demanda</Text>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <View style={{ flex: 1, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceLighter, paddingHorizontal: 10, paddingVertical: 8 }}>
                                <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800' }}>PUBLICACIONES</Text>
                                <Text style={{ color: colors.text, fontWeight: '900', marginTop: 2, fontSize: 16 }}>{activityFeedItems.length}</Text>
                            </View>
                            <View style={{ flex: 1, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceLighter, paddingHorizontal: 10, paddingVertical: 8 }}>
                                <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800' }}>NUEVAS</Text>
                                <Text style={{ color: colors.text, fontWeight: '900', marginTop: 2, fontSize: 16 }}>{unseenActivitiesCount}</Text>
                            </View>
                        </View>

                        {hasBoosts && (
                            <View style={{ borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceLighter, paddingHorizontal: 10, paddingVertical: 8, gap: 6 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800' }}>BOOSTS ACTIVOS</Text>
                                    {showBoostsHint && (
                                        <TouchableOpacity
                                            style={[styles.archiveToggle, { minHeight: 26, paddingHorizontal: 8, paddingVertical: 4 }]}
                                            onPress={async () => {
                                                feedbackSelection();
                                                setShowBoostsHint(false);
                                                try {
                                                    await (configService as any).set(BOOSTS_HINT_SEEN_KEY, true);
                                                } catch {
                                                    // no-op
                                                }
                                            }}
                                        >
                                            <Text style={[styles.archiveToggleText, { fontSize: 10 }]}>Entendido</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                                    {eventMultiplier > 1 && (
                                        <TouchableOpacity
                                            style={[styles.archiveToggle, { minHeight: 30, paddingHorizontal: 10, backgroundColor: colors.surface, borderColor: eventChipBorder, flexDirection: 'row', alignItems: 'center', gap: 6 }]}
                                            onPress={() => {
                                                feedbackSelection();
                                                setIsEventModalVisible(true);
                                            }}
                                        >
                                            {eventChipType === 'streak' ? (
                                                <Flame size={13} color={eventChipBorder} />
                                            ) : eventChipType === 'pr' ? (
                                                <Trophy size={13} color={eventChipBorder} />
                                            ) : eventChipType === 'weather' ? (
                                                <CloudRain size={13} color={eventChipBorder} />
                                            ) : (
                                                <Zap size={13} color={eventChipBorder} />
                                            )}
                                            <Text style={[styles.archiveToggleText, { fontWeight: '800' }]}>{eventChipLabel} x{eventMultiplier.toFixed(2)}</Text>
                                        </TouchableOpacity>
                                    )}
                                    {weatherBoostActive && (
                                        <TouchableOpacity
                                            style={[styles.archiveToggle, { minHeight: 30, paddingHorizontal: 10, backgroundColor: colors.surface, borderColor: weatherChipBorder, flexDirection: 'row', alignItems: 'center', gap: 6 }]}
                                            onPress={() => {
                                                feedbackSelection();
                                                setIsWeatherModalVisible(true);
                                            }}
                                        >
                                            <CloudRain size={13} color={weatherChipBorder} />
                                            <Text style={[styles.archiveToggleText, { fontWeight: '800' }]}>
                                                {weatherMultiplier > 1 ? `${weatherChipLabel} x${weatherMultiplier.toFixed(2)}` : `${weatherChipLabel} activo`}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                    {baseWorkoutPoints > 0 && (
                                        <TouchableOpacity
                                            style={[styles.archiveToggle, { minHeight: 30, paddingHorizontal: 10, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 6 }]}
                                            onPress={() => {
                                                feedbackSelection();
                                                setIsProfileQuickPanelVisible(true);
                                            }}
                                        >
                                            <Zap size={13} color={colors.primary.DEFAULT} />
                                            <Text style={[styles.archiveToggleText, { fontWeight: '800' }]}>+{effectiveWorkoutPoints} pts/ent</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                                {showBoostsHint && (
                                    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600' }}>
                                        Tip: tocá cualquier boost para ver cómo se calcula y sus detalles.
                                    </Text>
                                )}
                            </View>
                        )}

                        {isFeedControlsExpanded && (
                            <>
                                <View style={{ gap: 8 }}>
                                    <Text style={{ color: colors.textMuted, fontWeight: '800', fontSize: 11 }}>VISIBILIDAD</Text>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <TouchableOpacity
                                            style={[styles.archiveToggle, { flex: 1, justifyContent: 'center' }, !showSeen && styles.archiveToggleActive]}
                                            onPress={() => {
                                                feedbackSelection();
                                                setShowSeen(false);
                                            }}
                                        >
                                            <Text style={[styles.archiveToggleText, { textAlign: 'center' }, !showSeen && styles.archiveToggleTextActive]}>Solo nuevas</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.archiveToggle, { flex: 1, justifyContent: 'center' }, showSeen && styles.archiveToggleActive]}
                                            onPress={() => {
                                                feedbackSelection();
                                                setShowSeen(true);
                                            }}
                                        >
                                            <Text style={[styles.archiveToggleText, { textAlign: 'center' }, showSeen && styles.archiveToggleTextActive]}>Nuevas + vistas</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={{ gap: 8 }}>
                                    <Text style={{ color: colors.textMuted, fontWeight: '800', fontSize: 11 }}>TIPO DE CONTENIDO</Text>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        {feedTypeOptions.map((option) => (
                                            <TouchableOpacity
                                                key={option.value}
                                                style={[
                                                    styles.archiveToggle,
                                                    { flex: 1, minHeight: 34, justifyContent: 'center', paddingHorizontal: 8 },
                                                    typeFilter === option.value && styles.archiveToggleActive,
                                                ]}
                                                onPress={() => {
                                                    feedbackSelection();
                                                    setTypeFilter(option.value);
                                                }}
                                            >
                                                <Text
                                                    numberOfLines={1}
                                                    style={[styles.archiveToggleText, { textAlign: 'center' }, typeFilter === option.value && styles.archiveToggleTextActive]}
                                                >
                                                    {option.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <TouchableOpacity
                                        style={[styles.archiveToggle, { flex: 1, justifyContent: 'center', minHeight: 36 }, hideOwnActivity && styles.archiveToggleActive]}
                                        onPress={() => {
                                            feedbackSelection();
                                            setHideOwnActivity((prev) => !prev);
                                        }}
                                    >
                                        <Text
                                            numberOfLines={1}
                                            style={[styles.archiveToggleText, { textAlign: 'center' }, hideOwnActivity && styles.archiveToggleTextActive]}
                                        >
                                            {hideOwnActivity ? 'Solo comunidad' : 'Mis posts + comunidad'}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.archiveToggle,
                                            { width: 94, justifyContent: 'center', minHeight: 36, opacity: totalUnseenCount > 0 ? 1 : 0.5 },
                                        ]}
                                        disabled={totalUnseenCount === 0}
                                        onPress={() => {
                                            feedbackSoftImpact();
                                            handleClearFeedNotifications();
                                        }}
                                    >
                                        <Text style={styles.archiveToggleText}>Limpiar</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>
            </View>
        );
    }, [
        profile,
        colors,
        styles,
        showSeen,
        hideOwnActivity,
        typeFilter,
        activityFeedItems.length,
        unseenActivitiesCount,
        totalUnseenCount,
        handleClearFeedNotifications,
        isFeedControlsExpanded,
        showBoostsHint,
    ]);

    if (!user) {
        return (
            <SafeAreaWrapper style={styles.container} centered contentStyle={{ alignItems: 'center', justifyContent: 'center' }}>
                <View style={styles.loggedOutContainer}>
                    <View style={styles.loggedOutIcon}>
                        <Globe size={48} color={colors.textMuted} />
                    </View>
                    <Text style={styles.loggedOutTitle}>Conectate a IronSocial</Text>
                    <Text style={styles.loggedOutSub}>
                        Sincronizá tus rutinas, compartilas con amigos y descubrí la comunidad IronTrain.
                    </Text>
                    <TouchableOpacity style={styles.loginBtn} onPress={() => login()}>
                        <Text style={styles.loginBtnText}>Iniciar Sesión</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.signupBtn} onPress={() => login()}>
                        <Text style={styles.signupBtnText}>Crear Cuenta</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaWrapper>
        );
    }

    return (
        <SafeAreaWrapper style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.title}>IronSocial</Text>
                    {loading && (
                        <View style={styles.headerLoadingWrapper}>
                            <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
                        </View>
                    )}
                </View>
                <View style={styles.headerCenterIconWrapper}>
                    <IronTrainLogo size={60} />
                </View>
                <View style={styles.headerActionsBox}>
                    <TouchableOpacity
                        style={styles.headerIconBtn}
                        onPress={() => {
                            handleSwitchTab('friends');
                            setFriendsSubTab('search');
                        }}
                    >
                        <Search size={20} color={colors.primary.DEFAULT} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.headerIconBtn}
                        onPress={() => {
                            feedbackSelection();
                            setIsNotificationsModalVisible(true);
                        }}
                    >
                        <Bell size={20} color={colors.primary.DEFAULT} />
                        {pendingNotificationsCount > 0 && (
                            <View style={styles.inboxBadge}>
                                <Text style={styles.inboxBadgeText}>{pendingNotificationsCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.headerIconBtn}
                        onPress={() => {
                            feedbackSelection();
                            setIsProfileQuickPanelVisible(true);
                        }}
                    >
                        <UserCircle2 size={20} color={colors.primary.DEFAULT} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.tabContent}>
                {loading && !refreshing ? (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
                        <Text style={[styles.emptyText, { marginTop: 12 }]}>Sincronizando comunidad...</Text>
                    </View>
                ) : (
                    <>
                        {activeTab === 'feed' && (
                            <SocialFeedTab
                                items={activityFeedItems}
                                profile={profile}
                                stories={stories}
                                isLive={realtimeConnected}
                                liveSource={realtimeSource}
                                lastLiveSyncAt={lastRealtimeSyncAt}
                                renderHeader={renderSharedProfileHeader}
                                refreshing={refreshing}
                                onRefresh={handleRefresh}
                                onToggleKudo={handleToggleKudo}
                                onMarkAsSeen={handleMarkAsSeen}
                                onCopyRoutine={(item) => {
                                    if (item.payload) {
                                        handleInboxResponse(item.id, 'accept', item.payload);
                                    }
                                }}
                                onOpenStory={(story) => {
                                    setSearchQuery(story.username ? `@${story.username}` : story.name);
                                    handleSwitchTab('friends');
                                    setFriendsSubTab('search');
                                }}
                                colors={colors}
                                styles={styles}
                            />
                        )}
                        {activeTab === 'leaderboard' && (
                            <ScrollView
                                contentContainerStyle={styles.scrollContent}
                                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary.DEFAULT} />}
                            >
                                {renderSectionHeader('Ranking social')}
                                <LeaderboardTab
                                    leaderboard={leaderboard}
                                    profile={profile}
                                    rankingSegment={rankingSegment}
                                    expandedFriendId={expandedFriendId}
                                    comparisons={comparisons}
                                    loadingCompare={loadingCompare}
                                    onExpandFriend={handleExpandFriend}
                                    onShowScoreInfo={() => setIsScoreModalVisible(true)}
                                    setRankingSegment={setRankingSegment}
                                    isLive={realtimeConnected}
                                    liveSource={realtimeSource}
                                    lastLiveSyncAt={lastRealtimeSyncAt}
                                    colors={colors}
                                    styles={styles}
                                />
                            </ScrollView>
                        )}
                        {activeTab === 'friends' && (
                            <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 8 }}>
                                {renderSectionHeader('Amigos')}

                                <TouchableOpacity
                                    style={{
                                        borderRadius: 10,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                        backgroundColor: colors.surfaceLighter,
                                        paddingHorizontal: 10,
                                        paddingVertical: 9,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        marginBottom: 10,
                                    }}
                                    onPress={handleOpenWorkspaceHub}
                                    disabled={openingWorkspaceHub}
                                >
                                    <View>
                                        <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800' }}>{sharedSpaceCopy.statLabel}</Text>
                                        <Text style={{ color: colors.text, fontWeight: '900', marginTop: 2, fontSize: 14 }}>
                                            {formatSharedSpaceStatus(workspaceCount, pendingReviewsCount)}
                                        </Text>
                                    </View>
                                    <View style={[styles.archiveToggle, pendingReviewsCount > 0 && { borderColor: colors.yellow }]}>
                                        <Text style={styles.archiveToggleText}>
                                            {openingWorkspaceHub ? 'Abriendo...' : (pendingReviewsCount > 0 ? sharedSpaceCopy.ctaReviewNow : sharedSpaceCopy.ctaOpenHub)}
                                        </Text>
                                    </View>
                                </TouchableOpacity>

                                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                                    <TouchableOpacity
                                        style={[styles.archiveToggle, { flex: 1, justifyContent: 'center' }, friendsSubTab === 'friends' && styles.archiveToggleActive]}
                                        onPress={() => {
                                            feedbackSelection();
                                            setFriendsSubTab('friends');
                                        }}
                                    >
                                        <Text style={[styles.archiveToggleText, { textAlign: 'center' }, friendsSubTab === 'friends' && styles.archiveToggleTextActive]}>
                                            Mis amigos
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.archiveToggle, { flex: 1, justifyContent: 'center' }, friendsSubTab === 'search' && styles.archiveToggleActive]}
                                        onPress={() => {
                                            feedbackSelection();
                                            setFriendsSubTab('search');
                                        }}
                                    >
                                        <Text style={[styles.archiveToggleText, { textAlign: 'center' }, friendsSubTab === 'search' && styles.archiveToggleTextActive]}>
                                            Buscar atletas
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={{ flex: 1 }}>
                                    {friendsSubTab === 'friends' ? (
                                        <FriendsTab
                                            friends={friends}
                                            onAcceptRequest={handleAcceptFriend}
                                            onRejectRequest={handleRejectFriend}
                                            onShowFriendActions={setSelectedFriend}
                                            colors={colors}
                                            styles={styles}
                                            refreshing={refreshing}
                                            onRefresh={handleRefresh}
                                        />
                                    ) : (
                                        <SearchTab
                                            searchQuery={searchQuery}
                                            setSearchQuery={setSearchQuery}
                                            onSearch={handleSearch}
                                            searchResults={searchResults}
                                            onSendRequest={handleSendFriendRequest}
                                            loading={searching}
                                            colors={colors}
                                            styles={styles}
                                            refreshing={refreshing}
                                            onRefresh={handleRefresh}
                                        />
                                    )}
                                </View>
                            </View>
                        )}
                    </>
                )}
            </View>

            <Modal
                visible={isProfileQuickPanelVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setIsProfileQuickPanelVisible(false)}
            >
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: withAlpha(colors.background, '2E'), paddingHorizontal: 16 }}>
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={() => setIsProfileQuickPanelVisible(false)}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                    />

                    <View style={[styles.detailModalCard, { width: '94%', maxWidth: 440, maxHeight: '88%', padding: 18, borderRadius: 20, backgroundColor: colors.surface }]}>
                        <View style={[styles.detailIconCircle, { width: 72, height: 72, borderRadius: 36, marginBottom: 12, borderColor: colors.primary.DEFAULT, backgroundColor: withAlpha(colors.primary.DEFAULT, '15') }]}>
                            <UserCircle2 size={30} color={colors.primary.DEFAULT} />
                        </View>

                        <View style={{ marginBottom: 8, width: '100%' }}>
                            <TouchableOpacity
                                style={[styles.modalCloseBtn, { position: 'absolute', right: 0, top: 0, zIndex: 2 }]}
                                onPress={() => {
                                    feedbackSelection();
                                    setIsProfileQuickPanelVisible(false);
                                }}
                            >
                                <Text style={{ color: colors.textMuted, fontWeight: '900' }}>Cerrar</Text>
                            </TouchableOpacity>
                            <View style={{ alignItems: 'center', paddingHorizontal: 56 }}>
                                <Text style={styles.detailTitle}>Tu perfil</Text>
                                <Text style={{ color: colors.textMuted, fontWeight: '700', fontSize: 12, marginTop: 2, textAlign: 'center' }}>Accesos rápidos y configuración social</Text>
                            </View>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            style={{ width: '100%' }}
                            contentContainerStyle={{ paddingTop: 6, paddingBottom: 4 }}
                        >
                            <ProfileCard
                                profile={profile}
                                isProfileExpanded={isProfileExpanded}
                                setIsProfileExpanded={setIsProfileExpanded}
                                isGoalsExpanded={isGoalsExpanded}
                                setIsGoalsExpanded={setIsGoalsExpanded}
                                trainingDays={trainingDays}
                                onToggleTrainingDay={handleToggleTrainingDay}
                                onCopyId={handleCopyProfileId}
                                onEditProfile={() => {
                                    setIsProfileQuickPanelVisible(false);
                                    setIsMyProfileModalVisible(true);
                                }}
                                onShowEventModal={() => {
                                    setIsProfileQuickPanelVisible(false);
                                    setIsEventModalVisible(true);
                                }}
                                onShowWeatherModal={() => {
                                    setIsProfileQuickPanelVisible(false);
                                    setIsWeatherModalVisible(true);
                                }}
                                onRefreshLocation={refreshLocation}
                                locationPermissionDenied={locationPermissionDenied}
                                lastKnownLocation={lastKnownLocation}
                                refreshingLocation={refreshingLocation}
                                colors={colors}
                                styles={styles}
                            />
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <SocialNotificationsModal
                visible={isNotificationsModalVisible}
                onClose={() => setIsNotificationsModalVisible(false)}
                incomingFriendRequests={incomingFriendRequestsList}
                shares={notificationShares.filter(i => !i.seenAt || i.status === 'pending')}
                activityAlerts={notificationActivityAlerts}
                onAcceptFriend={handleAcceptFriend}
                onRejectFriend={handleRejectFriend}
                onAcceptShare={(inboxId, payload) => handleInboxResponse(inboxId, 'accept', payload)}
                onRejectShare={(inboxId) => handleInboxResponse(inboxId, 'reject')}
                onOpenActivity={async (activityId) => {
                    await handleMarkAsSeen(activityId, 'activity_log');
                    setIsNotificationsModalVisible(false);
                    handleSwitchTab('feed');
                }}
                onMarkAllSeen={handleMarkAllAsSeen}
                colors={colors}
                styles={styles}
            />

            <SharedSpaceHubModal
                visible={isWorkspaceHubVisible}
                onClose={() => {
                    setIsWorkspaceHubVisible(false);
                    setOpeningWorkspaceHub(false);
                    reloadSharedWorkspaceSummary();
                }}
                onOpenRoutine={() => {
                    router.push('/(tabs)/exercises');
                }}
            />

            <ProfileEditModal
                visible={isMyProfileModalVisible}
                onClose={() => setIsMyProfileModalVisible(false)}
                displayName={displayName}
                setDisplayName={setDisplayName}
                username={username}
                setUsername={setUsername}
                isPublic={isPublic}
                setIsPublic={setIsPublic}
                onSave={handleUpdateProfile}
                saving={savingProfile}
                profile={profile}
                colors={colors}
                styles={styles}
            />

            <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
                <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface, padding: 8 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity style={[styles.archiveToggle, { flex: 1, minWidth: 0, minHeight: 34, justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 6, gap: 4 }, activeTab === 'leaderboard' && styles.archiveToggleActive]} onPress={() => handleSwitchTab('leaderboard')}>
                            <Trophy size={12} color={activeTab === 'leaderboard' ? colors.onPrimary : colors.textMuted} />
                            <Text numberOfLines={1} style={[styles.archiveToggleText, { textAlign: 'center', fontSize: 11 }, activeTab === 'leaderboard' && styles.archiveToggleTextActive]}>Ranking</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.archiveToggle, { flex: 1, minWidth: 0, minHeight: 34, justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 6, gap: 4 }, activeTab === 'friends' && styles.archiveToggleActive]} onPress={() => handleSwitchTab('friends')}>
                            <Users size={12} color={activeTab === 'friends' ? colors.onPrimary : colors.textMuted} />
                            <Text numberOfLines={1} style={[styles.archiveToggleText, { textAlign: 'center', fontSize: 11 }, activeTab === 'friends' && styles.archiveToggleTextActive]}>Amigos</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.archiveToggle, { flex: 1, minWidth: 0, minHeight: 34, justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 6, gap: 4 }]} onPress={handleOpenPublicRoutines}>
                            <Globe size={12} color={colors.textMuted} />
                            <Text numberOfLines={1} style={[styles.archiveToggleText, { textAlign: 'center', fontSize: 11 }]}>Rutinas</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.archiveToggle, { flex: 1, minWidth: 0, minHeight: 34, justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 6, gap: 4 }]} onPress={() => router.push('/settings' as any)}>
                            <Settings size={12} color={colors.textMuted} />
                            <Text numberOfLines={1} style={[styles.archiveToggleText, { textAlign: 'center', fontSize: 11 }]}>Ajustes</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <FriendDetailModal
                visible={!!selectedFriend}
                onClose={() => setSelectedFriend(null)}
                friend={selectedFriend}
                friendLeaderboardEntry={selectedFriendLeaderboardEntry}
                friendComparisonPreview={selectedFriendComparisonPreview}
                onAction={handleFriendModalAction}
                onOpenComparison={handleOpenFriendInRanking}
                loading={friendActionLoading}
                colors={colors}
                styles={styles}
            />

            <ScoreInfoModal
                visible={isScoreModalVisible}
                onClose={() => setIsScoreModalVisible(false)}
                profile={profile}
                colors={colors}
                styles={styles}
            />

            <GlobalEventModal
                visible={isEventModalVisible}
                onClose={() => setIsEventModalVisible(false)}
                event={profile?.activeEvent}
                colors={colors}
                styles={styles}
            />

            <WeatherBonusModal
                visible={isWeatherModalVisible}
                onClose={() => setIsWeatherModalVisible(false)}
                profile={profile}
                refreshingLocation={refreshingLocation}
                onRefreshLocation={refreshLocation}
                weatherHistory={weatherHistory}
                onLoadHistory={loadWeatherHistory}
                colors={colors}
                styles={styles}
            />
        </SafeAreaWrapper >
    );
}
