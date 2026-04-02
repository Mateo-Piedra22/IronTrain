import { SocialColors, SocialHeaderRenderer, SocialStyles } from '@/components/social/types';
import { SocialFriend } from '@/src/services/SocialService';
import { feedbackSelection } from '@/src/social/feedback';
import { withAlpha } from '@/src/theme';
import { FlashList } from '@shopify/flash-list';
import { CheckCircle2, ChevronRight, Clock3, Send, ShieldBan, UserCheck, UserMinus } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface FriendsTabProps {
    friends: SocialFriend[];
    onAcceptRequest: (id: string) => void;
    onRejectRequest: (id: string) => void;
    onShowFriendActions: (friend: SocialFriend) => void;
    colors: SocialColors;
    styles: SocialStyles;
}

const FriendItem = React.memo(({
    friend,
    onAcceptRequest,
    onRejectRequest,
    onShowFriendActions,
    colors,
    styles
}: {
    friend: SocialFriend,
    onAcceptRequest: (id: string) => void,
    onRejectRequest: (id: string) => void,
    onShowFriendActions: (friend: SocialFriend) => void,
    colors: SocialColors,
    styles: SocialStyles
}) => {
    const isRequest = friend.status === 'pending' && !friend.isSender;
    const isSent = friend.status === 'pending' && friend.isSender;
    const isBlocked = friend.status === 'blocked';
    const isAccepted = friend.status === 'accepted';

    const statusText = isRequest
        ? 'Solicitud recibida'
        : isSent
            ? 'Solicitud enviada'
            : isBlocked
                ? 'Bloqueado'
                : 'Amigo';

    const statusColor = isRequest
        ? colors.primary.DEFAULT
        : isSent
            ? colors.yellow
            : isBlocked
                ? colors.red
                : colors.green;

    const statusIcon = isRequest
        ? <Clock3 size={11} color={statusColor} />
        : isSent
            ? <Send size={11} color={statusColor} />
            : isBlocked
                ? <ShieldBan size={11} color={statusColor} />
                : <CheckCircle2 size={11} color={statusColor} />;

    return (
        <TouchableOpacity
            style={styles.friendRow}
            onPress={() => {
                feedbackSelection();
                onShowFriendActions(friend);
            }}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceLighter, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: colors.text, fontWeight: '900' }}>{(friend.displayName || 'A').slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.friendName}>{friend.displayName}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, borderWidth: 1, borderColor: statusColor, backgroundColor: colors.surface, paddingHorizontal: 8, paddingVertical: 4 }}>
                            {statusIcon}
                            <Text style={{ color: statusColor, fontWeight: '900', fontSize: 10, textTransform: 'uppercase' }}>{statusText}</Text>
                        </View>
                        {!!friend.username && <Text style={[styles.friendStatus, { fontSize: 12 }]}>@{friend.username}</Text>}
                    </View>
                </View>
            </View>

            {isRequest && (
                <View style={styles.actionsBox}>
                    <TouchableOpacity
                        style={styles.btnSmallAccept}
                        onPress={() => {
                            feedbackSelection();
                            onAcceptRequest(friend.id);
                        }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                        <UserCheck size={18} color={colors.onPrimary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.btnSmallReject}
                        onPress={() => {
                            feedbackSelection();
                            onRejectRequest(friend.id);
                        }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                        <UserMinus size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                </View>
            )}
            {!isRequest && (
                <ChevronRight size={18} color={colors.textMuted} />
            )}
        </TouchableOpacity>
    );
});

