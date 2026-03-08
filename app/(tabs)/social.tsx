import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { useDataReload } from '@/src/hooks/useDataReload';
import { locationPermissionsService } from '@/src/services/LocationPermissionsService';
import { routineService } from '@/src/services/RoutineService';
import { SocialComparisonEntry, SocialFriend, SocialInboxItem, SocialLeaderboardEntry, SocialProfile, SocialSearchUser, SocialService } from '@/src/services/SocialService';
import { useAuthStore } from '@/src/store/authStore';
import { confirm } from '@/src/store/confirmStore';
import { Colors, ThemeFx, withAlpha } from '@/src/theme';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { Award, CalendarDays, CheckCircle, ChevronDown, ChevronUp, CloudRain, Copy, Dumbbell, Flame, Globe, Info, Lock as LockIcon, MapPin, MapPinOff, RefreshCcw, Scale, Settings, Shield as ShieldIcon, TrendingUp, Trophy, UserCheck, UserMinus as UserMinusIcon, XCircle, X as XIcon, Zap } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Linking,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { configService } from '@/src/services/ConfigService';
import { useSettingsStore } from '@/src/store/useSettingsStore';

type SocialTabKey = 'leaderboard' | 'friends' | 'inbox' | 'search';
const USERNAME_REGEX = /^[a-z0-9_]+$/;

