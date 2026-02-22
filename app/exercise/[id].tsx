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
import { notify } from '@/src/utils/notify';
import { formatTimeSeconds } from '@/src/utils/time';
import * as Haptics from 'expo-haptics';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Info, Pencil, Timer, Zap } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';

type Tab = 'track' | 'history' | 'analysis';
type AnalysisTab = 'overview' | 'prs' | 'tools';
type HistoryTab = 'sessions' | 'sets';
type SetsSort = 'recent' | 'weight' | 'orm' | 'volume' | 'reps' | 'distance' | 'time' | 'pace' | 'speed';
type CardioMetric = 'distance' | 'time' | 'pace' | 'speed';

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
    const [cardioMetric, setCardioMetric] = useState<CardioMetric>('speed');
    const [cardioPrimaryPR, setCardioPrimaryPR] = useState<CardioMetric>('speed');

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

    useEffect(() => {
        const m = configService.get('exerciseCardioMetricById')?.[exerciseId];
        if (m === 'distance' || m === 'time' || m === 'pace' || m === 'speed') {
            setCardioMetric(m);
        } else {
            setCardioMetric('speed');
        }
    }, [exerciseId]);

    useEffect(() => {
        const m = configService.get('exerciseCardioPrimaryPRById')?.[exerciseId];
        if (m === 'distance' || m === 'time' || m === 'pace' || m === 'speed') {
            setCardioPrimaryPR(m);
        } else {
            setCardioPrimaryPR(cardioMetric);
        }
    }, [exerciseId, cardioMetric]);

    const setCardioMetricPersisted = async (m: CardioMetric) => {
        setCardioMetric(m);
        try {
            const prev = configService.get('exerciseCardioMetricById') || {};
            const next = { ...prev, [exerciseId]: m };
            await configService.set('exerciseCardioMetricById', next);
        } catch { }
    };

    const setCardioPrimaryPRPersisted = async (m: CardioMetric) => {
        setCardioPrimaryPR(m);
        try {
            const prev = configService.get('exerciseCardioPrimaryPRById') || {};
            const next = { ...prev, [exerciseId]: m };
            await configService.set('exerciseCardioPrimaryPRById', next);
        } catch { }
    };

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
            notify.info('Este entrenamiento está finalizado y no se puede editar.');
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
            notify.error(e?.message ?? 'No se pudo actualizar la serie');
        }

        // Refresh history in background to check for completion status changes
        loadHistoryData();
    };

    const handleDeleteSet = async (setId: string) => {
        if (workoutLocked) {
            notify.info('Este entrenamiento está finalizado y no se puede editar.');
            return;
        }
        setSets(prev => prev.filter(s => s.id !== setId));
        await workoutService.deleteSet(setId);
        loadHistoryData();
    };

    const handleAddSet = async () => {
        if (!workoutId) return;
        if (workoutLocked) {
            notify.info('Este entrenamiento está finalizado y no se puede editar.');
            return;
        }
        const nextIndex = sets.length;
        const newSetId = await workoutService.addSet(workoutId, exerciseId, 'normal', { order_index: nextIndex });
        if (newSetId) {
            loadTrackData();
        }
    };

    const handleCopySet = async (setId: string) => {
        if (!workoutId) return;
        if (workoutLocked) {
            notify.info('Este entrenamiento está finalizado y no se puede editar.');
            return;
        }
        const s = sets.find((x) => x.id === setId);
        if (!s) return;

        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await workoutService.addSet(workoutId, exerciseId, s.type as any, {
                weight: s.weight,
                reps: s.reps,
                distance: s.distance,
                time: s.time,
                rpe: s.rpe,
                notes: s.notes,
            });
            loadTrackData();
        } catch (e: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            notify.error(e?.message ?? 'No se pudo copiar la serie');
        }
    };

    const copyFromHistory = async (histSets: WorkoutSet[]) => {
        if (!workoutId) return;
        if (workoutLocked) {
            notify.info('Este entrenamiento está finalizado y no se puede editar.');
            return;
        }
        for (const s of histSets) {
            await workoutService.addSet(workoutId, exerciseId, s.type as any, {
                weight: s.weight,
                reps: s.reps,
                distance: (s as any).distance,
                time: (s as any).time,
                rpe: s.rpe,
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
            notify.info('Este entrenamiento está finalizado y no se puede editar.');
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
    const exType = currentExercise?.type ?? 'weight_reps';

    const oneRmSeries = useMemo(() => {
        if (exType !== 'weight_reps') return [];
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
    }, [history, unit, exType]);

    const volumeData = useMemo(() => {
        if (exType !== 'weight_reps') return [];
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
    }, [history, unit, exType]);

    const distanceSeries = useMemo(() => {
        if (exType !== 'distance_time') return [];
        return [...history].reverse().map((h) => {
            const distKm = (h.sets || []).reduce((acc, s: any) => acc + ((s.distance || 0) / 1000), 0);
            const label = (() => {
                try {
                    const d = new Date(h.date || Date.now());
                    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
                } catch {
                    return '--/--';
                }
            })();
            return { value: Math.round(distKm * 100) / 100, label };
        });
    }, [history, exType]);

    const speedSeries = useMemo(() => {
        if (exType !== 'distance_time') return [];
        return [...history].reverse().map((h) => {
            const distKm = (h.sets || []).reduce((acc, s: any) => acc + ((s.distance || 0) / 1000), 0);
            const timeSec = (h.sets || []).reduce((acc, s: any) => acc + (s.time || 0), 0);
            const speed = (distKm > 0 && timeSec > 0) ? (distKm / (timeSec / 3600)) : 0;
            const label = (() => {
                try {
                    const d = new Date(h.date || Date.now());
                    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
                } catch {
                    return '--/--';
                }
            })();
            return { value: Math.round(speed * 100) / 100, label };
        });
    }, [history, exType]);

    const timeSeries = useMemo(() => {
        if (exType !== 'distance_time') return [];
        return [...history].reverse().map((h) => {
            const timeSec = (h.sets || []).reduce((acc, s: any) => acc + (s.time || 0), 0);
            const label = (() => {
                try {
                    const d = new Date(h.date || Date.now());
                    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
                } catch {
                    return '--/--';
                }
            })();
            const min = timeSec > 0 ? (timeSec / 60) : 0;
            return { value: Math.round(min * 10) / 10, label };
        });
    }, [history, exType]);

    const paceSeries = useMemo(() => {
        if (exType !== 'distance_time') return [];
        return [...history].reverse().map((h) => {
            const distKm = (h.sets || []).reduce((acc, s: any) => acc + ((s.distance || 0) / 1000), 0);
            const timeSec = (h.sets || []).reduce((acc, s: any) => acc + (s.time || 0), 0);
            const paceSecPerKm = (distKm > 0 && timeSec > 0) ? (timeSec / distKm) : 0;
            const label = (() => {
                try {
                    const d = new Date(h.date || Date.now());
                    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
                } catch {
                    return '--/--';
                }
            })();
            const minPerKm = paceSecPerKm > 0 ? (paceSecPerKm / 60) : 0;
            return { value: Math.round(minPerKm * 100) / 100, label };
        });
    }, [history, exType]);

    const repsSeries = useMemo(() => {
        if (exType !== 'reps_only') return [];
        return [...history].reverse().map((h) => {
            const best = (h.sets || []).reduce((m: number, s: any) => Math.max(m, s.reps || 0), 0);
            const label = (() => {
                try {
                    const d = new Date(h.date || Date.now());
                    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
                } catch {
                    return '--/--';
                }
            })();
            return { value: best, label };
        });
    }, [history, exType]);

    const weightSeries = useMemo(() => {
        if (exType !== 'weight_only') return [];
        return [...history].reverse().map((h) => {
            const bestKg = (h.sets || []).reduce((m: number, s: any) => Math.max(m, s.weight || 0), 0);
            const label = (() => {
                try {
                    const d = new Date(h.date || Date.now());
                    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
                } catch {
                    return '--/--';
                }
            })();
            return { value: Math.round(displayWeight(bestKg) * 10) / 10, label };
        });
    }, [history, exType, unit]);

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
            const vol = (h.sets || []).reduce((acc, s: any) => acc + ((displayWeight(s.weight || 0)) * (s.reps || 0)), 0);
            if (!best || vol > best.vol) return { vol, date: h.date };
            return best;
        }, null as any);

        const bestDistance = flat.reduce((best: any, s: any) => {
            const d = (s.distance || 0);
            if (d <= 0) return best;
            if (!best) return s;
            return (d > (best.distance || 0)) ? s : best;
        }, null as any);

        const bestSpeed = flat.reduce((best: any, s: any) => {
            const dKm = (s.distance || 0) / 1000;
            const t = s.time || 0;
            if (dKm <= 0 || t <= 0) return best;
            const speed = dKm / (t / 3600);
            if (!best || speed > best.speed) return { speed, ...s };
            return best;
        }, null as any);

        const bestPace = flat.reduce((best: any, s: any) => {
            const dKm = (s.distance || 0) / 1000;
            const t = s.time || 0;
            if (dKm <= 0 || t <= 0) return best;
            const pace = t / dKm;
            if (!best || pace < best.pace) return { pace, ...s };
            return best;
        }, null as any);

        const bestSessionDistance = history.reduce((best: any, h) => {
            const distKm = (h.sets || []).reduce((acc, s: any) => acc + ((s.distance || 0) / 1000), 0);
            if (!best || distKm > best.distKm) return { distKm, date: h.date };
            return best;
        }, null as any);

        const bestSessionTime = history.reduce((best: any, h) => {
            const timeSec = (h.sets || []).reduce((acc, s: any) => acc + (s.time || 0), 0);
            if (!best || timeSec > best.timeSec) return { timeSec, date: h.date };
            return best;
        }, null as any);

        const bestReps = flat.reduce((best: any, s: any) => {
            const r = s.reps || 0;
            if (r <= 0) return best;
            if (!best) return s;
            return (r > (best.reps || 0)) ? s : best;
        }, null as any);

        const now = Date.now();
        const cutoff30 = now - (30 * 86400 * 1000);
        const sessions30 = history.filter((h) => (h.date || 0) > cutoff30).length;
        const lastDate = history[0]?.date ?? null;
        const daysSince = lastDate ? Math.max(0, Math.floor((now - lastDate) / (86400 * 1000))) : null;

        const heaviestDisplay = heaviest ? { ...heaviest, weight: displayWeight(heaviest.weight || 0) } : null;
        const best1rmDisplay = best1rm ? { ...best1rm, est: displayWeight(best1rm.est || 0) } : null;
        const bestDistanceDisplay = bestDistance ? { ...bestDistance, distanceKm: Math.round(((bestDistance.distance || 0) / 1000) * 100) / 100 } : null;
        const bestSpeedDisplay = bestSpeed ? { ...bestSpeed, speedKmh: Math.round((bestSpeed.speed || 0) * 100) / 100 } : null;
        const bestPaceDisplay = bestPace ? { ...bestPace, paceSecPerKm: Math.round((bestPace.pace || 0)) } : null;
        const bestRepsDisplay = bestReps ? { ...bestReps } : null;

        return {
            heaviest: heaviestDisplay,
            best1rm: best1rmDisplay,
            bestSessionVol,
            bestDistance: bestDistanceDisplay,
            bestSpeed: bestSpeedDisplay,
            bestPace: bestPaceDisplay,
            bestSessionDistance,
            bestSessionTime,
            bestReps: bestRepsDisplay,
            sessions30,
            daysSince,
        };
    }, [history, unit, exType]);

    const cardioPrimarySummary = useMemo(() => {
        if (exType !== 'distance_time') return null;
        const fmtDate = (ms: number | null | undefined) => {
            if (!ms) return null;
            try {
                return new Date(ms).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
            } catch {
                return null;
            }
        };

        if (cardioPrimaryPR === 'distance') {
            const km = insights.bestSessionDistance?.distKm;
            return {
                title: 'Distancia',
                value: km != null ? `${Math.round(km * 100) / 100} km` : '—',
                dateLabel: fmtDate(insights.bestSessionDistance?.date),
            };
        }
        if (cardioPrimaryPR === 'time') {
            const t = insights.bestSessionTime?.timeSec;
            return {
                title: 'Tiempo',
                value: t ? formatTimeSeconds(t) : '—',
                dateLabel: fmtDate(insights.bestSessionTime?.date),
            };
        }
        if (cardioPrimaryPR === 'pace') {
            const paceSec = insights.bestPace?.paceSecPerKm;
            return {
                title: 'Ritmo',
                value: paceSec ? `${formatTimeSeconds(paceSec)}/km` : '—',
                dateLabel: fmtDate((insights.bestPace as any)?.__date),
            };
        }
        const sp = insights.bestSpeed?.speedKmh;
        return {
            title: 'Velocidad',
            value: sp != null ? `${Math.round(sp * 10) / 10} km/h` : '—',
            dateLabel: fmtDate((insights.bestSpeed as any)?.__date),
        };
    }, [exType, cardioPrimaryPR, insights]);

    const historySets = useMemo(() => {
        return history.flatMap((h) => (h.sets || []).map((s: any) => {
            const base = { ...s, __date: h.date };
            if (exType === 'distance_time') {
                const distKm = (s.distance || 0) / 1000;
                const timeSec = s.time || 0;
                const paceSecPerKm = (distKm > 0 && timeSec > 0) ? (timeSec / distKm) : 0;
                const speedKmh = (distKm > 0 && timeSec > 0) ? (distKm / (timeSec / 3600)) : 0;
                return { ...base, __distKm: distKm, __timeSec: timeSec, __pace: paceSecPerKm, __speed: speedKmh };
            }
            if (exType === 'reps_only') {
                return { ...base, __reps: s.reps || 0 };
            }
            if (exType === 'weight_only') {
                const wKg = s.weight || 0;
                return { ...base, __w: displayWeight(wKg) };
            }
            const wKg = s.weight || 0;
            const r = s.reps || 0;
            const orm = (wKg > 0 && r > 0) ? CalculatorService.estimate1RM('epley', wKg, r) : 0;
            const wd = displayWeight(wKg);
            const ormDisplay = displayWeight(orm);
            const vol = wd * r;
            return { ...base, __orm: Math.round(ormDisplay), __vol: vol, __w: wd };
        }));
    }, [history, unit, exType]);

    const sortedHistorySets = useMemo(() => {
        const arr = [...historySets];
        if (setsSort === 'weight') return arr.sort((a: any, b: any) => ((b.__w ?? b.weight) || 0) - ((a.__w ?? a.weight) || 0));
        if (setsSort === 'orm') return arr.sort((a: any, b: any) => (b.__orm || 0) - (a.__orm || 0));
        if (setsSort === 'volume') return arr.sort((a: any, b: any) => (b.__vol || 0) - (a.__vol || 0));
        if (setsSort === 'reps') return arr.sort((a: any, b: any) => (b.__reps ?? b.reps ?? 0) - (a.__reps ?? a.reps ?? 0));
        if (setsSort === 'distance') return arr.sort((a: any, b: any) => (b.__distKm || 0) - (a.__distKm || 0));
        if (setsSort === 'time') return arr.sort((a: any, b: any) => (b.__timeSec || 0) - (a.__timeSec || 0));
        if (setsSort === 'pace') return arr.sort((a: any, b: any) => {
            const ap = a.__pace || 0;
            const bp = b.__pace || 0;
            if (ap === 0 && bp === 0) return 0;
            if (ap === 0) return 1;
            if (bp === 0) return -1;
            return ap - bp;
        });
        if (setsSort === 'speed') return arr.sort((a: any, b: any) => (b.__speed || 0) - (a.__speed || 0));
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
                        onCopy={handleCopySet}
                        exerciseType={currentExercise?.type ?? 'weight_reps'}
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
                        {(exType === 'distance_time'
                            ? ([
                                { id: 'recent', label: 'Recientes' },
                                { id: 'distance', label: 'Distancia' },
                                { id: 'time', label: 'Tiempo' },
                                { id: 'pace', label: 'Ritmo' },
                                { id: 'speed', label: 'Velocidad' },
                            ] as const)
                            : exType === 'reps_only'
                                ? ([
                                    { id: 'recent', label: 'Recientes' },
                                    { id: 'reps', label: 'Reps' },
                                ] as const)
                                : exType === 'weight_only'
                                    ? ([
                                        { id: 'recent', label: 'Recientes' },
                                        { id: 'weight', label: 'Peso' },
                                    ] as const)
                                    : ([
                                        { id: 'recent', label: 'Recientes' },
                                        { id: 'weight', label: 'Peso' },
                                        { id: 'orm', label: '1RM' },
                                        { id: 'volume', label: 'Volumen' }
                                    ] as const)
                        ).map((s) => (
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
                                                {exType === 'distance_time'
                                                    ? `${Math.round((s.__distKm || 0) * 100) / 100} km`
                                                    : exType === 'reps_only'
                                                        ? `${s.reps || 0} reps`
                                                        : exType === 'weight_only'
                                                            ? `${Math.round((s.__w || 0) * 100) / 100} ${unit}`
                                                            : (
                                                                <>
                                                                    {Math.round((s.__w || 0) * 100) / 100}<Text className="text-iron-500 text-xs font-bold"> {unit}</Text>
                                                                    <Text className="text-iron-500 text-xs font-bold"> × </Text>
                                                                    {s.reps || 0}<Text className="text-iron-500 text-xs font-bold"> reps</Text>
                                                                </>
                                                            )
                                                }
                                            </Text>
                                            {exType === 'distance_time' ? (
                                                <Text className="text-iron-500 text-xs font-bold">{formatTimeSeconds(s.__timeSec || 0)}</Text>
                                            ) : null}
                                        </View>
                                        <View className="flex-row items-center justify-between mt-2">
                                            {exType === 'weight_reps' ? (
                                                <>
                                                    <Text className="text-iron-500 text-xs font-bold">1RM: <Text className="text-iron-950">{s.__orm || 0}</Text> {unit}</Text>
                                                    <Text className="text-iron-500 text-xs font-bold">VOL: <Text className="text-iron-950">{Math.round(s.__vol || 0)}</Text></Text>
                                                </>
                                            ) : exType === 'distance_time' ? (
                                                <>
                                                    <Text className="text-iron-500 text-xs font-bold">
                                                        Ritmo: <Text className="text-iron-950">{s.__pace ? formatTimeSeconds(s.__pace) : '—'}</Text>
                                                    </Text>
                                                    <Text className="text-iron-500 text-xs font-bold">
                                                        Vel: <Text className="text-iron-950">{s.__speed ? `${Math.round(s.__speed * 10) / 10} km/h` : '—'}</Text>
                                                    </Text>
                                                </>
                                            ) : exType === 'reps_only' ? (
                                                <Text className="text-iron-500 text-xs font-bold">Reps: <Text className="text-iron-950">{s.reps || 0}</Text></Text>
                                            ) : (
                                                <Text className="text-iron-500 text-xs font-bold">Peso: <Text className="text-iron-950">{Math.round((s.__w || 0) * 100) / 100}</Text> {unit}</Text>
                                            )}
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
                                                        {exType === 'distance_time'
                                                            ? `${Math.round((((s as any).distance || 0) / 1000) * 100) / 100} km`
                                                            : exType === 'reps_only'
                                                                ? `${s.reps !== undefined && s.reps !== null ? s.reps : 0}`
                                                                : exType === 'weight_only'
                                                                    ? `${s.weight !== undefined && s.weight !== null ? Math.round(displayWeight(s.weight) * 100) / 100 : 0}`
                                                                    : `${s.weight !== undefined && s.weight !== null ? Math.round(displayWeight(s.weight) * 100) / 100 : 0}`
                                                        }
                                                        {exType === 'weight_reps' || exType === 'weight_only' ? (
                                                            <Text className="text-xs font-bold text-iron-600">{unit}</Text>
                                                        ) : null}
                                                        {exType === 'reps_only' ? (
                                                            <Text className="text-xs font-bold text-iron-600">reps</Text>
                                                        ) : null}
                                                    </Text>
                                                    {exType === 'distance_time' ? (
                                                        <Text className="text-xs font-bold text-iron-600">
                                                            {formatTimeSeconds((s as any).time || 0)}
                                                        </Text>
                                                    ) : null}
                                                </View>
                                            </View>

                                            <View className="flex-row items-center">
                                                {exType === 'weight_reps' ? (
                                                    <Text className="font-black text-iron-950 text-lg leading-tight">
                                                        {s.reps !== undefined && s.reps !== null ? s.reps : 0}
                                                        <Text className="text-xs font-bold text-iron-600">reps</Text>
                                                    </Text>
                                                ) : exType === 'distance_time' ? (
                                                    <Text className="text-xs font-bold text-iron-600">
                                                        {(() => {
                                                            const dKm = (((s as any).distance || 0) / 1000);
                                                            const t = (s as any).time || 0;
                                                            if (dKm <= 0 || t <= 0) return '—';
                                                            const pace = t / dKm;
                                                            return `${formatTimeSeconds(pace)}/km`;
                                                        })()}
                                                    </Text>
                                                ) : null}
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
                            <Text className="text-iron-500 text-xs font-bold uppercase">
                                {exType === 'distance_time'
                                    ? cardioMetric === 'distance'
                                        ? 'Mejor distancia'
                                        : cardioMetric === 'time'
                                            ? 'Mayor tiempo'
                                            : cardioMetric === 'pace'
                                                ? 'Mejor ritmo'
                                                : 'Mejor velocidad'
                                    : exType === 'reps_only'
                                        ? 'Mejor reps'
                                        : exType === 'weight_only'
                                            ? 'Mejor peso'
                                            : 'Mejor 1RM'
                                }
                            </Text>
                            <Text className="text-iron-950 text-2xl font-black mt-1">
                                {exType === 'distance_time'
                                    ? cardioMetric === 'distance'
                                        ? (insights.bestSessionDistance?.distKm != null ? Math.round(insights.bestSessionDistance.distKm * 100) / 100 : 0)
                                        : cardioMetric === 'time'
                                            ? formatTimeSeconds(insights.bestSessionTime?.timeSec ?? 0)
                                            : cardioMetric === 'pace'
                                                ? (insights.bestPace?.paceSecPerKm ? formatTimeSeconds(insights.bestPace.paceSecPerKm) : '—')
                                                : (insights.bestSpeed?.speedKmh ?? 0)
                                    : exType === 'reps_only'
                                        ? (insights.bestReps?.reps ?? 0)
                                        : exType === 'weight_only'
                                            ? (insights.heaviest?.weight ?? 0)
                                            : (insights.best1rm?.est ?? 0)
                                }
                            </Text>
                            <Text className="text-iron-500 text-xs font-bold">
                                {exType === 'distance_time'
                                    ? cardioMetric === 'distance'
                                        ? 'km'
                                        : cardioMetric === 'time'
                                            ? ''
                                            : cardioMetric === 'pace'
                                                ? '/km'
                                                : 'km/h'
                                    : exType === 'reps_only'
                                        ? 'reps'
                                        : unit
                                }
                            </Text>
                        </IronCard>
                    </View>

                    {exType === 'weight_reps' ? (
                        <>
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
                        </>
                    ) : exType === 'distance_time' ? (
                        <>
                            <View className="flex-row gap-2 mb-2 flex-wrap">
                                {([
                                    { id: 'distance', label: 'Distancia' },
                                    { id: 'time', label: 'Tiempo' },
                                    { id: 'pace', label: 'Ritmo' },
                                    { id: 'speed', label: 'Velocidad' },
                                ] as const).map((m) => (
                                    <TouchableOpacity
                                        key={m.id}
                                        onPress={() => void setCardioMetricPersisted(m.id)}
                                        className={`px-3 py-2 rounded-full border ${cardioMetric === m.id ? 'bg-surface border-primary' : 'bg-transparent border-iron-700'}`}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Cambiar métrica a ${m.label}`}
                                    >
                                        <Text className={`font-bold text-xs ${cardioMetric === m.id ? 'text-primary' : 'text-iron-950'}`}>{m.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View className="rounded-xl overflow-hidden bg-surface border border-iron-700 elevation-1">
                                <View className="px-4 py-3 bg-iron-100 flex-row items-center justify-between gap-2 border-b border-iron-200">
                                    <View className="flex-row items-center gap-2">
                                        <View className={`w-1.5 h-4 rounded-full ${cardioMetric === 'distance' ? 'bg-primary' : 'bg-iron-600'}`} />
                                        <Text className="text-iron-950 font-black tracking-tight text-sm uppercase">
                                            {cardioMetric === 'distance' ? 'Distancia por sesión' : cardioMetric === 'time' ? 'Tiempo por sesión' : cardioMetric === 'pace' ? 'Ritmo (min/km)' : 'Velocidad (km/h)'}
                                        </Text>
                                    </View>
                                    {cardioPrimarySummary ? (
                                        <View className="items-end">
                                            <Text className="text-iron-500 text-[10px] font-bold uppercase">
                                                PR: {cardioPrimarySummary.title}{cardioPrimarySummary.dateLabel ? ` • ${cardioPrimarySummary.dateLabel}` : ''}
                                            </Text>
                                            <Text className="text-iron-950 text-xs font-black">{cardioPrimarySummary.value}</Text>
                                        </View>
                                    ) : null}
                                </View>
                                <View className="py-6 items-center bg-surface">
                                    {cardioMetric === 'distance' ? (
                                        distanceSeries.length > 0 ? (
                                            <BarChart
                                                data={distanceSeries}
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
                                            <Text className="text-iron-500">Aún no hay distancia para mostrar.</Text>
                                        )
                                    ) : cardioMetric === 'speed' ? (
                                        speedSeries.length > 1 ? (
                                            <LineChart
                                                data={speedSeries}
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
                                                pointerConfig={{
                                                    pointerStripHeight: 190,
                                                    pointerStripColor: Colors.iron[300],
                                                    pointerStripWidth: 2,
                                                    pointerColor: Colors.primary.DEFAULT,
                                                    pointerLabelWidth: 140,
                                                    pointerLabelHeight: 60,
                                                    shiftPointerLabelX: -70,
                                                    shiftPointerLabelY: -70,
                                                    autoAdjustPointerLabelPosition: true,
                                                    pointerLabelComponent: (items: any[]) => {
                                                        const it = items?.[0] ?? {};
                                                        const v = Number(it.value ?? 0);
                                                        const speed = Number.isFinite(v) ? Math.round(v * 10) / 10 : 0;
                                                        return (
                                                            <View className="bg-iron-900 border border-iron-700 rounded-xl px-3 py-2">
                                                                <Text className="text-iron-500 text-[10px] font-bold">{String(it.label ?? '')}</Text>
                                                                <Text className="text-iron-950 text-base font-black">{speed > 0 ? `${speed} km/h` : '—'}</Text>
                                                            </View>
                                                        );
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <Text className="text-iron-500">Aún no hay suficientes datos.</Text>
                                        )
                                    ) : cardioMetric === 'time' ? (
                                        timeSeries.length > 0 ? (
                                            <BarChart
                                                data={timeSeries}
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
                                            <Text className="text-iron-500">Aún no hay tiempo para mostrar.</Text>
                                        )
                                    ) : (
                                        paceSeries.length > 1 ? (
                                            <LineChart
                                                data={paceSeries}
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
                                                formatYLabel={(label: string) => {
                                                    const n = Number(String(label).replace(',', '.'));
                                                    if (!Number.isFinite(n) || n <= 0) return label;
                                                    return formatTimeSeconds(Math.round(n * 60));
                                                }}
                                                initialSpacing={0}
                                                endSpacing={0}
                                                pointerConfig={{
                                                    pointerStripHeight: 190,
                                                    pointerStripColor: Colors.iron[300],
                                                    pointerStripWidth: 2,
                                                    pointerColor: Colors.primary.DEFAULT,
                                                    pointerLabelWidth: 140,
                                                    pointerLabelHeight: 60,
                                                    shiftPointerLabelX: -70,
                                                    shiftPointerLabelY: -70,
                                                    autoAdjustPointerLabelPosition: true,
                                                    pointerLabelComponent: (items: any[]) => {
                                                        const it = items?.[0] ?? {};
                                                        const minutesPerKm = Number(it.value ?? 0);
                                                        const paceSec = Number.isFinite(minutesPerKm) && minutesPerKm > 0 ? Math.round(minutesPerKm * 60) : 0;
                                                        return (
                                                            <View className="bg-iron-900 border border-iron-700 rounded-xl px-3 py-2">
                                                                <Text className="text-iron-500 text-[10px] font-bold">{String(it.label ?? '')}</Text>
                                                                <Text className="text-iron-950 text-base font-black">
                                                                    {paceSec > 0 ? `${formatTimeSeconds(paceSec)}/km` : '—'}
                                                                </Text>
                                                            </View>
                                                        );
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <Text className="text-iron-500">Aún no hay suficientes datos.</Text>
                                        )
                                    )}
                                </View>
                            </View>
                        </>
                    ) : exType === 'reps_only' ? (
                        <View className="rounded-xl overflow-hidden bg-surface border border-iron-700 elevation-1">
                            <View className="px-4 py-3 bg-iron-100 flex-row items-center gap-2 border-b border-iron-200">
                                <View className="w-1.5 h-4 bg-primary rounded-full" />
                                <Text className="text-iron-950 font-black tracking-tight text-sm uppercase">Reps máximas</Text>
                            </View>
                            <View className="py-6 items-center bg-surface">
                                {repsSeries.length > 1 ? (
                                    <LineChart
                                        data={repsSeries}
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
                    ) : (
                        <View className="rounded-xl overflow-hidden bg-surface border border-iron-700 elevation-1">
                            <View className="px-4 py-3 bg-iron-100 flex-row items-center gap-2 border-b border-iron-200">
                                <View className="w-1.5 h-4 bg-primary rounded-full" />
                                <Text className="text-iron-950 font-black tracking-tight text-sm uppercase">Peso máximo</Text>
                            </View>
                            <View className="py-6 items-center bg-surface">
                                {weightSeries.length > 1 ? (
                                    <LineChart
                                        data={weightSeries}
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
                    )}
                </View>
            ) : analysisTab === 'prs' ? (
                <View className="gap-4">
                    <IronCard>
                        <Text className="text-iron-950 font-bold text-lg mb-3">Mejores marcas (en rango)</Text>
                        {exType === 'weight_reps' ? (
                            <>
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
                            </>
                        ) : exType === 'distance_time' ? (
                            <>
                                <Text className="text-iron-500 text-xs font-bold uppercase mb-2">PR principal</Text>
                                <View className="flex-row gap-2 mb-4 flex-wrap">
                                    {([
                                        { id: 'speed', label: 'Velocidad' },
                                        { id: 'pace', label: 'Ritmo' },
                                        { id: 'distance', label: 'Distancia' },
                                        { id: 'time', label: 'Tiempo' },
                                    ] as const).map((m) => (
                                        <TouchableOpacity
                                            key={m.id}
                                            onPress={() => void setCardioPrimaryPRPersisted(m.id)}
                                            className={`px-3 py-2 rounded-full border ${cardioPrimaryPR === m.id ? 'bg-surface border-primary' : 'bg-transparent border-iron-700'}`}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Definir PR principal como ${m.label}`}
                                        >
                                            <Text className={`font-bold text-xs ${cardioPrimaryPR === m.id ? 'text-primary' : 'text-iron-950'}`}>{m.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <View className="flex-row justify-between items-center mb-3">
                                    <Text className="text-iron-500 font-bold">
                                        {cardioPrimaryPR === 'distance'
                                            ? 'Mejor distancia (sesión)'
                                            : cardioPrimaryPR === 'time'
                                                ? 'Mayor tiempo (sesión)'
                                                : cardioPrimaryPR === 'pace'
                                                    ? 'Mejor ritmo'
                                                    : 'Mejor velocidad'}
                                    </Text>
                                    <Text className="text-iron-950 font-black">
                                        {cardioPrimaryPR === 'distance'
                                            ? `${insights.bestSessionDistance?.distKm != null ? (Math.round(insights.bestSessionDistance.distKm * 100) / 100) : 0} km`
                                            : cardioPrimaryPR === 'time'
                                                ? (insights.bestSessionTime?.timeSec ? formatTimeSeconds(insights.bestSessionTime.timeSec) : '—')
                                                : cardioPrimaryPR === 'pace'
                                                    ? (insights.bestPace?.paceSecPerKm ? `${formatTimeSeconds(insights.bestPace.paceSecPerKm)}/km` : '—')
                                                    : `${insights.bestSpeed?.speedKmh != null ? (Math.round(insights.bestSpeed.speedKmh * 10) / 10) : 0} km/h`
                                        }
                                    </Text>
                                </View>

                                <View className="flex-row justify-between items-center mb-2">
                                    <Text className="text-iron-500 font-bold">Mejor velocidad</Text>
                                    <Text className="text-iron-950 font-black">{insights.bestSpeed?.speedKmh ?? 0} km/h</Text>
                                </View>
                                <View className="flex-row justify-between items-center mb-2">
                                    <Text className="text-iron-500 font-bold">Mejor ritmo</Text>
                                    <Text className="text-iron-950 font-black">{insights.bestPace?.paceSecPerKm ? `${formatTimeSeconds(insights.bestPace.paceSecPerKm)}/km` : '—'}</Text>
                                </View>
                                <View className="flex-row justify-between items-center">
                                    <Text className="text-iron-500 font-bold">Mejor distancia (sesión)</Text>
                                    <Text className="text-iron-950 font-black">{insights.bestSessionDistance?.distKm != null ? (Math.round(insights.bestSessionDistance.distKm * 100) / 100) : 0} km</Text>
                                </View>
                                <View className="flex-row justify-between items-center mt-2">
                                    <Text className="text-iron-500 font-bold">Mayor tiempo (sesión)</Text>
                                    <Text className="text-iron-950 font-black">{insights.bestSessionTime?.timeSec ? formatTimeSeconds(insights.bestSessionTime.timeSec) : '—'}</Text>
                                </View>
                            </>
                        ) : exType === 'reps_only' ? (
                            <View className="flex-row justify-between items-center">
                                <Text className="text-iron-500 font-bold">Mejor set</Text>
                                <Text className="text-iron-950 font-black">{insights.bestReps?.reps ?? 0} reps</Text>
                            </View>
                        ) : (
                            <View className="flex-row justify-between items-center">
                                <Text className="text-iron-500 font-bold">Mejor set</Text>
                                <Text className="text-iron-950 font-black">{insights.heaviest?.weight ?? 0} {unit}</Text>
                            </View>
                        )}
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
                        {workoutId && (exType === 'weight_reps' || exType === 'weight_only') && (
                            <TouchableOpacity
                                onPress={() => {
                                    if (workoutLocked) {
                                        notify.info('Este entrenamiento está finalizado y no se puede editar.');
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
