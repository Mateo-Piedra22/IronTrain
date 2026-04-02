import { SocialColors, SocialHeaderRenderer, SocialStyles } from '@/components/social/types';
import { SocialInboxItem, SocialProfile } from '@/src/services/SocialService';
import { feedbackSelection, feedbackSoftImpact } from '@/src/social/feedback';
import { withAlpha } from '@/src/theme';
import { getInboxKey } from '@/src/utils/dedupe';
import { FlashList } from '@shopify/flash-list';
import { CheckCircle, ChevronDown, ChevronUp, Dumbbell, Eye, EyeOff, Filter, Flame, Globe, Trophy, User, XCircle } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { LayoutAnimation, ScrollView, Text, TouchableOpacity, View } from 'react-native';

type FeedFilter = 'all' | 'pr' | 'workout' | 'routine';

interface PrGroupItem {
    id: string;
    type: 'pr_group';
    senderId: string;
    senderName: string;
    senderUsername?: string | null;
    createdAt: string | number | Date;
    items: SocialInboxItem[];
    unseenCount: number;
}

type InboxRenderItem = SocialInboxItem | PrGroupItem;

const safeDate = (dateStr: unknown): Date => {
    try {
        if (!dateStr) return new Date();
        const d = dateStr instanceof Date
            ? dateStr
            : typeof dateStr === 'string' || typeof dateStr === 'number'
                ? new Date(dateStr)
                : new Date();
        return isNaN(d.getTime()) ? new Date() : d;
    } catch {
        return new Date();
    }
};

interface InboxTabProps {
    inbox: SocialInboxItem[];
    showSeen: boolean;
    setShowSeen: (show: boolean) => void;
    hideOwnActivity: boolean;
    setHideOwnActivity: (hide: boolean) => void;
    typeFilter: FeedFilter;
    setTypeFilter: (type: FeedFilter) => void;
    handleInboxResponse: (inboxId: string, action: 'accept' | 'reject', payload?: unknown) => void;
    handleMarkAsSeen: (id: string, feedType: 'direct_share' | 'activity_log') => void;
    handleMarkAllAsSeen?: () => void;
    handleToggleKudo: (feedId: string) => void;
    profile: SocialProfile | null;
    colors: SocialColors;
    styles: SocialStyles;
    renderHeader?: SocialHeaderRenderer;
    refreshing?: boolean;
    onRefresh?: () => void;
    isLive?: boolean;
    liveSource?: 'idle' | 'sse' | 'polling';
    lastLiveSyncAt?: number | null;
}

const getActivityDescription = (item: SocialInboxItem): string => {
    const isPr = item.actionType === 'pr_broken';
    const isRoutineShared = item.actionType === 'routine_shared';
    if (isPr) {
        try {
            const meta = item.metadata ? JSON.parse(item.metadata) : {};
            const exercise = meta.exerciseName || 'un ejercicio';
            const unit = meta.unit || 'kg';
            if (meta.weight && meta.reps) {
                return `Nuevo PR en ${exercise}: ${meta.weight}${unit} x ${meta.reps}`;
            }
            if (meta.oneRm) {
                return `Nuevo PR en ${exercise}: ${Math.round(meta.oneRm)}${unit} (1RM)`;
            }
        } catch { }
        return 'Rompió un Récord Personal';
    }
    if (isRoutineShared) return 'Compartió una rutina';
    return 'Completó un Entrenamiento';
};

