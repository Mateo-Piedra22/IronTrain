import { ConsistencyHeatmap } from '@/components/ConsistencyHeatmap';
import { GoalsWidget } from '@/components/GoalsWidget';
import { IronCard } from '@/components/IronCard';
import { VolumeChart } from '@/components/analysis/VolumeChart';
import { CardioSummary, CategoryVolumeRow, RepsOnlySummary, WeightOnlySummary, WorkoutComparison, WorkoutStreak, WorkoutSummary } from '@/src/services/AnalysisService';
import { Colors } from '@/src/theme';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

interface AnalysisOverviewProps {
    rangeDays: 7 | 30 | 90 | 365;
    setRangeDays: (d: 7 | 30 | 90 | 365) => void;
    summary7: WorkoutSummary | null;
    streak: WorkoutStreak | null;
    summaryRange: WorkoutSummary | null;
    comparison: WorkoutComparison | null;
    heatmapData: number[]; // timestamps
    volumeSeries: { value: number; label: string; dateMs: number }[];
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

    return (
        <View className="pb-8">
            <View className="flex-row gap-2 mb-6">
                {[7, 30, 90, 365].map((d) => (
                    <Pressable
                        key={d}
                        onPress={() => setRangeDays(d as any)}
                        className={`px-3 py-2 rounded-full border ${rangeDays === d ? 'bg-surface border-primary' : 'bg-transparent border-iron-700'}`}
                    >
                        <Text className={`font-bold ${rangeDays === d ? 'text-primary' : 'text-iron-950'}`}>{d}D</Text>
                    </Pressable>
                ))}
            </View>

            <View className="flex-row gap-3 mb-6">
                <View className="flex-1">
                    <IronCard>
                        <Text className="text-iron-500 text-[10px] font-bold uppercase tracking-wider">Últimos 7 días</Text>
                        <Text className="text-iron-950 text-3xl font-black mt-1">{summary7?.workoutCount ?? 0}</Text>
                        <Text className="text-iron-500 text-xs font-bold">sesiones</Text>
                    </IronCard>
                </View>
                <View className="flex-1">
                    <IronCard>
                        <Text className="text-iron-500 text-[10px] font-bold uppercase tracking-wider">Racha Actual</Text>
                        <Text className="text-iron-950 text-3xl font-black mt-1 text-primary">{streak?.current ?? 0}</Text>
                        <Text className="text-iron-500 text-xs font-bold">días consecutivos</Text>
                    </IronCard>
                </View>
            </View>

            <IronCard className="mb-6 p-5">
                <View className="flex-row justify-between items-center mb-4">
                    <Text className="text-iron-950 font-bold text-lg">Resumen ({rangeDays} días)</Text>
                    {comparison?.workoutChangePct != null && (
                        <View className={`px-2 py-1 rounded ${comparison.workoutChangePct >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                            <Text className={`text-xs font-bold ${comparison.workoutChangePct >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                                {comparison.workoutChangePct > 0 ? '+' : ''}{comparison.workoutChangePct}% actividad
                            </Text>
                        </View>
                    )}
                </View>

                <View className="flex-row gap-4 mb-4">
                    <View className="flex-1 p-3 bg-iron-200 rounded-xl border border-iron-300">
                        <Text className="text-iron-500 text-[10px] uppercase font-bold">Volumen Total</Text>
                        <Text className="text-iron-950 text-xl font-black mt-1">
                            {(summaryRange?.totalVolume ?? 0) > 1000
                                ? `${Math.round((summaryRange?.totalVolume ?? 0) / 1000)}k`
                                : summaryRange?.totalVolume ?? 0}
                        </Text>
                        <Text className="text-iron-400 text-[10px]">kg acumulados</Text>
                    </View>
                    <View className="flex-1 p-3 bg-iron-200 rounded-xl border border-iron-300">
                        <Text className="text-iron-500 text-[10px] uppercase font-bold">Intensidad</Text>
                        <Text className="text-iron-950 text-xl font-black mt-1">
                            {summaryRange?.workoutCount
                                ? Math.round((summaryRange.totalVolume || 0) / summaryRange.workoutCount).toLocaleString()
                                : 0}
                        </Text>
                        <Text className="text-iron-400 text-[10px]">kg / sesión</Text>
                    </View>
                </View>

                <View className="flex-row gap-4">
                    <View className="flex-1">
                        <Text className="text-iron-500 text-xs font-bold mb-1">Duración Media</Text>
                        <Text className="text-iron-950 text-lg font-bold">
                            {summaryRange?.avgDurationMin ? Math.round(summaryRange.avgDurationMin) : '—'} min
                        </Text>
                    </View>
                    <View className="flex-1">
                        <Text className="text-iron-500 text-xs font-bold mb-1">Densidad</Text>
                        <Text className="text-iron-950 text-lg font-bold">
                            {summaryRange?.avgDurationMin && summaryRange.workoutCount
                                ? Math.round((summaryRange.totalVolume || 0) / (summaryRange.avgDurationMin * summaryRange.workoutCount))
                                : '—'}
                        </Text>
                        <Text className="text-iron-400 text-[10px]">kg/min</Text>
                    </View>
                </View>

                {(cardioSummary?.sessions || 0) > 0 && (
                    <View className="mt-4 pt-4 border-t border-iron-200">
                        <Text className="text-iron-950 font-bold text-sm mb-2">Cardio</Text>
                        <View className="flex-row justify-between">
                            <Text className="text-iron-600 text-xs">
                                {cardioSummary?.sessions} sesiones · {Math.round((cardioSummary?.totalDistanceMeters || 0) / 1000)}km
                            </Text>
                            <Text className="text-iron-600 text-xs">
                                {Math.round((cardioSummary?.totalTimeSeconds || 0) / 60)} min total
                            </Text>
                        </View>
                    </View>
                )}

                {(repsOnlySummary?.sessions || 0) > 0 && (
                    <View className="mt-4 pt-4 border-t border-iron-200">
                        <Text className="text-iron-950 font-bold text-sm mb-2">Peso Corporal</Text>
                        <Text className="text-iron-600 text-xs">
                            {repsOnlySummary?.sessions} sesiones · {repsOnlySummary?.totalReps} reps totales
                        </Text>
                    </View>
                )}

                {(weightOnlySummary?.sessions || 0) > 0 && (
                    <View className="mt-4 pt-4 border-t border-iron-200">
                        <Text className="text-iron-950 font-bold text-sm mb-2">Peso Extra</Text>
                        <Text className="text-iron-600 text-xs">
                            {weightOnlySummary?.sessions} sesiones · Max: {weightOnlySummary?.bestWeightKg} kg
                        </Text>
                    </View>
                )}
            </IronCard>

            <View className="mb-6">
                <GoalsWidget />
            </View>

            <View className="mb-8">
                <ConsistencyHeatmap timestamps={heatmapData} />
            </View>

            <View className="mb-8">
                <VolumeChart data={volumeSeries} bucket={bucket} />
            </View>

            <View>
                <Text className="text-lg text-primary font-bold mb-4">Distribución por Grupo Muscular</Text>
                {categoryVolume.map((c) => (
                    <View key={c.categoryId} className="flex-row items-center justify-between py-3 border-b border-iron-100">
                        <View className="flex-row items-center gap-3">
                            <View className="w-3 h-3 rounded-full" style={{ backgroundColor: c.categoryColor || Colors.iron[400] }} />
                            <Text className="text-iron-900 font-bold">{c.categoryName}</Text>
                        </View>
                        <View className="flex-row items-center gap-4">
                            <Text className="text-iron-500 text-xs">{c.setCount} series</Text>
                            <Text className="text-iron-950 font-black w-16 text-right">
                                {(c.volume / 1000).toFixed(1)}k <Text className="text-[10px] font-normal text-iron-400">VOL</Text>
                            </Text>
                        </View>
                    </View>
                ))}
            </View>

        </View>
    );
}