export default function SocialTab() {
    const [profile, setProfile] = useState<SocialProfile | null>(null);
    const [friends, setFriends] = useState<SocialFriend[]>([]);
    const [inbox, setInbox] = useState<SocialInboxItem[]>([]);
    const [leaderboard, setLeaderboard] = useState<SocialLeaderboardEntry[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SocialSearchUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<SocialTabKey>('leaderboard');
    const router = useRouter();
    const [rankingSegment, setRankingSegment] = useState<'weekly' | 'monthly' | 'lifetime'>('lifetime');
    const [expandedFriendId, setExpandedFriendId] = useState<string | null>(null);
    const [comparisons, setComparisons] = useState<Record<string, SocialComparisonEntry[]>>({});
    const [loadingCompare, setLoadingCompare] = useState(false);
    const [activeFriend, setActiveFriend] = useState<SocialFriend | null>(null);
    const [friendActionLoading, setFriendActionLoading] = useState(false);
    const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
    const [profileFormDisplayName, setProfileFormDisplayName] = useState('');
    const [profileFormUsername, setProfileFormUsername] = useState('');
    const [profileFormPublic, setProfileFormPublic] = useState(true);
    const [profileSaving, setProfileSaving] = useState(false);
    const [trainingDays, setTrainingDays] = useState<number[]>([]);
    const [isGoalsExpanded, setIsGoalsExpanded] = useState(false);
    const [isScoreModalVisible, setIsScoreModalVisible] = useState(false);
    const [isEventModalVisible, setIsEventModalVisible] = useState(false);
    const [isWeatherModalVisible, setIsWeatherModalVisible] = useState(false);
    const [refreshingLocation, setRefreshingLocation] = useState(false);
    const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);

    const authState = useAuthStore();
    const navigation = useNavigation();

    const loadData = useCallback(async () => {
        if (!authState.token) return;
        try {
            setLoading(true);
            const [prof, fr, inb, lb] = await Promise.all([
                SocialService.getProfile(),
                SocialService.getFriends(),
                SocialService.getInbox(),
                SocialService.getAnalytics(),
            ]);
            setProfile(prev => ({
                ...prof,
                weatherBonus: prof.weatherBonus || prev?.weatherBonus || null
            }));
            setFriends(fr);
            setInbox(inb);
            setLeaderboard(lb);
        } catch {
            confirm.error('Error', 'No se pudieron cargar los datos sociales.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [authState.token]);

    const loadTrainingDays = useCallback(async () => {
        const rawDays = await configService.get('training_days');
        setTrainingDays(Array.isArray(rawDays) ? rawDays : [1, 2, 3, 4, 5, 6]);
    }, []);

    useDataReload(() => {
        loadData();
    }, ['DATA_UPDATED', 'SOCIAL_UPDATED']);

    useDataReload(() => {
        loadTrainingDays();
    }, ['SETTINGS_UPDATED']);

    useFocusEffect(
        useCallback(() => {
            loadData();
            loadTrainingDays();
            // Comprobar ubicación al entrar de manera silenciosa
            handleRefreshLocation(true);
        }, [loadData, loadTrainingDays])
    );

    const handleCopyId = async () => {
        if (profile?.id) {
            await Clipboard.setStringAsync(profile.id);
            confirm.success('Copiado', 'Tu ID ha sido copiado al portapapeles. Compartilo con un amigo.');
        }
    };

    const handleRefreshLocation = useCallback(async (silent = false) => {
        try {
            setRefreshingLocation(true);
            const location = await locationPermissionsService.getCurrentLocation(silent);

            if (location) {
                setProfile(prev => prev ? ({
                    ...prev,
                    weatherBonus: {
                        ...(prev.weatherBonus || {
                            condition: 'Sincronizando...',
                            temperature: 20,
                            multiplier: 1.0,
                            isActive: false
                        }),
                        location: location.city || 'Tu ubicación',
                    }
                }) : null);

                try {
                    const updatedBonus = await SocialService.updateWeatherBonus(
                        location.lat,
                        location.lon,
                        location.city
                    );

                    if (updatedBonus) {
                        setProfile(prev => prev ? ({
                            ...prev,
                            weatherBonus: updatedBonus
                        }) : null);
                        if (!silent) confirm.success('Ubicación Actualizada', `Se detectó: ${location.city || 'Tu ubicación'}`);
                    }
                } catch (err) {
                    console.warn('[SocialTab] Weather API failed, keeping local location:', err);
                    if (!silent) confirm.error('Servicio de Clima', 'No pudimos verificar bonificaciones climáticas, pero detectamos tu ubicación.');
                }
            } else {
                const status = await Location.getForegroundPermissionsAsync();
                setLocationPermissionDenied(status.status === 'denied');
                // Don't show error message in silent mode to avoid annoying the user on tab entry
                if (!silent) confirm.error('Error de GPS', 'No pudimos obtener tu ubicación exacta. Verificá los permisos.');
            }
        } catch (e: unknown) {
            console.error('[SocialTab] Error refreshing location:', e);
            if (!silent) confirm.error('Error de GPS', 'Ocurrió un error al intentar obtener tu ubicación.');
        } finally {
            setRefreshingLocation(false);
        }
    }, [confirm]);

    const handleSearch = async () => {
        const trimmed = searchQuery.trim();
        if (!trimmed) return;
        try {
            setLoading(true);
            const res = await SocialService.searchUsers(trimmed);
            setSearchResults(res);
            setActiveTab('search');
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Error desconocido';
            confirm.error('Error', msg);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenPublicRoutines = async () => {
        try {
            await Linking.openURL('https://irontrain.motiona.xyz/feed');
        } catch {
            confirm.error('Error', 'No se pudo abrir la página de rutinas públicas.');
        }
    };

    const handleSendRequest = async (friendId: string) => {
        try {
            await SocialService.sendFriendRequest(friendId);
            confirm.success('Solicitud enviada', 'La solicitud fue enviada correctamente.');
            loadData();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Error desconocido';
            confirm.error('Error', msg);
        }
    };

    const handleFriendResponse = async (requestId: string, action: 'accept' | 'reject') => {
        try {
            await SocialService.respondFriendRequest(requestId, action);
            loadData();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Error desconocido';
            confirm.error('Error', msg);
        }
    };

    const openProfileModal = () => {
        if (!profile) return;
        setProfileFormDisplayName((profile.displayName || '').trim());
        setProfileFormUsername((profile.username || '').trim());
        setProfileFormPublic(profile.isPublic !== 0);
        setIsProfileModalVisible(true);
    };

    const handleSaveProfile = async () => {
        const normalizedDisplayName = profileFormDisplayName.replace(/\s+/g, ' ').trim();
        const normalizedUsername = profileFormUsername.trim().toLowerCase();

        if (!normalizedDisplayName) {
            confirm.error('Error', 'El nombre visible es obligatorio.');
            return;
        }

        if (normalizedDisplayName.length < 2 || normalizedDisplayName.length > 64) {
            confirm.error('Error', 'El nombre visible debe tener entre 2 y 64 caracteres.');
            return;
        }

        if (normalizedUsername.length > 0) {
            if (normalizedUsername.length < 3 || normalizedUsername.length > 20) {
                confirm.error('Error', 'El username debe tener entre 3 y 20 caracteres.');
                return;
            }
            if (!USERNAME_REGEX.test(normalizedUsername)) {
                confirm.error('Error', 'El username solo permite letras, números y guion bajo.');
                return;
            }
        }

        const isChangingUsername = normalizedUsername !== (profile?.username || '').toLowerCase();

        if (isChangingUsername && profile?.lastUsernameChangeAt) {
            const lastChange = new Date(profile.lastUsernameChangeAt);
            const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
            const diff = Date.now() - lastChange.getTime();

            if (diff < thirtyDaysInMs) {
                const nextChangeDate = new Date(lastChange.getTime() + thirtyDaysInMs);
                confirm.error(
                    'Espera un poco',
                    `Solo podés cambiar tu username una vez cada 30 días. Próximo cambio: ${nextChangeDate.toLocaleDateString()}`
                );
                return;
            }
        }

        setProfileSaving(true);
        try {
            await SocialService.updateProfile(
                normalizedDisplayName,
                normalizedUsername.length > 0 ? normalizedUsername : null,
                profileFormPublic ? 1 : 0
            );

            setProfile((prev) => prev ? ({
                ...prev,
                displayName: normalizedDisplayName,
                username: normalizedUsername.length > 0 ? normalizedUsername : null,
                isPublic: profileFormPublic ? 1 : 0,
                lastUsernameChangeAt: isChangingUsername ? new Date().toISOString() : prev.lastUsernameChangeAt
            }) : prev);

            setIsProfileModalVisible(false);
            confirm.success('Perfil actualizado', 'Tu perfil social se actualizó correctamente.');
            await loadData();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Error desconocido';
            confirm.error('Error', msg);
        } finally {
            setProfileSaving(false);
        }
    };

    const handleInboxResponse = async (inboxId: string, action: 'accept' | 'reject', payload?: unknown) => {
        try {
            if (action === 'accept' && payload) {
                const parsedPayload = typeof payload === 'string'
                    ? JSON.parse(payload)
                    : payload;
                await routineService.importSharedRoutine(parsedPayload);
                confirm.success('Rutina importada', 'La rutina ha sido añadida a tu biblioteca local.');
            }
            await SocialService.respondInbox(inboxId, action);
            loadData();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Error desconocido';
            confirm.error('Error', msg);
        }
    };

    const handleToggleKudo = async (feedId: string) => {
        // Optimistic UI update
        const prevInbox = [...inbox];
        setInbox(prev => prev.map(item => {
            if (item.id === feedId) {
                return {
                    ...item,
                    hasKudoed: !item.hasKudoed,
                    kudosCount: (item.kudosCount || 0) + (item.hasKudoed ? -1 : 1)
                };
            }
            return item;
        }));

        try {
            const action = await SocialService.toggleKudo(feedId);
            if (action === 'error') {
                setInbox(prevInbox);
            } else {
                setInbox(prev => prev.map(item => {
                    if (item.id !== feedId) return item;
                    const count = Math.max(0, item.kudosCount || 0);
                    const hasKudoed = action === 'added';
                    const nextCount = action === 'added' ? Math.max(1, count) : Math.max(0, count - 1);
                    return { ...item, hasKudoed, kudosCount: nextCount };
                }));
            }
        } catch {
            setInbox(prevInbox);
        }
    };

    const handleShowScoreInfo = () => {
        setIsScoreModalVisible(true);
    };

    const handleToggleTrainingDay = async (dayId: number) => {
        const isSelected = trainingDays.includes(dayId);
        const newDays = isSelected
            ? trainingDays.filter(d => d !== dayId)
            : [...trainingDays, dayId].sort((a, b) => a - b);

        setTrainingDays(newDays);
        await configService.set('training_days', newDays);
        await useSettingsStore.getState().setTrainingDays(newDays);
    };

    const handleExpandFriend = async (friendId: string) => {
        if (friendId === profile?.id) return;
        if (expandedFriendId === friendId) {
            setExpandedFriendId(null);
            return;
        }
        setExpandedFriendId(friendId);
        if (!comparisons[friendId]) {
            setLoadingCompare(true);
            try {
                const data = await SocialService.compareFriend(friendId);
                setComparisons(prev => ({ ...prev, [friendId]: data }));
            } catch {
                confirm.error('Error', 'No se pudo cargar la comparación de fuerza.');
            } finally {
                setLoadingCompare(false);
            }
        }
    };

    const handleOpenFriendModal = (friend: SocialFriend) => {
        setActiveFriend(friend);
    };

    const handleOpenFriendInRanking = async () => {
        if (!activeFriend) return;
        setActiveTab('leaderboard');
        setActiveFriend(null);
        await handleExpandFriend(activeFriend.friendId);
    };

    const closeFriendModal = () => {
        if (!friendActionLoading) {
            setActiveFriend(null);
        }
    };

    const executeFriendAction = async (action: 'accept' | 'reject' | 'remove' | 'block') => {
        if (!activeFriend) return;
        setFriendActionLoading(true);
        try {
            await SocialService.respondFriendRequest(activeFriend.id, action);
            setActiveFriend(null);
            await loadData();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Error desconocido';
            confirm.error('Error', msg);
        } finally {
            setFriendActionLoading(false);
        }
    };

    const handleFriendAction = async (action: 'accept' | 'reject' | 'remove' | 'block') => {
        if (action === 'remove') {
            confirm.ask(
                'Eliminar amistad',
                'Vas a eliminar a este amigo de tu lista. Podrás volver a enviar solicitud después.',
                () => {
                    confirm.hide();
                    executeFriendAction('remove');
                },
                'Eliminar'
            );
            return;
        }
        if (action === 'block') {
            confirm.ask(
                'Bloquear usuario',
                'Se bloqueará esta relación social. Esta acción impacta solicitudes y visibilidad entre ambos.',
                () => {
                    confirm.hide();
                    executeFriendAction('block');
                },
                'Bloquear'
            );
            return;
        }
        if (action === 'reject' && activeFriend?.isSender) {
            confirm.ask(
                'Cancelar solicitud',
                '¿Querés cancelar la solicitud enviada a este usuario?',
                () => {
                    confirm.hide();
                    executeFriendAction('reject');
                },
                'Cancelar solicitud'
            );
            return;
        }
        executeFriendAction(action);
    };

    if (!authState.token) {
        return (
            <SafeAreaWrapper style={styles.container} centered contentClassName="items-center justify-center">
                <View style={styles.loggedOutContainer}>
                    <View style={styles.loggedOutIcon}>
                        <Globe size={48} color={Colors.iron[400]} />
                    </View>
                    <Text style={styles.loggedOutTitle}>Conectate a IronSocial</Text>
                    <Text style={styles.loggedOutSub}>
                        Sincronizá tus rutinas, compartilas con amigos y descubrí la comunidad IronTrain.
                    </Text>
                    <TouchableOpacity style={styles.loginBtn} onPress={() => useAuthStore.getState().login()}>
                        <Text style={styles.loginBtnText}>Iniciar Sesión</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.signupBtn} onPress={() => useAuthStore.getState().login()}>
                        <Text style={styles.signupBtnText}>Crear Cuenta</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaWrapper>
        );
    }

    const pendingInboxCount = inbox.filter(i => i.status === 'pending').length;

    // Sincronizar badge de la pestaña
    useEffect(() => {
        navigation.setOptions({
            tabBarBadge: pendingInboxCount > 0 ? pendingInboxCount : undefined
        });
    }, [pendingInboxCount, navigation]);

    return (
        <SafeAreaWrapper style={styles.container}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', zIndex: 10 }}>
                    <Text style={styles.title}>IronSocial</Text>
                </View>
                <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <Image
                        source={require('../../assets/images/icon.png')}
                        style={{ width: 100, height: 100, resizeMode: 'contain' }}
                    />
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push('/settings' as any)}>
                        <Settings size={20} color={Colors.primary.DEFAULT} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.publicBtn} onPress={handleOpenPublicRoutines}>
                        <Globe size={16} color={Colors.white} />
                    </TouchableOpacity>
                    {loading && <ActivityIndicator size="small" color={Colors.primary.DEFAULT} />}
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
            >
                {profile && (
                    <View style={styles.profileCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.profileName}>{profile.displayName}</Text>
                                {profile.username && (
                                    <Text style={styles.profileUsername}>@{profile.username}</Text>
                                )}
                            </View>

                            <View style={styles.bonusColumn}>
                                {profile.activeEvent && (
                                    <TouchableOpacity
                                        style={styles.eventBadge}
                                        onPress={() => setIsEventModalVisible(true)}
                                        activeOpacity={0.7}
                                    >
                                        <Zap size={10} color={Colors.iron[950]} fill={Colors.iron[950]} />
                                        <Text style={styles.eventBadgeText}>Evento {profile.activeEvent.multiplier}x</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    style={profile.weatherBonus?.isActive ? styles.weatherBadge : styles.locationBadge}
                                    onPress={() => refreshingLocation ? null : handleRefreshLocation(false)}
                                    activeOpacity={0.7}
                                    disabled={refreshingLocation}
                                >
                                    {refreshingLocation ? (
                                        <ActivityIndicator size={10} color={Colors.iron[500]} />
                                    ) : profile.weatherBonus?.isActive ? (
                                        <CloudRain size={10} color={Colors.white} />
                                    ) : locationPermissionDenied ? (
                                        <MapPinOff size={10} color={Colors.iron[500]} />
                                    ) : (
                                        <MapPin size={10} color={Colors.iron[500]} />
                                    )}
                                    <Text style={profile.weatherBonus?.isActive ? styles.weatherBadgeText : styles.locationBadgeText}>
                                        {refreshingLocation ? 'Localizando...' :
                                            profile.weatherBonus?.isActive ? 'Voluntad de Hierro' :
                                                locationPermissionDenied ? 'Ubicación desactivada' :
                                                    (profile.weatherBonus?.location || 'Activar ubicación')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <Text style={styles.profileStats}>Rutinas compartidas: {profile.shareStats || 0}</Text>
                        <View style={styles.profileMetaRow}>
                            <View style={styles.profileVisibilityBadge}>
                                {profile.isPublic === 0 ? <LockIcon size={14} color={Colors.iron[500]} /> : <Globe size={14} color={Colors.primary.DEFAULT} />}
                                <Text style={styles.profileVisibilityText}>{profile.isPublic === 0 ? 'Perfil Privado' : 'Perfil Público'}</Text>
                            </View>
                            <TouchableOpacity style={styles.profileEditBtn} onPress={openProfileModal}>
                                <ShieldIcon size={14} color={Colors.white} />
                                <Text style={styles.profileEditBtnText}>Editar Perfil</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity style={styles.idBox} onPress={handleCopyId}>
                            <Text style={styles.idText} numberOfLines={1} ellipsizeMode="middle">ID: {profile.id}</Text>
                            <Copy size={16} color={Colors.iron[500]} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.goalsTrigger}
                            onPress={() => setIsGoalsExpanded(!isGoalsExpanded)}
                        >
                            <View style={styles.goalsTriggerLeft}>
                                <CalendarDays size={18} color={Colors.primary.DEFAULT} />
                                <Text style={styles.goalsTriggerTitle}>Mi Meta Semanal</Text>
                            </View>
                            <View style={styles.goalsTriggerRight}>
                                <Text style={styles.goalsSummaryText}>{trainingDays.length} días</Text>
                                {isGoalsExpanded ? <ChevronUp size={18} color={Colors.iron[400]} /> : <ChevronDown size={18} color={Colors.iron[400]} />}
                            </View>
                        </TouchableOpacity>

                        {isGoalsExpanded && (
                            <View style={styles.goalsExpanded}>
                                <Text style={styles.goalsDesc}>
                                    Seleccioná los días que planeás entrenar. Los días no marcados como entrenamiento no cortarán tu racha de puntuación.
                                </Text>
                                <View style={styles.daysRow}>
                                    {[
                                        { id: 1, label: 'L' }, { id: 2, label: 'M' }, { id: 3, label: 'X' },
                                        { id: 4, label: 'J' }, { id: 5, label: 'V' }, { id: 6, label: 'S' },
                                        { id: 0, label: 'D' }
                                    ].map(day => {
                                        const isSelected = trainingDays.includes(day.id);
                                        return (
                                            <TouchableOpacity
                                                key={day.id}
                                                onPress={() => handleToggleTrainingDay(day.id)}
                                                style={[styles.dayChip, isSelected && styles.dayChipActive]}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={[styles.dayChipText, isSelected && styles.dayChipTextActive]}>{day.label}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        )}
                    </View>
                )}

                <View style={styles.tabsMenuWrapper}>
                    <View style={styles.tabsMenu}>
                        <TouchableOpacity style={[styles.tabBtn, activeTab === 'leaderboard' && styles.tabBtnActive]} onPress={() => setActiveTab('leaderboard')}>
                            <Text style={[styles.tabText, activeTab === 'leaderboard' && styles.tabTextActive]}>Ranking</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.tabBtn, activeTab === 'friends' && styles.tabBtnActive]} onPress={() => setActiveTab('friends')}>
                            <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>Amigos</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.tabBtn, activeTab === 'inbox' && styles.tabBtnActive]} onPress={() => setActiveTab('inbox')}>
                            <Text style={[styles.tabText, activeTab === 'inbox' && styles.tabTextActive]}>
                                Feed{pendingInboxCount > 0 ? ` (${pendingInboxCount})` : ''}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.tabBtn, activeTab === 'search' && styles.tabBtnActive]} onPress={() => setActiveTab('search')}>
                            <Text style={[styles.tabText, activeTab === 'search' && styles.tabTextActive]}>Buscar</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.tabContent}>
                    {activeTab === 'leaderboard' && (
                        <View>
                            <View style={styles.rankingHeader}>
                                <View style={styles.rankingSegmentRow}>
                                    {(['weekly', 'monthly', 'lifetime'] as const).map((seg) => (
                                        <TouchableOpacity
                                            key={seg}
                                            style={[styles.segmentBtn, rankingSegment === seg && styles.segmentBtnActive]}
                                            onPress={() => setRankingSegment(seg)}
                                        >
                                            <Text style={[styles.segmentText, rankingSegment === seg && styles.segmentTextActive]}>
                                                {seg === 'weekly' ? 'Semanal' : seg === 'monthly' ? 'Mensual' : 'Histórico'}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <TouchableOpacity onPress={handleShowScoreInfo} style={styles.infoBtn}>
                                    <Info size={20} color={Colors.iron[400]} />
                                </TouchableOpacity>
                            </View>

                            {leaderboard.length === 0 ? (
                                <Text style={styles.emptyText}>Sin datos de ranking aún.</Text>
                            ) : (
                                [...leaderboard].sort((a, b) => b.scores[rankingSegment] - a.scores[rankingSegment]).map((user, i) => {
                                    const isExpanded = expandedFriendId === user.id;
                                    const comparisonData = comparisons[user.id] || [];

                                    return (
                                        <View key={user.id}>
                                            <TouchableOpacity
                                                style={[styles.friendRow, user.id === profile?.id && styles.highlightRow]}
                                                onPress={() => handleExpandFriend(user.id)}
                                                activeOpacity={0.7}
                                            >
                                                <View style={styles.rankRow}>
                                                    <Text style={[styles.rankNumber, { color: i === 0 ? Colors.yellow : i === 1 ? Colors.iron[300] : i === 2 ? Colors.primary.light : Colors.iron[500] }]}>
                                                        {i + 1}
                                                    </Text>
                                                    <View>
                                                        <Text style={styles.friendName}>{user.id === profile?.id ? 'Tú' : user.displayName}</Text>
                                                        <Text style={styles.friendStatus}>IronScore {user.scores[rankingSegment]}</Text>
                                                    </View>
                                                </View>
                                                {user.stats?.currentStreak >= 3 && (
                                                    <View style={styles.streakBadge}>
                                                        <Flame size={12} color={Colors.red} fill={Colors.red} style={{ marginRight: 4 }} />
                                                        <Text style={styles.streakText}>Racha: {user.stats.currentStreak}</Text>
                                                    </View>
                                                )}
                                            </TouchableOpacity>

                                            {isExpanded && (
                                                <View style={styles.expandedComparisonBox}>
                                                    <View style={styles.compareHeader}>
                                                        <Scale size={18} color={Colors.iron[400]} />
                                                        <Text style={styles.compareTitle}>Comparación de Fuerza (1RM)</Text>
                                                    </View>
                                                    {loadingCompare ? (
                                                        <ActivityIndicator size="small" color={Colors.primary.DEFAULT} style={{ marginVertical: 10 }} />
                                                    ) : comparisonData.length === 0 ? (
                                                        <Text style={styles.compareEmptyText}>No hay ejercicios comunes acá.</Text>
                                                    ) : (
                                                        comparisonData.map((comp, cidx) => {
                                                            const userWon = comp.user1RM > comp.friend1RM;
                                                            const friendWon = comp.friend1RM > comp.user1RM;
                                                            const diff = Math.abs(comp.user1RM - comp.friend1RM);

                                                            return (
                                                                <View key={cidx} style={styles.compareRow}>
                                                                    <View style={styles.compareRowHeader}>
                                                                        <Text style={styles.compareExerciseName}>{comp.exerciseName}</Text>
                                                                        {diff > 0 && (
                                                                            <Text style={[styles.compareDiff, { color: userWon ? Colors.green : Colors.red }]}>
                                                                                {userWon ? '+' : '-'}{diff.toFixed(1)}{comp.unit}
                                                                            </Text>
                                                                        )}
                                                                    </View>
                                                                    <View style={styles.compareBars}>
                                                                        <View style={[styles.compareBarContainer, { flex: 1 }]}>
                                                                            <View style={[styles.compareValueRow, userWon && styles.compareValueHighlightBox]}>
                                                                                <Text style={[styles.compareValue, userWon && styles.compareValueHighlight]}>{comp.user1RM}{comp.unit}</Text>
                                                                            </View>
                                                                            <Text style={styles.compareLabel}>Tú</Text>
                                                                        </View>
                                                                        <View style={[styles.compareBarContainer, { flex: 1 }]}>
                                                                            <View style={[styles.compareValueRow, friendWon && styles.compareValueHighlightBox]}>
                                                                                <Text style={[styles.compareValue, friendWon && styles.compareValueHighlight]}>{comp.friend1RM}{comp.unit}</Text>
                                                                            </View>
                                                                            <Text style={styles.compareLabel}>{user.displayName}</Text>
                                                                        </View>
                                                                    </View>
                                                                </View>
                                                            );
                                                        })
                                                    )}
                                                </View>
                                            )}
                                        </View>
                                    );
                                })
                            )}
                        </View>
                    )}

                    {activeTab === 'friends' && (
                        <View>
                            {friends.length === 0 ? (
                                <Text style={styles.emptyText}>No tienes amigos aún. Busca a alguien por su ID.</Text>
                            ) : (
                                friends.map((f) => (
                                    <TouchableOpacity key={f.id} style={styles.friendRow} onPress={() => handleOpenFriendModal(f)} activeOpacity={0.8}>
                                        <View>
                                            <Text style={styles.friendName}>{f.displayName}</Text>
                                            <Text style={styles.friendStatus}>
                                                {f.status === 'pending' ? (f.isSender ? 'Solicitud Enviada' : 'Te envió solicitud') : 'Amigo'}
                                            </Text>
                                        </View>
                                        {f.status === 'pending' && !f.isSender && (
                                            <View style={styles.actionsBox}>
                                                <TouchableOpacity style={styles.btnSmallAccept} onPress={() => handleFriendResponse(f.id, 'accept')}>
                                                    <Text style={styles.btnSmallText}>Aceptar</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.btnSmallReject} onPress={() => handleFriendResponse(f.id, 'reject')}>
                                                    <Text style={styles.btnSmallText}>Rechazar</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                        {f.status === 'accepted' && (
                                            <UserCheck size={20} color={Colors.primary.DEFAULT} />
                                        )}
                                    </TouchableOpacity>
                                ))
                            )}
                        </View>
                    )}

                    {activeTab === 'inbox' && (
                        <View style={{ gap: 16 }}>
                            {inbox.length === 0 ? (
                                <Text style={styles.emptyText}>Tu Feed de la comunidad está vacío.</Text>
                            ) : (
                                inbox.map((item) => {
                                    if (item.feedType === 'direct_share' || !item.feedType) {
                                        return (
                                            <View key={item.id} style={styles.premiumCard}>
                                                <View style={styles.premiumHeader}>
                                                    <View style={styles.premiumIconBox}>
                                                        <Dumbbell size={24} color={Colors.white} />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.premiumTitle}>Invitación a Entrenar</Text>
                                                        <Text style={styles.premiumSender}>de @{item.senderUsername || item.senderName}</Text>
                                                    </View>
                                                    <Text style={styles.activityDate}>
                                                        {new Date(item.createdAt).toLocaleDateString()}
                                                    </Text>
                                                </View>

                                                <View style={styles.premiumBody}>
                                                    <Text style={styles.premiumDescription}>
                                                        @{item.senderUsername || item.senderName} diseñó una rutina para vos. Sumala a tu biblioteca.
                                                    </Text>
                                                </View>

                                                {item.status === 'pending' ? (
                                                    <View style={styles.premiumActions}>
                                                        <TouchableOpacity style={styles.premiumBtnPrimary} onPress={() => handleInboxResponse(item.id, 'accept', item.payload)}>
                                                            <Text style={styles.premiumBtnTextPrimary}>Descargar & Importar</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity style={styles.premiumBtnSecondary} onPress={() => handleInboxResponse(item.id, 'reject')}>
                                                            <Text style={styles.premiumBtnTextSecondary}>Ignorar</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                ) : (
                                                    <View style={styles.premiumResolved}>
                                                        {item.status === 'accepted' ? (
                                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                                <CheckCircle size={16} color={Colors.green} style={{ marginRight: 6 }} />
                                                                <Text style={[styles.premiumStatusText, { color: Colors.green }]}>Rutina Importada</Text>
                                                            </View>
                                                        ) : (
                                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                                <XCircle size={16} color={Colors.red} style={{ marginRight: 6 }} />
                                                                <Text style={[styles.premiumStatusText, { color: Colors.red }]}>Rutina Rechazada</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    }

                                    if (item.feedType === 'activity_log') {
                                        const isPr = item.actionType === 'pr_broken';
                                        const isRoutineShared = item.actionType === 'routine_shared';
                                        const isOwnActivity = profile?.id && item.senderId === profile.id;

                                        return (
                                            <View key={item.id} style={styles.activityRow}>
                                                <View style={styles.activityHeader}>
                                                    <View style={[styles.activityIconBox, isPr ? { backgroundColor: withAlpha(Colors.yellow, '30') } : (isRoutineShared ? { backgroundColor: withAlpha(Colors.primary.DEFAULT, '30') } : { backgroundColor: withAlpha(Colors.primary.DEFAULT, '15') })]}>
                                                        {isPr ? <Trophy size={18} color={Colors.yellow} /> : isRoutineShared ? <Globe size={18} color={Colors.primary.DEFAULT} /> : <Dumbbell size={18} color={Colors.primary.DEFAULT} />}
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.activityUser}>@{item.senderUsername || item.senderName}</Text>
                                                        <Text style={styles.activityDesc}>
                                                            {isPr ? 'Rompió un Récord Personal' : isRoutineShared ? 'Compartió una rutina' : 'Completó un Entrenamiento'}
                                                        </Text>
                                                    </View>
                                                    <Text style={styles.activityDate}>
                                                        {new Date(item.createdAt).toLocaleDateString()}
                                                    </Text>
                                                </View>

                                                <View style={styles.activityFooter}>
                                                    <TouchableOpacity
                                                        style={[styles.kudoBtn, item.hasKudoed && styles.kudoBtnActive, isOwnActivity && styles.kudoBtnDisabled]}
                                                        onPress={() => !isOwnActivity && handleToggleKudo(item.id)}
                                                        disabled={!!isOwnActivity}
                                                    >
                                                        <Flame size={18} color={item.hasKudoed ? Colors.yellow : Colors.iron[600]} fill={item.hasKudoed ? Colors.yellow : "transparent"} />
                                                        <Text style={[styles.kudoText, item.hasKudoed && styles.kudoTextActive]}>
                                                            {item.kudosCount || 0} Kudos
                                                        </Text>
                                                    </TouchableOpacity>
                                                    {isOwnActivity ? <Text style={styles.ownActivityHint}>Tu actividad</Text> : null}
                                                </View>
                                            </View>
                                        );
                                    }
                                    return null;
                                })
                            )}
                        </View>
                    )}

                    {activeTab === 'search' && (
                        <View>
                            <View style={styles.searchBox}>
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Buscar por ID o username..."
                                    placeholderTextColor={Colors.iron[500]}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    returnKeyType="search"
                                    onSubmitEditing={handleSearch}
                                />
                                <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
                                    <Text style={styles.searchBtnText}>Buscar</Text>
                                </TouchableOpacity>
                            </View>
                            {searchResults.length === 0 && searchQuery.trim().length > 0 && !loading && (
                                <Text style={styles.emptyText}>Sin resultados para "{searchQuery.trim()}"</Text>
                            )}
                            {searchResults.map((u) => (
                                <View key={u.id} style={styles.friendRow}>
                                    <View>
                                        <Text style={styles.friendName}>{u.displayName || 'Sin nombre'}</Text>
                                        {u.username && <Text style={styles.friendStatus}>@{u.username}</Text>}
                                    </View>
                                    <TouchableOpacity style={styles.btnSmallAccept} onPress={() => handleSendRequest(u.id)}>
                                        <Text style={styles.btnSmallText}>Agregar</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            </ScrollView>

            <Modal visible={isProfileModalVisible} transparent animationType="fade" onRequestClose={() => setIsProfileModalVisible(false)}>
                <Pressable style={styles.modalOverlay} onPress={() => setIsProfileModalVisible(false)}>
                    <Pressable style={styles.modalCard} onPress={() => { }}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Perfil Social</Text>
                            <TouchableOpacity onPress={() => setIsProfileModalVisible(false)} style={styles.modalCloseBtn}>
                                <XIcon size={18} color={Colors.iron[500]} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalBody}>
                            <Text style={styles.modalLabel}>Nombre visible</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={profileFormDisplayName}
                                onChangeText={setProfileFormDisplayName}
                                maxLength={64}
                                placeholder="Tu nombre visible"
                                placeholderTextColor={Colors.iron[500]}
                            />
                            <Text style={styles.modalFieldHint}>
                                Entre 2 y 64 caracteres. Evitá datos sensibles.
                            </Text>

                            <Text style={styles.modalLabel}>Username</Text>
                            <TextInput
                                style={[
                                    styles.modalInput,
                                    profile?.lastUsernameChangeAt &&
                                    (Date.now() - new Date(profile.lastUsernameChangeAt).getTime() < 30 * 24 * 60 * 60 * 1000) &&
                                    { backgroundColor: Colors.iron[100], color: Colors.iron[500] }
                                ]}
                                value={profileFormUsername}
                                onChangeText={(value) => setProfileFormUsername(value.replace(/\s+/g, '').toLowerCase())}
                                maxLength={32}
                                autoCapitalize="none"
                                autoCorrect={false}
                                placeholder="sin espacios"
                                placeholderTextColor={Colors.iron[500]}
                                editable={!profile?.lastUsernameChangeAt || (Date.now() - new Date(profile.lastUsernameChangeAt).getTime() >= 30 * 24 * 60 * 60 * 1000)}
                            />
                            {profile?.lastUsernameChangeAt && (Date.now() - new Date(profile.lastUsernameChangeAt).getTime() < 30 * 24 * 60 * 60 * 1000) ? (
                                <Text style={[styles.modalFieldHint, { color: Colors.primary.DEFAULT, fontWeight: '900' }]}>
                                    Bloqueado hasta: {new Date(new Date(profile.lastUsernameChangeAt).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                                </Text>
                            ) : (
                                <Text style={styles.modalFieldHint}>
                                    Dejá vacío para quitar username. Permitido: a-z, 0-9 y _ (1 vez cada 30 días)
                                </Text>
                            )}

                            <View style={styles.privacyRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.modalLabel}>Visibilidad del perfil</Text>
                                    <Text style={styles.privacyHint}>
                                        {profileFormPublic ? 'Público: apareces en búsqueda social.' : 'Privado: no apareces en búsqueda social.'}
                                    </Text>
                                </View>
                                <Switch
                                    value={profileFormPublic}
                                    onValueChange={setProfileFormPublic}
                                    trackColor={{ false: Colors.iron[700], true: Colors.primary.DEFAULT + '66' }}
                                    thumbColor={profileFormPublic ? Colors.primary.DEFAULT : Colors.iron[500]}
                                />
                            </View>
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsProfileModalVisible(false)}>
                                <Text style={styles.modalCancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalPrimaryBtn} onPress={handleSaveProfile} disabled={profileSaving}>
                                {profileSaving ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.modalPrimaryText}>Guardar</Text>}
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            <Modal visible={!!activeFriend} transparent animationType="fade" onRequestClose={closeFriendModal}>
                <Pressable style={styles.modalOverlay} onPress={closeFriendModal}>
                    <Pressable style={styles.modalCard} onPress={() => { }}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{activeFriend?.displayName || 'Amigo'}</Text>
                            <TouchableOpacity onPress={closeFriendModal} style={styles.modalCloseBtn}>
                                <XIcon size={18} color={Colors.iron[500]} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalBody}>
                            {activeFriend?.username && (
                                <Text style={styles.friendModalUsername}>@{activeFriend.username}</Text>
                            )}
                            <Text style={styles.friendModalStatus}>
                                {activeFriend?.status === 'pending'
                                    ? activeFriend.isSender
                                        ? 'Solicitud enviada'
                                        : 'Solicitud recibida'
                                    : activeFriend?.status === 'blocked'
                                        ? 'Bloqueado'
                                        : 'Amistad aceptada'}
                            </Text>
                            {activeFriend ? (
                                <View style={styles.friendInfoCard}>
                                    <Text style={styles.friendInfoLabel}>ID Social</Text>
                                    <TouchableOpacity style={styles.friendInfoCopyBtn} onPress={async () => {
                                        await Clipboard.setStringAsync(activeFriend.friendId);
                                        confirm.success('Copiado', 'ID del amigo copiado al portapapeles.');
                                    }}>
                                        <Text style={styles.friendInfoId} numberOfLines={1} ellipsizeMode="middle">{activeFriend.friendId}</Text>
                                        <Copy size={14} color={Colors.iron[600]} />
                                    </TouchableOpacity>
                                    {activeFriend.status === 'accepted' ? (
                                        <TouchableOpacity style={styles.friendInfoActionBtn} onPress={handleOpenFriendInRanking}>
                                            <Scale size={14} color={Colors.primary.DEFAULT} />
                                            <Text style={styles.friendInfoActionText}>Ver comparación en ranking</Text>
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                            ) : null}
                        </View>

                        <View style={styles.modalActionsStack}>
                            {activeFriend?.status === 'pending' && !activeFriend?.isSender && (
                                <View style={styles.dualActionRow}>
                                    <TouchableOpacity style={styles.modalPrimaryBtn} disabled={friendActionLoading} onPress={() => handleFriendAction('accept')}>
                                        <Text style={styles.modalPrimaryText}>Aceptar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.modalDangerBtn} disabled={friendActionLoading} onPress={() => handleFriendAction('reject')}>
                                        <Text style={styles.modalDangerText}>Rechazar</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                            {activeFriend?.status === 'pending' && activeFriend?.isSender && (
                                <TouchableOpacity style={styles.modalSecondaryBtn} disabled={friendActionLoading} onPress={() => handleFriendAction('reject')}>
                                    <XCircle size={14} color={Colors.iron[600]} />
                                    <Text style={styles.modalSecondaryText}>Cancelar solicitud</Text>
                                </TouchableOpacity>
                            )}

                            {activeFriend?.status === 'accepted' && (
                                <View style={styles.dualActionRow}>
                                    <TouchableOpacity style={styles.modalSecondaryBtn} disabled={friendActionLoading} onPress={() => handleFriendAction('remove')}>
                                        <UserMinusIcon size={14} color={Colors.iron[500]} />
                                        <Text style={styles.modalSecondaryText}>Eliminar amigo</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.modalDangerBtn} disabled={friendActionLoading} onPress={() => handleFriendAction('block')}>
                                        <Text style={styles.modalDangerText}>Bloquear</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                            {friendActionLoading ? <ActivityIndicator size="small" color={Colors.primary.DEFAULT} style={{ marginTop: 4 }} /> : null}
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Modal: IronScore System Info */}
            <Modal
                visible={isScoreModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setIsScoreModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsScoreModalVisible(false)} />
                    <View style={[styles.modalCard, { height: '80%', maxHeight: '85%' }]}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <Award size={20} color={Colors.primary.DEFAULT} />
                                <Text style={styles.modalTitle}>Sistema IronScore</Text>
                            </View>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsScoreModalVisible(false)}>
                                <XIcon size={16} color={Colors.iron[600]} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={{ flex: 1 }}
                            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                            showsVerticalScrollIndicator={true}
                        >
                            <Text style={styles.infoSectionTitle}>Nueva Economía de Puntos</Text>
                            <Text style={styles.infoSectionDesc}>
                                Los puntos premian el esfuerzo real y NO se reinician nunca ni se pierden.
                            </Text>

                            <View style={styles.infoPointRow}>
                                <CheckCircle size={18} color={Colors.green} />
                                <Text style={styles.infoPointText}>Completar Entrenamiento</Text>
                                <Text style={styles.infoPointValue}>+{profile?.scoreConfig?.workoutCompletePoints || 20} pts</Text>
                            </View>

                            <View style={styles.infoPointRow}>
                                <TrendingUp size={18} color={Colors.primary.DEFAULT} />
                                <Text style={styles.infoPointText}>Día Extra (Máx {profile?.scoreConfig?.extraDayWeeklyCap || 3}/sem)</Text>
                                <Text style={styles.infoPointValue}>+{profile?.scoreConfig?.extraDayPoints || 10} pts</Text>
                            </View>

                            <View style={styles.infoPointRow}>
                                <Trophy size={18} color={Colors.yellow} />
                                <Text style={styles.infoPointText}>Romper PR (Normal)</Text>
                                <Text style={styles.infoPointValue}>+{profile?.scoreConfig?.prNormalPoints || 10} pts</Text>
                            </View>

                            <View style={styles.infoPointRow}>
                                <Award size={18} color={Colors.yellow} />
                                <Text style={styles.infoPointText}>Romper PR (Big 3)</Text>
                                <Text style={styles.infoPointValue}>+{profile?.scoreConfig?.prBig3Points || 25} pts</Text>
                            </View>

                            {profile?.scoreConfig?.weatherBonusEnabled !== 0 && (
                                <View style={styles.infoPointRow}>
                                    <CloudRain size={18} color={Colors.blue} />
                                    <Text style={styles.infoPointText}>Voluntad de Hierro ({'<'}{profile?.scoreConfig?.coldThresholdC || 5}°C)</Text>
                                    <Text style={styles.infoPointValue}>+{profile?.scoreConfig?.adverseWeatherPoints || 15} pts</Text>
                                </View>
                            )}

                            <View style={styles.infoDivider} />

                            <Text style={styles.infoSectionTitle}>Sistema de Rachas (Semanas)</Text>
                            <Text style={styles.infoSectionDesc}>
                                El multiplicador aumenta si cumplís tu meta de días configurada semanalmente.
                            </Text>

                            <View style={styles.infoStreakRow}>
                                <Text style={styles.infoStreakLabel}>Semanas 1-{(profile?.scoreConfig?.weekTier2Min || 3) - 1}</Text>
                                <Text style={styles.infoStreakValue}>x1.00</Text>
                            </View>
                            <View style={styles.infoStreakRow}>
                                <Text style={styles.infoStreakLabel}>Semanas {profile?.scoreConfig?.weekTier2Min || 3}-{(profile?.scoreConfig?.weekTier3Min || 5) - 1}</Text>
                                <Text style={styles.infoStreakValue}>x{(profile?.scoreConfig?.tier2Multiplier || 1.1).toFixed(2)}</Text>
                            </View>
                            <View style={styles.infoStreakRow}>
                                <Text style={styles.infoStreakLabel}>Semanas {profile?.scoreConfig?.weekTier3Min || 5}-{(profile?.scoreConfig?.weekTier4Min || 10) - 1}</Text>
                                <Text style={styles.infoStreakValue}>x{(profile?.scoreConfig?.tier3Multiplier || 1.25).toFixed(2)}</Text>
                            </View>
                            <View style={[styles.infoStreakRow, styles.infoStreakBestia]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Flame size={14} color={Colors.red} />
                                    <Text style={[styles.infoStreakLabel, { color: Colors.white }]}>Semanas {profile?.scoreConfig?.weekTier4Min || 10}+ (Bestia)</Text>
                                </View>
                                <Text style={[styles.infoStreakValue, { color: Colors.white }]}>x{(profile?.scoreConfig?.tier4Multiplier || 1.5).toFixed(2)}</Text>
                            </View>

                            <View style={styles.infoDivider} />

                            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                                <View style={styles.infoIconBox}>
                                    <Zap size={20} color={Colors.yellow} fill={Colors.yellow} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.infoSectionTitle}>Eventos Globales</Text>
                                    <Text style={styles.infoSectionDesc}>
                                        Multiplicadores de experiencia activados por el administrador durante fechas especiales.
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.infoDivider} />

                            <View style={styles.formulaBox}>
                                <Text style={styles.formulaTitle}>Fórmula de Puntos</Text>
                                <Text style={styles.formulaText}>
                                    Puntos = (Base + Bonos) × Multiplicador Racha × Evento Global
                                </Text>
                            </View>

                            <View style={styles.infoFooterBox}>
                                <Info size={14} color={Colors.iron[600]} />
                                <Text style={styles.infoFooterText}>
                                    El puntaje se calcula en tiempo real al finalizar cada entrenamiento. Los PRs se validan contra tu historial completo.
                                </Text>
                            </View>

                            <View style={{ height: 20 }} />
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Modal: Global Event Details */}
            <Modal
                visible={isEventModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setIsEventModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsEventModalVisible(false)} />
                    <View style={styles.detailModalCard}>
                        <View style={[styles.detailIconCircle, { borderColor: Colors.yellow, backgroundColor: withAlpha(Colors.yellow, '15') }]}>
                            <Zap size={32} color={Colors.yellow} fill={Colors.yellow} />
                        </View>
                        <View style={styles.activeEventBadge}>
                            <Zap size={10} color={Colors.white} fill={Colors.white} />
                            <Text style={styles.activeEventBadgeText}>Evento Global Activo</Text>
                        </View>
                        <Text style={styles.detailTitle}>{profile?.activeEvent?.title || 'Evento Especial'}</Text>
                        <Text style={styles.detailDesc}>¡Un multiplicador global está activo! Todas tus ganancias de IronScore se verán potenciadas automáticamente.</Text>

                        <View style={styles.detailInfoGrid}>
                            <View style={styles.detailInfoRow}>
                                <Text style={styles.detailInfoLabel}>Multiplicador</Text>
                                <Text style={[styles.detailInfoValue, { color: Colors.yellow, fontSize: 18 }]}>x{profile?.activeEvent?.multiplier?.toFixed(1) || '1.0'}</Text>
                            </View>
                            <View style={styles.detailInfoRow}>
                                <Text style={styles.detailInfoLabel}>Estado</Text>
                                <Text style={[styles.detailInfoValue, { color: Colors.green }]}>Activo Ahora</Text>
                            </View>
                            <View style={styles.detailInfoRow}>
                                <Text style={styles.detailInfoLabel}>Finaliza el</Text>
                                <Text style={styles.detailInfoValue}>
                                    {profile?.activeEvent ? new Date(profile.activeEvent.endDate).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) : '--/--/--'}
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity style={styles.detailCloseBtn} onPress={() => setIsEventModalVisible(false)}>
                            <Text style={styles.detailCloseText}>Entendido</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Modal: Weather Bonus Details */}
            <Modal
                visible={isWeatherModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setIsWeatherModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsWeatherModalVisible(false)} />
                    <View style={styles.detailModalCard}>
                        <View style={[
                            styles.detailIconCircle,
                            {
                                borderColor: profile?.weatherBonus?.isActive ? Colors.primary.DEFAULT : Colors.iron[400],
                                backgroundColor: withAlpha(profile?.weatherBonus?.isActive ? Colors.primary.DEFAULT : Colors.iron[400], '15')
                            }
                        ]}>
                            {profile?.weatherBonus?.isActive ? (
                                <CloudRain size={32} color={Colors.primary.DEFAULT} />
                            ) : (
                                <MapPin size={32} color={Colors.iron[500]} />
                            )}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                            <Text style={styles.detailTitle}>
                                {profile?.weatherBonus?.isActive ? 'Voluntad de Hierro' : 'Ubicación y Clima'}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={styles.refreshBadgeBtn}
                            onPress={() => handleRefreshLocation()}
                            disabled={refreshingLocation}
                        >
                            {refreshingLocation ? (
                                <ActivityIndicator size="small" color={Colors.primary.DEFAULT} />
                            ) : (
                                <>
                                    <RefreshCcw size={14} color={Colors.primary.DEFAULT} />
                                    <Text style={styles.refreshBadgeText}>Recomprobar Ubicación</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <Text style={styles.detailDesc}>
                            {profile?.weatherBonus?.isActive
                                ? '¡Has vencido a los elementos! Entrenar con clima adverso te otorga puntos extra por tu disciplina inquebrantable.'
                                : 'El sistema detecta tu ubicación para validar bonus por clima adverso. Podrás obtener +15 pts extra si entrenas bajo lluvia, nieve o frío extremo.'}
                        </Text>

                        <View style={styles.detailInfoGrid}>
                            <View style={styles.detailInfoRow}>
                                <Text style={styles.detailInfoLabel}>Ubicación</Text>
                                <Text style={styles.detailInfoValue}>{profile?.weatherBonus?.location || 'Detectando...'}</Text>
                            </View>
                            <View style={styles.detailInfoRow}>
                                <Text style={styles.detailInfoLabel}>Clima</Text>
                                <Text style={styles.detailInfoValue}>{profile?.weatherBonus?.condition || 'Despejado'}</Text>
                            </View>
                            <View style={styles.detailInfoRow}>
                                <Text style={styles.detailInfoLabel}>Bonus</Text>
                                <Text style={[
                                    styles.detailInfoValue,
                                    { color: profile?.weatherBonus?.isActive ? Colors.primary.DEFAULT : Colors.iron[500] }
                                ]}>
                                    {profile?.weatherBonus?.isActive ? '+15 pts' : 'Inactivo'}
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity style={styles.detailCloseBtn} onPress={() => setIsWeatherModalVisible(false)}>
                            <Text style={styles.detailCloseText}>
                                {profile?.weatherBonus?.isActive ? '¡A darle!' : 'Entendido'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal >
        </SafeAreaWrapper >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    loggedOutContainer: {
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    loggedOutIcon: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: Colors.iron[100],
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    loggedOutTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: Colors.iron[950],
        textAlign: 'center',
        marginBottom: 8,
    },
    loggedOutSub: {
        fontSize: 15,
        color: Colors.iron[600],
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
    },
    loginBtn: {
        backgroundColor: Colors.primary.DEFAULT,
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
        marginBottom: 12,
    },
    loginBtnText: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: '800',
    },
    signupBtn: {
        backgroundColor: Colors.surface,
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.iron[300],
    },
    signupBtnText: {
        color: Colors.primary.DEFAULT,
        fontSize: 16,
        fontWeight: '700',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 60,
        backgroundColor: Colors.iron[900],
        zIndex: 10,
        shadowColor: ThemeFx.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 4,
    },
    title: {
        color: Colors.iron[950],
        fontWeight: '900',
        fontSize: 20,
        letterSpacing: -0.5,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        zIndex: 10,
    },
    publicBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: Colors.primary.DEFAULT,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 12,
    },
    headerIconBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.iron[800],
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.iron[700],
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    profileCard: {
        backgroundColor: Colors.surface,
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        marginBottom: 24,
    },
    profileName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: Colors.iron[950],
        marginBottom: 4,
    },
    profileUsername: {
        fontSize: 16,
        fontWeight: '900',
        color: Colors.primary.DEFAULT,
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    profileStats: {
        fontSize: 14,
        color: Colors.iron[600],
        marginBottom: 12,
    },
    profileMetaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    profileVisibilityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: Colors.iron[950],
        borderRadius: 999,
        borderWidth: 1,
        borderColor: Colors.iron[700],
    },
    profileVisibilityText: {
        fontSize: 11,
        color: Colors.iron[200],
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    profileEditBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: Colors.primary.DEFAULT,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    profileEditBtnText: {
        color: Colors.white,
        fontSize: 11,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    idBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.iron[950],
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.iron[700],
    },
    idText: {
        color: Colors.iron[200],
        fontFamily: 'monospace',
        fontSize: 12,
        flex: 1,
        marginRight: 10,
    },
    tabsMenuWrapper: {
        marginBottom: 20,
    },
    tabsMenu: {
        flexDirection: 'row',
        backgroundColor: Colors.surface,
        borderRadius: 14,
        padding: 6,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        gap: 6,
    },
    tabBtn: {
        flex: 1,
        paddingHorizontal: 10,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabBtnActive: {
        backgroundColor: Colors.primary.DEFAULT,
    },
    tabText: {
        color: Colors.iron[600],
        fontWeight: '800',
        fontSize: 12,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    tabTextActive: {
        color: Colors.white,
    },
    tabContent: {
        minHeight: 200,
    },
    emptyText: {
        color: Colors.iron[600],
        textAlign: 'center',
        marginTop: 40,
        fontSize: 15,
    },
    friendRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        padding: 16,
        borderRadius: 14,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: Colors.iron[700],
    },
    highlightRow: {
        borderColor: Colors.primary.DEFAULT,
        borderWidth: 2,
    },
    expandedComparisonBox: {
        backgroundColor: Colors.surface,
        marginHorizontal: 8,
        marginBottom: 8,
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        marginTop: 4,
    },
    compareHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderColor: Colors.iron[800],
    },
    compareTitle: {
        color: Colors.iron[600],
        fontSize: 13,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    compareEmptyText: {
        color: Colors.iron[600],
        fontSize: 13,
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 8,
    },
    compareRow: {
        marginBottom: 12,
        backgroundColor: Colors.iron[900],
        borderWidth: 1,
        borderColor: Colors.iron[700],
        borderRadius: 8,
        padding: 12,
    },
    compareRowHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    compareExerciseName: {
        color: Colors.iron[950],
        fontSize: 14,
        fontWeight: 'bold',
        textTransform: 'capitalize',
        flex: 1,
    },
    compareDiff: {
        fontSize: 12,
        fontWeight: '900',
    },
    compareBarContainer: {
        alignItems: 'center',
    },
    compareValueRow: {
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: 'transparent',
    },
    compareValueHighlightBox: {
        backgroundColor: Colors.primary.DEFAULT + '20',
        borderColor: Colors.primary.DEFAULT + '40',
        borderWidth: 1,
    },
    compareBars: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    compareValue: {
        fontSize: 18,
        color: Colors.iron[700],
        fontWeight: '900',
    },
    compareValueHighlight: {
        color: Colors.primary.DEFAULT,
    },
    compareLabel: {
        fontSize: 11,
        color: Colors.iron[600],
        fontWeight: 'bold',
        marginTop: 2,
    },
    rankRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    rankingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    rankingSegmentRow: {
        flexDirection: 'row',
        backgroundColor: Colors.iron[900],
        borderRadius: 10,
        padding: 4,
        flex: 1,
        marginRight: 12,
    },
    segmentBtn: {
        backgroundColor: Colors.iron[900],
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
    },
    segmentBtnActive: {
        backgroundColor: Colors.iron[950],
    },
    segmentText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: Colors.iron[500],
        textTransform: 'uppercase',
    },
    segmentTextActive: {
        color: Colors.white,
    },
    infoBtn: {
        padding: 8,
        backgroundColor: Colors.surface,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: Colors.iron[700],
    },
    streakBadge: {
        backgroundColor: withAlpha(Colors.red, '20'),
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: withAlpha(Colors.red, '50'),
        flexDirection: 'row',
        alignItems: 'center',
    },
    streakText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: Colors.red,
    },
    friendName: {
        color: Colors.iron[950],
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    friendStatus: {
        color: Colors.iron[600],
        fontSize: 12,
        textTransform: 'uppercase',
    },
    rankNumber: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    actionsBox: {
        flexDirection: 'row',
        gap: 8,
    },
    btnSmallAccept: {
        backgroundColor: Colors.primary.DEFAULT,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
    },
    btnSmallReject: {
        backgroundColor: Colors.iron[700],
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
    },
    btnSmallText: {
        color: Colors.white,
        fontWeight: '900',
        fontSize: 12,
        textTransform: 'uppercase',
    },
    btnSmallTextReject: {
        color: Colors.iron[950],
        fontWeight: '900',
        fontSize: 12,
        textTransform: 'uppercase',
    },
    searchBox: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    searchInput: {
        flex: 1,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        color: Colors.iron[950],
    },
    searchBtn: {
        backgroundColor: Colors.primary.DEFAULT,
        justifyContent: 'center',
        paddingHorizontal: 20,
        borderRadius: 12,
    },
    searchBtnText: {
        color: Colors.white,
        fontWeight: 'bold',
    },
    // Premium Routine Card Styles
    premiumCard: {
        backgroundColor: Colors.surface,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        overflow: 'hidden',
        elevation: 6,
        shadowColor: ThemeFx.shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
    },
    premiumHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        paddingBottom: 8,
        gap: 12,
    },
    premiumIconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: Colors.primary.DEFAULT,
        alignItems: 'center',
        justifyContent: 'center',
    },
    premiumTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: Colors.iron[950],
        marginBottom: 2,
    },
    premiumSender: {
        fontSize: 14,
        color: Colors.primary.DEFAULT,
        fontWeight: '700',
    },
    premiumBody: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    premiumDescription: {
        fontSize: 14,
        color: Colors.iron[600],
        lineHeight: 20,
    },
    premiumActions: {
        flexDirection: 'row',
        padding: 16,
        gap: 8,
        borderTopWidth: 1,
        borderColor: Colors.iron[700],
        backgroundColor: Colors.iron[900],
    },
    premiumBtnPrimary: {
        flex: 1,
        backgroundColor: Colors.primary.DEFAULT,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 12,
    },
    premiumBtnTextPrimary: {
        color: Colors.white,
        fontWeight: '900',
        fontSize: 13,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    premiumBtnSecondary: {
        backgroundColor: Colors.iron[800],
        paddingVertical: 12,
        paddingHorizontal: 20,
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.iron[600],
    },
    premiumBtnTextSecondary: {
        color: Colors.iron[950],
        fontWeight: '900',
        fontSize: 13,
        textTransform: 'uppercase',
    },
    premiumResolved: {
        padding: 16,
        alignItems: 'center',
        borderTopWidth: 1,
        borderColor: Colors.iron[700],
        backgroundColor: Colors.iron[900],
    },
    premiumStatusText: {
        color: Colors.iron[600],
        fontWeight: '800',
        fontStyle: 'italic',
    },
    // Activity Log Styles
    activityRow: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.iron[700],
    },
    activityHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    activityIconBox: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.iron[800],
        alignItems: 'center',
        justifyContent: 'center',
    },
    activityUser: {
        fontSize: 15,
        fontWeight: '900',
        color: Colors.iron[950],
    },
    activityDesc: {
        fontSize: 13,
        color: Colors.iron[600],
    },
    activityDate: {
        fontSize: 11,
        color: Colors.iron[600],
        textTransform: 'uppercase',
        fontWeight: '600',
    },
    activityFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderColor: Colors.iron[700],
        paddingTop: 12,
        marginTop: 4,
    },
    kudoBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 20,
        backgroundColor: Colors.iron[800],
    },
    kudoBtnActive: {
        backgroundColor: withAlpha(Colors.yellow, '15'),
        borderColor: withAlpha(Colors.yellow, '40'),
        borderWidth: 1,
    },
    kudoBtnDisabled: {
        opacity: 0.45,
    },
    kudoText: {
        color: Colors.iron[600],
        fontSize: 13,
        fontWeight: '900',
    },
    kudoTextActive: {
        color: Colors.yellow,
    },
    ownActivityHint: {
        marginLeft: 10,
        color: Colors.iron[600],
        fontSize: 11,
        fontWeight: '700',
        alignSelf: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: ThemeFx.backdrop,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    modalCard: {
        width: '100%',
        maxWidth: 430,
        backgroundColor: Colors.surface,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderColor: Colors.iron[700],
    },
    modalTitle: {
        color: Colors.iron[950],
        fontSize: 18,
        fontWeight: '900',
    },
    modalCloseBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.iron[900],
        borderWidth: 1,
        borderColor: Colors.iron[700],
    },
    modalBody: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 10,
    },
    modalLabel: {
        color: Colors.iron[600],
        fontSize: 12,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    modalFieldHint: {
        color: Colors.iron[600],
        fontSize: 11,
        fontWeight: '700',
        marginTop: -6,
        marginBottom: 2,
    },
    modalInput: {
        backgroundColor: Colors.white,
        borderWidth: 1,
        borderColor: Colors.iron[300],
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: Colors.iron[950],
        fontWeight: '700',
    },
    privacyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 2,
        gap: 12,
    },
    privacyHint: {
        color: Colors.iron[600],
        fontSize: 12,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 16,
        paddingBottom: 16,
        paddingTop: 4,
    },
    modalActionsStack: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        paddingTop: 4,
        gap: 8,
    },
    modalCancelBtn: {
        flex: 1,
        backgroundColor: Colors.iron[800],
        borderWidth: 1,
        borderColor: Colors.iron[700],
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
    },
    modalCancelText: {
        color: Colors.iron[500],
        fontSize: 13,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    modalPrimaryBtn: {
        flex: 1,
        backgroundColor: Colors.primary.DEFAULT,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
    },
    modalPrimaryText: {
        color: Colors.white,
        fontSize: 13,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    friendModalUsername: {
        fontSize: 16,
        fontWeight: '900',
        color: Colors.primary.DEFAULT,
    },
    friendModalStatus: {
        color: Colors.iron[600],
        fontSize: 13,
        textTransform: 'uppercase',
        fontWeight: '800',
    },
    friendInfoCard: {
        marginTop: 8,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        borderRadius: 12,
        padding: 10,
        backgroundColor: Colors.iron[900],
        gap: 8,
    },
    friendInfoLabel: {
        color: Colors.iron[600],
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    friendInfoCopyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        borderWidth: 1,
        borderColor: Colors.iron[300],
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: Colors.white,
    },
    friendInfoId: {
        flex: 1,
        color: Colors.iron[950],
        fontSize: 12,
        fontFamily: 'monospace',
    },
    friendInfoActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: withAlpha(Colors.primary.DEFAULT, '40'),
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: withAlpha(Colors.primary.DEFAULT, '10'),
    },
    friendInfoActionText: {
        color: Colors.primary.DEFAULT,
        fontSize: 12,
        fontWeight: '800',
    },
    dualActionRow: {
        flexDirection: 'row',
        gap: 10,
    },
    modalSecondaryBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: Colors.iron[800],
        borderWidth: 1,
        borderColor: Colors.iron[700],
        borderRadius: 12,
        paddingVertical: 12,
    },
    modalSecondaryText: {
        color: Colors.iron[950],
        fontSize: 12,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    modalDangerBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: withAlpha(Colors.red, '40'),
        borderWidth: 1,
        borderColor: withAlpha(Colors.red, '55'),
        borderRadius: 12,
        paddingVertical: 12,
    },
    modalDangerText: {
        color: Colors.red,
        fontSize: 12,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    goalsTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.surface,
        marginTop: 12,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.iron[700],
    },
    goalsTriggerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    goalsTriggerTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: Colors.iron[950],
    },
    goalsTriggerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    goalsSummaryText: {
        fontSize: 12,
        fontWeight: '900',
        color: Colors.primary.DEFAULT,
    },
    goalsExpanded: {
        marginTop: 8,
        padding: 14,
        backgroundColor: Colors.iron[950],
        borderRadius: 12,
        borderWidth: 1,
        borderColor: withAlpha(Colors.primary.DEFAULT, '30'),
    },
    goalsDesc: {
        fontSize: 12,
        color: Colors.iron[200],
        lineHeight: 18,
        marginBottom: 12,
    },
    daysRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 4,
    },
    dayChip: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.iron[900],
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.iron[800],
    },
    dayChipActive: {
        backgroundColor: Colors.primary.DEFAULT,
        borderColor: Colors.primary.DEFAULT,
    },
    dayChipText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: Colors.iron[600],
    },
    dayChipTextActive: {
        color: Colors.white,
    },
    // Score Info Modal Styles
    infoSectionTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: Colors.iron[950],
        marginBottom: 4,
    },
    infoSectionDesc: {
        fontSize: 13,
        color: Colors.iron[500],
        marginBottom: 16,
        lineHeight: 18,
    },
    infoPointRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderColor: Colors.border,
        gap: 12,
    },
    infoPointText: {
        flex: 1,
        fontSize: 15,
        color: Colors.iron[950],
        fontWeight: '900',
    },
    infoPointValue: {
        fontSize: 14,
        fontWeight: '900',
        color: Colors.primary.DEFAULT,
    },
    infoDivider: {
        height: 1,
        backgroundColor: Colors.border,
        marginVertical: 20,
    },
    infoStreakRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: Colors.iron[900],
        borderRadius: 8,
        marginBottom: 6,
    },
    infoStreakBestia: {
        backgroundColor: Colors.iron[950],
        borderWidth: 1,
        borderColor: withAlpha(Colors.red, '40'),
    },
    infoStreakLabel: {
        fontSize: 13,
        color: Colors.iron[950],
        fontWeight: '700',
    },
    infoStreakValue: {
        fontSize: 13,
        fontWeight: '900',
        color: Colors.primary.DEFAULT,
    },
    infoIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: Colors.iron[950],
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoFooterBox: {
        flexDirection: 'row',
        backgroundColor: Colors.iron[900],
        padding: 12,
        borderRadius: 10,
        gap: 10,
        borderWidth: 1,
        borderColor: Colors.iron[800],
    },
    infoFooterText: {
        flex: 1,
        fontSize: 11,
        color: Colors.iron[600],
        lineHeight: 16,
        fontStyle: 'italic',
    },
    bonusColumn: {
        alignItems: 'flex-end',
        gap: 6,
    },
    refreshBadgeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: withAlpha(Colors.primary.DEFAULT, '10'),
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: withAlpha(Colors.primary.DEFAULT, '20'),
    },
    refreshBadgeText: {
        fontSize: 12,
        color: Colors.primary.DEFAULT,
        fontWeight: 'bold',
    },
    eventBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.yellow,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    eventBadgeText: {
        color: Colors.iron[950],
        fontSize: 11,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    weatherBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary.DEFAULT,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    weatherBadgeText: {
        color: Colors.white,
        fontSize: 11,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    locationBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.iron[200], // Fondo un poco más oscuro para que se vea como un badge
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
        borderWidth: 1,
        borderColor: Colors.iron[300], // Borde más marcado
        minWidth: 80,
    },
    locationBadgeText: {
        color: Colors.iron[950], // Texto más oscuro para lectura
        fontSize: 11,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    activeEventBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.yellow,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 12,
        marginBottom: 8,
        gap: 6,
    },
    activeEventBadgeText: {
        color: Colors.iron[950],
        fontSize: 10,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    detailModalCard: {
        width: '88%',
        backgroundColor: Colors.surface,
        borderRadius: 28,
        padding: 24,
        borderWidth: 1,
        borderColor: Colors.border,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    detailIconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 2,
    },
    detailTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: Colors.iron[950],
        textAlign: 'center',
        marginBottom: 8,
    },
    detailDesc: {
        fontSize: 14,
        color: Colors.iron[600],
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    detailInfoGrid: {
        width: '100%',
        backgroundColor: Colors.iron[900],
        borderRadius: 20,
        padding: 20,
        gap: 14,
    },
    detailInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    detailInfoLabel: {
        fontSize: 11,
        color: Colors.iron[600],
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    detailInfoValue: {
        fontSize: 15,
        color: Colors.iron[950],
        fontWeight: '900',
    },
    detailCloseBtn: {
        marginTop: 24,
        width: '100%',
        paddingVertical: 16,
        borderRadius: 16,
        backgroundColor: Colors.iron[950],
        alignItems: 'center',
    },
    detailCloseText: {
        color: Colors.white,
        fontSize: 14,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    formulaBox: {
        backgroundColor: Colors.iron[950],
        padding: 16,
        borderRadius: 12,
        marginVertical: 10,
        borderWidth: 1,
        borderColor: withAlpha(Colors.primary.DEFAULT, '30'),
    },
    formulaTitle: {
        fontSize: 10,
        color: Colors.iron[500],
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 4,
        letterSpacing: 1,
    },
    formulaText: {
        fontSize: 13,
        color: Colors.primary.DEFAULT,
        fontWeight: '900',
        fontStyle: 'italic',
    },
});
