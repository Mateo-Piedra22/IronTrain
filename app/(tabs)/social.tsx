import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { routineService } from '@/src/services/RoutineService';
import { SocialFriend, SocialInboxItem, SocialLeaderboardEntry, SocialProfile, SocialSearchUser, SocialService } from '@/src/services/SocialService';
import { useAuthStore } from '@/src/store/authStore';
import { Colors } from '@/src/theme';
import * as Clipboard from 'expo-clipboard';
import { Copy, UserCheck } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

type SocialTabKey = 'leaderboard' | 'friends' | 'inbox' | 'search';

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

    const authState = useAuthStore();

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
            setProfile(prof);
            setFriends(fr);
            setInbox(inb);
            setLeaderboard(lb);
        } catch {
            Alert.alert('Error', 'No se pudieron cargar los datos sociales.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [authState.token]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleCopyId = async () => {
        if (profile?.id) {
            await Clipboard.setStringAsync(profile.id);
            Alert.alert('Copiado', 'Tu ID ha sido copiado al portapapeles. Compartilo con un amigo.');
        }
    };

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
            Alert.alert('Error', msg);
        } finally {
            setLoading(false);
        }
    };

    const handleSendRequest = async (friendId: string) => {
        try {
            await SocialService.sendFriendRequest(friendId);
            Alert.alert('Solicitud enviada', 'La solicitud fue enviada correctamente.');
            loadData();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Error desconocido';
            Alert.alert('Error', msg);
        }
    };

    const handleFriendResponse = async (requestId: string, action: 'accept' | 'reject') => {
        try {
            await SocialService.respondFriendRequest(requestId, action);
            loadData();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Error desconocido';
            Alert.alert('Error', msg);
        }
    };

    const handleInboxResponse = async (inboxId: string, action: 'accept' | 'reject', payload?: unknown) => {
        try {
            if (action === 'accept' && payload) {
                const parsedPayload = typeof payload === 'string'
                    ? JSON.parse(payload)
                    : payload;
                await routineService.importSharedRoutine(parsedPayload);
                Alert.alert('Rutina importada', 'La rutina ha sido añadida a tu biblioteca local.');
            }
            await SocialService.respondInbox(inboxId, action);
            loadData();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Error desconocido';
            Alert.alert('Error', msg);
        }
    };

    if (!authState.token) {
        return (
            <SafeAreaWrapper style={styles.container} centered contentClassName="items-center justify-center">
                <Text style={styles.title}>Iniciá sesión para usar IronSocial</Text>
            </SafeAreaWrapper>
        );
    }

    const pendingInboxCount = inbox.filter(i => i.status === 'pending').length;

    return (
        <SafeAreaWrapper style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>IronSocial</Text>
                {loading && <ActivityIndicator color={Colors.primary.DEFAULT} />}
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
            >
                {profile && (
                    <View style={styles.profileCard}>
                        <Text style={styles.profileName}>{profile.displayName}</Text>
                        <Text style={styles.profileStats}>Rutinas compartidas: {profile.shareStats || 0}</Text>
                        <TouchableOpacity style={styles.idBox} onPress={handleCopyId}>
                            <Text style={styles.idText} numberOfLines={1} ellipsizeMode="middle">ID: {profile.id}</Text>
                            <Copy size={16} color={Colors.iron[500]} />
                        </TouchableOpacity>
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
                                Inbox{pendingInboxCount > 0 ? ` (${pendingInboxCount})` : ''}
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
                            {leaderboard.length === 0 ? (
                                <Text style={styles.emptyText}>Sin datos de ranking aún.</Text>
                            ) : (
                                leaderboard.map((user, i) => (
                                    <View key={user.id} style={[styles.friendRow, user.id === profile?.id && styles.highlightRow]}>
                                        <View style={styles.rankRow}>
                                            <Text style={[styles.rankNumber, { color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : Colors.iron[500] }]}>
                                                {i + 1}
                                            </Text>
                                            <View>
                                                <Text style={styles.friendName}>{user.id === profile?.id ? 'Tú' : user.displayName}</Text>
                                                <Text style={styles.friendStatus}>IronScore {user.score}</Text>
                                            </View>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>
                    )}

                    {activeTab === 'friends' && (
                        <View>
                            {friends.length === 0 ? (
                                <Text style={styles.emptyText}>No tienes amigos aún. Busca a alguien por su ID.</Text>
                            ) : (
                                friends.map((f) => (
                                    <View key={f.id} style={styles.friendRow}>
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
                                    </View>
                                ))
                            )}
                        </View>
                    )}

                    {activeTab === 'inbox' && (
                        <View>
                            {inbox.length === 0 ? (
                                <Text style={styles.emptyText}>Tu bandeja de entrada está vacía.</Text>
                            ) : (
                                inbox.map((item) => (
                                    <View key={item.id} style={styles.friendRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.friendName}>{item.senderName} te envió una Rutina</Text>
                                            <Text style={styles.friendStatus}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                                        </View>
                                        {item.status === 'pending' ? (
                                            <View style={styles.actionsBox}>
                                                <TouchableOpacity style={styles.btnSmallAccept} onPress={() => handleInboxResponse(item.id, 'accept', item.payload)}>
                                                    <Text style={styles.btnSmallText}>Importar</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.btnSmallReject} onPress={() => handleInboxResponse(item.id, 'reject')}>
                                                    <Text style={styles.btnSmallTextReject}>Rechazar</Text>
                                                </TouchableOpacity>
                                            </View>
                                        ) : (
                                            <Text style={styles.friendStatus}>{item.status === 'accepted' ? 'Importada' : 'Rechazada'}</Text>
                                        )}
                                    </View>
                                ))
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
        </SafeAreaWrapper>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 12,
        marginBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: Colors.iron[950],
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
    profileStats: {
        fontSize: 14,
        color: Colors.iron[500],
        marginBottom: 16,
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
        color: Colors.iron[400],
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
        color: Colors.iron[500],
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
        color: Colors.iron[500],
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
    rankRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    friendName: {
        color: Colors.iron[950],
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    friendStatus: {
        color: Colors.iron[500],
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
        color: '#fff',
        fontWeight: 'bold',
    },
});
