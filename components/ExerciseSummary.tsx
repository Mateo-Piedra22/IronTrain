import { configService } from '@/src/services/ConfigService';
import { UnitService } from '@/src/services/UnitService';
import { withAlpha } from '@/src/theme';
import { ExerciseType, WorkoutSet } from '@/src/types/db';
import { formatTimeSecondsCompact } from '@/src/utils/time';
import { ChevronRight, Trophy } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '../src/hooks/useColors';
import { BadgePill } from './ui/BadgePill';


interface ExerciseSummaryProps {
    exerciseName: string;
    exerciseType: ExerciseType;
    sets: WorkoutSet[];
    badges?: any[];
    categoryColor?: string;

    onPress: () => void;
    disabled?: boolean;
}

function formatDistanceMeters(meters: number): string {
    const m = Math.max(0, meters);
    if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
    return `${Math.round(m)} m`;
}

function formatWeight(value: number, unit: 'kg' | 'lbs'): string {
    const v = Number.isFinite(value) ? value : 0;
    const u = unit === 'kg' ? 'kg' : 'lb';
    const decimals = v % 1 === 0 ? 0 : 1;
    return `${v.toFixed(decimals)} ${u}`;
}

export function ExerciseSummary({ exerciseName, exerciseType, sets, badges = [], categoryColor, onPress, disabled }: ExerciseSummaryProps) {
    const colors = useColors();
    const activeCategoryColor = categoryColor || colors.primary.dark;

    const ss = useMemo(() => StyleSheet.create({
        card: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            paddingHorizontal: 14,
            paddingVertical: 14,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: colors.border,
            elevation: 1
        },
        accentBar: {
            width: 5,
            alignSelf: 'stretch',
            borderRadius: 3,
            marginRight: 14,
            backgroundColor: activeCategoryColor
        },
        name: {
            color: colors.text,
            fontWeight: '800',
            fontSize: 15
        },
        statsRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 4
        },
        statText: {
            color: colors.textMuted,
            fontSize: 12,
            fontWeight: '700'
        },
        dotSeparator: {
            color: colors.border,
            fontSize: 12,
            fontWeight: '700',
            marginHorizontal: 6
        },
        bestBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: withAlpha(colors.primary.DEFAULT, '10'),
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
            borderWidth: 1.5,
            borderColor: withAlpha(colors.primary.DEFAULT, '20')
        },
        bestText: {
            color: colors.yellow,
            fontSize: 11,
            fontWeight: '800'
        },
        confirmBtn: { backgroundColor: colors.primary.DEFAULT, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
        confirmBtnText: { color: colors.onPrimary, fontWeight: '800', fontSize: 15 },
        badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
        badgeList: { flexDirection: 'row', gap: 4 },
        moreBadge: { backgroundColor: colors.surfaceLighter, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
        moreBadgeText: { fontSize: 10, fontWeight: '800', color: colors.textMuted },
        rightContent: { alignItems: 'flex-end', marginLeft: 12 },
        trophyIcon: { marginRight: 5 },
        chevron: { marginLeft: 4 }
    }), [colors, activeCategoryColor]);

    const unit = configService.get('weightUnit');
    const displayWeight = (kgValue: number) => unit === 'kg' ? kgValue : UnitService.kgToLbs(kgValue);
    const totalSets = sets.length;
    const completedSets = sets.filter((s) => s.completed === 1);
    const doneSets = completedSets.length;
    const relevant = doneSets > 0 ? completedSets : sets;

    const repsTotal = relevant.reduce((acc, s) => acc + (s.reps ?? 0), 0);
    const distanceTotal = relevant.reduce((acc, s) => acc + (s.distance ?? 0), 0);
    const timeTotal = relevant.reduce((acc, s) => acc + (s.time ?? 0), 0);

    const avgWeight = (() => {
        const weights = relevant.map((s) => s.weight ?? 0).filter((w) => w > 0);
        if (weights.length === 0) return null;
        const sum = weights.reduce((a, b) => a + b, 0);
        return sum / weights.length;
    })();

    const primaryStat =
        exerciseType === 'distance_time'
            ? `${distanceTotal > 0 ? formatDistanceMeters(distanceTotal) : ''}${distanceTotal > 0 && timeTotal > 0 ? ' • ' : ''}${timeTotal > 0 ? formatTimeSecondsCompact(timeTotal) : ''}`.trim()
            : (exerciseType === 'weight_reps' || exerciseType === 'reps_only')
                ? `${repsTotal} reps`
                : '';

    const secondaryStat =
        (exerciseType === 'weight_reps' || exerciseType === 'weight_only') && avgWeight != null
            ? `${formatWeight(displayWeight(avgWeight), unit)}`
            : '';

    const bestSetByWeight = relevant
        .filter((s) => s.type !== 'warmup')
        .reduce<{ weight: number; reps: number } | null>((best, s) => {
            const w = s.weight ?? 0;
            const r = s.reps ?? 0;
            if (w <= 0) return best;
            if (!best) return { weight: w, reps: r };
            if (w > best.weight) return { weight: w, reps: r };
            return best;
        }, null);

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`Abrir ${exerciseName}`}
            activeOpacity={0.8}
            style={[ss.card, disabled && { opacity: 0.6 }]}
        >
            <View style={ss.accentBar} />

            <View style={{ flex: 1 }}>
                <Text style={ss.name} numberOfLines={1}>{exerciseName}</Text>

                {badges.length > 0 && (
                    <View style={ss.badgeRow}>
                        <View style={ss.badgeList}>
                            {badges.slice(0, 3).map((badge, idx) => (
                                <BadgePill
                                    key={idx}
                                    name={badge.name}
                                    color={badge.color}
                                    icon={badge.icon}
                                    size="xs"
                                />
                            ))}
                        </View>
                        {badges.length > 3 && (
                            <View style={ss.moreBadge}>
                                <Text style={ss.moreBadgeText}>+{badges.length - 3}</Text>
                            </View>
                        )}
                    </View>
                )}


                <View style={ss.statsRow}>
                    <Text style={ss.statText}>{doneSets}/{totalSets} series</Text>
                    {primaryStat ? <Text style={ss.dotSeparator}>•</Text> : null}
                    {primaryStat ? <Text style={ss.statText} numberOfLines={1}>{primaryStat}</Text> : null}
                    {secondaryStat ? <Text style={ss.dotSeparator}>•</Text> : null}
                    {secondaryStat ? <Text style={ss.statText} numberOfLines={1}>{secondaryStat}</Text> : null}
                </View>
            </View>

            {(exerciseType === 'weight_reps' || exerciseType === 'weight_only') && bestSetByWeight && (
                <View style={ss.rightContent}>
                    <View style={ss.bestBadge}>
                        <Trophy size={11} color={colors.yellow} style={ss.trophyIcon} />
                        <Text style={ss.bestText}>
                            {formatWeight(displayWeight(bestSetByWeight.weight), unit)}
                            {exerciseType === 'weight_reps' && bestSetByWeight.reps > 0 ? ` × ${bestSetByWeight.reps}` : ''}
                        </Text>
                    </View>
                </View>
            )}

            <ChevronRight size={18} color={colors.textMuted} style={ss.chevron} />
        </TouchableOpacity>
    );
}
