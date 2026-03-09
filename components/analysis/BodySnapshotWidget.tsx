import { withAlpha } from '@/src/theme';
import { useRouter } from 'expo-router';
import { Ruler, Scale, TrendingDown, TrendingUp } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '../../src/hooks/useColors';

interface BodySnapshotWidgetProps {
    unit: string;
    displayWeight: (kg: number) => number;
}

export function BodySnapshotWidget({ unit, displayWeight }: BodySnapshotWidgetProps) {
    const colors = useColors();
    const router = useRouter();
    const [latestWeight, setLatestWeight] = useState<{ value: number; delta: number | null } | null>(null);
    const [latestFat, setLatestFat] = useState<{ value: number; delta: number | null } | null>(null);

    const styles = useMemo(() => StyleSheet.create({
        bodyCard: {
            backgroundColor: colors.surface,
            borderRadius: 20,
            padding: 24,
            borderWidth: 1.5,
            borderColor: colors.iron[200],
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.06,
            shadowRadius: 16,
            elevation: 4,
        },
        bodyHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
        },
        bodyIconCircle: {
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: withAlpha(colors.primary.DEFAULT, '15'),
            justifyContent: 'center',
            alignItems: 'center',
        },
        bodyTitle: {
            fontSize: 18,
            fontWeight: '900',
            color: colors.iron[950],
            letterSpacing: -0.4,
        },
        bodyGrid: {
            flexDirection: 'row',
            gap: 12,
        },
        bodyMetric: {
            flex: 1,
            backgroundColor: colors.iron[100],
            padding: 16,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: colors.iron[200],
        },
        bodyMetricLabel: {
            fontSize: 11,
            fontWeight: '900',
            color: colors.iron[500],
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        bodyMetricValue: {
            fontSize: 22,
            fontWeight: '900',
            color: colors.iron[950],
            marginTop: 6,
            letterSpacing: -0.5,
        },
        deltaBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginTop: 4,
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 6,
            alignSelf: 'flex-start',
        }
    }), [colors]);

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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={styles.bodyIconCircle}>
                        <Ruler size={16} color={colors.primary.DEFAULT} />
                    </View>
                    <Text style={styles.bodyTitle}>Evolución física</Text>
                </View>
                <TrendingUp size={18} color={colors.iron[300]} />
            </View>
            <View style={styles.bodyGrid}>
                {latestWeight && (
                    <View style={styles.bodyMetric}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Scale size={14} color={colors.iron[500]} />
                            <Text style={styles.bodyMetricLabel}>Peso</Text>
                        </View>
                        <Text style={styles.bodyMetricValue}>
                            {Math.round(displayWeight(latestWeight.value) * 10) / 10} {unit}
                        </Text>
                        {latestWeight.delta !== null && (
                            <View style={[
                                styles.deltaBadge,
                                { backgroundColor: latestWeight.delta > 0 ? withAlpha(colors.green, '10') : latestWeight.delta < 0 ? withAlpha(colors.red, '10') : 'transparent' }
                            ]}>
                                {latestWeight.delta > 0
                                    ? <TrendingUp size={10} color={colors.green} />
                                    : latestWeight.delta < 0 ? <TrendingDown size={10} color={colors.red} /> : null}
                                <Text style={{ fontSize: 10, fontWeight: '900', color: latestWeight.delta > 0 ? colors.green : latestWeight.delta < 0 ? colors.red : colors.iron[500] }}>
                                    {latestWeight.delta > 0 ? '+' : ''}{Math.round(displayWeight(latestWeight.delta) * 10) / 10} {unit}
                                </Text>
                            </View>
                        )}
                    </View>
                )}
                {latestFat && (
                    <View style={styles.bodyMetric}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <TrendingDown size={14} color={colors.iron[500]} />
                            <Text style={styles.bodyMetricLabel}>Grasa</Text>
                        </View>
                        <Text style={styles.bodyMetricValue}>{latestFat.value}%</Text>
                        {latestFat.delta !== null && (
                            <View style={[
                                styles.deltaBadge,
                                { backgroundColor: latestFat.delta < 0 ? withAlpha(colors.green, '10') : latestFat.delta > 0 ? withAlpha(colors.red, '10') : 'transparent' }
                            ]}>
                                {latestFat.delta > 0
                                    ? <TrendingUp size={10} color={colors.red} />
                                    : latestFat.delta < 0 ? <TrendingDown size={10} color={colors.green} /> : null}
                                <Text style={{ fontSize: 10, fontWeight: '900', color: latestFat.delta < 0 ? colors.green : latestFat.delta > 0 ? colors.red : colors.iron[500] }}>
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

