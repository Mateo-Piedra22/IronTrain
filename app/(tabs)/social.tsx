import { useColors } from '@/src/hooks/useColors';
import { useDataReload } from '@/src/hooks/useDataReload';
import { useTheme } from '@/src/hooks/useTheme';
import { configService } from '@/src/services/ConfigService';
import { routineService } from '@/src/services/RoutineService';
import { SocialFriend, SocialSearchUser, SocialService } from '@/src/services/SocialService';
import { useAuthStore } from '@/src/store/authStore';
import { confirm } from '@/src/store/confirmStore';
import { useNotificationStore } from '@/src/store/notificationStore';
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { useSocialStore } from '@/src/store/useSocialStore';
import { logger } from '@/src/utils/logger';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { Globe, Inbox as InboxIcon, Search, Settings, Trophy, Users } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { IronTrainLogo } from '@/components/IronTrainLogo';
import { FriendsTab } from '@/components/social/FriendsTab';
import InboxTab from '@/components/social/InboxTab';
import { LeaderboardTab } from '@/components/social/LeaderboardTab';
import { ProfileCard } from '@/components/social/ProfileCard';
import { SearchTab } from '@/components/social/SearchTab';
import { useSocialStyles } from '@/components/social/social.styles';
import {
    FriendDetailModal,
    GlobalEventModal,
    ProfileEditModal,
    ScoreInfoModal,
    WeatherBonusModal
} from '@/components/social/SocialModals';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';

