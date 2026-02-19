import { AnalysisOverview } from '@/components/analysis/AnalysisOverview';
import { AnalysisRecords } from '@/components/analysis/AnalysisRecords';
import { AnalysisTools } from '@/components/analysis/AnalysisTools';
import { AnalysisTrends } from '@/components/analysis/AnalysisTrends';
import { CalculatorsModal } from '@/components/CalculatorsModal';
import { IronCard } from '@/components/IronCard';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { AnalysisService, CardioSummary, CategoryVolumeRow, ExerciseVolumeRow, OneRMProgressRow, OneRepMax, RepsOnlySummary, VolumeSeriesPoint, WeightOnlySummary, WorkoutComparison, WorkoutStreak, WorkoutSummary } from '@/src/services/AnalysisService';
import { configService } from '@/src/services/ConfigService';
import { UnitService } from '@/src/services/UnitService';
import { workoutService } from '@/src/services/WorkoutService';
import { Colors } from '@/src/theme';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

interface RangeAnalysisState {
    summary7: WorkoutSummary | null;
    summaryRange: WorkoutSummary | null;
    comparison: WorkoutComparison | null;
    volumeSeries: VolumeSeriesPoint[];
    cardioSummary: CardioSummary | null;
    repsOnlySummary: RepsOnlySummary | null;
    weightOnlySummary: WeightOnlySummary | null;
    categoryVolume: CategoryVolumeRow[];
    oneRepMaxes: OneRepMax[];
    topExercisesByVolume: ExerciseVolumeRow[];
    top1RMProgress: OneRMProgressRow[];
}

interface CoreAnalysisState {
    heatmapData: number[];
    streak: WorkoutStreak | null;
}

const INITIAL_RANGE_STATE: RangeAnalysisState = {
    summary7: null,
    summaryRange: null,
    comparison: null,
    volumeSeries: [],
    cardioSummary: null,
    repsOnlySummary: null,
    weightOnlySummary: null,
    categoryVolume: [],
    oneRepMaxes: [],
    topExercisesByVolume: [],
    top1RMProgress: [],
};

