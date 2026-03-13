import { SocialInboxItem, SocialProfile } from '@/src/services/SocialService';
import { withAlpha } from '@/src/theme';
import { getInboxKey } from '@/src/utils/dedupe';
import { FlashList } from '@shopify/flash-list';
import { CheckCircle, Dumbbell, Eye, EyeOff, Flame, Globe, Trophy, XCircle } from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface InboxTabProps {
    inbox: SocialInboxItem[];
    showSeen: boolean;
    setShowSeen: (show: boolean) => void;
    handleInboxResponse: (inboxId: string, action: 'accept' | 'reject', payload?: unknown) => void;
    handleMarkAsSeen: (id: string, feedType: 'direct_share' | 'activity_log') => void;
    handleToggleKudo: (feedId: string) => void;
    profile: SocialProfile | null;
    colors: any;
    styles: any;
}

const getActivityDescription = (item: SocialInboxItem): string => {
    const isPr = item.actionType === 'pr_broken';
    const isRoutineShared = item.actionType === 'routine_shared';
    if (isPr) return 'Rompió un Récord Personal';
    if (isRoutineShared) return 'Compartió una rutina';
    return 'Completó un Entrenamiento';
};

const DirectShareItem = React.memo(({ item, onResponse, onMarkAsSeen, colors, styles }: any) => {
    return (
        <View style={styles.premiumCard}>
            <View style={styles.premiumHeader}>
                <View style={styles.premiumIconBox}>
                    <Dumbbell size={24} color={colors.onPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.premiumTitle}>Invitación a Entrenar</Text>
                    <Text style={styles.premiumSender}>de @{item.senderUsername || item.senderName}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={styles.activityDate}>
                        {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                    {!item.seenAt && (
                        <TouchableOpacity style={styles.markSeenBtn} onPress={() => onMarkAsSeen(item.id, 'direct_share')}>
                            <EyeOff size={14} color={colors.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <View style={styles.premiumBody}>
                <Text style={styles.premiumDescription}>
                    {item.senderName} compartió una rutina con vos. ¿Querés importarla a tu biblioteca?
                </Text>
            </View>

            {!item.seenAt ? (
                <View style={styles.premiumActions}>
                    <TouchableOpacity style={styles.premiumBtnPrimary} onPress={() => onResponse(item.id, 'accept', item.payload)}>
                        <Text style={styles.premiumBtnTextPrimary}>Importar Rutina</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.premiumBtnSecondary} onPress={() => onResponse(item.id, 'reject')}>
                        <Text style={styles.premiumBtnTextSecondary}>Ignorar</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.premiumResolved}>
                    {item.status === 'accepted' ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <CheckCircle size={16} color={colors.green} style={{ marginRight: 6 }} />
                            <Text style={[styles.premiumStatusText, { color: colors.green }]}>Rutina Importada</Text>
                        </View>
                    ) : item.status === 'rejected' ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <XCircle size={16} color={colors.red} style={{ marginRight: 6 }} />
                            <Text style={[styles.premiumStatusText, { color: colors.red }]}>Rutina Rechazada</Text>
                        </View>
                    ) : (
                        <Text style={[styles.premiumStatusText, { color: colors.textMuted }]}>Visto</Text>
                    )}
                </View>
            )}
        </View>
    );
});

