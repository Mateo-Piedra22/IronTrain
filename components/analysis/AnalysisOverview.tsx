import { ConsistencyHeatmap } from '@/components/ConsistencyHeatmap';
import { GoalsWidget } from '@/components/GoalsWidget';
import { BodySnapshotWidget } from '@/components/analysis/BodySnapshotWidget';
import { VolumeChart } from '@/components/analysis/VolumeChart';
import { CardioSummary, CategoryVolumeRow, RepsOnlySummary, WeightOnlySummary, WorkoutComparison, WorkoutStreak, WorkoutSummary } from '@/src/services/AnalysisService';
import { ThemeFx, withAlpha } from '@/src/theme';
import { Activity, BarChart3, Clock, Flame, TrendingDown, TrendingUp, Trophy, Zap } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '../../src/hooks/useColors';

interface AnalysisOverviewProps {
    rangeDays: 7 | 30 | 90 | 365;
    setRangeDays: (d: 7 | 30 | 90 | 365) => void;
    summary7: WorkoutSummary | null;
    streak: WorkoutStreak | null;
    summaryRange: WorkoutSummary | null;
    comparison: WorkoutComparison | null;
    heatmapData: number[]; // timestamps
    volumeSeries: { value: number; sets?: number; label: string; dateMs: number }[];
    bucket: 'day' | 'week' | 'month';
    categoryVolume: CategoryVolumeRow[];
    cardioSummary: CardioSummary | null;
    repsOnlySummary: RepsOnlySummary | null;
    weightOnlySummary: WeightOnlySummary | null;
    unit: string;
    displayWeight: (kg: number) => number;
}

