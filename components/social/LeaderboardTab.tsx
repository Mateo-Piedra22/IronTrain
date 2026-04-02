import { SocialColors, SocialHeaderRenderer, SocialStyles } from '@/components/social/types';
import { SocialComparisonEntry, SocialLeaderboardEntry, SocialProfile } from '@/src/services/SocialService';
import { feedbackSelection } from '@/src/social/feedback';
import { FlashList } from '@shopify/flash-list';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Flame, Info, Scale, Search, ShieldCheck, ShieldX, Swords, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';

const COMPARISON_PAGE_SIZE = 6;
const MAX_COMPARISON_QUERY_LENGTH = 40;

const normalizeSearchText = (value: string): string =>
    value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

type FriendComparisonSort = 'diff_desc' | 'diff_asc' | 'alpha_asc' | 'user_desc' | 'friend_desc';

interface LeaderboardTabProps {
    leaderboard: SocialLeaderboardEntry[];
    rankingSegment: 'weekly' | 'monthly' | 'lifetime';
    profile: SocialProfile | null;
    expandedFriendId: string | null;
    comparisons: Record<string, SocialComparisonEntry[]>;
    loadingCompare: boolean;
    onExpandFriend: (id: string) => void;
    onShowScoreInfo: () => void;
    setRankingSegment: (segment: 'weekly' | 'monthly' | 'lifetime') => void;
    isLive?: boolean;
    liveSource?: 'idle' | 'sse' | 'polling';
    lastLiveSyncAt?: number | null;
    colors: SocialColors;
    styles: SocialStyles;
}

const ComparisonRow = React.memo(({ comp, userDisplayName, colors, styles }: { comp: SocialComparisonEntry, userDisplayName: string, colors: SocialColors, styles: SocialStyles }) => {
    const userWon = comp.user1RM > comp.friend1RM;
    const friendWon = comp.friend1RM > comp.user1RM;
    const diff = Math.abs(comp.user1RM - comp.friend1RM);
    const maxValue = Math.max(comp.user1RM, comp.friend1RM, 1);
    const userWidthPct = Math.max(12, Math.round((comp.user1RM / maxValue) * 100));
    const friendWidthPct = Math.max(12, Math.round((comp.friend1RM / maxValue) * 100));

    return (
        <View style={styles.compareRowCard}>
            <View style={styles.compareRowHeader}>
                <View style={styles.compareExerciseHeaderLeft}>
                    <Text style={styles.compareExerciseName}>{comp.exerciseName}</Text>
                    <Text style={styles.compareUnitText}>1RM · {comp.unit}</Text>
                </View>
                {diff > 0 && (
                    <Text style={[styles.compareDiff, { color: userWon ? colors.green : colors.red }]}>
                        {userWon ? '+' : '-'}{diff.toFixed(1)}{comp.unit}
                    </Text>
                )}
            </View>

            <View style={styles.compareLane}>
                <View style={styles.compareLaneHeader}>
                    <Text style={styles.compareLabel}>Tú</Text>
                    <Text style={[styles.compareValue, userWon && styles.compareValueHighlight]}>{comp.user1RM}{comp.unit}</Text>
                </View>
                <View style={styles.compareBarTrack}>
                    <View style={[styles.compareBarFillUser, { width: `${userWidthPct}%` as `${number}%` }]} />
                </View>
            </View>

            <View style={styles.compareLane}>
                <View style={styles.compareLaneHeader}>
                    <Text style={styles.compareLabel}>{userDisplayName}</Text>
                    <Text style={[styles.compareValue, friendWon && styles.compareValueHighlight]}>{comp.friend1RM}{comp.unit}</Text>
                </View>
                <View style={styles.compareBarTrack}>
                    <View style={[styles.compareBarFillFriend, { width: `${friendWidthPct}%` as `${number}%` }]} />
                </View>
            </View>
        </View>
    );
});