export default function SocialTab() {
    const { user, login, logout } = useAuthStore();
    const { activeTheme } = useTheme();
    const colors = useColors();
    const styles = useSocialStyles();
    const addToast = useNotificationStore(state => state.addToast);
    const router = useRouter();
    const navigation = useNavigation();

    // -- STATE --
    const [activeTab, setActiveTab] = useState<'leaderboard' | 'friends' | 'inbox' | 'search'>('leaderboard');
    const [refreshing, setRefreshing] = useState(false);

    // Global Data
    const {
        profile, setProfile, leaderboard, friends, inbox, setInbox,
        loading, refreshingLocation, locationPermissionDenied, lastKnownLocation,
        loadData, refreshLocation
    } = useSocialStore();

    const incomingFriendRequests = friends.filter(f => f.status === 'pending' && !f.isSender).length;
    const pendingRoutinesCount = inbox.filter(i => i.feedType === 'direct_share' && i.status === 'pending').length;
    const unseenActivitiesCount = inbox.filter(i => !i.seenAt && i.feedType === 'activity_log').length;
    const totalUnseenCount = incomingFriendRequests + pendingRoutinesCount + unseenActivitiesCount;
    const unseenFeedCount = pendingRoutinesCount + unseenActivitiesCount;

    // UI State
    const [isProfileExpanded, setIsProfileExpanded] = useState(false);
    const [isGoalsExpanded, setIsGoalsExpanded] = useState(false);
    const [showSeen, setShowSeen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SocialSearchUser[]>([]);
    const [searching, setSearching] = useState(false);
    const [selectedFriend, setSelectedFriend] = useState<SocialFriend | null>(null);
    const [friendActionLoading, setFriendActionLoading] = useState(false);
    const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
    const [isScoreModalVisible, setIsScoreModalVisible] = useState(false);
    const [isEventModalVisible, setIsEventModalVisible] = useState(false);
    const [isWeatherModalVisible, setIsWeatherModalVisible] = useState(false);

    // Leaderboard state
    const [rankingSegment, setRankingSegment] = useState<'weekly' | 'monthly' | 'lifetime'>('weekly');
    const [hideOwnActivity, setHideOwnActivity] = useState(false);
    const [typeFilter, setTypeFilter] = useState<'all' | 'pr' | 'workout' | 'routine'>('all');
    const [expandedFriendId, setExpandedFriendId] = useState<string | null>(null);
    const [comparisons, setComparisons] = useState<Record<string, any>>({});
    const [loadingCompare, setLoadingCompare] = useState(false);

    // Profile Edit forms
    const [displayName, setDisplayName] = useState('');
    const [username, setUsername] = useState('');
    const [isPublic, setIsPublic] = useState(true);
    const [savingProfile, setSavingProfile] = useState(false);
    const [trainingDays, setTrainingDays] = useState<number[]>([]);

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
            setIsPublic(p.isPublic === 1);
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

            // Per user request: Re-check location in background every X time (3 minutes) while on Social tab
            const locInterval = setInterval(() => {
                refreshLocation(true);
            }, 3 * 60 * 1000);

            return () => clearInterval(locInterval);
        }, [user, loadTrainingDays, refreshLocation])
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

    const handleCopyId = async () => {
        if (profile?.id) {
            await Clipboard.setStringAsync(profile.id);
            addToast({
                type: 'success',
                title: 'ID copiado',
                message: 'Ya podés compartirlo con tus amigos.'
            });
        }
    };

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
            setIsProfileModalVisible(false);
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

    const handleRemoveFriend = async (friendId: string, name: string) => {
        confirm.destructive(
            'Eliminar amigo',
            `¿Estás seguro de que querés eliminar a ${name}?`,
            async () => {
                try {
                    await SocialService.respondFriendRequest(friendId, 'remove');
                    setSelectedFriend(null);
                    fetchInitialData(true, true);
                    addToast({ type: 'success', title: 'Amigo eliminado' });
                } catch (err) {
                    addToast({ type: 'error', title: 'Error al eliminar' });
                }
            }
        );
    };

    const handleInboxResponse = async (inboxId: string, action: 'accept' | 'reject', payload?: any) => {
        try {
            if (action === 'accept' && payload) {
                const routine = payload;
                await routineService.importSharedRoutine(routine);
                addToast({ type: 'success', title: 'Rutina importada', message: 'Ya podés verla en tu biblioteca.' });
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
        const unseen = inbox.filter(i => !i.seenAt);
        if (unseen.length === 0) return;

        confirm.ask(
            '¿Archivar todo?',
            `Se marcarán como leídas las ${unseen.length} notificaciones pendientes.`,
            async () => {
                const now = new Date().toISOString();
                // Optimistic UI Update: Mark everything seen immediately
                setInbox(current => current.map(item => ({ ...item, seenAt: item.seenAt || now })));
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
                    <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push('/settings' as any)}>
                        <Settings size={20} color={colors.primary.DEFAULT} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.publicBtn} onPress={handleOpenPublicRoutines}>
                        <Globe size={16} color={colors.onPrimary} />
                        <Text style={styles.publicBtnText}>Públicas</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary.DEFAULT} />}
            >
                <ProfileCard
                    profile={profile}
                    isProfileExpanded={isProfileExpanded}
                    setIsProfileExpanded={setIsProfileExpanded}
                    isGoalsExpanded={isGoalsExpanded}
                    setIsGoalsExpanded={setIsGoalsExpanded}
                    trainingDays={trainingDays}
                    onToggleTrainingDay={handleToggleTrainingDay}
                    onCopyId={handleCopyId}
                    onEditProfile={() => setIsProfileModalVisible(true)}
                    onShowEventModal={() => setIsEventModalVisible(true)}
                    onShowWeatherModal={() => setIsWeatherModalVisible(true)}
                    onRefreshLocation={refreshLocation}
                    refreshingLocation={refreshingLocation}
                    locationPermissionDenied={locationPermissionDenied}
                    lastKnownLocation={lastKnownLocation}
                    colors={colors}
                    styles={styles}
                />

                <View style={styles.tabsMenuWrapper}>
                    <View style={styles.tabsMenu}>
                        <TouchableOpacity
                            style={[styles.tabBtn, activeTab === 'leaderboard' && styles.tabBtnActive]}
                            onPress={() => setActiveTab('leaderboard')}
                        >
                            <Trophy size={18} color={activeTab === 'leaderboard' ? colors.onPrimary : colors.textMuted} />
                            <Text style={[styles.tabText, activeTab === 'leaderboard' && styles.tabTextActive]}>Ranking</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.tabBtn, activeTab === 'friends' && styles.tabBtnActive]}
                            onPress={() => setActiveTab('friends')}
                        >
                            <Users size={18} color={activeTab === 'friends' ? colors.onPrimary : colors.textMuted} />
                            <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>
                                Amigos{incomingFriendRequests > 0 ? ` (${incomingFriendRequests})` : ''}
                            </Text>
                            {incomingFriendRequests > 0 && (
                                <View style={[styles.inboxBadge, { backgroundColor: colors.red }]}>
                                    <Text style={styles.inboxBadgeText}>{incomingFriendRequests}</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.tabBtn, activeTab === 'inbox' && styles.tabBtnActive]}
                            onPress={() => setActiveTab('inbox')}
                        >
                            <InboxIcon size={18} color={activeTab === 'inbox' ? colors.onPrimary : colors.textMuted} />
                            <Text style={[styles.tabText, activeTab === 'inbox' && styles.tabTextActive]}>
                                Feed{unseenFeedCount > 0 ? ` (${unseenFeedCount})` : ''}
                            </Text>
                            {unseenFeedCount > 0 && (
                                <View style={styles.inboxBadge}>
                                    <Text style={styles.inboxBadgeText}>{unseenFeedCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.tabBtn, activeTab === 'search' && styles.tabBtnActive]}
                            onPress={() => setActiveTab('search')}
                        >
                            <Search size={18} color={activeTab === 'search' ? colors.onPrimary : colors.textMuted} />
                            <Text style={[styles.tabText, activeTab === 'search' && styles.tabTextActive]}>Buscar</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {loading && !refreshing ? (
                    <View style={{ padding: 40, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
                        <Text style={[styles.emptyText, { marginTop: 12 }]}>Sincronizando comunidad...</Text>
                    </View>
                ) : (
                    <View style={styles.tabContent}>
                        {activeTab === 'leaderboard' && (
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
                                colors={colors}
                                styles={styles}
                            />
                        )}
                        {activeTab === 'friends' && (
                            <FriendsTab
                                friends={friends}
                                onAcceptRequest={handleAcceptFriend}
                                onRejectRequest={handleRejectFriend}
                                onShowFriendActions={setSelectedFriend}
                                colors={colors}
                                styles={styles}
                            />
                        )}
                        {activeTab === 'inbox' && (
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
                                handleToggleKudo={handleToggleKudo}
                                handleMarkAllAsSeen={handleMarkAllAsSeen}
                                profile={profile}
                                colors={colors}
                                styles={styles}
                            />
                        )}
                        {activeTab === 'search' && (
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
                        )}
                    </View>
                )}
            </ScrollView>

            <ProfileEditModal
                visible={isProfileModalVisible}
                onClose={() => setIsProfileModalVisible(false)}
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
                colors={colors}
                styles={styles}
            />
        </SafeAreaWrapper>
    );
}