export default function AnalysisScreen() {
    const [unit, setUnit] = useState(configService.get('weightUnit'));
    const [calcVisible, setCalcVisible] = useState(false);
    const [calcTab, setCalcTab] = useState<'oneRm' | 'warmup' | 'plates' | 'power'>('oneRm');
    const [coreLoading, setCoreLoading] = useState(true);
    const [rangeLoading, setRangeLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<'overview' | 'trends' | 'records' | 'tools'>('overview');

    // Combined State to prevent waterfall renders
    const [coreData, setCoreData] = useState<CoreAnalysisState>({ heatmapData: [], streak: null });
    const [rangeData, setRangeData] = useState<RangeAnalysisState>(INITIAL_RANGE_STATE);

    const [rangeDays, setRangeDays] = useState<7 | 30 | 90 | 365>(configService.get('analyticsDefaultRangeDays'));

    const coreRequestIdRef = useRef(0);
    const rangeRequestIdRef = useRef(0);
    const isLoading = coreLoading || rangeLoading;

    useFocusEffect(
        useCallback(() => {
            setUnit(configService.get('weightUnit'));
        }, [])
    );

    const displayWeight = useCallback((kgValue: number) => unit === 'kg' ? kgValue : UnitService.kgToLbs(kgValue), [unit]);

    const bucket = useMemo(() => {
        if (rangeDays <= 30) return 'day' as const;
        if (rangeDays <= 90) return 'week' as const;
        return 'month' as const;
    }, [rangeDays]);

    // Memoize the mapped series to avoid prop churn
    const mappedVolumeSeries = useMemo(() => {
        return rangeData.volumeSeries.map(p => ({
            value: p.volume,
            label: p.label,
            dateMs: p.dateMs
        }));
    }, [rangeData.volumeSeries]);

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

            setCoreData({
                heatmapData: dates,
                streak: st
            });
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
            const [s7, sRange, comp, series, cardio, repsOnly, weightOnly, cats, maxes, topExVol, rmProg] = await Promise.all([
                AnalysisService.getWorkoutSummary(7),
                AnalysisService.getWorkoutSummary(days),
                AnalysisService.getWorkoutComparison(days),
                AnalysisService.getVolumeSeries(days, b),
                AnalysisService.getCardioSummary(days),
                AnalysisService.getRepsOnlySummary(days),
                AnalysisService.getWeightOnlySummary(days),
                AnalysisService.getCategoryVolume(days, 6),
                AnalysisService.getTop1RMs(days, 8),
                AnalysisService.getTopExercisesByVolume(days, 8),
                AnalysisService.getTop1RMProgress(days, 6),
            ]);
            if (rangeRequestIdRef.current !== requestId) return;

            setRangeData({
                summary7: s7,
                summaryRange: sRange,
                comparison: comp,
                volumeSeries: series,
                cardioSummary: cardio,
                repsOnlySummary: repsOnly,
                weightOnlySummary: weightOnly,
                categoryVolume: cats,
                oneRepMaxes: maxes,
                topExercisesByVolume: topExVol,
                top1RMProgress: rmProg
            });

        } catch (e) {
            if (rangeRequestIdRef.current !== requestId) return;
            console.error('Failed to load range stats', e);
            setError('No se pudieron cargar tus analíticas.');
        } finally {
            if (rangeRequestIdRef.current !== requestId) return;
            setRangeLoading(false);
        }
    }, []);

    const handleRangeChange = useCallback((d: 7 | 30 | 90 | 365) => {
        setRangeDays(d);
        configService.set('analyticsDefaultRangeDays', d);
        const nextBucket = d <= 30 ? 'day' : d <= 90 ? 'week' : 'month';
        loadRangeStats(d, nextBucket);
    }, [loadRangeStats]);

    useFocusEffect(
        useCallback(() => {
            loadStats();
            loadRangeStats(rangeDays, bucket);
        }, [loadStats, loadRangeStats, rangeDays, bucket])
    );

    return (
        <SafeAreaWrapper className="flex-1 bg-iron-900" edges={['top', 'left', 'right']}>
            <View className="flex-1 px-4 mt-2">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 px-4 mb-4" contentContainerStyle={{ paddingRight: 20 }}>
                    <View className="flex-row gap-2 items-center">
                        {[
                            { key: 'overview', label: 'Resumen' },
                            { key: 'trends', label: 'Tendencias' },
                            { key: 'records', label: 'Récords' },
                            { key: 'tools', label: 'Herramientas' },
                        ].map((t) => (
                            <Pressable
                                key={t.key}
                                onPress={() => setTab(t.key as any)}
                                className={`px-4 py-2 rounded-full border ${tab === t.key ? 'bg-primary border-primary' : 'bg-iron-200 border-iron-300'}`}
                            >
                                <Text className={`font-bold ${tab === t.key ? 'text-white' : 'text-iron-600'}`}>{t.label}</Text>
                            </Pressable>
                        ))}
                    </View>
                </ScrollView>

                <ScrollView contentContainerStyle={{ paddingBottom: 100, flexGrow: 1, justifyContent: 'flex-start' }} showsVerticalScrollIndicator={false}>
                    {isLoading && !rangeData.summary7 ? (
                        <View className="flex-1 justify-center items-center py-20 pb-0">
                            <ActivityIndicator size="large" color={Colors.primary.DEFAULT} />
                            <Text className="text-iron-500 mt-4 font-bold">Analizando datos...</Text>
                        </View>
                    ) : error ? (
                        <IronCard className="mb-6 border-red-900/50 bg-red-900/10">
                            <Text className="text-red-400 font-bold text-lg mb-2">Error de carga</Text>
                            <Text className="text-iron-400 mb-4">{error}</Text>
                            <Pressable onPress={loadStats} className="bg-red-900/40 px-4 py-2 rounded-lg items-center self-start">
                                <Text className="text-red-200 font-bold">Reintentar</Text>
                            </Pressable>
                        </IronCard>
                    ) : (
                        <>
                            {tab === 'overview' && (
                                <AnalysisOverview
                                    rangeDays={rangeDays}
                                    setRangeDays={handleRangeChange}
                                    summary7={rangeData.summary7}
                                    streak={coreData.streak}
                                    summaryRange={rangeData.summaryRange}
                                    comparison={rangeData.comparison}
                                    heatmapData={coreData.heatmapData}
                                    volumeSeries={mappedVolumeSeries}
                                    bucket={bucket}
                                    categoryVolume={rangeData.categoryVolume}
                                    cardioSummary={rangeData.cardioSummary}
                                    repsOnlySummary={rangeData.repsOnlySummary}
                                    weightOnlySummary={rangeData.weightOnlySummary}
                                    unit={unit}
                                    displayWeight={displayWeight}
                                />
                            )}

                            {tab === 'trends' && (
                                <AnalysisTrends
                                    volumeSeries={rangeData.volumeSeries}
                                    topExercisesByVolume={rangeData.topExercisesByVolume}
                                    rangeDays={rangeDays}
                                    handleRangeChange={handleRangeChange}
                                />
                            )}

                            {tab === 'records' && (
                                <AnalysisRecords
                                    oneRepMaxes={rangeData.oneRepMaxes}
                                    rangeDays={rangeDays}
                                />
                            )}

                            {tab === 'tools' && (
                                <AnalysisTools setCalcVisible={(v, t) => {
                                    if (t) setCalcTab(t);
                                    setCalcVisible(v);
                                }} />
                            )}
                        </>
                    )}
                </ScrollView>
            </View>
            <CalculatorsModal visible={calcVisible} onClose={() => setCalcVisible(false)} initialTab={calcTab} />
        </SafeAreaWrapper>
    );
}
