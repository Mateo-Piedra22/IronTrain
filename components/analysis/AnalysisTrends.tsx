import { EmptyChartPlaceholder } from '@/components/EmptyChartPlaceholder';
import { BadgePill } from '@/components/ui/BadgePill';
import { ExerciseVolumeRow, VolumeSeriesPoint } from '@/src/services/AnalysisService';
import { ThemeFx, withAlpha } from '@/src/theme';
import { useRouter } from 'expo-router';
import { ChevronRight, Minus, TrendingDown, TrendingUp, Zap } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '../../src/hooks/useColors';

interface AnalysisTrendsProps {
    volumeSeries: VolumeSeriesPoint[];
    topExercisesByVolume: ExerciseVolumeRow[];
    rangeDays: 7 | 30 | 90 | 365;
    handleRangeChange: (d: 7 | 30 | 90 | 365) => void;
}

export function AnalysisTrends({ volumeSeries, topExercisesByVolume, rangeDays, handleRangeChange }: AnalysisTrendsProps) {
    const colors = useColors();
    const styles = useMemo(() => StyleSheet.create({
        container: {
            paddingBottom: 32
        },
        rangeRow: {
            flexDirection: 'row',
            gap: 12,
            marginBottom: 24
        },
        rangeChip: {
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            flex: 1,
            alignItems: 'center',
        },
        rangeChipActive: {
            backgroundColor: colors.primary.DEFAULT,
            borderColor: colors.primary.DEFAULT,
            ...ThemeFx.shadowMd,
        },
        rangeChipText: {
            fontWeight: '900',
            fontSize: 14,
            color: colors.textMuted
        },
        rangeChipTextActive: {
            color: colors.onPrimary
        },

        trendCard: {
            backgroundColor: colors.surface,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: colors.border,
            padding: 24,
            marginBottom: 28,
            ...ThemeFx.shadowMd,
        },
        trendHeader: {
            marginBottom: 24
        },
        trendTitleContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10
        },
        trendAccent: {
            width: 4,
            height: 22,
            borderRadius: 2,
            backgroundColor: colors.primary.DEFAULT
        },
        trendTitle: {
            fontSize: 20,
            fontWeight: '900',
            color: colors.text,
            letterSpacing: -0.5
        },
        trendGrid: {
            flexDirection: 'row',
            backgroundColor: colors.surfaceLighter,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: colors.border,
            padding: 20,
        },
        trendCell: {
            flex: 1
        },
        trendCellSeparator: {
            borderLeftWidth: 1.5,
            borderLeftColor: colors.border,
            paddingLeft: 20
        },
        trendCellLabel: {
            fontSize: 11,
            fontWeight: '900',
            color: colors.textMuted,
            textTransform: 'uppercase',
            marginBottom: 12,
            letterSpacing: 0.5,
        },
        trendDirectionRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10
        },
        trendCellValue: {
            fontSize: 18,
            fontWeight: '900',
            color: colors.text
        },
        trendChangeValue: {
            fontSize: 28,
            letterSpacing: -1,
            fontWeight: '900',
        },
        trendIconCircle: {
            width: 38,
            height: 38,
            borderRadius: 14,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1.5,
        },
        insufficientData: {
            marginTop: 20,
            paddingTop: 16,
            borderTopWidth: 1.5,
            borderTopColor: colors.border,
        },
        insufficientDataText: {
            fontSize: 13,
            color: colors.textMuted,
            fontStyle: 'italic',
            textAlign: 'center',
            fontWeight: '600'
        },

        sectionTitleContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginBottom: 16
        },
        sectionAccent: {
            width: 4,
            height: 20,
            borderRadius: 2,
            backgroundColor: colors.primary.DEFAULT
        },
        sectionTitle: {
            fontSize: 18,
            fontWeight: '900',
            color: colors.text,
            letterSpacing: -0.3
        },

        exerciseCard: {
            backgroundColor: colors.surface,
            padding: 16,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: colors.border,
            ...ThemeFx.shadowSm,
            marginBottom: 12,
        },
        exerciseCardContent: {
            flexDirection: 'row',
            alignItems: 'center'
        },
        rankBadge: {
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: withAlpha(colors.primary.DEFAULT, '15'),
            justifyContent: 'center',
            alignItems: 'center',
        },
        rankText: {
            fontSize: 15,
            fontWeight: '900',
            color: colors.primary.DEFAULT
        },
        exerciseInfo: {
            flex: 1,
            marginLeft: 14
        },
        categoryRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8
        },
        categoryDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
        },
        exerciseCategory: {
            fontSize: 11,
            fontWeight: '900',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        exerciseName: {
            fontSize: 16,
            fontWeight: '900',
            color: colors.text,
            marginTop: 2
        },
        badgesContainer: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 6,
            marginTop: 6
        },
        exerciseSets: {
            fontSize: 12,
            fontWeight: '800',
            color: colors.textMuted,
            marginTop: 6
        },
        volumeContainer: {
            alignItems: 'flex-end'
        },
        exerciseVolume: {
            fontSize: 22,
            fontWeight: '900',
            color: colors.text,
            letterSpacing: -0.5,
        },
        exerciseVolUnit: {
            fontSize: 11,
            fontWeight: '900',
            color: colors.textMuted,
            textTransform: 'uppercase'
        },
        chevron: {
            marginLeft: 8
        },
    }), [colors]);
    const router = useRouter();

    const volumeTrend = useMemo(() => {
        if (volumeSeries.length < 2) {
            return { slopePerPoint: 0, first: 0, last: 0, changePct: null as number | null };
        }
        const y = volumeSeries.map((p) => p.volume);
        const x = volumeSeries.map((_, i) => i);
        const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
        const mx = mean(x);
        const my = mean(y);
        let num = 0;
        let den = 0;
        for (let i = 0; i < x.length; i++) {
            const dx = x[i] - mx;
            num += dx * (y[i] - my);
            den += dx * dx;
        }
        const slopePerPoint = den > 0 ? num / den : 0;
        const first = y[0] ?? 0;
        const last = y[y.length - 1] ?? 0;
        const changePct = first > 0 ? Math.round(((last - first) / first) * 100) : null;
        return { slopePerPoint, first, last, changePct };
    }, [volumeSeries]);

    const isUp = volumeTrend.slopePerPoint > 0.01;
    const isDown = volumeTrend.slopePerPoint < -0.01;

    return (
        <View style={styles.container}>
            {/* Range Selector */}
            <View style={styles.rangeRow}>
                {[7, 30, 90, 365].map((d) => (
                    <Pressable
                        key={d}
                        onPress={() => handleRangeChange(d as any)}
                        style={[styles.rangeChip, rangeDays === d && styles.rangeChipActive]}
                    >
                        <Text style={[styles.rangeChipText, rangeDays === d && styles.rangeChipTextActive]}>
                            {d}D
                        </Text>
                    </Pressable>
                ))}
            </View>

            {/* Volume Trend Card */}
            <View style={styles.trendCard}>
                <View style={styles.trendHeader}>
                    <View style={styles.trendTitleContainer}>
                        <View style={styles.trendAccent} />
                        <Text style={styles.trendTitle}>Tendencia de carga</Text>
                    </View>
                </View>

                <View style={styles.trendGrid}>
                    {/* Direction */}
                    <View style={styles.trendCell}>
                        <Text style={styles.trendCellLabel}>Dirección</Text>
                        <View style={styles.trendDirectionRow}>
                            <View style={[
                                styles.trendIconCircle,
                                { backgroundColor: isUp ? withAlpha(colors.green, '33') : isDown ? withAlpha(colors.red, '33') : colors.border }
                            ]}>
                                {isUp ? <TrendingUp size={18} color={colors.green} />
                                    : isDown ? <TrendingDown size={18} color={colors.red} />
                                        : <Minus size={18} color={colors.textMuted} />}
                            </View>
                            <Text style={[styles.trendCellValue, {
                                color: isUp ? colors.green : isDown ? colors.red : colors.text
                            }]}>
                                {isUp ? 'Subiendo' : isDown ? 'Bajando' : 'Estable'}
                            </Text>
                        </View>
                    </View>

                    {/* Change */}
                    <View style={[styles.trendCell, styles.trendCellSeparator]}>
                        <Text style={styles.trendCellLabel}>Cambio</Text>
                        <Text style={[styles.trendCellValue, styles.trendChangeValue, {
                            color: volumeTrend.changePct && volumeTrend.changePct > 0 ? colors.green
                                : volumeTrend.changePct && volumeTrend.changePct < 0 ? colors.red
                                    : colors.text
                        }]}>
                            {volumeTrend.changePct == null ? '—' : `${volumeTrend.changePct >= 0 ? '+' : ''}${volumeTrend.changePct}%`}
                        </Text>
                    </View>
                </View>

                {volumeSeries.length < 2 && (
                    <View style={styles.insufficientData}>
                        <Text style={styles.insufficientDataText}>
                            Registra más entrenamientos para ver tu tendencia.
                        </Text>
                    </View>
                )}
            </View>

            {/* Top Exercises */}
            <View style={{ marginBottom: 20 }}>
                <View style={styles.sectionTitleContainer}>
                    <View style={styles.sectionAccent} />
                    <Zap size={16} color={colors.text} />
                    <Text style={styles.sectionTitle}>Mejores ejercicios por carga</Text>
                </View>
                {topExercisesByVolume.length === 0 ? (
                    <EmptyChartPlaceholder
                        title="Sin datos"
                        message="Completa entrenamientos para ver tus ejercicios más frecuentes."
                        height={140}
                    />
                ) : (
                    topExercisesByVolume.map((e, idx) => (
                        <Pressable
                            key={e.exerciseId}
                            onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: e.exerciseId, exerciseId: e.exerciseId, exerciseName: e.exerciseName } } as any)}
                            style={styles.exerciseCard}
                        >
                            <View style={styles.exerciseCardContent}>
                                {/* Rank */}
                                <View style={styles.rankBadge}>
                                    <Text style={styles.rankText}>{idx + 1}</Text>
                                </View>

                                {/* Info */}
                                <View style={styles.exerciseInfo}>
                                    <View style={styles.categoryRow}>
                                        <View style={[
                                            styles.categoryDot,
                                            { backgroundColor: e.categoryColor || colors.textMuted }
                                        ]} />
                                        <Text style={styles.exerciseCategory}>{e.categoryName}</Text>
                                    </View>
                                    <Text style={styles.exerciseName} numberOfLines={1}>{e.exerciseName}</Text>
                                    <View style={styles.badgesContainer}>
                                        {e.badges?.map((b, i) => (
                                            <BadgePill key={i} name={b.name} color={b.color} icon={b.icon} size="xs" />
                                        ))}
                                    </View>
                                    <Text style={styles.exerciseSets}>{e.setCount} series</Text>
                                </View>

                                {/* Volume */}
                                <View style={styles.volumeContainer}>
                                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
                                        <Text style={styles.exerciseVolume}>
                                            {e.volume >= 1000 ? `${(e.volume / 1000).toFixed(1)}k` : Math.round(e.volume)}
                                        </Text>
                                        <Text style={styles.exerciseVolUnit}>kg</Text>
                                    </View>
                                </View>

                                <ChevronRight size={16} color={colors.textMuted} style={styles.chevron} />
                            </View>
                        </Pressable>
                    ))
                )}
            </View>
        </View>
    );
}


