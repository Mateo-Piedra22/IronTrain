import { ExerciseFormModal } from '@/components/ExerciseFormModal';
import { IronButton } from '@/components/IronButton';
import { IronCard } from '@/components/IronCard';
import { SetRow } from '@/components/SetRow';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { WarmupCalculatorModal } from '@/components/WarmupCalculatorModal';
import { CalculatorService } from '@/src/services/CalculatorService';
import { configService } from '@/src/services/ConfigService';
import { dbService } from '@/src/services/DatabaseService';
import { UnitService } from '@/src/services/UnitService';
import { workoutService } from '@/src/services/WorkoutService';
import { useTimerStore } from '@/src/store/timerStore';
import { Colors } from '@/src/theme';
import { Exercise, WorkoutSet } from '@/src/types/db';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Info, Pencil, Timer, Zap } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Dimensions, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';

type Tab = 'track' | 'history' | 'analysis';
type AnalysisTab = 'overview' | 'prs' | 'tools';
type HistoryTab = 'sessions' | 'sets';
type SetsSort = 'recent' | 'weight' | 'orm' | 'volume';

export default function ExerciseDetailScreen() {
    const { workoutId, exerciseId, exerciseName } = useLocalSearchParams<{ workoutId: string, exerciseId: string, exerciseName: string }>();
    const router = useRouter();
    const [unit, setUnit] = useState(configService.get('weightUnit'));
    const displayWeight = (kgValue: number) => unit === 'kg' ? kgValue : UnitService.kgToLbs(kgValue);
    const toKg = (displayValue: number) => unit === 'kg' ? displayValue : UnitService.lbsToKg(displayValue);

    const [sets, setSets] = useState<WorkoutSet[]>([]);
    const [history, setHistory] = useState<{ date: number; sets: WorkoutSet[] }[]>([]);
    const [activeTab, setActiveTab] = useState<Tab>(workoutId ? 'track' : 'history');
    const [analysisTab, setAnalysisTab] = useState<AnalysisTab>('overview');
    const [historyRangeDays, setHistoryRangeDays] = useState<30 | 90 | 365>(90);
    const [historyTab, setHistoryTab] = useState<HistoryTab>('sessions');
    const [setsSort, setSetsSort] = useState<SetsSort>('recent');

    const [workoutLocked, setWorkoutLocked] = useState(false);

    const [loading, setLoading] = useState(true);
    const [warmupVisible, setWarmupVisible] = useState(false);
    const [notes, setNotes] = useState<string | null>(null);

    // Config Modal
    const [isConfigVisible, setIsConfigVisible] = useState(false);
    const [currentExercise, setCurrentExercise] = useState<Exercise | null>(null);

    const screenWidth = Dimensions.get('window').width;

    useFocusEffect(
        useCallback(() => {
            setUnit(configService.get('weightUnit'));
        }, [])
    );

    useEffect(() => {
        loadData();
    }, [workoutId, exerciseId, historyRangeDays]);

    // Added specific effect to refresh history when entering the tab
    useEffect(() => {
        if (activeTab === 'analysis') {
            setAnalysisTab('overview');
        }
    }, [activeTab]);

    const loadTrackData = async () => {
        if (!workoutId) return;
        try {
            const workout = await dbService.getWorkoutById(workoutId);
            const locked = workout?.status === 'completed';
            setWorkoutLocked(locked);
            if (locked && activeTab === 'track') {
                setActiveTab('history');
            }

            const allSets = await workoutService.getSets(workoutId);
            const exSets = allSets.filter(s => s.exercise_id === exerciseId);
            setSets(exSets);
        } catch (e) {
            console.error(e);
        }
    };

    const loadHistoryData = async () => {
        try {
            const hist = await workoutService.getExerciseHistory(exerciseId, 60, historyRangeDays);
            setHistory(hist);
            // Also load exercise details if needed
            const exerciseDetails = await workoutService.getExercise(exerciseId);
            setNotes(exerciseDetails?.notes || null);
            setCurrentExercise(exerciseDetails || null);
        } catch (e) {
            console.error(e);
        }
    };

    const loadData = async () => {
        setLoading(true);
        await Promise.all([loadTrackData(), loadHistoryData()]);
        setLoading(false);
    };

    const handleUpdateSet = async (setId: string, updates: Partial<WorkoutSet>) => {
        if (workoutLocked) {
            Alert.alert('Entrenamiento finalizado', 'Este entrenamiento está finalizado y no se puede editar.');
            return;
        }
        const prev = sets.find((s) => s.id === setId);
        const prevSnapshot = sets;
        const shouldAutoRest =
            updates.completed === 1 &&
            prev?.completed !== 1 &&
            configService.get('autoStartRestTimerOnSetComplete');

        // Optimistic update for UI
        setSets(prev => prev.map(s => s.id === setId ? { ...s, ...updates } : s));

        try {
            await workoutService.updateSet(setId, updates);
            if (shouldAutoRest) {
                useTimerStore.getState().startTimer(configService.get('defaultRestTimer'));
            }
        } catch (e: any) {
            setSets(prevSnapshot);
            Alert.alert('Error', e?.message ?? 'No se pudo actualizar la serie');
        }

        // Refresh history in background to check for completion status changes
        loadHistoryData();
    };

    const handleDeleteSet = async (setId: string) => {
        if (workoutLocked) {
            Alert.alert('Entrenamiento finalizado', 'Este entrenamiento está finalizado y no se puede editar.');
            return;
        }
        setSets(prev => prev.filter(s => s.id !== setId));
        await workoutService.deleteSet(setId);
        loadHistoryData();
    };

    const handleAddSet = async () => {
        if (!workoutId) return;
        if (workoutLocked) {
            Alert.alert('Entrenamiento finalizado', 'Este entrenamiento está finalizado y no se puede editar.');
            return;
        }
        const nextIndex = sets.length;
        const newSetId = await workoutService.addSet(workoutId, exerciseId, 'normal', { order_index: nextIndex });
        if (newSetId) {
            loadTrackData();
        }
    };

    const copyFromHistory = async (histSets: WorkoutSet[]) => {
        if (!workoutId) return;
        if (workoutLocked) {
            Alert.alert('Entrenamiento finalizado', 'Este entrenamiento está finalizado y no se puede editar.');
            return;
        }
        for (const s of histSets) {
            await workoutService.addSet(workoutId, exerciseId, s.type as any, {
                weight: s.weight,
                reps: s.reps,
                notes: s.notes,
                order_index: sets.length + 1
            });
        }
        loadTrackData();
        setActiveTab('track');
    };

    const handleAddWarmupSets = async (newSets: Partial<WorkoutSet>[]) => {
        if (!workoutId) return;
        if (workoutLocked) {
            Alert.alert('Entrenamiento finalizado', 'Este entrenamiento está finalizado y no se puede editar.');
            return;
        }
        for (const s of newSets) {
            const w = (s.weight ?? 0);
            const wKg = toKg(w);
            await workoutService.addSet(workoutId, exerciseId, 'warmup', {
                weight: wKg,
                reps: s.reps,
                notes: s.notes,
                order_index: sets.length + 1
            });
        }
        loadTrackData();
    };

    // --- GRAPHS DATA ---
    const rounding = unit === 'kg' ? configService.get('calculatorsRoundingKg') : configService.get('calculatorsRoundingLbs');

    const oneRmSeries = useMemo(() => {
        return [...history].reverse().map(h => {
            const validSets = h.sets.filter(s => (s.weight || 0) > 0 && (s.reps || 0) > 0);
            const best = validSets.reduce((acc, s) => {
                const est = CalculatorService.estimate1RM('epley', s.weight || 0, s.reps || 0);
                return Math.max(acc, est);
            }, 0);
            const label = (() => {
                try {
                    const d = new Date(h.date || Date.now());
                    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
                } catch {
                    return '--/--';
                }
            })();
            return { value: Math.round(displayWeight(best)), label };
        });
    }, [history, unit]);

    const volumeData = useMemo(() => {
        return [...history].reverse().map(h => {
            const vol = h.sets.reduce((acc, s) => acc + ((displayWeight(s.weight || 0)) * (s.reps || 0)), 0);
            const label = (() => {
                try {
                    const d = new Date(h.date || Date.now());
                    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
                } catch {
                    return '--/--';
                }
            })();
            return { value: Math.round(vol), label };
        });
    }, [history, unit]);

    const insights = useMemo(() => {
        const flat = history.flatMap((h) => (h.sets || []).map((s) => ({ ...s, __date: h.date })));
        const heaviest = flat.reduce((best: any, s: any) => {
            const w = s.weight || 0;
            if (w <= 0) return best;
            if (!best) return s;
            return (w > (best.weight || 0)) ? s : best;
        }, null as any);
        const best1rm = flat.reduce((best: any, s: any) => {
            const w = s.weight || 0;
            const r = s.reps || 0;
            if (w <= 0 || r <= 0) return best;
            const est = CalculatorService.estimate1RM('epley', w, r);
            if (!best || est > best.est) return { est, ...s };
            return best;
        }, null as any);
        const bestSessionVol = history.reduce((best, h) => {
            const vol = (h.sets || []).reduce((acc, s) => acc + ((displayWeight(s.weight || 0)) * (s.reps || 0)), 0);
            if (!best || vol > best.vol) return { vol, date: h.date };
            return best;
        }, null as any);

        const now = Date.now();
        const cutoff30 = now - (30 * 86400 * 1000);
        const sessions30 = history.filter((h) => (h.date || 0) > cutoff30).length;
        const lastDate = history[0]?.date ?? null;
        const daysSince = lastDate ? Math.max(0, Math.floor((now - lastDate) / (86400 * 1000))) : null;

        const heaviestDisplay = heaviest ? { ...heaviest, weight: displayWeight(heaviest.weight || 0) } : null;
        const best1rmDisplay = best1rm ? { ...best1rm, est: displayWeight(best1rm.est || 0) } : null;
        return { heaviest: heaviestDisplay, best1rm: best1rmDisplay, bestSessionVol, sessions30, daysSince };
    }, [history, unit]);

    const historySets = useMemo(() => {
        return history.flatMap((h) => (h.sets || []).map((s) => {
            const w = s.weight || 0;
            const r = s.reps || 0;
            const orm = (w > 0 && r > 0) ? CalculatorService.estimate1RM('epley', w, r) : 0;
            const wd = displayWeight(w);
            const ormDisplay = displayWeight(orm);
            const vol = wd * r;
            return { ...s, __date: h.date, __orm: Math.round(ormDisplay), __vol: vol, __w: wd };
        }));
    }, [history, unit]);

    const sortedHistorySets = useMemo(() => {
        const arr = [...historySets];
        if (setsSort === 'weight') return arr.sort((a: any, b: any) => (b.weight || 0) - (a.weight || 0));
        if (setsSort === 'orm') return arr.sort((a: any, b: any) => (b.__orm || 0) - (a.__orm || 0));
        if (setsSort === 'volume') return arr.sort((a: any, b: any) => (b.__vol || 0) - (a.__vol || 0));
        return arr.sort((a: any, b: any) => (b.__date || 0) - (a.__date || 0));
    }, [historySets, setsSort]);

    // --- RENDER CONTENT ---
    const renderTrack = () => {
        if (!workoutId) return <View><Text className="text-iron-950 text-center mt-10">No active workout</Text></View>;

        return (
            <IronCard className="mb-4">
                {workoutLocked && (
                    <View className="bg-surface p-3 rounded-xl border border-iron-700 mb-3">
                        <Text className="text-iron-950 font-bold">Entrenamiento finalizado</Text>
                        <Text className="text-iron-500 text-xs mt-1">Para editar, reabre el entrenamiento desde su pantalla.</Text>
                    </View>
                )}
                {sets.map((set, idx) => (
                    <SetRow
                        key={set.id}
                        set={set}
                        index={idx}
                        onUpdate={handleUpdateSet}
                        onDelete={handleDeleteSet}
                        disabled={workoutLocked}
                    />
                ))}

                {!workoutLocked && (
                    <View className="mt-4">
                        <IronButton label="AGREGAR SERIE" onPress={handleAddSet} variant="outline" />
                    </View>
                )}

                <WarmupCalculatorModal
                    visible={warmupVisible}
                    onClose={() => setWarmupVisible(false)}
                    onAddSets={handleAddWarmupSets}
                    defaultWeight={Math.max(...sets.map(s => displayWeight(s.weight || 0)), 0) || (unit === 'kg' ? 100 : 225)}
                />
            </IronCard>
        )
    };

    const renderHistory = () => (
        <View className="pb-8 px-1">
            <View className="flex-row gap-2 mb-4">
                {[30, 90, 365].map((d) => (
                    <TouchableOpacity
                        key={d}
                        onPress={() => setHistoryRangeDays(d as 30 | 90 | 365)}
                        className={`px-3 py-2 rounded-full border ${historyRangeDays === d ? 'bg-surface border-primary' : 'bg-transparent border-iron-700'}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Cambiar rango a ${d} días`}
                    >
                        <Text className={`font-bold ${historyRangeDays === d ? 'text-primary' : 'text-iron-950'}`}>{d}D</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View className="flex-row gap-2 mb-4">
                {([
                    { id: 'sessions', label: 'Sesiones' },
                    { id: 'sets', label: 'Series' }
                ] as const).map((t) => (
                    <TouchableOpacity
                        key={t.id}
                        onPress={() => setHistoryTab(t.id)}
                        className={`px-3 py-2 rounded-full border ${historyTab === t.id ? 'bg-surface border-primary' : 'bg-transparent border-iron-700'}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Ver ${t.label}`}
                    >
                        <Text className={`font-bold ${historyTab === t.id ? 'text-primary' : 'text-iron-950'}`}>{t.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {(!history || history.length === 0) ? (
                <View className="items-center justify-center py-10 bg-surface rounded-xl border border-iron-700 elevation-1 mt-4">
                    <Info size={40} color={Colors.iron[300]} />
                    <Text className="text-iron-950 text-center font-bold mt-2">Aún no hay historial</Text>
                    <Text className="text-iron-500 text-center text-xs mt-1 px-4">Aparecerá aquí cuando completes series de este ejercicio.</Text>
                </View>
            ) : historyTab === 'sets' ? (
                <View>
                    <View className="flex-row gap-2 mb-4 flex-wrap">
                        {([
                            { id: 'recent', label: 'Recientes' },
                            { id: 'weight', label: 'Peso' },
                            { id: 'orm', label: '1RM' },
                            { id: 'volume', label: 'Volumen' }
                        ] as const).map((s) => (
                            <TouchableOpacity
                                key={s.id}
                                onPress={() => setSetsSort(s.id)}
                                className={`px-3 py-2 rounded-full border ${setsSort === s.id ? 'bg-surface border-primary' : 'bg-transparent border-iron-700'}`}
                                accessibilityRole="button"
                                accessibilityLabel={`Ordenar por ${s.label}`}
                            >
                                <Text className={`font-bold text-xs ${setsSort === s.id ? 'text-primary' : 'text-iron-950'}`}>{s.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {sortedHistorySets.length === 0 ? (
                        <Text className="text-iron-500 text-center mt-10">No hay series completas en este rango.</Text>
                    ) : (
                        <View className="gap-3">
                            {sortedHistorySets.slice(0, 80).map((s: any, idx: number) => {
                                const dateLabel = (() => {
                                    try {
                                        const d = new Date(s.__date || Date.now());
                                        return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' });
                                    } catch {
                                        return '—';
                                    }
                                })();
                                return (
                                    <View key={`${s.id}-${idx}`} className="bg-surface p-4 rounded-xl border border-iron-700 elevation-1">
                                        <View className="flex-row items-center justify-between mb-2">
                                            <Text className="text-iron-500 text-xs font-bold uppercase">{dateLabel}</Text>
                                            {s.rpe ? <View className="bg-white px-2 py-1 rounded-full border border-primary/40"><Text className="text-[10px] font-bold text-iron-950">@{s.rpe}</Text></View> : null}
                                        </View>
                                        <View className="flex-row items-end justify-between">
                                            <Text className="text-iron-950 font-black text-2xl">
                                                {Math.round((s.__w || 0) * 100) / 100}<Text className="text-iron-500 text-xs font-bold"> {unit}</Text>
                                                <Text className="text-iron-500 text-xs font-bold"> × </Text>
                                                {s.reps || 0}<Text className="text-iron-500 text-xs font-bold"> reps</Text>
                                            </Text>
                                        </View>
                                        <View className="flex-row items-center justify-between mt-2">
                                            <Text className="text-iron-500 text-xs font-bold">1RM: <Text className="text-iron-950">{s.__orm || 0}</Text> {unit}</Text>
                                            <Text className="text-iron-500 text-xs font-bold">VOL: <Text className="text-iron-950">{Math.round(s.__vol || 0)}</Text></Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>
            ) : history.map((h, i) => {
                // Defensive Date Handling
                let dateDisplay = { day: '?', month: '???' };
                try {
                    const d = new Date(h.date || Date.now());
                    dateDisplay = {
                        day: d.getDate().toString(),
                        month: d.toLocaleString('default', { month: 'short' })
                    };
                } catch (e) { }

                return (
                    <View key={i} className="flex-row mb-4">
                        {/* Left Date Column */}
                        <View className="w-14 items-center mr-2 pt-1">
                            <View className="bg-surface rounded-lg px-2 py-1 items-center w-full border border-iron-700 elevation-1">
                                <Text className="font-black text-iron-950 text-lg">{dateDisplay.day}</Text>
                                <Text className="text-iron-500 text-[10px] uppercase font-bold">{dateDisplay.month}</Text>
                            </View>
                            {/* Vertical Line */}
                            <View className="flex-1 w-[2px] bg-iron-300 my-1 rounded-full opacity-30" />
                        </View>

                        {/* Right Content Card (Explicit View for styles) */}
                        <View className="flex-1">
                            <View className="p-3 bg-surface rounded-xl border border-iron-700 elevation-1">
                                <View className="flex-row justify-between items-center mb-3 border-b border-iron-200 pb-2">
                                    <Text className="text-xs text-iron-500 font-bold uppercase tracking-wider">Sesión completada</Text>
                                    {workoutId && (
                                        <TouchableOpacity
                                            onPress={() => copyFromHistory(h.sets)}
                                            className="bg-primary px-3 py-1.5 rounded-full shadow-sm active:bg-primary/80"
                                            accessibilityRole="button"
                                            accessibilityLabel="Copiar series de esta sesión"
                                        >
                                            <Text className="text-white text-[10px] font-black tracking-wide">COPIAR</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                <View className="gap-2">
                                    {(h.sets && h.sets.length > 0) ? h.sets.map((s, idx) => (
                                        <View key={idx} className="flex-row items-center justify-between bg-white p-2 rounded-lg border border-primary/40">
                                            <View className="flex-row items-center gap-3">
                                                <View className="w-6 h-6 rounded-full bg-white items-center justify-center border border-primary/50">
                                                    <Text className="text-[10px] font-bold text-iron-950">{idx + 1}</Text>
                                                </View>
                                                <View className="items-start">
                                                    <Text className="font-black text-iron-950 text-lg leading-tight">
                                                        {s.weight !== undefined && s.weight !== null ? Math.round(displayWeight(s.weight) * 100) / 100 : 0}
                                                        <Text className="text-xs font-bold text-iron-600">{unit}</Text>
                                                    </Text>
                                                </View>
                                            </View>

                                            <View className="flex-row items-center">
                                                <Text className="font-black text-iron-950 text-lg leading-tight">
                                                    {s.reps !== undefined && s.reps !== null ? s.reps : 0}
                                                    <Text className="text-xs font-bold text-iron-600">reps</Text>
                                                </Text>
                                                {s.rpe ? <View className="bg-white px-1.5 py-0.5 rounded ml-2 border border-primary/40"><Text className="text-[10px] font-bold text-iron-950">@{s.rpe}</Text></View> : null}
                                            </View>
                                        </View>
                                    )) : (
                                        <View className="p-2 bg-red-50 rounded border border-red-100">
                                            <Text className="text-red-500 font-bold text-xs text-center">Sin datos en esta sesión</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>
                    </View>
                )
            })}
        </View>
    );

    const renderAnalysis = () => (
        <View className="gap-4 pb-8">
            <View className="flex-row gap-2">
                {([
                    { id: 'overview', label: 'Resumen' },
                    { id: 'prs', label: 'PRs' },
                    { id: 'tools', label: 'Herramientas' }
                ] as const).map((t) => (
                    <TouchableOpacity
                        key={t.id}
                        onPress={() => setAnalysisTab(t.id)}
                        className={`px-3 py-2 rounded-full border ${analysisTab === t.id ? 'bg-surface border-primary' : 'bg-transparent border-iron-700'}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Abrir ${t.label}`}
                    >
                        <Text className={`font-bold ${analysisTab === t.id ? 'text-primary' : 'text-iron-950'}`}>{t.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {analysisTab === 'overview' ? (
                <View className="gap-6">
                    <View className="flex-row gap-3">
                        <IronCard className="flex-1">
                            <Text className="text-iron-500 text-xs font-bold uppercase">Sesiones (30d)</Text>
                            <Text className="text-iron-950 text-2xl font-black mt-1">{insights.sessions30}</Text>
                            <Text className="text-iron-500 text-xs font-bold">última: {insights.daysSince == null ? '—' : `${insights.daysSince}d`}</Text>
                        </IronCard>
                        <IronCard className="flex-1">
                            <Text className="text-iron-500 text-xs font-bold uppercase">Mejor 1RM</Text>
                            <Text className="text-iron-950 text-2xl font-black mt-1">{insights.best1rm?.est ?? 0}</Text>
                            <Text className="text-iron-500 text-xs font-bold">{unit}</Text>
                        </IronCard>
                    </View>

                    <View className="rounded-xl overflow-hidden bg-surface border border-iron-700 elevation-1">
                        <View className="px-4 py-3 bg-iron-100 flex-row items-center gap-2 border-b border-iron-200">
                            <View className="w-1.5 h-4 bg-primary rounded-full" />
                            <Text className="text-iron-950 font-black tracking-tight text-sm uppercase">1RM estimado</Text>
                        </View>
                        <View className="py-6 items-center bg-surface">
                            {oneRmSeries.length > 1 ? (
                                <LineChart
                                    data={oneRmSeries}
                                    color={Colors.primary.DEFAULT}
                                    thickness={3}
                                    dataPointsColor={Colors.primary.DEFAULT}
                                    hideRules
                                    height={200}
                                    width={screenWidth - 64}
                                    curved
                                    isAnimated
                                    startFillColor={Colors.primary.DEFAULT}
                                    endFillColor={Colors.primary.DEFAULT}
                                    startOpacity={0.2}
                                    endOpacity={0}
                                    areaChart
                                    yAxisTextStyle={{ color: Colors.iron[400], fontSize: 10 }}
                                    xAxisLabelTextStyle={{ color: Colors.iron[400], fontSize: 10 }}
                                    initialSpacing={0}
                                    endSpacing={0}
                                />
                            ) : (
                                <Text className="text-iron-500">Aún no hay suficientes datos.</Text>
                            )}
                        </View>
                    </View>

                    <View className="rounded-xl overflow-hidden bg-surface border border-iron-700 elevation-1">
                        <View className="px-4 py-3 bg-iron-100 flex-row items-center gap-2 border-b border-iron-200">
                            <View className="w-1.5 h-4 bg-iron-600 rounded-full" />
                            <Text className="text-iron-950 font-black tracking-tight text-sm uppercase">Volumen</Text>
                        </View>
                        <View className="py-6 items-center bg-surface">
                            {volumeData.length > 0 ? (
                                <BarChart
                                    data={volumeData}
                                    frontColor={Colors.primary.dark}
                                    barWidth={16}
                                    spacing={28}
                                    roundedTop
                                    hideRules
                                    height={200}
                                    width={screenWidth - 64}
                                    yAxisTextStyle={{ color: Colors.iron[400], fontSize: 10 }}
                                    xAxisLabelTextStyle={{ color: Colors.iron[400], fontSize: 10 }}
                                    initialSpacing={0}
                                    endSpacing={0}
                                />
                            ) : (
                                <Text className="text-iron-500">Aún no hay volumen para mostrar.</Text>
                            )}
                        </View>
                    </View>
                </View>
            ) : analysisTab === 'prs' ? (
                <View className="gap-4">
                    <IronCard>
                        <Text className="text-iron-950 font-bold text-lg mb-3">Mejores marcas (en rango)</Text>
                        <View className="flex-row justify-between items-center mb-2">
                            <Text className="text-iron-500 font-bold">Serie más pesada</Text>
                            <Text className="text-iron-950 font-black">
                                {(insights.heaviest?.weight ?? 0)} {unit} × {(insights.heaviest?.reps ?? 0)}
                            </Text>
                        </View>
                        <View className="flex-row justify-between items-center mb-2">
                            <Text className="text-iron-500 font-bold">Mejor 1RM (Epley)</Text>
                            <Text className="text-iron-950 font-black">{insights.best1rm?.est ?? 0} {unit}</Text>
                        </View>
                        <View className="flex-row justify-between items-center">
                            <Text className="text-iron-500 font-bold">Mejor volumen sesión</Text>
                            <Text className="text-iron-950 font-black">{insights.bestSessionVol?.vol ? Math.round(insights.bestSessionVol.vol) : 0}</Text>
                        </View>
                        <Text className="text-iron-500 text-xs mt-3">Nota: las PRs dependen de las series marcadas como completadas.</Text>
                    </IronCard>
                </View>
            ) : (
                <View className="gap-4">
                    <IronCard>
                        <Text className="text-iron-950 font-bold text-lg mb-4">Herramientas</Text>
                        <TouchableOpacity
                            onPress={() => useTimerStore.getState().startTimer(configService.get('defaultRestTimer'))}
                            className="bg-primary px-4 py-3 rounded-xl mb-3 flex-row items-center justify-between"
                            accessibilityRole="button"
                            accessibilityLabel="Iniciar descanso"
                        >
                            <Text className="text-white font-black">Iniciar descanso ({configService.get('defaultRestTimer')}s)</Text>
                            <Timer size={18} color={Colors.white} />
                        </TouchableOpacity>

                        <View className="flex-row gap-2">
                            {[60, 90, 120].map((s) => (
                                <TouchableOpacity
                                    key={s}
                                    onPress={async () => {
                                        await configService.set('defaultRestTimer', s);
                                        useTimerStore.getState().startTimer(s);
                                    }}
                                    className="flex-1 bg-iron-200 px-3 py-3 rounded-xl border border-iron-300 active:opacity-80"
                                    accessibilityRole="button"
                                    accessibilityLabel={`Iniciar descanso de ${s} segundos`}
                                >
                                    <Text className="text-iron-950 font-bold text-center">{s}s</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View className="h-[1px] bg-iron-200 my-4" />

                        <TouchableOpacity
                            onPress={() => router.push('/tools/plate-calculator' as any)}
                            className="bg-surface px-4 py-3 rounded-xl border border-iron-700 active:bg-iron-200"
                            accessibilityRole="button"
                            accessibilityLabel="Abrir calculadora de discos"
                        >
                            <Text className="text-iron-950 font-bold">Calculadora de discos</Text>
                            <Text className="text-iron-500 text-xs mt-1">Útil si no llegas exacto: muestra alternativas por arriba/abajo.</Text>
                        </TouchableOpacity>
                    </IronCard>
                </View>
            )}
        </View>
    );

    const availableTabs: Tab[] = workoutId
        ? ['track', 'history', 'analysis']
        : ['history', 'analysis'];

    return (
        <SafeAreaWrapper className="flex-1 bg-iron-900" edges={['bottom', 'left', 'right']}>
            <Stack.Screen options={{
                title: currentExercise?.name || exerciseName || 'Exercise',
                headerBackTitle: 'Volver',
                headerRight: () => (
                    <View className="flex-row gap-2">
                        {/* Edit Button (Library Mode) */}
                        {!workoutId && (
                            <TouchableOpacity onPress={() => setIsConfigVisible(true)} className="bg-iron-800 p-2 rounded-full border border-iron-700">
                                <Pencil size={20} color={Colors.iron[400]} />
                            </TouchableOpacity>
                        )}

                        {/* Warmup Calc (Workout Mode) */}
                        {workoutId && (
                            <TouchableOpacity
                                onPress={() => {
                                    if (workoutLocked) {
                                        Alert.alert('Entrenamiento finalizado', 'Este entrenamiento está finalizado y no se puede editar.');
                                        return;
                                    }
                                    setWarmupVisible(true);
                                }}
                                className="bg-iron-800 p-2 rounded-full border border-iron-700"
                                accessibilityRole="button"
                                accessibilityLabel="Abrir calculadora de calentamiento"
                            >
                                <Zap size={20} color="#fbbf24" fill="#fbbf24" />
                            </TouchableOpacity>
                        )}
                    </View>
                )
            }} />

            {notes && (
                <View className="bg-yellow-900/20 border-b border-yellow-700/50 p-3 flex-row items-start">
                    <Info size={16} color={Colors.yellow} style={{ marginTop: 2, marginRight: 8 }} />
                    <Text className="text-yellow-500 font-bold flex-1 text-sm">{notes}</Text>
                </View>
            )}

            <View className="flex-row pt-2 bg-iron-900 border-b border-iron-700">
                {availableTabs.map(tab => (
                    <TouchableOpacity
                        key={tab}
                        onPress={() => setActiveTab(tab)}
                        className={`flex-1 py-4 items-center border-b-4 ${activeTab === tab ? 'border-primary' : 'border-transparent'}`}
                    >
                        <Text className={`font-bold uppercase tracking-wider text-sm ${activeTab === tab ? 'text-primary' : 'text-iron-500'}`}>
                            {tab === 'track' ? 'Registrar' : tab === 'history' ? 'Historial' : 'Análisis'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 100 }}>
                {loading ? (
                    <View className="py-10 items-center">
                        <Text className="text-iron-500 font-bold">Cargando…</Text>
                    </View>
                ) : (
                    <>
                        {activeTab === 'track' && renderTrack()}
                        {activeTab === 'history' && renderHistory()}
                        {activeTab === 'analysis' && renderAnalysis()}
                    </>
                )}
            </ScrollView>

            <ExerciseFormModal
                visible={isConfigVisible}
                onClose={() => setIsConfigVisible(false)}
                onSave={() => {
                    loadData();
                    if (currentExercise) {
                        router.setParams({ exerciseName: currentExercise.name });
                    }
                }}
                initialData={currentExercise}
            />
        </SafeAreaWrapper>
    );
}