const ActivityItem = React.memo(({ item, onToggleKudo, onMarkAsSeen, profileId, colors, styles }: any) => {
    const isOwn = item.senderId === profileId;
    const senderLabel = isOwn ? 'Tú' : (item.senderUsername ? `@${item.senderUsername}` : item.senderName);
    const isPr = item.actionType === 'pr_broken';
    const isRoutineShared = item.actionType === 'routine_shared';
    const iconBg = isPr
        ? { backgroundColor: withAlpha(colors.yellow, '30') }
        : isRoutineShared
            ? { backgroundColor: withAlpha(colors.primary.DEFAULT, '30') }
            : { backgroundColor: withAlpha(colors.primary.DEFAULT, '15') };
    return (
        <View style={styles.activityRow}>
            <View style={styles.activityHeader}>
                <View style={[styles.activityIconBox, iconBg]}>
                    {isPr ? (
                        <Trophy size={18} color={colors.yellow} />
                    ) : isRoutineShared ? (
                        <Globe size={18} color={colors.primary.DEFAULT} />
                    ) : (
                        <Dumbbell size={18} color={colors.primary.DEFAULT} />
                    )}
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.activityUser}>
                        {senderLabel}
                    </Text>
                    <Text style={styles.activityDesc}>{getActivityDescription(item)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={styles.activityDate}>
                        {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                </View>
            </View>
            <View style={styles.activityFooter}>
                <TouchableOpacity
                    style={[styles.kudoBtn, item.hasKudoed && styles.kudoBtnActive, isOwn && styles.kudoBtnDisabled]}
                    onPress={() => !isOwn && onToggleKudo(item.id)}
                    disabled={isOwn}
                >
                    <Flame size={16} color={item.hasKudoed ? colors.yellow : colors.textMuted} fill={item.hasKudoed ? colors.yellow : 'none'} />
                    <Text style={[styles.kudoText, item.hasKudoed && styles.kudoTextActive]}>
                        {item.kudosCount || 0} {item.kudosCount === 1 ? 'Kudo' : 'Kudos'}
                    </Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    {isOwn && <Text style={styles.ownActivityHint}>Tu actividad</Text>}
                    {!item.seenAt && (
                        <TouchableOpacity style={styles.markSeenBtn} onPress={() => onMarkAsSeen(item.id, 'activity_log')}>
                            <Eye size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
});

export const InboxTab = React.memo(({
    inbox,
    showSeen,
    setShowSeen,
    handleInboxResponse,
    handleMarkAsSeen,
    handleToggleKudo,
    profile,
    colors,
    styles,
    renderHeader,
    refreshing,
    onRefresh
}: InboxTabProps & { renderHeader?: any, refreshing?: boolean, onRefresh?: () => void }) => {

    const filteredInbox = useMemo(() => {
        return inbox.filter(item => showSeen ? !!item.seenAt : !item.seenAt);
    }, [inbox, showSeen]);

    const renderItem = useCallback(({ item }: { item: SocialInboxItem }) => {
        if (item.feedType === 'direct_share' || !item.feedType) {
            return (
                <View style={{ marginBottom: 16 }}>
                    <DirectShareItem
                        item={item}
                        onResponse={handleInboxResponse}
                        onMarkAsSeen={handleMarkAsSeen}
                        colors={colors}
                        styles={styles}
                    />
                </View>
            );
        }
        return (
            <View style={{ marginBottom: 16 }}>
                <ActivityItem
                    item={item}
                    onToggleKudo={handleToggleKudo}
                    onMarkAsSeen={handleMarkAsSeen}
                    profileId={profile?.id}
                    colors={colors}
                    styles={styles}
                />
            </View>
        );
    }, [handleInboxResponse, handleMarkAsSeen, handleToggleKudo, profile?.id, colors, styles]);

    return (
        <View style={{ flex: 1 }}>
            <FlashList
                data={filteredInbox}
                renderItem={renderItem}
                keyExtractor={(item) => getInboxKey(item)}
                ListHeaderComponent={() => (
                    <View>
                        {renderHeader && renderHeader()}
                        <View style={styles.inboxSecondaryHeader}>
                            <Text style={styles.inboxStatusTitle}>
                                {showSeen ? 'Historial de Notificaciones' : 'Notificaciones Recientes'}
                            </Text>
                            <TouchableOpacity
                                style={[styles.archiveToggle, showSeen && styles.archiveToggleActive]}
                                onPress={() => setShowSeen(!showSeen)}
                            >
                                {showSeen ? <Eye size={16} color={colors.onPrimary} /> : <EyeOff size={16} color={colors.textMuted} />}
                                <Text style={[styles.archiveToggleText, showSeen && styles.archiveToggleTextActive]}>
                                    {showSeen ? 'Ver pendientes' : 'Ver archivadas'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
                refreshing={refreshing}
                onRefresh={onRefresh}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>
                        {showSeen ? 'No tenés notificaciones archivadas.' : 'Todo al día por acá.'}
                    </Text>
                }
                contentContainerStyle={{ paddingBottom: 100 }}
            />
        </View>
    );
});