const LeaderboardItem = React.memo(({
    user,
    index: i,
    profileId,
    rankingSegment,
    isExpanded,
    comparisonData,
    loadingCompare,
    onExpandFriend,
    colors,
    styles
}: {
    user: SocialLeaderboardEntry,
    index: number,
    profileId: string | undefined,
    rankingSegment: 'weekly' | 'monthly' | 'lifetime',
    isExpanded: boolean,
    comparisonData: SocialComparisonEntry[],
    loadingCompare: boolean,
    onExpandFriend: (id: string) => void,
    colors: SocialColors,
    styles: SocialStyles
}) => {
    const isSelfRow = user.id === profileId;
    const [comparisonQuery, setComparisonQuery] = useState('');
    const [comparisonFilter, setComparisonFilter] = useState<'all' | 'ahead' | 'behind' | 'tied'>('all');
    const [comparisonSort, setComparisonSort] = useState<FriendComparisonSort>('diff_desc');
    const [showAdvancedControls, setShowAdvancedControls] = useState(false);
    const [comparisonPage, setComparisonPage] = useState(1);

    const sortedComparisonData = useMemo(() => {
        const draft = [...comparisonData];

        if (comparisonSort === 'alpha_asc') {
            return draft.sort((a, b) => (a.exerciseName || '').localeCompare(b.exerciseName || ''));
        }

        if (comparisonSort === 'user_desc') {
            return draft.sort((a, b) => b.user1RM - a.user1RM);
        }

        if (comparisonSort === 'friend_desc') {
            return draft.sort((a, b) => b.friend1RM - a.friend1RM);
        }

        if (comparisonSort === 'diff_asc') {
            return draft.sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff));
        }

        return draft.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    }, [comparisonData, comparisonSort]);

    const normalizedQuery = useMemo(() => normalizeSearchText(comparisonQuery), [comparisonQuery]);

    const filteredComparisonData = useMemo(() => {
        return sortedComparisonData.filter((entry) => {
            const entryName = normalizeSearchText(entry.exerciseName || '');
            const matchesQuery = normalizedQuery.length === 0 || entryName.includes(normalizedQuery);

            const isAhead = entry.user1RM > entry.friend1RM;
            const isBehind = entry.user1RM < entry.friend1RM;
            const isTied = !isAhead && !isBehind;

            const matchesFilter =
                comparisonFilter === 'all'
                    ? true
                    : comparisonFilter === 'ahead'
                        ? isAhead
                        : comparisonFilter === 'behind'
                            ? isBehind
                            : isTied;

            return matchesQuery && matchesFilter;
        });
    }, [sortedComparisonData, normalizedQuery, comparisonFilter]);

    const totalComparisonPages = Math.max(1, Math.ceil(filteredComparisonData.length / COMPARISON_PAGE_SIZE));

    const paginatedComparisonData = useMemo(() => {
        const startIndex = (comparisonPage - 1) * COMPARISON_PAGE_SIZE;
        return filteredComparisonData.slice(startIndex, startIndex + COMPARISON_PAGE_SIZE);
    }, [filteredComparisonData, comparisonPage]);

    useEffect(() => {
        if (!isExpanded) {
            setComparisonPage(1);
            setComparisonQuery('');
            setComparisonFilter('all');
            setComparisonSort('diff_desc');
            setShowAdvancedControls(false);
        }
    }, [isExpanded]);

    useEffect(() => {
        setComparisonPage(1);
    }, [comparisonFilter, normalizedQuery, comparisonSort]);

    useEffect(() => {
        if (comparisonPage > totalComparisonPages) {
            setComparisonPage(totalComparisonPages);
        }
    }, [comparisonPage, totalComparisonPages]);

    const comparisonSummary = useMemo(() => {
        return comparisonData.reduce(
            (acc, entry) => {
                if (entry.user1RM > entry.friend1RM) acc.wins += 1;
                else if (entry.user1RM < entry.friend1RM) acc.losses += 1;
                else acc.ties += 1;
                acc.netKg += entry.user1RMKg - entry.friend1RMKg;
                return acc;
            },
            { wins: 0, losses: 0, ties: 0, netKg: 0 },
        );
    }, [comparisonData]);

    return (
        <View key={user.id}>
            <TouchableOpacity
                style={[styles.friendRow, user.id === profileId && styles.highlightRow]}
                onPress={() => {
                    if (isSelfRow) return;
                    feedbackSelection();
                    onExpandFriend(user.id);
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
                <View style={styles.rankRow}>
                    <Text style={[styles.rankNumber, { color: i === 0 ? colors.yellow : i === 1 ? colors.textMuted : i === 2 ? colors.primary.light : colors.textMuted }]}>
                        {i + 1}
                    </Text>
                    <View>
                        <Text style={styles.friendName}>{user.id === profileId ? 'Tú' : user.displayName}</Text>
                        <Text style={styles.friendStatus}>
                            IronScore {user.scores[rankingSegment]}
                            {typeof user.stats?.engagementScore === 'number' ? ` • Interacción ${user.stats.engagementScore}` : ''}
                        </Text>
                    </View>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    {user.stats?.currentStreak >= 3 && (
                        <View style={styles.streakBadge}>
                            <Flame size={12} color={colors.red} fill={colors.red} style={{ marginRight: 4 }} />
                            <Text style={styles.streakText}>Racha: {user.stats.currentStreak}</Text>
                        </View>
                    )}
                    {!isSelfRow && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 999, backgroundColor: colors.surfaceLighter, paddingHorizontal: 8, paddingVertical: 5 }}>
                            <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>
                                {isExpanded ? 'Ocultar' : 'Comparar'} 1RM
                            </Text>
                            {isExpanded ? (
                                <ChevronUp size={13} color={colors.textMuted} />
                            ) : (
                                <ChevronDown size={13} color={colors.textMuted} />
                            )}
                        </View>
                    )}
                </View>
            </TouchableOpacity>

            {!isSelfRow && isExpanded && (
                <View style={styles.expandedComparisonBox}>
                    <View style={styles.compareHeader}>
                        <Scale size={18} color={colors.textMuted} />
                        <Text style={styles.compareTitle}>Comparación de Fuerza (1RM)</Text>
                    </View>
                    <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 12 }}>
                        Vista por ejercicio. Tocá otra fila del ranking para cambiar de atleta comparado.
                    </Text>

                    {!loadingCompare && comparisonData.length > 0 && (
                        <View style={{ marginBottom: 12, gap: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, paddingHorizontal: 10, minHeight: 42 }}>
                                <Search size={15} color={colors.textMuted} />
                                <TextInput
                                    style={{ flex: 1, color: colors.text, fontSize: 13, fontWeight: '700', paddingVertical: 8 }}
                                    value={comparisonQuery}
                                    onChangeText={(value) => setComparisonQuery(value.slice(0, MAX_COMPARISON_QUERY_LENGTH))}
                                    placeholder="Buscar ejercicio"
                                    placeholderTextColor={colors.textMuted}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    returnKeyType="search"
                                />
                                {comparisonQuery.length > 0 && (
                                    <TouchableOpacity
                                        style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceLighter }}
                                        onPress={() => {
                                            feedbackSelection();
                                            setComparisonQuery('');
                                        }}
                                    >
                                        <X size={14} color={colors.textMuted} />
                                    </TouchableOpacity>
                                )}
                            </View>

                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                {([
                                    { key: 'all', label: 'Todos' },
                                    { key: 'ahead', label: 'Ventajas' },
                                    { key: 'behind', label: 'Desventajas' },
                                    { key: 'tied', label: 'Empates' },
                                ] as const).map((option) => {
                                    const active = comparisonFilter === option.key;
                                    return (
                                        <TouchableOpacity
                                            key={option.key}
                                            style={{ borderWidth: 1, borderColor: active ? colors.primary.DEFAULT : colors.border, borderRadius: 999, backgroundColor: active ? colors.surfaceLighter : colors.surface, paddingHorizontal: 10, paddingVertical: 6 }}
                                            onPress={() => {
                                                feedbackSelection();
                                                setComparisonFilter(option.key);
                                            }}
                                        >
                                            <Text style={{ color: active ? colors.primary.DEFAULT : colors.textMuted, fontSize: 11, fontWeight: '800' }}>{option.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700' }}>
                                    {filteredComparisonData.length} resultado{filteredComparisonData.length === 1 ? '' : 's'}
                                </Text>

                                <TouchableOpacity
                                    style={{ borderWidth: 1, borderColor: showAdvancedControls ? colors.primary.DEFAULT : colors.border, borderRadius: 999, backgroundColor: showAdvancedControls ? colors.surfaceLighter : colors.surface, paddingHorizontal: 10, paddingVertical: 6 }}
                                    onPress={() => {
                                        feedbackSelection();
                                        setShowAdvancedControls((prev) => !prev);
                                    }}
                                >
                                    <Text style={{ color: showAdvancedControls ? colors.primary.DEFAULT : colors.textMuted, fontSize: 11, fontWeight: '800' }}>
                                        {showAdvancedControls ? 'Ocultar opciones' : 'Más opciones'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {showAdvancedControls && (
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                    {([
                                        { key: 'diff_desc', label: 'Mayor diferencia' },
                                        { key: 'diff_asc', label: 'Menor diferencia' },
                                        { key: 'alpha_asc', label: 'A-Z' },
                                        { key: 'user_desc', label: 'Tu 1RM' },
                                        { key: 'friend_desc', label: 'Rival 1RM' },
                                    ] as const).map((option) => {
                                        const active = comparisonSort === option.key;
                                        return (
                                            <TouchableOpacity
                                                key={option.key}
                                                style={{ borderWidth: 1, borderColor: active ? colors.primary.DEFAULT : colors.border, borderRadius: 999, backgroundColor: active ? colors.surfaceLighter : colors.surface, paddingHorizontal: 10, paddingVertical: 6 }}
                                                onPress={() => {
                                                    feedbackSelection();
                                                    setComparisonSort(option.key);
                                                }}
                                            >
                                                <Text style={{ color: active ? colors.primary.DEFAULT : colors.textMuted, fontSize: 11, fontWeight: '800' }}>{option.label}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}
                        </View>
                    )}

                    {loadingCompare ? (
                        <ActivityIndicator size="small" color={colors.primary.DEFAULT} style={{ marginVertical: 10 }} />
                    ) : comparisonData.length === 0 ? (
                        <Text style={styles.compareEmptyText}>No hay ejercicios comunes acá.</Text>
                    ) : filteredComparisonData.length === 0 ? (
                        <Text style={styles.compareEmptyText}>No hay coincidencias para esa búsqueda o filtro.</Text>
                    ) : (
                        <>
                            <View style={styles.compareSummaryGrid}>
                                <View style={styles.compareSummaryItem}>
                                    <ShieldCheck size={14} color={colors.green} />
                                    <Text style={styles.compareSummaryLabel}>Ventajas</Text>
                                    <Text style={[styles.compareSummaryValue, { color: colors.green }]}>{comparisonSummary.wins}</Text>
                                </View>
                                <View style={styles.compareSummaryItem}>
                                    <ShieldX size={14} color={colors.red} />
                                    <Text style={styles.compareSummaryLabel}>Desventajas</Text>
                                    <Text style={[styles.compareSummaryValue, { color: colors.red }]}>{comparisonSummary.losses}</Text>
                                </View>
                                <View style={styles.compareSummaryItem}>
                                    <Swords size={14} color={colors.textMuted} />
                                    <Text style={styles.compareSummaryLabel}>Empates</Text>
                                    <Text style={styles.compareSummaryValue}>{comparisonSummary.ties}</Text>
                                </View>
                            </View>

                            <View style={styles.compareInsightBox}>
                                <Text style={styles.compareInsightText}>
                                    {comparisonSummary.netKg >= 0
                                        ? `Balance total a tu favor: +${comparisonSummary.netKg.toFixed(1)}kg en ejercicios comunes.`
                                        : `Balance total a favor de ${user.displayName}: +${Math.abs(comparisonSummary.netKg).toFixed(1)}kg.`}
                                </Text>
                            </View>

                            {paginatedComparisonData.map((comp, cidx) => (
                                <ComparisonRow
                                    key={`${comp.exerciseName}-${cidx}`}
                                    comp={comp}
                                    userDisplayName={user.displayName}
                                    colors={colors}
                                    styles={styles}
                                />
                            ))}

                            {filteredComparisonData.length > COMPARISON_PAGE_SIZE && (
                                <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 8 }}>
                                    <TouchableOpacity
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: comparisonPage === 1 ? 0.4 : 1 }}
                                        disabled={comparisonPage === 1}
                                        onPress={() => {
                                            feedbackSelection();
                                            setComparisonPage((prev) => Math.max(1, prev - 1));
                                        }}
                                    >
                                        <ChevronLeft size={14} color={colors.textMuted} />
                                        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>Anterior</Text>
                                    </TouchableOpacity>

                                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: '800' }}>
                                        Página {comparisonPage}/{totalComparisonPages}
                                    </Text>

                                    <TouchableOpacity
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: comparisonPage === totalComparisonPages ? 0.4 : 1 }}
                                        disabled={comparisonPage === totalComparisonPages}
                                        onPress={() => {
                                            feedbackSelection();
                                            setComparisonPage((prev) => Math.min(totalComparisonPages, prev + 1));
                                        }}
                                    >
                                        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>Siguiente</Text>
                                        <ChevronRight size={14} color={colors.textMuted} />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </>
                    )}
                </View>
            )}
        </View>
    );
});