export const AnalysisOverview = React.memo(({
    rangeDays,
    setRangeDays,
    summary7,
    streak,
    summaryRange,
    comparison,
    heatmapData,
    volumeSeries,
    bucket,
    categoryVolume,
    cardioSummary,
    repsOnlySummary,
    weightOnlySummary,
    unit,
    displayWeight
}: AnalysisOverviewProps) => {
    const colors = useColors();

    const styles = useMemo(() => StyleSheet.create({
        container: {
            paddingBottom: 32
        },
        rangeRow: {
            flexDirection: 'row',
            gap: 10,
            marginBottom: 24
        },
        rangeChip: {
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: colors.surfaceLighter,
            borderWidth: 1.5,
            borderColor: colors.border,
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
            fontSize: 13,
            color: colors.textMuted,
        },
        rangeChipTextActive: {
            color: colors.onPrimary,
        },
        heroRow: {
            flexDirection: 'row',
            gap: 16,
            marginBottom: 24,
        },
        heroCard: {
            flex: 1,
            backgroundColor: colors.surface,
            borderRadius: 20,
            padding: 20,
            borderWidth: 1.5,
            borderColor: colors.border,
            ...ThemeFx.shadowSm,
        },
        heroIconRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginBottom: 12,
        },
        heroIconCircle: {
            width: 36,
            height: 36,
            borderRadius: 12,
            justifyContent: 'center',
            alignItems: 'center',
        },
        heroLabel: {
            fontSize: 12,
            fontWeight: '900',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        heroValue: {
            fontSize: 34,
            fontWeight: '900',
            color: colors.text,
            letterSpacing: -1,
        },
        heroValueAccent: {
            color: colors.primary.DEFAULT,
        },
        heroUnitContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginTop: 4,
        },
        heroUnit: {
            fontSize: 12,
            fontWeight: '800',
            color: colors.textMuted,
        },
        bestBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: withAlpha(colors.yellow, '15'),
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: withAlpha(colors.yellow, '30'),
        },
        bestBadgeText: {
            fontSize: 11,
            fontWeight: '900',
            color: colors.yellow,
        },
        summaryCard: {
            backgroundColor: colors.surface,
            borderRadius: 20,
            padding: 24,
            borderWidth: 1.5,
            borderColor: colors.border,
            marginBottom: 24,
            ...ThemeFx.shadowMd,
        },
        summaryHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24,
        },
        summaryHeaderTitleContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10
        },
        summaryAccent: {
            width: 4,
            height: 22,
            borderRadius: 2,
            backgroundColor: colors.primary.DEFAULT,
        },
        summaryTitle: {
            fontSize: 20,
            fontWeight: '900',
            color: colors.text,
            letterSpacing: -0.5,
        },
        changeBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 12,
            borderWidth: 1.5,
        },
        metricsGrid: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 24,
            padding: 20,
            backgroundColor: colors.surfaceLighter,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        metricCell: {
            flex: 1,
        },
        metricDivider: {
            width: 1.5,
            height: 44,
            backgroundColor: colors.border,
            marginHorizontal: 16,
        },
        metricIconRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginBottom: 6,
        },
        metricLabel: {
            fontSize: 11,
            fontWeight: '900',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.3,
        },
        metricValue: {
            fontSize: 26,
            fontWeight: '900',
            color: colors.text,
            letterSpacing: -0.5,
        },
        metricUnit: {
            fontSize: 12,
            fontWeight: '800',
            color: colors.textMuted,
            marginTop: 4,
        },
        secondaryRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: 4,
        },
        secondaryCell: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
        },
        secondaryLabel: {
            fontSize: 11,
            fontWeight: '900',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        secondaryValue: {
            fontSize: 16,
            fontWeight: '900',
            color: colors.text,
        },
        subSection: {
            marginTop: 24,
            paddingTop: 16,
            borderTopWidth: 1.5,
            borderTopColor: colors.border,
        },
        subSectionTitle: {
            fontSize: 12,
            fontWeight: '900',
            color: colors.textMuted,
            textTransform: 'uppercase',
            marginBottom: 6,
            letterSpacing: 0.8,
        },
        subSectionRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
        },
        subSectionText: {
            fontSize: 15,
            fontWeight: '900',
            color: colors.text,
        },
        sectionHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginBottom: 16,
        },
        sectionAccent: {
            width: 4,
            height: 20,
            borderRadius: 2,
            backgroundColor: colors.primary.DEFAULT,
        },
        sectionTitle: {
            fontSize: 18,
            fontWeight: '900',
            color: colors.text,
            letterSpacing: -0.3,
        },
        emptyState: {
            padding: 40,
            backgroundColor: colors.surface,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: colors.border,
            alignItems: 'center',
            ...ThemeFx.shadowSm,
        },
        emptyTitle: {
            fontSize: 18,
            fontWeight: '900',
            color: colors.text,
            marginBottom: 8,
        },
        emptyMessage: {
            fontSize: 14,
            color: colors.textMuted,
            textAlign: 'center',
            lineHeight: 20,
            fontWeight: '600',
        },
        widgetSpacing: {
            marginBottom: 24
        },
        widgetSpacingLarge: {
            marginBottom: 32
        },
        tableContainer: {
            backgroundColor: colors.surface,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: colors.border,
            overflow: 'hidden',
            ...ThemeFx.shadowSm,
        },
        tableSectionHeader: {
            paddingHorizontal: 20,
            paddingTop: 24,
            marginBottom: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        tableHeader: {
            flexDirection: 'row',
            paddingHorizontal: 20,
            paddingVertical: 14,
            backgroundColor: colors.surfaceLighter,
            borderBottomWidth: 1.5,
            borderBottomColor: colors.border,
        },
        tableHeaderText: {
            fontSize: 11,
            fontWeight: '900',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        tableRow: {
            paddingHorizontal: 20,
            paddingVertical: 20,
        },
        tableRowBorder: {
            borderBottomWidth: 1.5,
            borderBottomColor: colors.surfaceLighter,
        },
        tableRowContent: {
            flexDirection: 'row',
            alignItems: 'center'
        },
        tableNameContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            flex: 1,
            paddingRight: 12
        },
        categoryIndicator: {
            width: 12,
            height: 12,
            borderRadius: 6,
            marginRight: 12,
        },
        tableName: {
            fontSize: 15,
            fontWeight: '900',
            color: colors.text,
        },
        tableMaxWeight: {
            fontSize: 14,
            fontWeight: '900',
            color: colors.primary.DEFAULT
        },
        tableVolume: {
            width: 85,
            textAlign: 'right',
            fontSize: 16,
            fontWeight: '900',
            color: colors.text,
        },
        setPill: {
            backgroundColor: withAlpha(colors.primary.DEFAULT, '15'),
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 12,
            width: 65,
            alignItems: 'center',
        },
        setPillText: {
            fontSize: 13,
            fontWeight: '900',
            color: colors.primary.DEFAULT,
        },
        progressTrack: {
            height: 8,
            backgroundColor: colors.surfaceLighter,
            borderRadius: 4,
            marginTop: 14,
            overflow: 'hidden',
        },
        progressFill: {
            height: '100%',
            borderRadius: 4,
        },
    }), [colors]);

    const sessionCount7 = summary7?.workoutCount ?? 0;
    const currentStreak = streak?.current ?? 0;
    const bestStreak = streak?.best ?? 0;

    return (
        <View style={styles.container}>
            {/* Range Selector */}
            <View style={styles.rangeRow}>
                {[7, 30, 90, 365].map((d) => (
                    <Pressable
                        key={d}
                        onPress={() => setRangeDays(d as any)}
                        style={[styles.rangeChip, rangeDays === d && styles.rangeChipActive]}
                    >
                        <Text style={[styles.rangeChipText, rangeDays === d && styles.rangeChipTextActive]}>
                            {d}D
                        </Text>
                    </Pressable>
                ))}
            </View>

            {/* Hero Stats Row: 7 Days + Streak */}
            <View style={styles.heroRow}>
                {/* Last 7 Days Card */}
                <View style={styles.heroCard}>
                    <View style={styles.heroIconRow}>
                        <View style={[styles.heroIconCircle, { backgroundColor: withAlpha(colors.primary.DEFAULT, '15') }]}>
                            <Activity size={18} color={colors.primary.DEFAULT} />
                        </View>
                        <Text style={styles.heroLabel}>Últimos 7 días</Text>
                    </View>
                    <Text style={styles.heroValue}>{sessionCount7}</Text>
                    <Text style={styles.heroUnit}>sesiones</Text>
                </View>

                {/* Streak Card */}
                <View style={styles.heroCard}>
                    <View style={styles.heroIconRow}>
                        <View style={[styles.heroIconCircle, { backgroundColor: withAlpha(colors.yellow, '15') }]}>
                            <Flame size={18} color={colors.yellow} />
                        </View>
                        <Text style={styles.heroLabel}>Racha</Text>
                    </View>
                    <Text style={[styles.heroValue, currentStreak > 0 && styles.heroValueAccent]}>
                        {currentStreak}
                    </Text>
                    <View style={styles.heroUnitContainer}>
                        <Text style={styles.heroUnit}>días activos</Text>
                        {bestStreak > 0 && (
                            <View style={styles.bestBadge}>
                                <Trophy size={10} color={colors.yellow} />
                                <Text style={styles.bestBadgeText}>{bestStreak}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>

            {/* Summary Card */}
            <View style={styles.summaryCard}>
                {/* Header */}
                <View style={styles.summaryHeader}>
                    <View style={styles.summaryHeaderTitleContainer}>
                        <View style={styles.summaryAccent} />
                        <Text style={styles.summaryTitle}>Resumen · {rangeDays} días</Text>
                    </View>
                    {comparison?.workoutChangePct != null && (
                        <View style={[
                            styles.changeBadge,
                            {
                                backgroundColor: comparison.workoutChangePct >= 0 ? withAlpha(colors.green, '15') : withAlpha(colors.red, '15'),
                                borderColor: comparison.workoutChangePct >= 0 ? withAlpha(colors.green, '30') : withAlpha(colors.red, '30'),
                            }
                        ]}>
                            {comparison.workoutChangePct >= 0
                                ? <TrendingUp size={14} color={colors.green} />
                                : <TrendingDown size={14} color={colors.red} />}
                            <Text style={{
                                fontSize: 13,
                                fontWeight: '900',
                                color: comparison.workoutChangePct >= 0 ? colors.green : colors.red,
                            }}>
                                {comparison.workoutChangePct > 0 ? '+' : ''}{comparison.workoutChangePct}%
                            </Text>
                        </View>
                    )}
                </View>

                {/* Primary Metrics Grid */}
                <View style={styles.metricsGrid}>
                    <View style={styles.metricCell}>
                        <View style={styles.metricIconRow}>
                            <Zap size={14} color={colors.primary.DEFAULT} />
                            <Text style={styles.metricLabel}>Carga Movida</Text>
                        </View>
                        <Text style={styles.metricValue}>
                            {(summaryRange?.totalVolume ?? 0) > 1000
                                ? `${Math.round((summaryRange?.totalVolume ?? 0) / 1000)}k`
                                : summaryRange?.totalVolume ?? 0}
                        </Text>
                        <Text style={styles.metricUnit}>{summaryRange?.totalSets ?? 0} series • {summaryRange?.totalReps ?? 0} reps</Text>
                    </View>
                    <View style={styles.metricDivider} />
                    <View style={styles.metricCell}>
                        <View style={styles.metricIconRow}>
                            <TrendingUp size={14} color={colors.primary.DEFAULT} />
                            <Text style={styles.metricLabel}>Intensidad</Text>
                        </View>
                        <Text style={styles.metricValue}>
                            {summaryRange?.workoutCount
                                ? Math.round((summaryRange.totalVolume || 0) / summaryRange.workoutCount).toLocaleString()
                                : 0}
                        </Text>
                        <Text style={styles.metricUnit}>kg / sesión</Text>
                    </View>
                </View>

                {/* Secondary Metrics */}
                <View style={styles.secondaryRow}>
                    <View style={styles.secondaryCell}>
                        <Clock size={18} color={colors.textMuted} />
                        <View>
                            <Text style={styles.secondaryLabel}>Duración Media</Text>
                            <Text style={styles.secondaryValue}>
                                {summaryRange?.avgDurationMin ? Math.round(summaryRange.avgDurationMin) : '—'} min
                            </Text>
                        </View>
                    </View>
                    <View style={styles.secondaryCell}>
                        <Zap size={18} color={colors.textMuted} />
                        <View>
                            <Text style={styles.secondaryLabel}>Densidad</Text>
                            <Text style={styles.secondaryValue}>
                                {summaryRange?.avgDurationMin && summaryRange.workoutCount
                                    ? Math.round((summaryRange.totalVolume || 0) / (summaryRange.avgDurationMin * summaryRange.workoutCount))
                                    : '—'}{' '}
                                <Text style={styles.metricUnit}>kg/min</Text>
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Conditional Summaries */}
                {(cardioSummary?.sessions || 0) > 0 && (
                    <View style={styles.subSection}>
                        <Text style={styles.subSectionTitle}>Cardio</Text>
                        <View style={styles.subSectionRow}>
                            <Text style={styles.subSectionText}>
                                {cardioSummary?.sessions} sesiones · {Math.round((cardioSummary?.totalDistanceMeters || 0) / 1000)}km
                            </Text>
                            <Text style={styles.subSectionText}>
                                {Math.round((cardioSummary?.totalTimeSeconds || 0) / 60)} min total
                            </Text>
                        </View>
                    </View>
                )}

                {(repsOnlySummary?.sessions || 0) > 0 && (
                    <View style={styles.subSection}>
                        <Text style={styles.subSectionTitle}>Peso Corporal</Text>
                        <Text style={styles.subSectionText}>
                            {repsOnlySummary?.sessions} sesiones · {repsOnlySummary?.totalReps} reps totales
                        </Text>
                    </View>
                )}

                {(weightOnlySummary?.sessions || 0) > 0 && (
                    <View style={styles.subSection}>
                        <Text style={styles.subSectionTitle}>Peso Extra</Text>
                        <Text style={styles.subSectionText}>
                            {weightOnlySummary?.sessions} sesiones · Max: {weightOnlySummary?.bestWeightKg} kg
                        </Text>
                    </View>
                )}
            </View>

            {/* Goals */}
            <View style={styles.widgetSpacing}>
                <GoalsWidget />
            </View>

            {/* Heatmap */}
            <View style={styles.widgetSpacingLarge}>
                <ConsistencyHeatmap timestamps={heatmapData} />
            </View>

            {/* Volume Chart */}
            <View style={styles.widgetSpacingLarge}>
                <VolumeChart data={volumeSeries} bucket={bucket} />
            </View>

            {/* Category Volume Distribution */}
            <View>
                {categoryVolume.length === 0 ? (
                    <>
                        <View style={styles.sectionHeader}>
                            <View style={styles.sectionAccent} />
                            <BarChart3 size={18} color={colors.text} />
                            <Text style={styles.sectionTitle}>Distribución por Grupo Muscular</Text>
                        </View>
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyTitle}>Sin datos de carga</Text>
                            <Text style={styles.emptyMessage}>
                                Completa entrenamientos con peso para ver tu distribución muscular.
                            </Text>
                        </View>
                    </>
                ) : (
                    <View style={styles.tableContainer}>
                        {/* Card-internal header */}
                        <View style={styles.tableSectionHeader}>
                            <View style={styles.sectionAccent} />
                            <BarChart3 size={18} color={colors.text} />
                            <Text style={styles.sectionTitle}>Distribución por Grupo Muscular</Text>
                        </View>
                        {/* Table Header */}
                        <View style={styles.tableHeader}>
                            <Text style={[styles.tableHeaderText, { flex: 1 }]}>Grupo</Text>
                            <Text style={[styles.tableHeaderText, { width: 65, textAlign: 'center' }]}>Series</Text>
                            <Text style={[styles.tableHeaderText, { width: 64, textAlign: 'center' }]}>Peso Max</Text>
                            <Text style={[styles.tableHeaderText, { width: 85, textAlign: 'right' }]}>Carga Kg</Text>
                        </View>

                        {/* Table Rows */}
                        {(() => {
                            const maxVol = Math.max(...categoryVolume.map(c => c.volume), 1);
                            return categoryVolume.map((c, idx) => {
                                const pct = Math.round((c.volume / maxVol) * 100);
                                return (
                                    <View
                                        key={idx}
                                        style={[
                                            styles.tableRow,
                                            idx < categoryVolume.length - 1 && styles.tableRowBorder,
                                        ]}
                                    >
                                        <View style={styles.tableRowContent}>
                                            <View style={styles.tableNameContainer}>
                                                <View
                                                    style={[styles.categoryIndicator, {
                                                        backgroundColor: c.categoryColor || colors.textMuted
                                                    }]}
                                                />
                                                <Text
                                                    style={styles.tableName}
                                                    numberOfLines={1}
                                                    ellipsizeMode="tail"
                                                >
                                                    {c.categoryName}
                                                </Text>
                                            </View>

                                            <View style={styles.setPill}>
                                                <Text style={styles.setPillText}>{c.setCount}</Text>
                                            </View>

                                            <View style={{ width: 64, alignItems: 'center' }}>
                                                <Text style={styles.tableMaxWeight}>
                                                    {c.maxWeight ? `${Math.round(displayWeight(c.maxWeight))}${unit}` : '-'}
                                                </Text>
                                            </View>

                                            <Text style={styles.tableVolume}>
                                                {c.volume >= 1000 ? `${(c.volume / 1000).toFixed(1)}k` : Math.round(c.volume)}
                                            </Text>
                                        </View>

                                        {/* Progress Bar */}
                                        <View style={styles.progressTrack}>
                                            <View
                                                style={[styles.progressFill, {
                                                    width: `${pct}%`,
                                                    backgroundColor: c.categoryColor || colors.primary.DEFAULT,
                                                }]}
                                            />
                                        </View>
                                    </View>
                                );
                            });
                        })()}
                    </View>
                )}
            </View>

            {/* Body Snapshot */}
            <BodySnapshotWidget unit={unit} displayWeight={displayWeight} />
        </View>
    );
});



