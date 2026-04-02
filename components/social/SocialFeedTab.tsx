import { SocialColors, SocialHeaderRenderer, SocialStyles } from '@/components/social/types';
import { SocialInboxItem, SocialProfile } from '@/src/services/SocialService';
import { feedbackSelection, feedbackSoftImpact } from '@/src/social/feedback';
import { ActivityVisualSummary, SocialStory, buildActivityVisualSummary } from '@/src/social/socialSelectors';
import { FlashList } from '@shopify/flash-list';
import { CloudRain, Eye, Flame, Heart, Layers, Sparkles, Trophy, Users } from 'lucide-react-native';
import React, { memo, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';

type SocialFeedTabProps = {
    items: SocialInboxItem[];
    profile: SocialProfile | null;
    stories: SocialStory[];
    isLive?: boolean;
    liveSource?: 'idle' | 'sse' | 'polling';
    lastLiveSyncAt?: number | null;
    renderHeader?: SocialHeaderRenderer;
    refreshing?: boolean;
    onRefresh?: () => void;
    onToggleKudo: (feedId: string) => Promise<void> | void;
    onMarkAsSeen: (id: string, feedType: 'activity_log' | 'direct_share') => Promise<void> | void;
    onOpenStory?: (story: SocialStory) => void;
    onCopyRoutine?: (item: SocialInboxItem) => void;
    showScoreRail?: boolean;
    showStories?: boolean;
    emptyText?: string;
    colors: SocialColors;
    styles: SocialStyles;
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

const StoryStrip = memo(({ stories, onOpenStory, colors, styles }: { stories: SocialStory[]; onOpenStory?: (story: SocialStory) => void; colors: SocialColors; styles: SocialStyles }) => {
    if (!stories.length) return null;

    return (
        <View style={{ marginBottom: 16 }}>
            <Text style={[styles.inboxStatusTitle, { marginBottom: 10 }]}>Historias fitness</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 2 }}>
                {stories.map((story) => (
                    <TouchableOpacity
                        key={story.userId}
                        activeOpacity={0.85}
                        onPress={() => {
                            feedbackSelection();
                            onOpenStory?.(story);
                        }}
                        style={{ alignItems: 'center', width: 72 }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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

const ScoreRail = memo(({ profile, colors }: { profile: SocialProfile | null; colors: SocialColors }) => {
    if (!profile) return null;

    const [expanded, setExpanded] = useState(false);

    const score = Math.round(profile.scoreLifetime || 0);
    const streakDaily = profile.currentStreak || 0;
    const weatherMultiplier = profile.weatherBonus?.multiplier || 1;
    const friendsCount = profile.socialSummary?.friendsCount ?? 0;
    const activityCount = profile.socialSummary?.activityCount ?? 0;
    const engagementScore = profile.socialSummary?.engagementScore ?? 0;

    return (
        <View style={{ marginBottom: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 10, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '900' }}>Tu progreso</Text>
                <TouchableOpacity
                    style={{ paddingHorizontal: 10, minHeight: 30, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceLighter, justifyContent: 'center' }}
                    onPress={() => {
                        feedbackSoftImpact();
                        setExpanded((prev) => !prev);
                    }}
                >
                    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800' }}>{expanded ? 'Ver menos' : 'Ver más'}</Text>
                </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceLighter, padding: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Trophy size={12} color={colors.yellow} />
                        <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800' }}>IRONPOINTS</Text>
                    </View>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 3 }}>{score}</Text>
                </View>
                <View style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceLighter, padding: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Flame size={12} color={colors.red} />
                        <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800' }}>RACHA DIARIA</Text>
                    </View>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 3 }}>{streakDaily} días</Text>
                </View>
                <View style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceLighter, padding: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <CloudRain size={12} color={colors.primary.DEFAULT} />
                        <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800' }}>MULT</Text>
                    </View>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 3 }}>x{weatherMultiplier.toFixed(2)}</Text>
                </View>
            </View>

            {expanded && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <View style={{ flex: 1, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceLighter, paddingVertical: 8, paddingHorizontal: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Users size={12} color={colors.textMuted} />
                            <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800' }}>AMIGOS</Text>
                        </View>
                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '900', marginTop: 2 }}>{friendsCount}</Text>
                    </View>
                    <View style={{ flex: 1, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceLighter, paddingVertical: 8, paddingHorizontal: 10 }}>
                        <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800' }}>ACTIVIDAD SOCIAL</Text>
                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '900', marginTop: 2 }}>{activityCount}</Text>
                    </View>
                    <View style={{ flex: 1, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceLighter, paddingVertical: 8, paddingHorizontal: 10 }}>
                        <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800' }}>INTERACCIÓN</Text>
                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '900', marginTop: 2 }}>{engagementScore}</Text>
                    </View>
                </View>
            )}

            {expanded && (
                <Text style={{ marginTop: 4, color: colors.textMuted, fontSize: 11, fontWeight: '600', backgroundColor: colors.surfaceLighter, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }}>
                    Racha diaria: días consecutivos entrenando. Clima: multiplicador activo por condiciones climáticas.
                </Text>
            )}
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
    colors: SocialColors;
    styles: SocialStyles;
}) => {
    const lastTapRef = useRef<number>(0);
    const isOwn = profile?.id && item.senderId === profile.id;

    const onDoubleTapKudo = () => {
        const now = Date.now();
        if (now - lastTapRef.current < DOUBLE_TAP_THRESHOLD_MS && !isOwn) {
            feedbackSoftImpact();
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
        <View style={[styles.activityRow, { marginBottom: 10, padding: 12, borderColor: colors.border }]}> 
            <View style={[styles.activityHeader, { marginBottom: 6 }]}> 
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

            {!item.seenAt && (
                <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, borderWidth: 1, borderColor: colors.primary.DEFAULT, backgroundColor: colors.surface, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 8 }}>
                    <Eye size={11} color={colors.primary.DEFAULT} />
                    <Text style={{ color: colors.primary.DEFAULT, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>Nuevo</Text>
                </View>
            )}

            <Pressable onPress={onDoubleTapKudo} style={{ borderRadius: 16, overflow: 'hidden' }}>
                <View style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 12 }}>
                    <Text style={{ color: colors.text, fontWeight: '900', fontSize: 15 }}>{summary.headline}</Text>
                    <Text style={{ color: colors.textMuted, marginTop: 3, fontWeight: '700', fontSize: 12 }}>{summary.subline}</Text>

                    <View style={{ marginTop: 10, borderRadius: 10, backgroundColor: colors.surfaceLighter, borderWidth: 1, borderColor: colors.border, padding: 10 }}>
                        <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>{summary.highlightLabel.toUpperCase()}</Text>
                        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 2 }}>{summary.highlightValue}</Text>
                    </View>
                </View>
            </Pressable>

            {!isOwn && !item.hasKudoed && (
                <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600', marginTop: 6 }}>
                    Tip: doble toque en la tarjeta para dar Kudo más rápido.
                </Text>
            )}

            <View style={[styles.activityFooter, { marginTop: 8 }]}> 
                <TouchableOpacity
                    style={[styles.kudoBtn, item.hasKudoed && styles.kudoBtnActive, isOwn && styles.kudoBtnDisabled]}
                    onPress={() => {
                        if (!isOwn) {
                            feedbackSelection();
                            onToggleKudo(item.id);
                        }
                    }}
                    disabled={!!isOwn}
                    activeOpacity={0.85}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    {item.hasKudoed ? (
                        <Heart size={16} color={colors.yellow} fill={colors.yellow} />
                    ) : (
                        <Flame size={16} color={colors.textMuted} />
                    )}
                    <Text style={[styles.kudoText, item.hasKudoed && styles.kudoTextActive]}>
                        {item.kudosCount || 0} {item.kudosCount === 1 ? 'Kudo' : 'Kudos'}
                    </Text>
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    {summary.activityKind === 'routine' && (
                        <TouchableOpacity
                            style={[styles.archiveToggle, { borderColor: colors.border }]}
                            onPress={() => {
                                feedbackSelection();
                                onCopyRoutine?.(item);
                            }}
                            activeOpacity={0.85}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Text style={styles.archiveToggleText}>Guardar rutina</Text>
                        </TouchableOpacity>
                    )}
                    {!item.seenAt && (
                        <TouchableOpacity
                            style={[styles.archiveToggle, { borderColor: colors.border }]}
                            onPress={() => {
                                feedbackSelection();
                                onMarkAsSeen(item.id, 'activity_log');
                            }}
                            activeOpacity={0.85}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Text style={styles.archiveToggleText}>Marcar visto</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
});

export const SocialFeedTab = memo(({ items, profile, stories, renderHeader, refreshing, onRefresh, onToggleKudo, onMarkAsSeen, onOpenStory, onCopyRoutine, showScoreRail = true, showStories = true, emptyText = 'Todavía no hay actividad en tu feed.', colors, styles }: SocialFeedTabProps) => {
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
                <View style={{ paddingTop: 2 }}>
                    {renderHeader?.()}
                    {showScoreRail && <ScoreRail profile={profile} colors={colors} />}
                    {showStories && <StoryStrip stories={stories} onOpenStory={onOpenStory} colors={colors} styles={styles} />}
                </View>
            }
            refreshControl={<RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary.DEFAULT} />}
            ListEmptyComponent={(
                <View style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingVertical: 18, paddingHorizontal: 14, marginTop: 10 }}>
                    <Text style={styles.emptyText}>{emptyText}</Text>
                    <Text style={{ color: colors.textMuted, textAlign: 'center', fontSize: 12, marginTop: 4, fontWeight: '600' }}>
                        Compartí una rutina o agregá amigos para activar movimiento en tu feed.
                    </Text>
                </View>
            )}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
        />
    );
});

export default SocialFeedTab;
