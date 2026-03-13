import { SocialFriend } from '@/src/services/SocialService';
import { FlashList } from '@shopify/flash-list';
import { UserCheck, UserMinus } from 'lucide-react-native';
import React, { useCallback } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface FriendsTabProps {
    friends: SocialFriend[];
    onAcceptRequest: (id: string, name: string) => void;
    onRejectRequest: (id: string, name: string) => void;
    onShowFriendActions: (friend: SocialFriend) => void;
    colors: any;
    styles: any;
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
    onAcceptRequest: (id: string, name: string) => void,
    onRejectRequest: (id: string, name: string) => void,
    onShowFriendActions: (friend: SocialFriend) => void,
    colors: any,
    styles: any
}) => {
    const isRequest = friend.status === 'pending' && !friend.isSender;
    const isSent = friend.status === 'pending' && friend.isSender;

    return (
        <TouchableOpacity
            style={styles.friendRow}
            onPress={() => onShowFriendActions(friend)}
            activeOpacity={0.8}
        >
            <View>
                <Text style={styles.friendName}>{friend.displayName}</Text>
                <Text style={styles.friendStatus}>
                    {isRequest ? 'Te envió solicitud' : isSent ? 'Solicitud Enviada' : (friend.status === 'blocked' ? 'Bloqueado' : 'Amigo')}
                </Text>
            </View>
            {isRequest && (
                <View style={styles.actionsBox}>
                    <TouchableOpacity
                        style={styles.btnSmallAccept}
                        onPress={() => onAcceptRequest(friend.id, friend.displayName)}
                    >
                        <UserCheck size={18} color={colors.onPrimary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.btnSmallReject}
                        onPress={() => onRejectRequest(friend.id, friend.displayName)}
                    >
                        <UserMinus size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                </View>
            )}
            {!isRequest && !isSent && (
                <UserCheck size={20} color={colors.primary.DEFAULT} />
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
}: FriendsTabProps & { renderHeader?: any, refreshing?: boolean, onRefresh?: () => void }) => {

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
                data={friends}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={renderHeader}
                refreshing={refreshing}
                onRefresh={onRefresh}
                ListEmptyComponent={<Text style={styles.emptyText}>No tienes amigos aún. Busca a alguien por su ID.</Text>}
                contentContainerStyle={{ paddingBottom: 100 }}
            />
        </View>
    );
});
