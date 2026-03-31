import { SocialInboxItem, SocialProfile } from '@/src/services/SocialService';
import { ActivityVisualSummary, SocialStory, buildActivityVisualSummary } from '@/src/social/socialSelectors';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { Flame, Heart, Layers, Sparkles, Trophy } from 'lucide-react-native';
import React, { memo, useMemo, useRef } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';

type SocialFeedTabProps = {
    items: SocialInboxItem[];
    profile: SocialProfile | null;
    stories: SocialStory[];
    isLive?: boolean;
    liveSource?: 'idle' | 'sse' | 'polling';
    lastLiveSyncAt?: number | null;
    renderHeader?: () => React.ReactNode;
    refreshing?: boolean;
    onRefresh?: () => void;
    onToggleKudo: (feedId: string) => Promise<void> | void;
    onMarkAsSeen: (id: string, feedType: 'activity_log' | 'direct_share') => Promise<void> | void;
    onOpenStory?: (story: SocialStory) => void;
    onCopyRoutine?: (item: SocialInboxItem) => void;
    colors: any;
    styles: any;
};

const DOUBLE_TAP_THRESHOLD_MS = 280;

const timeAgo = (value: unknown): string => {
    if (!value) return 'recién';
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return 'recién';
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.max(1, Math.floor(diffMs / 60000));
    if (minutes < 60) return `hace ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `hace ${days}d`;
};

const syncLabel = (value: number | null | undefined): string => {
    if (!value) return 'sincronizando…';
    const diffMs = Date.now() - value;
    if (diffMs < 15000) return 'actualizado ahora';
    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return `actualizado hace ${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `actualizado hace ${minutes}m`;
};

const StoryStrip = memo(({ stories, onOpenStory, colors, styles }: { stories: SocialStory[]; onOpenStory?: (story: SocialStory) => void; colors: any; styles: any }) => {
    if (!stories.length) return null;

    return (
        <View style={{ marginBottom: 16 }}>
            <Text style={[styles.inboxStatusTitle, { marginBottom: 10 }]}>Historias fitness</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 2 }}>
                {stories.map((story) => (
                    <TouchableOpacity
                        key={story.userId}
                        activeOpacity={0.85}
                        onPress={() => onOpenStory?.(story)}
                        style={{ alignItems: 'center', width: 72 }}
                    >
                        <View
                            style={{
                                width: 56,
                                height: 56,
                                borderRadius: 28,
                                borderWidth: 2,
                                borderColor: story.trainedToday ? colors.primary.DEFAULT : colors.border,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: colors.surface,
                            }}
                        >
                            <Text style={{ color: colors.text, fontWeight: '900', fontSize: 15 }}>
                                {(story.name || 'U').slice(0, 1).toUpperCase()}
                            </Text>
                        </View>
                        <Text numberOfLines={1} style={{ marginTop: 6, fontSize: 11, color: colors.textMuted, fontWeight: '700' }}>
                            {story.name}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
});

const ScoreRail = memo(({ profile, colors }: { profile: SocialProfile | null; colors: any }) => {
    if (!profile) return null;

    const score = Math.round(profile.scoreLifetime || 0);
    const streak = profile.streakWeeks || 0;
    const weatherMultiplier = profile.weatherBonus?.multiplier || 1;
    const friendsCount = profile.socialSummary?.friendsCount ?? 0;
    const activityCount = profile.socialSummary?.activityCount ?? 0;
    const engagementScore = profile.socialSummary?.engagementScore ?? 0;

    return (
        <View style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <View style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 10 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800' }}>IRONPOINTS</Text>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 2 }}>{score}</Text>
                </View>
                <View style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 10 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800' }}>RACHA</Text>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 2 }}>{streak} sem</Text>
                </View>
                <View style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 10 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800' }}>CLIMA</Text>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 2 }}>x{weatherMultiplier.toFixed(2)}</Text>
                </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceLighter, paddingVertical: 8, paddingHorizontal: 10 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800' }}>AMIGOS</Text>
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '900', marginTop: 2 }}>{friendsCount}</Text>
                </View>
                <View style={{ flex: 1, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceLighter, paddingVertical: 8, paddingHorizontal: 10 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800' }}>ACTIVIDAD</Text>
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '900', marginTop: 2 }}>{activityCount}</Text>
                </View>
                <View style={{ flex: 1, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceLighter, paddingVertical: 8, paddingHorizontal: 10 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800' }}>ENG</Text>
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '900', marginTop: 2 }}>{engagementScore}</Text>
                </View>
            </View>
        </View>
    );
});

const ActivityCard = memo(({
    item,
    profile,
    summary,
    onToggleKudo,
    onMarkAsSeen,
    onCopyRoutine,
    colors,
    styles,
}: {
    item: SocialInboxItem;
    profile: SocialProfile | null;
    summary: ActivityVisualSummary;
    onToggleKudo: (feedId: string) => Promise<void> | void;
    onMarkAsSeen: (id: string, feedType: 'activity_log' | 'direct_share') => Promise<void> | void;
    onCopyRoutine?: (item: SocialInboxItem) => void;
    colors: any;
    styles: any;
}) => {
    const lastTapRef = useRef<number>(0);
    const isOwn = profile?.id && item.senderId === profile.id;

    const onDoubleTapKudo = () => {
        const now = Date.now();
        if (now - lastTapRef.current < DOUBLE_TAP_THRESHOLD_MS && !isOwn) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
            onToggleKudo(item.id);
        }
        lastTapRef.current = now;
    };

    const badgeIcon = summary.activityKind === 'pr'
        ? <Trophy size={14} color={colors.yellow} />
        : summary.activityKind === 'routine'
            ? <Layers size={14} color={colors.primary.DEFAULT} />
            : <Sparkles size={14} color={colors.primary.DEFAULT} />;

    return (
        <View style={[styles.activityRow, { marginBottom: 18 }]}> 
            <View style={[styles.activityHeader, { marginBottom: 10 }]}> 
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceLighter, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ color: colors.text, fontWeight: '900' }}>{(item.senderName || 'U').slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.activityUser}>{item.senderName || 'Usuario'}</Text>
                    <Text style={styles.activityDate}>{timeAgo(item.createdAt)}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surfaceLighter }}>
                    {badgeIcon}
                    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800' }}>{summary.badge}</Text>
                </View>
            </View>

            <Pressable onPress={onDoubleTapKudo} style={{ borderRadius: 16, overflow: 'hidden' }}>
                <View style={{ borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, padding: 16 }}>
                    <Text style={{ color: colors.text, fontWeight: '900', fontSize: 18 }}>{summary.headline}</Text>
                    <Text style={{ color: colors.textMuted, marginTop: 4, fontWeight: '700' }}>{summary.subline}</Text>

                    <View style={{ marginTop: 14, borderRadius: 12, backgroundColor: colors.surfaceLighter, borderWidth: 1, borderColor: colors.border, padding: 14 }}>
                        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 }}>{summary.highlightLabel.toUpperCase()}</Text>
                        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 4 }}>{summary.highlightValue}</Text>
                    </View>
                </View>
            </Pressable>

            <View style={[styles.activityFooter, { marginTop: 10 }]}> 
                <TouchableOpacity
                    style={[styles.kudoBtn, item.hasKudoed && styles.kudoBtnActive, isOwn && styles.kudoBtnDisabled]}
                    onPress={() => {
                        if (!isOwn) {
                            Haptics.selectionAsync().catch(() => undefined);
                            onToggleKudo(item.id);
                        }
                    }}
                    disabled={!!isOwn}
                    activeOpacity={0.85}
                >
                    {item.hasKudoed ? (
                        <Heart size={16} color={colors.yellow} fill={colors.yellow} />
                    ) : (
                        <Flame size={16} color={colors.textMuted} />
                    )}
                    <Text style={[styles.kudoText, item.hasKudoed && styles.kudoTextActive]}>
                        {item.kudosCount || 0} Kudos
                    </Text>
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    {summary.activityKind === 'routine' && (
                        <TouchableOpacity
                            style={[styles.archiveToggle, { borderColor: colors.border }]}
                            onPress={() => {
                                Haptics.selectionAsync().catch(() => undefined);
                                onCopyRoutine?.(item);
                            }}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.archiveToggleText}>Guardar rutina</Text>
                        </TouchableOpacity>
                    )}
                    {!item.seenAt && (
                        <TouchableOpacity
                            style={[styles.archiveToggle, { borderColor: colors.border }]}
                            onPress={() => {
                                Haptics.selectionAsync().catch(() => undefined);
                                onMarkAsSeen(item.id, 'activity_log');
                            }}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.archiveToggleText}>Marcar visto</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
});

