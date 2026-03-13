import { SocialComparisonEntry, SocialLeaderboardEntry, SocialProfile } from '@/src/services/SocialService';
import { FlashList } from '@shopify/flash-list';
import { Flame, Info, Scale } from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

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
    colors: any;
    styles: any;
}

const ComparisonRow = React.memo(({ comp, userDisplayName, colors, styles }: { comp: SocialComparisonEntry, userDisplayName: string, colors: any, styles: any }) => {
    const userWon = comp.user1RM > comp.friend1RM;
    const friendWon = comp.friend1RM > comp.user1RM;
    const diff = Math.abs(comp.user1RM - comp.friend1RM);

    return (
        <View style={styles.compareRow}>
            <View style={styles.compareRowHeader}>
                <Text style={styles.compareExerciseName}>{comp.exerciseName}</Text>
                {diff > 0 && (
                    <Text style={[styles.compareDiff, { color: userWon ? colors.green : colors.red }]}>
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
                    <Text style={styles.compareLabel}>{userDisplayName}</Text>
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
    colors: any,
    styles: any
}) => {
    return (
        <View key={user.id}>
            <TouchableOpacity
                style={[styles.friendRow, user.id === profileId && styles.highlightRow]}
                onPress={() => onExpandFriend(user.id)}
                activeOpacity={0.7}
            >
                <View style={styles.rankRow}>
                    <Text style={[styles.rankNumber, { color: i === 0 ? colors.yellow : i === 1 ? colors.textMuted : i === 2 ? colors.primary.light : colors.textMuted }]}>
                        {i + 1}
                    </Text>
                    <View>
                        <Text style={styles.friendName}>{user.id === profileId ? 'Tú' : user.displayName}</Text>
                        <Text style={styles.friendStatus}>IronScore {user.scores[rankingSegment]}</Text>
                    </View>
                </View>
                {user.stats?.currentStreak >= 3 && (
                    <View style={styles.streakBadge}>
                        <Flame size={12} color={colors.red} fill={colors.red} style={{ marginRight: 4 }} />
                        <Text style={styles.streakText}>Racha: {user.stats.currentStreak}</Text>
                    </View>
                )}
            </TouchableOpacity>

            {isExpanded && (
                <View style={styles.expandedComparisonBox}>
                    <View style={styles.compareHeader}>
                        <Scale size={18} color={colors.textMuted} />
                        <Text style={styles.compareTitle}>Comparación de Fuerza (1RM)</Text>
                    </View>
                    {loadingCompare ? (
                        <ActivityIndicator size="small" color={colors.primary.DEFAULT} style={{ marginVertical: 10 }} />
                    ) : comparisonData.length === 0 ? (
                        <Text style={styles.compareEmptyText}>No hay ejercicios comunes acá.</Text>
                    ) : (
                        comparisonData.map((comp, cidx) => (
                            <ComparisonRow
                                key={cidx}
                                comp={comp}
                                userDisplayName={user.displayName}
                                colors={colors}
                                styles={styles}
                            />
                        ))
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
    renderHeader,
    refreshing,
    onRefresh,
    colors,
    styles
}: LeaderboardTabProps & { renderHeader?: any, refreshing?: boolean, onRefresh?: () => void }) => {

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

    return (
        <View style={{ flex: 1 }}>
            <FlashList
                data={sortedLeaderboard}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={() => (
                    <View>
                        {renderHeader && renderHeader()}
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
                            <TouchableOpacity onPress={onShowScoreInfo} style={styles.infoBtn}>
                                <Info size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
                refreshing={refreshing}
                onRefresh={onRefresh}
                ListEmptyComponent={<Text style={styles.emptyText}>Sin datos de ranking aún.</Text>}
                contentContainerStyle={{ paddingBottom: 100 }}
            />
        </View>
    );
});