export const LeaderboardTab = React.memo(({
    leaderboard,
    rankingSegment,
    profile,
    expandedFriendId,
    comparisons,
    loadingCompare,
    onExpandFriend,
    onShowScoreInfo,
    setRankingSegment,
    isLive,
    liveSource,
    lastLiveSyncAt,
    renderHeader,
    refreshing,
    onRefresh,
    colors,
    styles
}: LeaderboardTabProps & { renderHeader?: SocialHeaderRenderer, refreshing?: boolean, onRefresh?: () => void }) => {

    const sortedLeaderboard = useMemo(() => {
        return [...leaderboard].sort((a, b) => b.scores[rankingSegment] - a.scores[rankingSegment]);
    }, [leaderboard, rankingSegment]);

    const renderItem = useCallback(({ item, index }: { item: SocialLeaderboardEntry, index: number }) => (
        <LeaderboardItem
            user={item}
            index={index}
            profileId={profile?.id}
            rankingSegment={rankingSegment}
            isExpanded={expandedFriendId === item.id}
            comparisonData={comparisons[item.id] || []}
            loadingCompare={loadingCompare}
            onExpandFriend={onExpandFriend}
            colors={colors}
            styles={styles}
        />
    ), [profile?.id, rankingSegment, expandedFriendId, comparisons, loadingCompare, onExpandFriend, colors, styles]);

    const topScore = sortedLeaderboard[0]?.scores?.[rankingSegment] ?? 0;
    const topThree = sortedLeaderboard.slice(0, 3);

    return (
        <View style={{ flex: 1 }}>
            <FlashList
                data={sortedLeaderboard}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={() => (
                    <View>
                        {renderHeader && renderHeader()}
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                            <View style={{ flex: 1, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingVertical: 8, paddingHorizontal: 10 }}>
                                <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800' }}>ATLETAS</Text>
                                <Text style={{ color: colors.text, fontWeight: '900', marginTop: 2 }}>{sortedLeaderboard.length}</Text>
                            </View>
                            <View style={{ flex: 1, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingVertical: 8, paddingHorizontal: 10 }}>
                                <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800' }}>MEJOR PUNTAJE</Text>
                                <Text style={{ color: colors.text, fontWeight: '900', marginTop: 2 }}>{topScore}</Text>
                            </View>
                        </View>
                        {topThree.length > 0 && (
                            <View style={{ marginBottom: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceLighter, paddingVertical: 8, paddingHorizontal: 10 }}>
                                <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800', marginBottom: 4 }}>TOP DEL MOMENTO</Text>
                                <Text style={{ color: colors.text, fontWeight: '800' }} numberOfLines={1}>
                                    {topThree.map((entry, idx) => `${idx + 1}. ${entry.displayName}`).join('  ·  ')}
                                </Text>
                            </View>
                        )}
                        <View style={styles.rankingHeader}>
                            <View style={styles.rankingSegmentRow}>
                                {(['weekly', 'monthly', 'lifetime'] as const).map((seg) => (
                                    <TouchableOpacity
                                        key={seg}
                                        style={[styles.segmentBtn, rankingSegment === seg && styles.segmentBtnActive]}
                                        onPress={() => {
                                            feedbackSelection();
                                            setRankingSegment(seg);
                                        }}
                                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    >
                                        <Text style={[styles.segmentText, rankingSegment === seg && styles.segmentTextActive]}>
                                            {seg === 'weekly' ? 'Semanal' : seg === 'monthly' ? 'Mensual' : 'Histórico'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <TouchableOpacity onPress={() => {
                                feedbackSelection();
                                onShowScoreInfo();
                            }} style={styles.infoBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                                <Info size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
                refreshing={refreshing}
                onRefresh={onRefresh}
                ListEmptyComponent={<Text style={styles.emptyText}>Aún no hay datos suficientes para mostrar posiciones.</Text>}
                contentContainerStyle={{ paddingBottom: 100 }}
            />
        </View>
    );
});
