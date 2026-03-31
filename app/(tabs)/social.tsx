import { useColors } from '@/src/hooks/useColors';
import { useDataReload } from '@/src/hooks/useDataReload';
import { configService } from '@/src/services/ConfigService';
import { routineService } from '@/src/services/RoutineService';
import { SocialFriend, SocialSearchUser, SocialService } from '@/src/services/SocialService';
import { buildStories, selectActivityFeed, selectIncomingFriendRequests, selectNotificationShares } from '@/src/social/socialSelectors';
import { useAuthStore } from '@/src/store/authStore';
import { confirm } from '@/src/store/confirmStore';
import { useNotificationStore } from '@/src/store/notificationStore';
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { useSocialStore } from '@/src/store/useSocialStore';
import * as analytics from '@/src/utils/analytics';
import { logger } from '@/src/utils/logger';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { Bell, Globe, Search, Settings, Trophy, UserCircle2, Users } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { FriendsTab } from '@/components/social/FriendsTab';
import InboxTab from '@/components/social/InboxTab';
import { LeaderboardTab } from '@/components/social/LeaderboardTab';
import { ProfileCard } from '@/components/social/ProfileCard';
import { SearchTab } from '@/components/social/SearchTab';
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

export default function SocialTab() {
    const { user, login } = useAuthStore();
    const colors = useColors();
    const styles = useSocialStyles();
    const addToast = useNotificationStore(state => state.addToast);
    const router = useRouter();
    const navigation = useNavigation();

    // -- STATE --
    const [activeTab, setActiveTab] = useState<'leaderboard' | 'friends' | 'inbox' | 'search'>('inbox');
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
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SocialSearchUser[]>([]);
    const [searching, setSearching] = useState(false);
    const [selectedFriend, setSelectedFriend] = useState<SocialFriend | null>(null);
    const [friendActionLoading, setFriendActionLoading] = useState(false);
    const [isScoreModalVisible, setIsScoreModalVisible] = useState(false);
    const [isEventModalVisible, setIsEventModalVisible] = useState(false);
    const [isWeatherModalVisible, setIsWeatherModalVisible] = useState(false);
    const [isMyProfileModalVisible, setIsMyProfileModalVisible] = useState(false);
    const [isNotificationsModalVisible, setIsNotificationsModalVisible] = useState(false);
    const [isProfileExpanded, setIsProfileExpanded] = useState(false);
    const [isGoalsExpanded, setIsGoalsExpanded] = useState(false);
    const [showSeen, setShowSeen] = useState(false);
    const [inboxViewMode, setInboxViewMode] = useState<'feed' | 'classic'>('feed');

    // Leaderboard state
    const [rankingSegment, setRankingSegment] = useState<'weekly' | 'monthly' | 'lifetime'>('weekly');
    const [hideOwnActivity, setHideOwnActivity] = useState(false);
    const [typeFilter, setTypeFilter] = useState<'all' | 'pr' | 'workout' | 'routine'>('all');
    const [expandedFriendId, setExpandedFriendId] = useState<string | null>(null);
    const [comparisons, setComparisons] = useState<Record<string, any>>({});
    const [loadingCompare, setLoadingCompare] = useState(false);

    const incomingFriendRequestsList = useMemo(() => selectIncomingFriendRequests(friends), [friends]);
    const activityFeedBase = useMemo(() => selectActivityFeed(inbox, profile?.id), [inbox, profile?.id]);
    const notificationShares = useMemo(() => selectNotificationShares(inbox), [inbox]);
    const activityFeedItems = useMemo(() => {
        return activityFeedBase.filter((item) => {
            if (hideOwnActivity && profile?.id && item.senderId === profile.id) return false;
            if (typeFilter === 'all') return true;
            if (typeFilter === 'pr') return item.actionType === 'pr_broken';
            if (typeFilter === 'workout') return item.actionType === 'workout_completed';
            if (typeFilter === 'routine') return item.actionType === 'routine_shared';
            return true;
        });
    }, [activityFeedBase, hideOwnActivity, profile?.id, typeFilter]);
    const stories = useMemo(() => buildStories(activityFeedItems.filter(item => item.senderId !== profile?.id)), [activityFeedItems, profile?.id]);

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
    const [trainingDays, setTrainingDays] = useState<number[]>([]);

    useFocusEffect(
        useCallback(() => {
            analytics.capture('social_tab_viewed');
        }, [])
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

    useFocusEffect(
        useCallback(() => {
            if (!user) return;
            loadTrainingDays();
            refreshLocation(true);
            startRealtimeSync();

            // Capture analytics event for survey triggering
            analytics.capture('social_tab_viewed');

            // Per user request: Re-check location in background every X time (3 minutes) while on Social tab
            const locInterval = setInterval(() => {
                refreshLocation(true);
            }, 3 * 60 * 1000);

            return () => {
                clearInterval(locInterval);
                stopRealtimeSync();
            };
        }, [user, loadTrainingDays, refreshLocation, startRealtimeSync, stopRealtimeSync])
    );

    const handleRefresh = () => {
        setRefreshing(true);
        // Refresh data from API
        fetchInitialData(true);
        // Also quietly refresh GPS location in background since user explicitly pulled to refresh
        refreshLocation(true);
    };

    const handleOpenPublicRoutines = useCallback(async () => {
        try {
            await Linking.openURL('https://irontrain.motiona.xyz/feed');
        } catch {
            addToast({ type: 'error', title: 'Error', message: 'No se pudo abrir la página de rutinas públicas.' });
        }
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
            setExpandedFriendId(null);
            return;
        }

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

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setSearching(true);
        try {
            const results = await SocialService.searchUsers(searchQuery.trim());
            setSearchResults(results);
        } catch (err) {
            addToast({ type: 'error', title: 'Error de búsqueda' });
        } finally {
            setSearching(false);
        }
    };

    const handleSendFriendRequest = async (friendId: string) => {
        try {
            await SocialService.sendFriendRequest(friendId);
            addToast({ type: 'success', title: 'Solicitud enviada' });
            setSearchResults(results => results.filter(u => u.id !== friendId));
        } catch (err: any) {
            addToast({ type: 'error', title: 'Error', message: err.message });
        }
    };

    const handleAcceptFriend = async (requestId: string) => {
        try {
            await SocialService.respondFriendRequest(requestId, 'accept');
            fetchInitialData(true);
            addToast({ type: 'success', title: 'Amigo agregado' });
        } catch (err) {
            addToast({ type: 'error', title: 'Error al aceptar' });
        }
    };

    const handleRejectFriend = async (requestId: string) => {
        try {
            await SocialService.respondFriendRequest(requestId, 'reject');
            fetchInitialData(true);
        } catch (err) {
            addToast({ type: 'error', title: 'Error al rechazar' });
        }
    };

    const handleFriendModalAction = async (action: 'accept' | 'reject' | 'remove' | 'block') => {
        if (!selectedFriend) return;

        const run = async () => {
            setFriendActionLoading(true);
            try {
                await SocialService.respondFriendRequest(selectedFriend.id, action);
                setSelectedFriend(null);
                fetchInitialData(true, true);
                if (action === 'accept') addToast({ type: 'success', title: 'Amigo agregado' });
                if (action === 'remove') addToast({ type: 'success', title: 'Amigo eliminado' });
                if (action === 'block') addToast({ type: 'success', title: 'Usuario bloqueado' });
            } catch (err: any) {
                addToast({ type: 'error', title: 'Error', message: err?.message });
            } finally {
                setFriendActionLoading(false);
            }
        };

        if (action === 'remove') {
            confirm.destructive(
                'Eliminar amigo',
                `¿Estás seguro de que querés eliminar a ${selectedFriend.displayName}?`,
                run
            );
            return;
        }

        if (action === 'block') {
            confirm.destructive(
                'Bloquear usuario',
                `¿Querés bloquear a ${selectedFriend.displayName}?`,
                run
            );
            return;
        }

        await run();
    };

    const handleOpenFriendInRanking = async (friendUserId: string) => {
        setSelectedFriend(null);
        setActiveTab('leaderboard');
        await handleExpandFriend(friendUserId);
    };

    const handleInboxResponse = async (inboxId: string, action: 'accept' | 'reject', payload?: any) => {
        try {
            if (action === 'accept' && payload) {
                const routine = payload;
                await routineService.importSharedRoutine(routine);
                addToast({ type: 'success', title: 'Rutina importada', message: 'Ya podés verla en tu biblioteca.' });
            }
            if (action === 'accept') {
                analytics.capture('routine_imported', { source: 'inbox', inbox_id: inboxId });
            }
            await SocialService.respondInbox(inboxId, action);
            fetchInitialData(true, true);
        } catch (err) {
            addToast({ type: 'error', title: 'Error en la acción' });
        }
    };

    const handleToggleKudo = async (feedId: string) => {
        try {
            const result = await SocialService.toggleKudo(feedId);
            if (result === 'error') return;

            setInbox(current => current.map(item => {
                if (item.id === feedId) {
                    const hasKudoed = result === 'added';
                    return {
                        ...item,
                        hasKudoed,
                        kudosCount: Math.max(0, ((item as any).kudosCount || 0) + (hasKudoed ? 1 : -1))
                    } as any;
                }
                return item;
            }));
        } catch (err) {
            logger.captureException(err, { scope: 'SocialTab.toggleKudo' });
            addToast({ type: 'error', title: 'Kudos', message: 'No se pudo actualizar el kudo.' });
        }
    };

    const handleMarkAsSeen = async (id: string, feedType: 'direct_share' | 'activity_log') => {
        // Optimistic UI update immediately to prevent double clicks
        setInbox(current => current.map(item => item.id === id ? { ...item, seenAt: new Date().toISOString() } : item));
        try {
            await SocialService.markAsSeen(id, feedType);
        } catch (err) {
            // Revert optimistic update on failure
            setInbox(current => current.map(item => item.id === id ? { ...item, seenAt: null } : item));
            logger.captureException(err, { scope: 'SocialTab.markAsSeen' });
            addToast({ type: 'error', title: 'Buzón', message: 'No se pudo marcar como visto.' });
        }
    };

    const handleMarkAllAsSeen = async () => {
        const unseen = notificationShares.filter(i => !i.seenAt);
        if (unseen.length === 0) return;

        confirm.ask(
            '¿Archivar todo?',
            `Se marcarán como leídas las ${unseen.length} notificaciones pendientes.`,
            async () => {
                const now = new Date().toISOString();
                // Optimistic UI Update: Mark everything seen immediately
                const unseenIds = new Set(unseen.map(item => item.id));
                setInbox(current => current.map(item => unseenIds.has(item.id) ? ({ ...item, seenAt: item.seenAt || now }) : item));
                addToast({ type: 'success', title: 'Buzón actualizado', message: 'Notificaciones archivadas.' });

                try {
                    await SocialService.markAllAsSeen(unseen);
                } catch (err) {
                    logger.captureException(err, { scope: 'SocialTab.markAllAsSeen' });
                    // Revert? Or just show error. Since we are archiving, usually reverting is confusing.
                    // But we can inform the user.
                    addToast({ type: 'error', title: 'Error servidor', message: 'Algunas notificaciones podrían reaparecer.' });
                }
            },
            'Archivar todo'
        );
    };

    const handleCopyProfileId = useCallback(async () => {
        if (!profile?.id) return;
        try {
            await Clipboard.setStringAsync(profile.id);
            addToast({ type: 'success', title: 'ID copiado' });
        } catch (err) {
            logger.captureException(err, { scope: 'SocialTab.copyProfileId' });
            addToast({ type: 'error', title: 'Perfil', message: 'No se pudo copiar el ID.' });
        }
    }, [profile?.id, addToast]);

    const renderSharedProfileHeader = useCallback(() => {
        if (!profile) return null;

        return (
            <View style={{ marginBottom: 14 }}>
                <ProfileCard
                    profile={profile}
                    isProfileExpanded={isProfileExpanded}
                    setIsProfileExpanded={setIsProfileExpanded}
                    isGoalsExpanded={isGoalsExpanded}
                    setIsGoalsExpanded={setIsGoalsExpanded}
                    trainingDays={trainingDays}
                    onToggleTrainingDay={handleToggleTrainingDay}
                    onCopyId={handleCopyProfileId}
                    onEditProfile={() => setIsMyProfileModalVisible(true)}
                    onShowEventModal={() => setIsEventModalVisible(true)}
                    onShowWeatherModal={() => setIsWeatherModalVisible(true)}
                    onRefreshLocation={refreshLocation}
                    locationPermissionDenied={locationPermissionDenied}
                    lastKnownLocation={lastKnownLocation}
                    refreshingLocation={refreshingLocation}
                    colors={colors}
                    styles={styles}
                />

                <View style={{ marginTop: 10, flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                        style={[styles.archiveToggle, inboxViewMode === 'feed' && styles.archiveToggleActive]}
                        onPress={() => setInboxViewMode('feed')}
                    >
                        <Text style={[styles.archiveToggleText, inboxViewMode === 'feed' && styles.archiveToggleTextActive]}>Feed moderno</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.archiveToggle, inboxViewMode === 'classic' && styles.archiveToggleActive]}
                        onPress={() => setInboxViewMode('classic')}
                    >
                        <Text style={[styles.archiveToggleText, inboxViewMode === 'classic' && styles.archiveToggleTextActive]}>Bandeja clásica</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }, [
        profile,
        isProfileExpanded,
        isGoalsExpanded,
        trainingDays,
        handleToggleTrainingDay,
        handleCopyProfileId,
        refreshLocation,
        locationPermissionDenied,
        lastKnownLocation,
        refreshingLocation,
        colors,
        styles,
        inboxViewMode,
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
                <View style={styles.headerActionsBox}>
                    <TouchableOpacity style={styles.headerIconBtn} onPress={() => setActiveTab('search')}>
                        <Search size={20} color={colors.primary.DEFAULT} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerIconBtn} onPress={() => setIsNotificationsModalVisible(true)}>
                        <Bell size={20} color={colors.primary.DEFAULT} />
                        {pendingNotificationsCount > 0 && (
                            <View style={styles.inboxBadge}>
                                <Text style={styles.inboxBadgeText}>{pendingNotificationsCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerIconBtn} onPress={() => setIsMyProfileModalVisible(true)}>
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
                        {activeTab === 'inbox' && (
                            inboxViewMode === 'feed' ? (
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
                                        setActiveTab('search');
                                    }}
                                    colors={colors}
                                    styles={styles}
                                />
                            ) : (
                                <InboxTab
                                    inbox={inbox}
                                    showSeen={showSeen}
                                    setShowSeen={setShowSeen}
                                    hideOwnActivity={hideOwnActivity}
                                    setHideOwnActivity={setHideOwnActivity}
                                    typeFilter={typeFilter}
                                    setTypeFilter={setTypeFilter}
                                    handleInboxResponse={handleInboxResponse}
                                    handleMarkAsSeen={handleMarkAsSeen}
                                    handleMarkAllAsSeen={handleMarkAllAsSeen}
                                    handleToggleKudo={handleToggleKudo}
                                    profile={profile}
                                    colors={colors}
                                    styles={styles}
                                    renderHeader={renderSharedProfileHeader}
                                    refreshing={refreshing}
                                    onRefresh={handleRefresh}
                                    isLive={realtimeConnected}
                                    liveSource={realtimeSource}
                                    lastLiveSyncAt={lastRealtimeSyncAt}
                                />
                            )
                        )}
                        {activeTab === 'leaderboard' && (
                            <ScrollView
                                contentContainerStyle={styles.scrollContent}
                                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary.DEFAULT} />}
                            >
                                <View style={{ marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={styles.inboxStatusTitle}>Ranking social</Text>
                                    <TouchableOpacity style={styles.archiveToggle} onPress={() => setActiveTab('inbox')}>
                                        <Text style={styles.archiveToggleText}>Volver al feed</Text>
                                    </TouchableOpacity>
                                </View>
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
                            <ScrollView
                                contentContainerStyle={styles.scrollContent}
                                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary.DEFAULT} />}
                            >
                                <View style={{ marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={styles.inboxStatusTitle}>Amigos</Text>
                                    <TouchableOpacity style={styles.archiveToggle} onPress={() => setActiveTab('inbox')}>
                                        <Text style={styles.archiveToggleText}>Volver al feed</Text>
                                    </TouchableOpacity>
                                </View>
                                <FriendsTab
                                    friends={friends}
                                    onAcceptRequest={handleAcceptFriend}
                                    onRejectRequest={handleRejectFriend}
                                    onShowFriendActions={setSelectedFriend}
                                    colors={colors}
                                    styles={styles}
                                />
                            </ScrollView>
                        )}
                        {activeTab === 'search' && (
                            <ScrollView
                                contentContainerStyle={styles.scrollContent}
                                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary.DEFAULT} />}
                            >
                                <View style={{ marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={styles.inboxStatusTitle}>Buscar atletas</Text>
                                    <TouchableOpacity style={styles.archiveToggle} onPress={() => setActiveTab('inbox')}>
                                        <Text style={styles.archiveToggleText}>Volver al feed</Text>
                                    </TouchableOpacity>
                                </View>
                                <SearchTab
                                    searchQuery={searchQuery}
                                    setSearchQuery={setSearchQuery}
                                    onSearch={handleSearch}
                                    searchResults={searchResults}
                                    onSendRequest={handleSendFriendRequest}
                                    loading={searching}
                                    colors={colors}
                                    styles={styles}
                                />
                            </ScrollView>
                        )}
                    </>
                )}
            </View>

            <SocialNotificationsModal
                visible={isNotificationsModalVisible}
                onClose={() => setIsNotificationsModalVisible(false)}
                incomingFriendRequests={incomingFriendRequestsList}
                shares={notificationShares.filter(i => !i.seenAt || i.status === 'pending')}
                onAcceptFriend={handleAcceptFriend}
                onRejectFriend={handleRejectFriend}
                onAcceptShare={(inboxId, payload) => handleInboxResponse(inboxId, 'accept', payload)}
                onRejectShare={(inboxId) => handleInboxResponse(inboxId, 'reject')}
                onMarkAllSeen={handleMarkAllAsSeen}
                colors={colors}
                styles={styles}
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

            <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={[styles.archiveToggle, activeTab === 'leaderboard' && styles.archiveToggleActive]} onPress={() => setActiveTab('leaderboard')}>
                        <Trophy size={14} color={activeTab === 'leaderboard' ? colors.onPrimary : colors.textMuted} />
                        <Text style={[styles.archiveToggleText, activeTab === 'leaderboard' && styles.archiveToggleTextActive]}>Ranking</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.archiveToggle, activeTab === 'friends' && styles.archiveToggleActive]} onPress={() => setActiveTab('friends')}>
                        <Users size={14} color={activeTab === 'friends' ? colors.onPrimary : colors.textMuted} />
                        <Text style={[styles.archiveToggleText, activeTab === 'friends' && styles.archiveToggleTextActive]}>Amigos</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.archiveToggle} onPress={() => router.push('/settings' as any)}>
                        <Settings size={14} color={colors.textMuted} />
                        <Text style={styles.archiveToggleText}>Settings</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.archiveToggle} onPress={handleOpenPublicRoutines}>
                        <Globe size={14} color={colors.textMuted} />
                        <Text style={styles.archiveToggleText}>Públicas</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <FriendDetailModal
                visible={!!selectedFriend}
                onClose={() => setSelectedFriend(null)}
                friend={selectedFriend}
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
