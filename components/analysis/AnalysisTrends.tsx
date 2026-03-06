import { EmptyChartPlaceholder } from '@/components/EmptyChartPlaceholder';
import { BadgePill } from '@/components/ui/BadgePill';
import { ExerciseVolumeRow, VolumeSeriesPoint } from '@/src/services/AnalysisService';
import { Colors } from '@/src/theme';
import { useRouter } from 'expo-router';
import { ChevronRight, Minus, TrendingDown, TrendingUp, Zap } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface AnalysisTrendsProps {
    volumeSeries: VolumeSeriesPoint[];
    topExercisesByVolume: ExerciseVolumeRow[];
    rangeDays: 7 | 30 | 90 | 365;
    handleRangeChange: (d: 7 | 30 | 90 | 365) => void;
}

export function AnalysisTrends({ volumeSeries, topExercisesByVolume, rangeDays, handleRangeChange }: AnalysisTrendsProps) {
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
        <View style={{ paddingBottom: 32 }}>
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={styles.trendAccent} />
                        <Text style={styles.trendTitle}>Tendencia de carga</Text>
                    </View>
                </View>

                <View style={styles.trendGrid}>
                    {/* Direction */}
                    <View style={styles.trendCell}>
                        <Text style={styles.trendCellLabel}>Dirección</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={[
                                styles.trendIconCircle,
                                { backgroundColor: isUp ? '#dcfce7' : isDown ? '#fee2e2' : Colors.iron[200] }
                            ]}>
                                {isUp ? <TrendingUp size={16} color="#166534" />
                                    : isDown ? <TrendingDown size={16} color="#991b1b" />
                                        : <Minus size={16} color={Colors.iron[500]} />}
                            </View>
                            <Text style={[styles.trendCellValue, {
                                color: isUp ? '#166534' : isDown ? '#991b1b' : Colors.iron[950]
                            }]}>
                                {isUp ? 'Subiendo' : isDown ? 'Bajando' : 'Estable'}
                            </Text>
                        </View>
                    </View>

                    {/* Change */}
                    <View style={[styles.trendCell, { borderLeftWidth: 1, borderLeftColor: Colors.iron[300], paddingLeft: 16 }]}>
                        <Text style={styles.trendCellLabel}>Cambio</Text>
                        <Text style={[styles.trendCellValue, styles.trendChangeValue, {
                            color: volumeTrend.changePct && volumeTrend.changePct > 0 ? '#166534'
                                : volumeTrend.changePct && volumeTrend.changePct < 0 ? '#991b1b'
                                    : Colors.iron[950]
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
            <View style={{ marginBottom: 28 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <View style={{ width: 3, height: 18, borderRadius: 2, backgroundColor: Colors.primary.DEFAULT }} />
                    <Zap size={16} color={Colors.iron[950]} />
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
                            style={[styles.exerciseCard, idx < topExercisesByVolume.length - 1 && { marginBottom: 10 }]}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                {/* Rank */}
                                <View style={styles.rankBadge}>
                                    <Text style={styles.rankText}>{idx + 1}</Text>
                                </View>

                                {/* Info */}
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <View style={{
                                            width: 8, height: 8, borderRadius: 4,
                                            backgroundColor: e.categoryColor || Colors.iron[500]
                                        }} />
                                        <Text style={styles.exerciseCategory}>{e.categoryName}</Text>
                                    </View>
                                    <Text style={styles.exerciseName} numberOfLines={1}>{e.exerciseName}</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                        {e.badges?.map((b, i) => (
                                            <BadgePill key={i} name={b.name} color={b.color} icon={b.icon} size="xs" />
                                        ))}
                                    </View>
                                    <Text style={styles.exerciseSets}>{e.setCount} series</Text>
                                </View>

                                {/* Volume */}
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={styles.exerciseVolume}>
                                        {e.volume >= 1000 ? `${(e.volume / 1000).toFixed(1)}k` : Math.round(e.volume)}
                                    </Text>
                                    <Text style={styles.exerciseVolUnit}>KG</Text>
                                </View>

                                <ChevronRight size={16} color={Colors.iron[400]} style={{ marginLeft: 8 }} />
                            </View>
                        </Pressable>
                    ))
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    rangeRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
    rangeChip: {
        paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 20, borderWidth: 1, borderColor: Colors.iron[700],
    },
    rangeChipActive: { backgroundColor: Colors.primary.DEFAULT, borderColor: Colors.primary.DEFAULT },
    rangeChipText: { fontWeight: '800', fontSize: 13, color: Colors.iron[950] },
    rangeChipTextActive: { color: Colors.surface },

    trendCard: {
        backgroundColor: Colors.surface, borderRadius: 16,
        borderWidth: 1, borderColor: Colors.iron[700],
        padding: 20, marginBottom: 24,
        elevation: 2, shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8,
    },
    trendHeader: { marginBottom: 16 },
    trendAccent: { width: 3, height: 18, borderRadius: 2, backgroundColor: Colors.primary.DEFAULT },
    trendTitle: { fontSize: 17, fontWeight: '900', color: Colors.iron[950], letterSpacing: -0.3 },
    trendGrid: {
        flexDirection: 'row',
        backgroundColor: Colors.iron[200], borderRadius: 12,
        borderWidth: 1, borderColor: Colors.iron[300],
        padding: 16,
    },
    trendCell: { flex: 1 },
    trendCellLabel: { fontSize: 10, fontWeight: '700', color: Colors.iron[500], textTransform: 'uppercase', marginBottom: 8 },
    trendCellValue: { fontSize: 18, fontWeight: '900', color: Colors.iron[950] },
    trendChangeValue: { fontSize: 24, letterSpacing: -0.5 },
    trendIconCircle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    insufficientData: {
        marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.iron[300],
    },
    insufficientDataText: { fontSize: 12, color: Colors.iron[400], fontStyle: 'italic' },

    sectionTitle: { fontSize: 17, fontWeight: '900', color: Colors.iron[950], letterSpacing: -0.3 },

    exerciseCard: {
        backgroundColor: Colors.surface, padding: 14, borderRadius: 14,
        borderWidth: 1, borderColor: Colors.iron[700],
        elevation: 1, shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4,
    },
    rankBadge: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: Colors.primary.DEFAULT + '15',
        justifyContent: 'center', alignItems: 'center',
    },
    rankText: { fontSize: 13, fontWeight: '900', color: Colors.primary.DEFAULT },
    exerciseCategory: { fontSize: 10, fontWeight: '700', color: Colors.iron[500], textTransform: 'uppercase' },
    exerciseName: { fontSize: 14, fontWeight: '700', color: Colors.iron[950], marginTop: 2 },
    exerciseSets: { fontSize: 11, fontWeight: '600', color: Colors.iron[400], marginTop: 2 },
    exerciseVolume: { fontSize: 18, fontWeight: '900', color: Colors.iron[950] },
    exerciseVolUnit: { fontSize: 9, fontWeight: '700', color: Colors.iron[400], textTransform: 'uppercase' },
});
