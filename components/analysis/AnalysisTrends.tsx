import { IronCard } from '@/components/IronCard';
import { ExerciseVolumeRow, VolumeSeriesPoint } from '@/src/services/AnalysisService';
import { Colors } from '@/src/theme';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

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

    return (
        <View className="pb-8">
            <View className="flex-row gap-2 mb-6">
                {[7, 30, 90, 365].map((d) => (
                    <Pressable
                        key={d}
                        onPress={() => handleRangeChange(d as any)}
                        className={`px-3 py-2 rounded-full border ${rangeDays === d ? 'bg-surface border-primary' : 'bg-transparent border-iron-700'}`}
                    >
                        <Text className={`font-bold ${rangeDays === d ? 'text-primary' : 'text-iron-950'}`}>{d}D</Text>
                    </Pressable>
                ))}
            </View>

            <IronCard className="mb-6">
                <Text className="text-iron-950 font-bold text-lg mb-4">Tendencia de volumen</Text>
                <View className="flex-row items-center justify-between">
                    <Text className="text-iron-500 text-xs font-bold uppercase">Dirección</Text>
                    <Text className="text-iron-950 font-black text-xl">
                        {volumeTrend.slopePerPoint > 0.01 ? 'Subiendo 📈' : volumeTrend.slopePerPoint < -0.01 ? 'Bajando 📉' : 'Estable ➡️'}
                    </Text>
                </View>
                <View className="flex-row items-center justify-between mt-4">
                    <Text className="text-iron-500 text-xs font-bold uppercase">Cambio</Text>
                    <Text className={`font-black text-xl ${volumeTrend.changePct && volumeTrend.changePct > 0 ? 'text-green-600' : volumeTrend.changePct && volumeTrend.changePct < 0 ? 'text-red-600' : 'text-iron-950'}`}>
                        {volumeTrend.changePct == null ? '—' : `${volumeTrend.changePct >= 0 ? '+' : ''}${volumeTrend.changePct}%`}
                    </Text>
                </View>
                {volumeSeries.length < 2 && (
                    <Text className="text-iron-500 text-xs mt-4 italic">
                        Registra más entrenamientos para ver tu tendencia.
                    </Text>
                )}
            </IronCard>

            <View className="mb-8">
                <Text className="text-lg text-primary font-bold mb-4">Top ejercicios (volumen)</Text>
                {topExercisesByVolume.length === 0 ? (
                    <View className="bg-surface p-6 rounded-xl border border-iron-200 items-center border-dashed">
                        <Text className="text-iron-400 font-bold mb-1">Sin datos</Text>
                        <Text className="text-iron-300 text-xs text-center">
                            Completa entrenamientos para ver tus ejercicios más frecuentes.
                        </Text>
                    </View>
                ) : (
                    topExercisesByVolume.map((e) => (
                        <Pressable
                            key={e.exerciseId}
                            onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: e.exerciseId, exerciseName: e.exerciseName } } as any)}
                            className="bg-surface p-4 mb-3 rounded-xl border border-iron-700 elevation-1 active:bg-iron-200"
                        >
                            <View className="flex-row items-center justify-between">
                                <View className="flex-1 pr-3">
                                    <View className="flex-row items-center gap-2">
                                        <View className="w-2 h-2 rounded-full" style={{ backgroundColor: e.categoryColor || Colors.iron[500] }} />
                                        <Text className="text-iron-500 text-xs font-bold uppercase">{e.categoryName}</Text>
                                    </View>
                                    <Text className="text-iron-950 font-bold text-base mt-1">{e.exerciseName}</Text>
                                    <Text className="text-iron-500 text-xs font-bold mt-1">{e.setCount} series</Text>
                                </View>
                                <View>
                                    <Text className="text-iron-950 font-black text-lg text-right">
                                        {(e.volume / 1000).toFixed(1)}k
                                    </Text>
                                    <Text className="text-iron-500 text-[10px] text-right">VOL</Text>
                                </View>
                            </View>
                        </Pressable>
                    ))
                )}
            </View>
        </View>
    );
}