const DirectShareItem = React.memo(({
    item,
    onResponse,
    onMarkAsSeen,
    colors,
    styles,
}: {
    item: SocialInboxItem;
    onResponse: (inboxId: string, action: 'accept' | 'reject', payload?: unknown) => void;
    onMarkAsSeen: (id: string, feedType: 'direct_share' | 'activity_log') => void;
    colors: SocialColors;
    styles: SocialStyles;
}) => {
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
                        {safeDate(item.createdAt).toLocaleDateString()}
                    </Text>
                    {!item.seenAt && (
                        <TouchableOpacity onPress={() => { feedbackSelection(); onMarkAsSeen(item.id, 'direct_share'); }}>
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
                    <TouchableOpacity style={styles.premiumBtnPrimary} onPress={() => { feedbackSelection(); onResponse(item.id, 'accept', item.payload); }}>
                        <Text style={styles.premiumBtnTextPrimary}>Importar Rutina</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.premiumBtnSecondary} onPress={() => { feedbackSelection(); onResponse(item.id, 'reject'); }}>
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

const ActivityItem = React.memo(({
    item,
    onToggleKudo,
    onMarkAsSeen,
    profileId,
    colors,
    styles,
    isGrouped = false,
}: {
    item: SocialInboxItem;
    onToggleKudo: (feedId: string) => void;
    onMarkAsSeen: (id: string, feedType: 'direct_share' | 'activity_log') => void;
    profileId?: string;
    colors: SocialColors;
    styles: SocialStyles;
    isGrouped?: boolean;
}) => {
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
        <View style={[styles.activityRow, isGrouped && { paddingLeft: 16, borderLeftWidth: 2, borderLeftColor: colors.border }]}>
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
                        {!isGrouped && senderLabel}
                    </Text>
                    <Text style={styles.activityDesc}>{getActivityDescription(item)}</Text>
                </View>
                {!isGrouped && (
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Text style={styles.activityDate}>
                            {safeDate(item.createdAt).toLocaleDateString()}
                        </Text>
                    </View>
                )}
            </View>
            <View style={styles.activityFooter}>
                <TouchableOpacity
                    style={[styles.kudoBtn, item.hasKudoed && styles.kudoBtnActive, isOwn && styles.kudoBtnDisabled]}
                    onPress={() => {
                        if (isOwn) return;
                        feedbackSelection();
                        onToggleKudo(item.id);
                    }}
                    disabled={isOwn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Flame size={16} color={item.hasKudoed ? colors.yellow : colors.textMuted} fill={item.hasKudoed ? colors.yellow : 'none'} />
                    <Text style={[styles.kudoText, item.hasKudoed && styles.kudoTextActive]}>
                        {item.kudosCount || 0} {item.kudosCount === 1 ? 'Kudo' : 'Kudos'}
                    </Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    {isOwn && <Text style={styles.ownActivityHint}>Tu actividad</Text>}
                    {!item.seenAt && (
                        <TouchableOpacity onPress={() => { feedbackSelection(); onMarkAsSeen(item.id, 'activity_log'); }}>
                            <Eye size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
});

const InboxTab = React.memo(({
    inbox,
    showSeen,
    setShowSeen,
    hideOwnActivity,
    setHideOwnActivity,
    typeFilter,
    setTypeFilter,
    handleInboxResponse,
    handleMarkAsSeen,
    handleMarkAllAsSeen,
    handleToggleKudo,
    profile,
    colors,
    styles,
    renderHeader,
    refreshing,
    onRefresh,
    isLive,
    liveSource,
    lastLiveSyncAt,
}: InboxTabProps) => {
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    const toggleGroup = (groupId: string) => {
        feedbackSoftImpact();
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedGroups((prev: Record<string, boolean>) => ({ ...prev, [groupId]: !prev[groupId] }));
    };

    const organizedData = useMemo(() => {
        if (!inbox) return [];

        // 1. Initial Filtering
        const filtered = inbox.filter(item => {
            // Seen/Unseen filtering
            const matchesSeen = showSeen ? !!item.seenAt : !item.seenAt;
            if (!matchesSeen) return false;

            // Own activity filtering
            if (hideOwnActivity && profile?.id && item.senderId === profile.id) return false;

            // Type filtering
            if (typeFilter !== 'all') {
                if (typeFilter === 'pr' && item.actionType !== 'pr_broken') return false;
                if (typeFilter === 'workout' && item.actionType !== 'workout_completed') return false;
                if (typeFilter === 'routine' && item.feedType !== 'direct_share' && item.actionType !== 'routine_shared') return false;
            }

            return true;
        });

        // 2. Grouping PRs
        const result: InboxRenderItem[] = [];
        const prGroups: Record<string, SocialInboxItem[]> = {};

        filtered.forEach(item => {
            if (item.actionType === 'pr_broken') {
                const dateKey = safeDate(item.createdAt).toISOString().split('T')[0];
                const groupKey = `pr_group:${item.senderId}:${dateKey}`;
                if (!prGroups[groupKey]) prGroups[groupKey] = [];
                prGroups[groupKey].push(item);
            } else {
                result.push(item);
            }
        });

        // Add groups or single items
        Object.entries(prGroups).forEach(([key, items]) => {
            if (items.length > 2) { // Only group if more than 2 PRs
                result.push({
                    id: key,
                    type: 'pr_group',
                    senderId: items[0].senderId,
                    senderName: items[0].senderName,
                    senderUsername: items[0].senderUsername,
                    createdAt: items[0].createdAt,
                    items: items.sort((a, b) => safeDate(b.createdAt).getTime() - safeDate(a.createdAt).getTime()),
                    unseenCount: items.filter(i => !i.seenAt).length
                });
            } else {
                items.forEach(i => result.push(i));
            }
        });

        // Sort everything by date
        return result.sort((a, b) => safeDate(b.createdAt).getTime() - safeDate(a.createdAt).getTime());
    }, [inbox, showSeen, profile?.id, hideOwnActivity, typeFilter]);

    const renderGroupItem = (group: PrGroupItem) => {
        const isExpanded = !!expandedGroups[group.id];
        const isOwn = group.senderId === profile?.id;
        const senderLabel = isOwn ? 'Tú' : (group.senderUsername ? `@${group.senderUsername}` : group.senderName);

        return (
            <View style={{ marginBottom: 16 }}>
                <TouchableOpacity
                    style={styles.activityRow}
                    onPress={() => toggleGroup(group.id)}
                    activeOpacity={0.7}
                >
                    <View style={styles.activityHeader}>
                        <View style={[styles.activityIconBox, { backgroundColor: withAlpha(colors.yellow, '30') }]}>
                            <Trophy size={18} color={colors.yellow} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.activityUser}>{senderLabel}</Text>
                            <Text style={styles.activityDesc}>Batió {group.items.length} Récords Personales</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                            <Text style={styles.activityDate}>
                                {safeDate(group.createdAt).toLocaleDateString()}
                            </Text>
                            {isExpanded ? (
                                <ChevronUp size={16} color={colors.textMuted} />
                            ) : (
                                <ChevronDown size={16} color={colors.textMuted} />
                            )}
                        </View>
                    </View>
                </TouchableOpacity>

                {isExpanded && (
                    <View style={{ marginTop: -8 }}>
                        {group.items.map((item: SocialInboxItem) => (
                            <ActivityItem
                                key={item.id}
                                item={item}
                                onToggleKudo={handleToggleKudo}
                                onMarkAsSeen={handleMarkAsSeen}
                                profileId={profile?.id}
                                colors={colors}
                                styles={styles}
                                isGrouped={true}
                            />
                        ))}
                    </View>
                )}
            </View>
        );
    };

    const renderItem = useCallback(({ item }: { item: InboxRenderItem }) => {
        if (item.type === 'pr_group') {
            return renderGroupItem(item);
        }

        if (item.feedType === 'direct_share') {
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
    }, [handleInboxResponse, handleMarkAsSeen, handleToggleKudo, profile?.id, colors, styles, expandedGroups]);

    return (
        <View style={{ flex: 1 }}>
            <FlashList
                data={organizedData}
                renderItem={renderItem}
                keyExtractor={(item) => item.id || getInboxKey(item)}
                ListHeaderComponent={() => (
                    <View style={{ paddingTop: 8 }}>
                        {renderHeader && renderHeader()}

                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                            <View style={{ flex: 1, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceLighter, paddingVertical: 8, paddingHorizontal: 10 }}>
                                <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800' }}>PUBLICACIONES</Text>
                                <Text style={{ color: colors.text, fontWeight: '900', marginTop: 2 }}>{organizedData.length}</Text>
                            </View>
                            <View style={{ flex: 1, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceLighter, paddingVertical: 8, paddingHorizontal: 10 }}>
                                <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800' }}>PENDIENTES</Text>
                                <Text style={{ color: colors.text, fontWeight: '900', marginTop: 2 }}>
                                    {organizedData.reduce((total, entry) => {
                                        if (entry.type === 'pr_group') return total + entry.unseenCount;
                                        return total + (entry.seenAt ? 0 : 1);
                                    }, 0)}
                                </Text>
                            </View>
                        </View>

                        {/* 1. Global Filters Bar (Always at top) */}
                        <View style={{ marginBottom: 12 }}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4, gap: 10 }}>
                                <TouchableOpacity
                                    style={[styles.filterChip, hideOwnActivity && styles.filterChipActive]}
                                    onPress={() => {
                                        feedbackSelection();
                                        setHideOwnActivity(!hideOwnActivity);
                                    }}
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                >
                                    <User size={14} color={hideOwnActivity ? colors.onPrimary : colors.textMuted} />
                                    <Text style={[styles.filterChipText, hideOwnActivity && styles.filterChipTextActive]}>
                                        Ocultar mías
                                    </Text>
                                </TouchableOpacity>

                                <View style={styles.filterSeparator} />

                                {(['all', 'workout', 'pr', 'routine'] as const).map((type) => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[styles.filterChip, typeFilter === type && styles.filterChipActive]}
                                        onPress={() => {
                                            feedbackSelection();
                                            setTypeFilter(type);
                                        }}
                                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    >
                                        {type === 'all' && <Filter size={14} color={typeFilter === type ? colors.onPrimary : colors.textMuted} />}
                                        {type === 'workout' && <Dumbbell size={14} color={typeFilter === type ? colors.onPrimary : colors.textMuted} />}
                                        {type === 'pr' && <Trophy size={14} color={typeFilter === type ? colors.onPrimary : colors.textMuted} />}
                                        {type === 'routine' && <Globe size={14} color={typeFilter === type ? colors.onPrimary : colors.textMuted} />}
                                        <Text style={[styles.filterChipText, typeFilter === type && styles.filterChipTextActive]}>
                                            {type === 'all' ? 'Todos' : type === 'workout' ? 'Entrenos' : type === 'pr' ? 'Récords' : 'Rutinas'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        {/* 2. Secondary Header with Toggle (Section Title) */}
                        <View style={[styles.inboxSecondaryHeader, { marginBottom: 16, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inboxStatusTitle}>
                                    {showSeen ? 'Historial de notificaciones' : 'Notificaciones recientes'}
                                </Text>
                                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2, fontWeight: '600' }}>
                                    {showSeen ? 'Actividad guardada' : 'Nuevas interacciones'}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={[styles.archiveToggle, showSeen && styles.archiveToggleActive]}
                                onPress={() => {
                                    feedbackSelection();
                                    setShowSeen(!showSeen);
                                }}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                                {showSeen ? <Eye size={16} color={colors.onPrimary} /> : <EyeOff size={16} color={colors.textMuted} />}
                                <Text style={[styles.archiveToggleText, showSeen && styles.archiveToggleTextActive]}>
                                    {showSeen ? 'Ver pendientes' : 'Ver archivadas'}
                                </Text>
                            </TouchableOpacity>

                            {!showSeen && handleMarkAllAsSeen && (
                                <TouchableOpacity
                                    style={[styles.archiveToggle, { marginLeft: 10, borderColor: colors.border }]}
                                    onPress={() => {
                                        feedbackSelection();
                                        handleMarkAllAsSeen();
                                    }}
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                >
                                    <CheckCircle size={16} color={colors.textMuted} />
                                    <Text style={[styles.archiveToggleText, { marginLeft: 6 }]}>Marcar todo</Text>
                                </TouchableOpacity>
                            )}
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
                contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
            />
        </View>
    );
});

export default InboxTab;