export const FriendsTab = React.memo(({
    friends,
    onAcceptRequest,
    onRejectRequest,
    onShowFriendActions,
    renderHeader,
    refreshing,
    onRefresh,
    colors,
    styles
}: FriendsTabProps & { renderHeader?: SocialHeaderRenderer, refreshing?: boolean, onRefresh?: () => void }) => {
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'sent' | 'blocked'>('all');

    const pendingCount = useMemo(
        () => friends.filter((friend) => friend.status === 'pending' && !friend.isSender).length,
        [friends]
    );

    const acceptedCount = useMemo(
        () => friends.filter((friend) => friend.status === 'accepted').length,
        [friends]
    );

    const sortedFriends = useMemo(() => {
        const rank = (friend: SocialFriend) => {
            if (friend.status === 'pending' && !friend.isSender) return 0;
            if (friend.status === 'accepted') return 1;
            if (friend.status === 'pending' && friend.isSender) return 2;
            return 3;
        };

        return [...friends].sort((a, b) => {
            const byRank = rank(a) - rank(b);
            if (byRank !== 0) return byRank;
            return (a.displayName || '').localeCompare(b.displayName || '');
        });
    }, [friends]);

    const filteredFriends = useMemo(() => {
        if (statusFilter === 'all') return sortedFriends;
        if (statusFilter === 'pending') return sortedFriends.filter((friend) => friend.status === 'pending' && !friend.isSender);
        if (statusFilter === 'accepted') return sortedFriends.filter((friend) => friend.status === 'accepted');
        if (statusFilter === 'sent') return sortedFriends.filter((friend) => friend.status === 'pending' && friend.isSender);
        return sortedFriends.filter((friend) => friend.status === 'blocked');
    }, [statusFilter, sortedFriends]);

    const header = useMemo(() => (
        <View style={{ gap: 10, marginBottom: 8 }}>
            {renderHeader && renderHeader()}
            <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingVertical: 8, paddingHorizontal: 10 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800' }}>SOLICITUDES</Text>
                    <Text style={{ color: colors.text, fontWeight: '900', marginTop: 2 }}>{pendingCount}</Text>
                </View>
                <View style={{ flex: 1, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingVertical: 8, paddingHorizontal: 10 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800' }}>AMIGOS</Text>
                    <Text style={{ color: colors.text, fontWeight: '900', marginTop: 2 }}>{acceptedCount}</Text>
                </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {([
                    { key: 'all', label: 'Todos' },
                    { key: 'pending', label: 'Pendientes' },
                    { key: 'accepted', label: 'Amigos' },
                    { key: 'sent', label: 'Enviadas' },
                    { key: 'blocked', label: 'Bloqueados' },
                ] as const).map((item) => (
                    <TouchableOpacity
                        key={item.key}
                        style={{ borderRadius: 999, borderWidth: 1, borderColor: statusFilter === item.key ? colors.primary.DEFAULT : colors.border, backgroundColor: statusFilter === item.key ? withAlpha(colors.primary.DEFAULT, '14') : colors.surface, paddingHorizontal: 10, paddingVertical: 6 }}
                        onPress={() => {
                            feedbackSelection();
                            setStatusFilter(item.key);
                        }}
                    >
                        <Text style={{ color: statusFilter === item.key ? colors.primary.DEFAULT : colors.textMuted, fontWeight: '800', fontSize: 11 }}>{item.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    ), [renderHeader, colors.border, colors.surface, colors.textMuted, colors.text, colors.primary.DEFAULT, pendingCount, acceptedCount, statusFilter]);

    const renderItem = useCallback(({ item }: { item: SocialFriend }) => (
        <FriendItem
            friend={item}
            onAcceptRequest={onAcceptRequest}
            onRejectRequest={onRejectRequest}
            onShowFriendActions={onShowFriendActions}
            colors={colors}
            styles={styles}
        />
    ), [onAcceptRequest, onRejectRequest, onShowFriendActions, colors, styles]);

    return (
        <View style={{ flex: 1 }}>
                <FlashList
                    data={filteredFriends}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    ListHeaderComponent={header}
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                ListEmptyComponent={<Text style={styles.emptyText}>{statusFilter === 'all' ? 'Todavía no tenés amigos. Usá Descubrir para enviar una solicitud.' : 'No hay resultados para este filtro todavía.'}</Text>}
                contentContainerStyle={{ paddingBottom: 100 }}
            />
        </View>
    );
});
