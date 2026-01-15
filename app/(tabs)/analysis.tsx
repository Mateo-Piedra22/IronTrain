import { CalculatorsModal } from '@/components/CalculatorsModal';
import { ConsistencyHeatmap } from '@/components/ConsistencyHeatmap';
import { GoalsWidget } from '@/components/GoalsWidget';
import { IronCard } from '@/components/IronCard';
import { PRCenter } from '@/components/PRCenter';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { AnalysisService, CategoryVolumeRow, ExerciseVolumeRow, OneRMProgressRow, OneRepMax, VolumeSeriesPoint, WorkoutComparison, WorkoutStreak, WorkoutSummary } from '@/src/services/AnalysisService';
import { backupService } from '@/src/services/BackupService';
import { configService } from '@/src/services/ConfigService';
import { UnitService } from '@/src/services/UnitService';
import { workoutService } from '@/src/services/WorkoutService';
import { Colors } from '@/src/theme';
import { useFocusEffect, useRouter } from 'expo-router';
import { LucideCalculator, LucideDatabase, LucideSettings } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Pressable, ScrollView, Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

const screenWidth = Dimensions.get('window').width;

export default function AnalysisScreen() {
    const router = useRouter();
    const [unit, setUnit] = useState(configService.get('weightUnit'));
    const [volumeData, setVolumeData] = useState<{ value: number, label: string, frontColor: string }[]>([]);
    const [oneRepMaxes, setOneRepMaxes] = useState<OneRepMax[]>([]);
    const [heatmapData, setHeatmapData] = useState<number[]>([]);
    const [calcVisible, setCalcVisible] = useState(false);
    const [coreLoading, setCoreLoading] = useState(true);
    const [rangeLoading, setRangeLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<'overview' | 'trends' | 'records' | 'tools'>('overview');
    const [summary7, setSummary7] = useState<WorkoutSummary | null>(null);
    const [streak, setStreak] = useState<WorkoutStreak | null>(null);
    const [rangeDays, setRangeDays] = useState<7 | 30 | 90 | 365>(configService.get('analyticsDefaultRangeDays'));
    const [summaryRange, setSummaryRange] = useState<WorkoutSummary | null>(null);
    const [comparison, setComparison] = useState<WorkoutComparison | null>(null);
    const [volumeSeries, setVolumeSeries] = useState<VolumeSeriesPoint[]>([]);
    const [categoryVolume, setCategoryVolume] = useState<CategoryVolumeRow[]>([]);
    const [topExercisesByVolume, setTopExercisesByVolume] = useState<ExerciseVolumeRow[]>([]);
    const [top1RMProgress, setTop1RMProgress] = useState<OneRMProgressRow[]>([]);
    const coreRequestIdRef = useRef(0);
    const rangeRequestIdRef = useRef(0);
    const isLoading = coreLoading || rangeLoading;

    useFocusEffect(
        useCallback(() => {
            setUnit(configService.get('weightUnit'));
        }, [])
    );

    const displayWeight = useCallback((kgValue: number) => unit === 'kg' ? kgValue : UnitService.kgToLbs(kgValue), [unit]);
    const displayVolume = useCallback((kgVolume: number) => unit === 'kg' ? kgVolume : UnitService.kgToLbs(kgVolume), [unit]);

    const bucket = useMemo(() => {
        if (rangeDays <= 30) return 'day' as const;
        if (rangeDays <= 90) return 'week' as const;
        return 'month' as const;
    }, [rangeDays]);

    const uniqueDaysInRange = useMemo(() => {
        const now = Date.now();
        const cutoff = now - (rangeDays * 86400 * 1000);
        const set = new Set<number>();
        for (const ts of heatmapData) {
            if (ts <= cutoff) continue;
            const d = new Date(ts);
            const dayKey = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
            set.add(dayKey);
        }
        return set.size;
    }, [heatmapData, rangeDays]);

    const volumeTrend = useMemo(() => {
        if (volumeSeries.length < 2) {
            return {
                slopePerPoint: 0,
                first: 0,
                last: 0,
                changePct: null as number | null
            };
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

    const loadStats = useCallback(async () => {
        setCoreLoading(true);
        setError(null);
        const requestId = ++coreRequestIdRef.current;
        try {
            const [dates, st] = await Promise.all([
                workoutService.getCompletedWorkoutsLastYear(),
                AnalysisService.getWorkoutStreakLastYear(),
            ]);
            if (coreRequestIdRef.current !== requestId) return;
            setHeatmapData(dates);
            setStreak(st);
        } catch (e) {
            if (coreRequestIdRef.current !== requestId) return;
            console.error('Failed to load stats', e);
            setError('No se pudieron cargar tus analíticas.');
        } finally {
            if (coreRequestIdRef.current !== requestId) return;
            setCoreLoading(false);
        }
    }, []);

    const loadRangeStats = useCallback(async (days: 7 | 30 | 90 | 365, b: 'day' | 'week' | 'month') => {
        setRangeLoading(true);
        setError(null);
        const requestId = ++rangeRequestIdRef.current;
        try {
            const [s7, sRange, comp, series, cats, maxes, topExVol, rmProg] = await Promise.all([
                AnalysisService.getWorkoutSummary(7),
                AnalysisService.getWorkoutSummary(days),
                AnalysisService.getWorkoutComparison(days),
                AnalysisService.getVolumeSeries(days, b),
                AnalysisService.getCategoryVolume(days, 6),
                AnalysisService.getTop1RMs(days, 8),
                AnalysisService.getTopExercisesByVolume(days, 8),
                AnalysisService.getTop1RMProgress(days, 6),
            ]);
            if (rangeRequestIdRef.current !== requestId) return;

            setSummary7(s7);
            setSummaryRange(sRange);
            setComparison(comp);
            setVolumeSeries(series);
            setCategoryVolume(cats);
            setOneRepMaxes(maxes);
            setTopExercisesByVolume(topExVol);
            setTop1RMProgress(rmProg);

            setVolumeData(
                series.map((p) => ({
                    value: p.volume,
                    label: p.label,
                    frontColor: Colors.primary.DEFAULT
                }))
            );
        } catch (e) {
            if (rangeRequestIdRef.current !== requestId) return;
            console.error('Failed to load range stats', e);
            setError('No se pudieron cargar tus analíticas.');
        } finally {
            if (rangeRequestIdRef.current !== requestId) return;
            setRangeLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadStats();
            loadRangeStats(rangeDays, bucket);
        }, [loadStats, loadRangeStats, rangeDays, bucket])
    );

    return (
        <SafeAreaWrapper className="flex-1 bg-iron-900" edges={['left', 'right']}>
            <ScrollView className="px-4 mt-2" contentContainerStyle={{ paddingBottom: 120 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 px-4 mb-4">
                    <View className="flex-row gap-2">
                        <Pressable
                            onPress={() => setTab('overview')}
                            className={`px-4 py-2 rounded-full border ${tab === 'overview' ? 'bg-surface border-primary' : 'bg-transparent border-iron-700'}`}
                            accessibilityRole="button"
                            accessibilityLabel="Ver resumen"
                        >
                            <Text className={`font-bold ${tab === 'overview' ? 'text-primary' : 'text-iron-950'}`}>Resumen</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setTab('trends')}
                            className={`px-4 py-2 rounded-full border ${tab === 'trends' ? 'bg-surface border-primary' : 'bg-transparent border-iron-700'}`}
                            accessibilityRole="button"
                            accessibilityLabel="Ver tendencias"
                        >
                            <Text className={`font-bold ${tab === 'trends' ? 'text-primary' : 'text-iron-950'}`}>Tendencias</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setTab('records')}
                            className={`px-4 py-2 rounded-full border ${tab === 'records' ? 'bg-surface border-primary' : 'bg-transparent border-iron-700'}`}
                            accessibilityRole="button"
                            accessibilityLabel="Ver récords"
                        >
                            <Text className={`font-bold ${tab === 'records' ? 'text-primary' : 'text-iron-950'}`}>Récords</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setTab('tools')}
                            className={`px-4 py-2 rounded-full border ${tab === 'tools' ? 'bg-surface border-primary' : 'bg-transparent border-iron-700'}`}
                            accessibilityRole="button"
                            accessibilityLabel="Ver herramientas"
                        >
                            <Text className={`font-bold ${tab === 'tools' ? 'text-primary' : 'text-iron-950'}`}>Herramientas</Text>
                        </Pressable>
                    </View>
                </ScrollView>

                {isLoading ? (
                    <View className="items-center justify-center py-20">
                        <ActivityIndicator size="large" color={Colors.primary.DEFAULT} />
                        <Text className="text-iron-500 mt-4">Cargando analíticas...</Text>
                    </View>
                ) : error ? (
                    <IronCard className="mb-6">
                        <Text className="text-iron-950 font-bold text-lg mb-2">No se pudo cargar</Text>
                        <Text className="text-iron-500 mb-4">{error}</Text>
                        <Pressable
                            onPress={loadStats}
                            className="bg-primary px-4 py-3 rounded-xl items-center"
                            accessibilityRole="button"
                            accessibilityLabel="Reintentar cargar analíticas"
                        >
                            <Text className="text-white font-bold">Reintentar</Text>
                        </Pressable>
                    </IronCard>
                ) : tab === 'overview' ? (
                    <View>
                        <View className="flex-row gap-2 mb-4">
                            {[7, 30, 90, 365].map((d) => (
                                <Pressable
                                    key={d}
                                    onPress={() => {
                                        const next = d as 7 | 30 | 90 | 365;
                                        setRangeDays(next);
                                        configService.set('analyticsDefaultRangeDays', next);
                                        const nextBucket = next <= 30 ? 'day' : next <= 90 ? 'week' : 'month';
                                        loadRangeStats(next, nextBucket);
                                    }}
                                    className={`px-3 py-2 rounded-full border ${rangeDays === d ? 'bg-surface border-primary' : 'bg-transparent border-iron-700'}`}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Cambiar rango a ${d} días`}
                                >
                                    <Text className={`font-bold ${rangeDays === d ? 'text-primary' : 'text-iron-950'}`}>{d}D</Text>
                                </Pressable>
                            ))}
                        </View>

                        <View className="flex-row gap-3 mb-6">
                            <View className="flex-1">
                                <IronCard>
                                    <Text className="text-iron-500 text-xs font-bold uppercase">7 días</Text>
                                    <Text className="text-iron-950 text-2xl font-black mt-1">{summary7?.workoutCount ?? 0}</Text>
                                    <Text className="text-iron-500 text-xs font-bold">entrenamientos</Text>
                                </IronCard>
                            </View>
                            <View className="flex-1">
                                <IronCard>
                                    <Text className="text-iron-500 text-xs font-bold uppercase">Racha</Text>
                                    <Text className="text-iron-950 text-2xl font-black mt-1">{streak?.current ?? 0}</Text>
                                    <Text className="text-iron-500 text-xs font-bold">mejor: {streak?.best ?? 0}</Text>
                                </IronCard>
                            </View>
                        </View>

                        <IronCard className="mb-6">
                            <Text className="text-iron-950 font-bold text-lg mb-4">Insights ({rangeDays} días)</Text>
                            <View className="flex-row gap-3">
                                <View className="flex-1">
                                    <Text className="text-iron-500 text-xs font-bold uppercase">Entrenamientos</Text>
                                    <Text className="text-iron-950 text-2xl font-black mt-1">{summaryRange?.workoutCount ?? 0}</Text>
                                    {comparison?.workoutChangePct != null && (
                                        <Text className="text-iron-500 text-xs font-bold mt-1">{comparison.workoutChangePct >= 0 ? '+' : ''}{comparison.workoutChangePct}% vs prev.</Text>
                                    )}
                                </View>
                                <View className="flex-1">
                                    <Text className="text-iron-500 text-xs font-bold uppercase">Volumen</Text>
                                    <Text className="text-iron-950 text-2xl font-black mt-1">{summaryRange?.totalVolume ?? 0}</Text>
                                    {comparison?.volumeChangePct != null && (
                                        <Text className="text-iron-500 text-xs font-bold mt-1">{comparison.volumeChangePct >= 0 ? '+' : ''}{comparison.volumeChangePct}% vs prev.</Text>
                                    )}
                                </View>
                            </View>
                            <View className="h-[1px] bg-iron-700 my-4" />
                            <View className="flex-row gap-3">
                                <View className="flex-1">
                                    <Text className="text-iron-500 text-xs font-bold uppercase">Prom. volumen</Text>
                                    <Text className="text-iron-950 text-xl font-black mt-1">
                                        {summaryRange?.workoutCount ? Math.round((summaryRange.totalVolume || 0) / summaryRange.workoutCount) : 0}
                                    </Text>
                                    <Text className="text-iron-500 text-xs font-bold">por entreno</Text>
                                </View>
                                <View className="flex-1">
                                    <Text className="text-iron-500 text-xs font-bold uppercase">Consistencia</Text>
                                    <Text className="text-iron-950 text-xl font-black mt-1">
                                        {rangeDays ? Math.round((uniqueDaysInRange / rangeDays) * 100) : 0}%
                                    </Text>
                                    <Text className="text-iron-500 text-xs font-bold">{uniqueDaysInRange} días activos</Text>
                                </View>
                            </View>
                            <View className="h-[1px] bg-iron-700 my-4" />
                            <View className="flex-row gap-3">
                                <View className="flex-1">
                                    <Text className="text-iron-500 text-xs font-bold uppercase">Duración prom.</Text>
                                    <Text className="text-iron-950 text-xl font-black mt-1">
                                        {summaryRange?.avgDurationMin != null ? Math.round(summaryRange.avgDurationMin) : '—'}
                                    </Text>
                                    <Text className="text-iron-500 text-xs font-bold">min</Text>
                                </View>
                                <View className="flex-1">
                                    <Text className="text-iron-500 text-xs font-bold uppercase">Densidad</Text>
                                    <Text className="text-iron-950 text-xl font-black mt-1">
                                        {summaryRange?.avgDurationMin && summaryRange.workoutCount
                                            ? Math.round((summaryRange.totalVolume || 0) / (summaryRange.avgDurationMin * summaryRange.workoutCount))
                                            : '—'}
                                    </Text>
                                    <Text className="text-iron-500 text-xs font-bold">vol/min</Text>
                                </View>
                            </View>
                        </IronCard>

                        <GoalsWidget />

                        <View className="mb-8">
                            <Text className="text-lg text-primary font-bold mb-4">Consistencia</Text>
                            <ConsistencyHeatmap timestamps={heatmapData} />
                        </View>

                        <View className="mb-8">
                            <Text className="text-lg text-primary font-bold mb-4">
                                Volumen ({rangeDays} días) {bucket === 'day' ? '' : bucket === 'week' ? '· semanal' : '· mensual'}
                            </Text>
                            <View className="bg-surface p-4 rounded-xl border border-iron-700 items-center elevation-1">
                                {volumeData.length > 0 ? (
                                    <BarChart
                                        data={volumeData}
                                        barWidth={bucket === 'day' ? 18 : 26}
                                        noOfSections={3}
                                        barBorderRadius={4}
                                        frontColor={Colors.primary.DEFAULT}
                                        yAxisThickness={0}
                                        xAxisThickness={0}
                                        yAxisTextStyle={{ color: Colors.iron[500] }}
                                        xAxisLabelTextStyle={{ color: Colors.iron[500] }}
                                        width={screenWidth - 64}
                                        height={200}
                                        initialSpacing={0}
                                        endSpacing={0}
                                        isAnimated
                                    />
                                ) : (
                                    <Text className="text-iron-500 py-8">Aún no hay volumen para mostrar.</Text>
                                )}
                            </View>
                            {volumeSeries.length > 0 && (
                                <Text className="text-iron-500 text-xs mt-3">
                                    Puntos: <Text className="text-iron-950 font-bold">{volumeSeries.length}</Text>
                                </Text>
                            )}
                        </View>

                        <View className="mb-8">
                            <Text className="text-lg text-primary font-bold mb-4">Top categorías (volumen)</Text>
                            {categoryVolume.length > 0 ? (
                                <View className="gap-3">
                                    {categoryVolume.map((c) => (
                                        <View
                                            key={c.categoryId}
                                            className="bg-surface p-4 rounded-xl border border-iron-700 elevation-1 flex-row items-center justify-between"
                                        >
                                            <View className="flex-row items-center gap-3 flex-1 pr-3">
                                                <View className="w-3 h-3 rounded-full" style={{ backgroundColor: c.categoryColor || Colors.iron[500] }} />
                                                <View className="flex-1">
                                                    <Text className="text-iron-950 font-bold">{c.categoryName}</Text>
                                                    <Text className="text-iron-500 text-xs font-bold">{c.setCount} series</Text>
                                                </View>
                                            </View>
                                            <View>
                                                <Text className="text-iron-950 font-black text-lg text-right">{c.volume}</Text>
                                                <Text className="text-iron-500 text-[10px] text-right">VOL</Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <Text className="text-iron-500">Aún no hay suficiente historial.</Text>
                            )}
                        </View>
                    </View>
                ) : tab === 'trends' ? (
                    <View>
                        <View className="flex-row gap-2 mb-4">
                            {[7, 30, 90, 365].map((d) => (
                                <Pressable
                                    key={d}
                                    onPress={() => {
                                        const next = d as 7 | 30 | 90 | 365;
                                        setRangeDays(next);
                                        configService.set('analyticsDefaultRangeDays', next);
                                        const nextBucket = next <= 30 ? 'day' : next <= 90 ? 'week' : 'month';
                                        loadRangeStats(next, nextBucket);
                                    }}
                                    className={`px-3 py-2 rounded-full border ${rangeDays === d ? 'bg-surface border-primary' : 'bg-transparent border-iron-700'}`}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Cambiar rango a ${d} días`}
                                >
                                    <Text className={`font-bold ${rangeDays === d ? 'text-primary' : 'text-iron-950'}`}>{d}D</Text>
                                </Pressable>
                            ))}
                        </View>

                        <IronCard className="mb-6">
                            <Text className="text-iron-950 font-bold text-lg mb-4">Tendencia de volumen</Text>
                            {volumeSeries.length < 2 ? (
                                <Text className="text-iron-500">Aún no hay suficientes datos para estimar una tendencia.</Text>
                            ) : (
                                <View>
                                    <View className="flex-row items-center justify-between">
                                        <Text className="text-iron-500 text-xs font-bold uppercase">Dirección</Text>
                                        <Text className="text-iron-950 font-black">
                                            {volumeTrend.slopePerPoint > 0.01 ? 'Subiendo' : volumeTrend.slopePerPoint < -0.01 ? 'Bajando' : 'Estable'}
                                        </Text>
                                    </View>
                                    <View className="h-[1px] bg-iron-700 my-4" />
                                    <View className="flex-row items-center justify-between">
                                        <Text className="text-iron-500 text-xs font-bold uppercase">Cambio</Text>
                                        <Text className="text-iron-950 font-black">
                                            {volumeTrend.changePct == null ? '—' : `${volumeTrend.changePct >= 0 ? '+' : ''}${volumeTrend.changePct}%`}
                                        </Text>
                                    </View>
                                    <Text className="text-iron-500 text-xs mt-2">
                                        Basado en {volumeSeries.length} puntos ({bucket === 'day' ? 'día' : bucket === 'week' ? 'semana' : 'mes'}).
                                    </Text>
                                </View>
                            )}
                        </IronCard>

                        <IronCard className="mb-6">
                            <Text className="text-iron-950 font-bold text-lg mb-4">Alertas</Text>
                            {comparison?.volumeChangePct != null && comparison.volumeChangePct <= -20 ? (
                                <Text className="text-iron-950">
                                    Tu volumen bajó <Text className="font-black">{Math.abs(comparison.volumeChangePct)}%</Text> vs el periodo anterior.
                                    Si fue intencional (deload), perfecto; si no, revisa sueño, cargas o frecuencia.
                                </Text>
                            ) : comparison?.workoutChangePct != null && comparison.workoutChangePct <= -20 ? (
                                <Text className="text-iron-950">
                                    Entrenaste menos (<Text className="font-black">{Math.abs(comparison.workoutChangePct)}%</Text> vs periodo anterior). Un objetivo simple: +1 sesión esta semana.
                                </Text>
                            ) : (
                                <Text className="text-iron-500">Sin alertas importantes en este rango.</Text>
                            )}
                        </IronCard>

                        <View className="mb-8">
                            <Text className="text-lg text-primary font-bold mb-4">Top ejercicios (volumen)</Text>
                            {topExercisesByVolume.length > 0 ? (
                                <View className="gap-3">
                                    {topExercisesByVolume.map((e) => (
                                        <Pressable
                                            key={e.exerciseId}
                                            onPress={() =>
                                                router.push({
                                                    pathname: '/exercise/[id]' as any,
                                                    params: { id: e.exerciseId, exerciseId: e.exerciseId, exerciseName: e.exerciseName }
                                                })
                                            }
                                            className="bg-surface p-4 rounded-xl border border-iron-700 elevation-1 active:bg-iron-200"
                                            accessibilityRole="button"
                                            accessibilityLabel={`Abrir ejercicio ${e.exerciseName}`}
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
                                                    <Text className="text-iron-950 font-black text-lg text-right">{Math.round(displayVolume(e.volume))}</Text>
                                                    <Text className="text-iron-500 text-[10px] text-right">VOL</Text>
                                                </View>
                                            </View>
                                        </Pressable>
                                    ))}
                                </View>
                            ) : (
                                <Text className="text-iron-500">Aún no hay suficiente historial.</Text>
                            )}
                        </View>

                        <View className="mb-8">
                            <Text className="text-lg text-primary font-bold mb-4">Mejoras (1RM estimado)</Text>
                            {top1RMProgress.length > 0 ? (
                                <View className="gap-3">
                                    {top1RMProgress.map((p) => (
                                        <Pressable
                                            key={p.exerciseId}
                                            onPress={() =>
                                                router.push({
                                                    pathname: '/exercise/[id]' as any,
                                                    params: { id: p.exerciseId, exerciseId: p.exerciseId, exerciseName: p.exerciseName }
                                                })
                                            }
                                            className="bg-surface p-4 rounded-xl border border-iron-700 elevation-1 active:bg-iron-200"
                                            accessibilityRole="button"
                                            accessibilityLabel={`Abrir progreso de ${p.exerciseName}`}
                                        >
                                            <View className="flex-row items-center justify-between">
                                                <View className="flex-1 pr-3">
                                                    <Text className="text-iron-950 font-bold text-base">{p.exerciseName}</Text>
                                                    <Text className="text-iron-500 text-xs font-bold mt-1">
                                                        {Math.round(displayWeight(p.start1RM) * 100) / 100} → {Math.round(displayWeight(p.end1RM) * 100) / 100} {unit}
                                                    </Text>
                                                </View>
                                                <View>
                                                    <Text className="text-primary font-black text-lg text-right">+{Math.round(displayWeight(p.delta) * 100) / 100}</Text>
                                                    <Text className="text-iron-500 text-[10px] text-right">{p.deltaPct == null ? unit.toUpperCase() : `+${p.deltaPct}%`}</Text>
                                                </View>
                                            </View>
                                        </Pressable>
                                    ))}
                                </View>
                            ) : (
                                <Text className="text-iron-500">Aún no hay suficientes datos para medir progreso en este rango.</Text>
                            )}
                        </View>
                    </View>
                ) : tab === 'records' ? (
                    <View>
                        <View className="flex-row gap-2 mb-4">
                            {[7, 30, 90, 365].map((d) => (
                                <Pressable
                                    key={d}
                                    onPress={() => {
                                        const next = d as 7 | 30 | 90 | 365;
                                        setRangeDays(next);
                                        configService.set('analyticsDefaultRangeDays', next);
                                        const nextBucket = next <= 30 ? 'day' : next <= 90 ? 'week' : 'month';
                                        loadRangeStats(next, nextBucket);
                                    }}
                                    className={`px-3 py-2 rounded-full border ${rangeDays === d ? 'bg-surface border-primary' : 'bg-transparent border-iron-700'}`}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Cambiar rango a ${d} días`}
                                >
                                    <Text className={`font-bold ${rangeDays === d ? 'text-primary' : 'text-iron-950'}`}>{d}D</Text>
                                </Pressable>
                            ))}
                        </View>

                        <PRCenter />

                        <View className="mb-8">
                            <Text className="text-lg text-primary font-bold mb-4">Est. 1RM (Top · {rangeDays} días)</Text>
                            {oneRepMaxes.length > 0 ? (
                                <View className="gap-3">
                                    {oneRepMaxes.map((orm) => (
                                        <Pressable
                                            key={orm.exerciseId}
                                            onPress={() =>
                                                router.push({
                                                    pathname: '/exercise/[id]' as any,
                                                    params: { id: orm.exerciseId, exerciseId: orm.exerciseId, exerciseName: orm.exerciseName }
                                                })
                                            }
                                            className="bg-surface p-4 rounded-xl border border-iron-700 flex-row justify-between items-center elevation-1 active:bg-iron-200"
                                            accessibilityRole="button"
                                            accessibilityLabel={`Abrir analíticas de ${orm.exerciseName}`}
                                        >
                                            <View className="flex-1 pr-3">
                                                <Text className="text-iron-950 font-bold text-base">{orm.exerciseName}</Text>
                                                <Text className="text-iron-500 text-xs font-bold">{Math.round(displayWeight(orm.weight) * 100) / 100}{unit} × {orm.reps}</Text>
                                            </View>
                                            <View>
                                                <Text className="text-primary text-xl font-black text-right">{Math.round(displayWeight(orm.estimated1RM) * 100) / 100}</Text>
                                                <Text className="text-iron-500 text-[10px] text-right">{unit.toUpperCase()}</Text>
                                            </View>
                                        </Pressable>
                                    ))}
                                </View>
                            ) : (
                                <Text className="text-iron-500">Registra series pesadas para ver estimaciones.</Text>
                            )}
                        </View>
                    </View>
                ) : (
                    <View>
                        <Text className="text-lg text-primary font-bold mb-4">Herramientas y ajustes</Text>
                        <View className="gap-4 mb-8">
                            <Pressable
                                onPress={() => setCalcVisible(true)}
                                className="bg-surface p-4 rounded-xl border border-iron-700 flex-row items-center gap-3 elevation-1 active:bg-iron-200"
                                accessibilityRole="button"
                                accessibilityLabel="Abrir calculadoras"
                            >
                                <LucideCalculator size={24} color={Colors.primary.dark} />
                                <Text className="text-iron-950 font-bold flex-1">Calculadoras (1RM y potencia)</Text>
                            </Pressable>

                            <Pressable
                                onPress={() => router.push('/tools/plate-calculator' as any)}
                                className="bg-surface p-4 rounded-xl border border-iron-700 flex-row items-center gap-3 elevation-1 active:bg-iron-200"
                                accessibilityRole="button"
                                accessibilityLabel="Abrir calculadora de discos"
                            >
                                <LucideCalculator size={24} color={Colors.primary.dark} />
                                <Text className="text-iron-950 font-bold flex-1">Calculadora de discos</Text>
                            </Pressable>

                            <Pressable
                                onPress={() => {
                                    Alert.alert(
                                        'Tus datos',
                                        'Exporta o restaura tu backup.',
                                        [
                                            {
                                                text: 'Exportar backup (JSON)',
                                                onPress: async () => {
                                                    try {
                                                        await backupService.exportData();
                                                    } catch (e) {
                                                        Alert.alert('Error', 'Falló la exportación.');
                                                    }
                                                }
                                            },
                                            {
                                                text: 'Restaurar backup (JSON)',
                                                style: 'destructive',
                                                onPress: async () => {
                                                    try {
                                                        const success = await backupService.importData({ mode: 'overwrite' });
                                                        if (success) Alert.alert('Listo', 'Datos restaurados. Reinicia la app.');
                                                    } catch (e) {
                                                        Alert.alert('Error', 'Falló la restauración.');
                                                    }
                                                }
                                            },
                                            { text: 'Cancelar', style: 'cancel' }
                                        ]
                                    );
                                }}
                                className="bg-surface p-4 rounded-xl border border-iron-700 flex-row items-center gap-3 active:bg-iron-200 elevation-1"
                                accessibilityRole="button"
                                accessibilityLabel="Gestionar datos"
                            >
                                <LucideDatabase size={24} color={Colors.primary.dark} />
                                <Text className="text-iron-950 font-bold flex-1">Gestión de datos</Text>
                            </Pressable>

                            <Pressable
                                onPress={() => router.push('/settings' as any)}
                                className="bg-surface p-4 rounded-xl border border-iron-700 flex-row items-center gap-3 elevation-1 active:bg-iron-200"
                                accessibilityRole="button"
                                accessibilityLabel="Abrir ajustes"
                            >
                                <LucideSettings size={24} color={Colors.primary.dark} />
                                <Text className="text-iron-950 font-bold flex-1">Ajustes</Text>
                            </Pressable>
                        </View>
                    </View>
                )}
            </ScrollView>

            <CalculatorsModal visible={calcVisible} onClose={() => setCalcVisible(false)} />
        </SafeAreaWrapper>
    );
}
