import { ConsistencyHeatmap } from '@/components/ConsistencyHeatmap';
import { GoalsWidget } from '@/components/GoalsWidget';
import { VolumeChart } from '@/components/analysis/VolumeChart';
import { CardioSummary, CategoryVolumeRow, RepsOnlySummary, WeightOnlySummary, WorkoutComparison, WorkoutStreak, WorkoutSummary } from '@/src/services/AnalysisService';
import { Colors, ThemeFx, withAlpha } from '@/src/theme';
import { useRouter } from 'expo-router';
import { Activity, BarChart3, ChevronRight, Clock, Flame, Ruler, Scale, TrendingDown, TrendingUp, Trophy, Zap } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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

export function AnalysisOverview({
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
}: AnalysisOverviewProps) {

    const sessionCount7 = summary7?.workoutCount ?? 0;
    const currentStreak = streak?.current ?? 0;
    const bestStreak = streak?.best ?? 0;

    return (
        <View style={{ paddingBottom: 32 }}>
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
                <View style={[styles.heroCard, { flex: 1 }]}>
                    <View style={styles.heroIconRow}>
                        <View style={[styles.heroIconCircle, { backgroundColor: withAlpha(Colors.primary.DEFAULT, '15') }]}>
                            <Activity size={16} color={Colors.primary.DEFAULT} />
                        </View>
                        <Text style={styles.heroLabel}>Últimos 7 días</Text>
                    </View>
                    <Text style={styles.heroValue}>{sessionCount7}</Text>
                    <Text style={styles.heroUnit}>sesiones</Text>
                </View>

                {/* Streak Card */}
                <View style={[styles.heroCard, { flex: 1 }]}>
                    <View style={styles.heroIconRow}>
                        <View style={[styles.heroIconCircle, { backgroundColor: withAlpha(Colors.yellow, '15') }]}>
                            <Flame size={16} color={Colors.yellow} />
                        </View>
                        <Text style={styles.heroLabel}>Racha</Text>
                    </View>
                    <Text style={[styles.heroValue, { color: currentStreak > 0 ? Colors.primary.DEFAULT : Colors.iron[950] }]}>
                        {currentStreak}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={styles.heroUnit}>días activos</Text>
                        {bestStreak > 0 && (
                            <View style={styles.bestBadge}>
                                <Trophy size={8} color={Colors.primary.dark} />
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={styles.summaryAccent} />
                        <Text style={styles.summaryTitle}>Resumen · {rangeDays} días</Text>
                    </View>
                    {comparison?.workoutChangePct != null && (
                        <View style={[
                            styles.changeBadge,
                            { backgroundColor: comparison.workoutChangePct >= 0 ? withAlpha(Colors.green, '33') : withAlpha(Colors.red, '33') }
                        ]}>
                            {comparison.workoutChangePct >= 0
                                ? <TrendingUp size={12} color={Colors.green} />
                                : <TrendingDown size={12} color={Colors.red} />}
                            <Text style={{
                                fontSize: 11,
                                fontWeight: '800',
                                color: comparison.workoutChangePct >= 0 ? Colors.green : Colors.red,
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
                            <Zap size={12} color={Colors.primary.DEFAULT} />
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
                            <TrendingUp size={12} color={Colors.primary.DEFAULT} />
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
                        <Clock size={14} color={Colors.iron[400]} />
                        <View>
                            <Text style={styles.secondaryLabel}>Duración Media</Text>
                            <Text style={styles.secondaryValue}>
                                {summaryRange?.avgDurationMin ? Math.round(summaryRange.avgDurationMin) : '—'} min
                            </Text>
                        </View>
                    </View>
                    <View style={styles.secondaryCell}>
                        <Zap size={14} color={Colors.iron[400]} />
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
            <View style={{ marginBottom: 24 }}>
                <GoalsWidget />
            </View>

            {/* Heatmap */}
            <View style={{ marginBottom: 28 }}>
                <ConsistencyHeatmap timestamps={heatmapData} />
            </View>

            {/* Volume Chart */}
            <View style={{ marginBottom: 28 }}>
                <VolumeChart data={volumeSeries} bucket={bucket} />
            </View>

            {/* Category Volume Distribution */}
            <View>
                {categoryVolume.length === 0 ? (
                    <>
                        <View style={styles.sectionHeader}>
                            <View style={styles.sectionAccent} />
                            <BarChart3 size={16} color={Colors.iron[950]} />
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
                        <View style={[styles.sectionHeader, { paddingHorizontal: 16, paddingTop: 14 }]}>
                            <View style={styles.sectionAccent} />
                            <BarChart3 size={16} color={Colors.iron[950]} />
                            <Text style={styles.sectionTitle}>Distribución por Grupo Muscular</Text>
                        </View>
                        {/* Table Header */}
                        <View style={styles.tableHeader}>
                            <Text style={[styles.tableHeaderText, { flex: 1 }]}>Grupo</Text>
                            <Text style={[styles.tableHeaderText, { width: 56, textAlign: 'center' }]}>Series</Text>
                            <Text style={[styles.tableHeaderText, { width: 64, textAlign: 'center' }]}>Peso Max</Text>
                            <Text style={[styles.tableHeaderText, { width: 80, textAlign: 'right' }]}>Carga Kg</Text>
                        </View>

                        {/* Table Rows */}
                        {(() => {
                            const maxVol = Math.max(...categoryVolume.map(c => c.volume), 1);
                            return categoryVolume.map((c, idx) => {
                                const pct = Math.round((c.volume / maxVol) * 100);
                                return (
                                    <View
                                        key={c.categoryId}
                                        style={[
                                            styles.tableRow,
                                            idx < categoryVolume.length - 1 && styles.tableRowBorder,
                                        ]}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 }}>
                                                <View
                                                    style={{
                                                        width: 10,
                                                        height: 10,
                                                        borderRadius: 5,
                                                        marginRight: 8,
                                                        backgroundColor: c.categoryColor || Colors.iron[400]
                                                    }}
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
                                                <Text style={{ fontSize: 13, fontWeight: '900', color: Colors.primary.DEFAULT }}>
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
                                                    backgroundColor: c.categoryColor || Colors.primary.DEFAULT,
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
}

function BodySnapshotWidget({ unit, displayWeight }: { unit: string; displayWeight: (kg: number) => number }) {
    const router = useRouter();
    const [latestWeight, setLatestWeight] = useState<{ value: number; delta: number | null } | null>(null);
    const [latestFat, setLatestFat] = useState<{ value: number; delta: number | null } | null>(null);

    const loadBodyData = useCallback(async () => {
        try {
            const { bodyService } = await import('@/src/services/BodyService');
            const [weightHistory, fatHistory] = await Promise.all([
                bodyService.getHistory('weight'),
                bodyService.getHistory('body_fat'),
            ]);
            if (weightHistory.length > 0) {
                const latest = weightHistory[0].value;
                const delta = weightHistory.length > 1 ? Math.round((latest - weightHistory[1].value) * 10) / 10 : null;
                setLatestWeight({ value: latest, delta });
            }
            if (fatHistory.length > 0) {
                const latest = fatHistory[0].value;
                const delta = fatHistory.length > 1 ? Math.round((latest - fatHistory[1].value) * 10) / 10 : null;
                setLatestFat({ value: latest, delta });
            }
        } catch { /* safe */ }
    }, []);

    useEffect(() => { loadBodyData(); }, [loadBodyData]);

    if (!latestWeight && !latestFat) return null;

    return (
        <Pressable onPress={() => router.push('/body' as any)} style={styles.bodyCard}>
            <View style={styles.bodyHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={styles.bodyIconCircle}>
                        <Ruler size={14} color={Colors.primary.DEFAULT} />
                    </View>
                    <Text style={styles.bodyTitle}>Evolución Física</Text>
                </View>
                <ChevronRight size={16} color={Colors.iron[400]} />
            </View>
            <View style={styles.bodyGrid}>
                {latestWeight && (
                    <View style={styles.bodyMetric}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Scale size={12} color={Colors.iron[500]} />
                            <Text style={styles.bodyMetricLabel}>Peso</Text>
                        </View>
                        <Text style={styles.bodyMetricValue}>
                            {Math.round(displayWeight(latestWeight.value) * 10) / 10} {unit}
                        </Text>
                        {latestWeight.delta !== null && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 }}>
                                {latestWeight.delta > 0
                                    ? <TrendingUp size={10} color={Colors.green} />
                                    : latestWeight.delta < 0 ? <TrendingDown size={10} color={Colors.red} /> : null}
                                <Text style={{ fontSize: 10, fontWeight: '800', color: latestWeight.delta > 0 ? Colors.green : latestWeight.delta < 0 ? Colors.red : Colors.iron[500] }}>
                                    {latestWeight.delta > 0 ? '+' : ''}{Math.round(displayWeight(latestWeight.delta) * 10) / 10} {unit}
                                </Text>
                            </View>
                        )}
                    </View>
                )}
                {latestFat && (
                    <View style={styles.bodyMetric}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <TrendingDown size={12} color={Colors.iron[500]} />
                            <Text style={styles.bodyMetricLabel}>Grasa</Text>
                        </View>
                        <Text style={styles.bodyMetricValue}>{latestFat.value}%</Text>
                        {latestFat.delta !== null && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 }}>
                                {latestFat.delta > 0
                                    ? <TrendingUp size={10} color={Colors.red} />
                                    : latestFat.delta < 0 ? <TrendingDown size={10} color={Colors.green} /> : null}
                                <Text style={{ fontSize: 10, fontWeight: '800', color: latestFat.delta < 0 ? Colors.green : latestFat.delta > 0 ? Colors.red : Colors.iron[500] }}>
                                    {latestFat.delta > 0 ? '+' : ''}{latestFat.delta}%
                                </Text>
                            </View>
                        )}
                    </View>
                )}
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    // Range Selector
    rangeRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 20,
    },
    rangeChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        backgroundColor: 'transparent',
    },
    rangeChipActive: {
        backgroundColor: Colors.primary.DEFAULT,
        borderColor: Colors.primary.DEFAULT,
    },
    rangeChipText: {
        fontWeight: '800',
        fontSize: 13,
        color: Colors.iron[950],
    },
    rangeChipTextActive: {
        color: Colors.surface,
    },

    // Hero Cards
    heroRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    heroCard: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        elevation: 2,
        shadowColor: ThemeFx.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
    },
    heroIconRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    heroIconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    heroLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: Colors.iron[500],
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    heroValue: {
        fontSize: 32,
        fontWeight: '900',
        color: Colors.iron[950],
        letterSpacing: -1,
        lineHeight: 36,
    },
    heroUnit: {
        fontSize: 11,
        fontWeight: '600',
        color: Colors.iron[400],
        marginTop: 2,
    },
    bestBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: withAlpha(Colors.primary.DEFAULT, '15'),
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    bestBadgeText: {
        fontSize: 9,
        fontWeight: '800',
        color: Colors.primary.dark,
    },

    // Summary Card
    summaryCard: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        padding: 20,
        marginBottom: 24,
        elevation: 2,
        shadowColor: ThemeFx.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
    },
    summaryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    summaryAccent: {
        width: 3,
        height: 18,
        borderRadius: 2,
        backgroundColor: Colors.primary.DEFAULT,
    },
    summaryTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: Colors.iron[950],
        letterSpacing: -0.3,
    },
    changeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },

    // Metrics Grid
    metricsGrid: {
        flexDirection: 'row',
        backgroundColor: Colors.iron[200],
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.iron[300],
        padding: 16,
        marginBottom: 16,
    },
    metricCell: {
        flex: 1,
        alignItems: 'center',
    },
    metricDivider: {
        width: 1,
        backgroundColor: Colors.iron[300],
        marginHorizontal: 12,
    },
    metricIconRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 6,
    },
    metricLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: Colors.iron[500],
        textTransform: 'uppercase',
    },
    metricValue: {
        fontSize: 22,
        fontWeight: '900',
        color: Colors.iron[950],
        letterSpacing: -0.5,
    },
    metricUnit: {
        fontSize: 10,
        color: Colors.iron[400],
        fontWeight: '500',
    },

    // Secondary Metrics
    secondaryRow: {
        flexDirection: 'row',
        gap: 12,
    },
    secondaryCell: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: Colors.iron[200],
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: Colors.iron[300],
    },
    secondaryLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: Colors.iron[500],
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    secondaryValue: {
        fontSize: 15,
        fontWeight: '800',
        color: Colors.iron[950],
    },

    // Sub Sections
    subSection: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: Colors.iron[300],
    },
    subSectionTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: Colors.iron[950],
        marginBottom: 6,
    },
    subSectionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    subSectionText: {
        fontSize: 12,
        color: Colors.iron[500],
        fontWeight: '500',
    },

    // Section Title
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 14,
    },
    sectionAccent: {
        width: 3,
        height: 18,
        borderRadius: 2,
        backgroundColor: Colors.primary.DEFAULT,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: Colors.iron[950],
        letterSpacing: -0.3,
    },

    // Empty State
    emptyState: {
        backgroundColor: Colors.surface,
        padding: 24,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        borderStyle: 'dashed',
        alignItems: 'center',
    },
    emptyTitle: {
        color: Colors.iron[500],
        fontWeight: '800',
        fontSize: 13,
        marginBottom: 4,
    },
    emptyMessage: {
        color: Colors.iron[400],
        fontSize: 11,
        textAlign: 'center',
    },

    // Table
    tableContainer: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        overflow: 'hidden',
        elevation: 2,
        shadowColor: ThemeFx.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
    },
    tableHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: Colors.iron[200],
        borderBottomWidth: 1,
        borderBottomColor: Colors.iron[300],
    },
    tableHeaderText: {
        fontSize: 9,
        fontWeight: '800',
        color: Colors.iron[500],
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    tableRow: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    tableRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: Colors.iron[200],
    },
    tableName: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.iron[950],
    },
    setPill: {
        width: 56,
        alignItems: 'center',
    },
    setPillText: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.iron[500],
        backgroundColor: Colors.iron[200],
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        overflow: 'hidden',
    },
    tableVolume: {
        width: 80,
        fontSize: 14,
        fontWeight: '900',
        color: Colors.iron[950],
        textAlign: 'right',
    },
    progressTrack: {
        height: 4,
        backgroundColor: Colors.iron[200],
        borderRadius: 2,
        marginTop: 8,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
        opacity: 0.65,
    },

    // Body Snapshot
    bodyCard: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        padding: 16,
        marginTop: 20,
        elevation: 1,
    },
    bodyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    bodyIconCircle: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: withAlpha(Colors.primary.DEFAULT, '12'),
        alignItems: 'center',
        justifyContent: 'center',
    },
    bodyTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: Colors.iron[950],
        letterSpacing: -0.3,
    },
    bodyGrid: {
        flexDirection: 'row',
        gap: 16,
    },
    bodyMetric: {
        flex: 1,
        backgroundColor: Colors.iron[200],
        borderRadius: 12,
        padding: 12,
    },
    bodyMetricLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.iron[500],
    },
    bodyMetricValue: {
        fontSize: 20,
        fontWeight: '900',
        color: Colors.iron[950],
        marginTop: 4,
    },
});