export const SocialFeedTab = memo(({ items, profile, stories, isLive, liveSource, lastLiveSyncAt, renderHeader, refreshing, onRefresh, onToggleKudo, onMarkAsSeen, onOpenStory, onCopyRoutine, colors, styles }: SocialFeedTabProps) => {
    const preparedItems = useMemo(() => {
        return items.map((item) => ({ item, summary: buildActivityVisualSummary(item) }));
    }, [items]);

    return (
        <FlashList
            data={preparedItems}
            keyExtractor={(entry) => entry.item.id}
            renderItem={({ item: entry }) => (
                <ActivityCard
                    item={entry.item}
                    summary={entry.summary}
                    profile={profile}
                    onToggleKudo={onToggleKudo}
                    onMarkAsSeen={onMarkAsSeen}
                    onCopyRoutine={onCopyRoutine}
                    colors={colors}
                    styles={styles}
                />
            )}
            ListHeaderComponent={
                <View style={{ paddingTop: 8 }}>
                    {renderHeader?.()}
                    <View style={{ marginBottom: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isLive ? colors.green : colors.red }} />
                            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 11 }}>
                                {isLive ? `LIVE · ${liveSource === 'sse' ? 'SSE' : 'POLLING'}` : 'RECONNECTING'}
                            </Text>
                        </View>
                        <Text style={{ color: colors.textMuted, fontWeight: '700', fontSize: 11 }}>
                            {syncLabel(lastLiveSyncAt)}
                        </Text>
                    </View>
                    <ScoreRail profile={profile} colors={colors} />
                    <StoryStrip stories={stories} onOpenStory={onOpenStory} colors={colors} styles={styles} />
                </View>
            }
            refreshControl={<RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary.DEFAULT} />}
            ListEmptyComponent={<Text style={styles.emptyText}>Todavía no hay actividad en tu feed.</Text>}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
        />
    );
});

export default SocialFeedTab;
