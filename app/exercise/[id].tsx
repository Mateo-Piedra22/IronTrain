import { EmptyChartPlaceholder } from '@/components/EmptyChartPlaceholder';
import { ExerciseFormModal } from '@/components/ExerciseFormModal';
import { IronButton } from '@/components/IronButton';
import { IronCard } from '@/components/IronCard';
import { SetRow, SetTypeConfigItemWithColors, useSetTypeConfig } from '@/components/SetRow';
import { BadgePill } from '@/components/ui/BadgePill';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { WarmupCalculatorModal } from '@/components/WarmupCalculatorModal';
import { useColors } from '@/src/hooks/useColors';
import { CalculatorService } from '@/src/services/CalculatorService';
import { configService } from '@/src/services/ConfigService';
import { dbService } from '@/src/services/DatabaseService';
import { ExerciseService } from '@/src/services/ExerciseService';
import { UnitService } from '@/src/services/UnitService';
import { workoutService } from '@/src/services/WorkoutService';
import { useTimerStore } from '@/src/store/timerStore';
import { ThemeFx, withAlpha } from '@/src/theme';
import { Exercise, WorkoutSet } from '@/src/types/db';
import { notify } from '@/src/utils/notify';
import { formatTimeSeconds } from '@/src/utils/time';
import * as Haptics from 'expo-haptics';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Info, Pencil, Timer, Trophy, Zap } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, Text, TouchableOpacity, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { BarChart, LineChart } from 'react-native-gifted-charts';

type Tab = 'track' | 'history' | 'analysis';
type AnalysisTab = 'overview' | 'prs' | 'tools';
type HistoryTab = 'sessions' | 'sets';
type SetsSort = 'recent' | 'weight' | 'orm' | 'volume' | 'reps' | 'distance' | 'time' | 'pace' | 'speed';
type CardioMetric = 'distance' | 'time' | 'pace' | 'speed';

export default function ExerciseDetailScreen() {
    const { workoutId, exerciseId, exerciseName } = useLocalSearchParams<{ workoutId: string, exerciseId: string, exerciseName: string }>();
    const router = useRouter();
    const colors = useColors();
    const { configs: SET_TYPE_CONFIG } = useSetTypeConfig();
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
    const [currentExercise, setCurrentExercise] = useState<(Exercise & { badges?: any[] }) | null>(null);

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
            const exerciseDetails = await ExerciseService.getById(exerciseId);
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
            notify.info('Bloqueado', 'El entrenamiento finalizó. Para editar debés reabrirlo.');
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
            notify.error('Datos revertidos', e?.message || 'Fallo de red al actualizar.');
        }

        // Refresh history in background to check for completion status changes
        loadHistoryData();
    };

    const handleDeleteSet = async (setId: string) => {
        if (workoutLocked) {
            notify.info('Entrenamiento cerrado', 'Este entrenamiento está finalizado y no se puede editar.');
            return;
        }
        const prevSnapshot = sets;
        setSets(prev => prev.filter(s => s.id !== setId));
        try {
            await workoutService.deleteSet(setId);
            loadHistoryData();
            notify.success('Descartada', 'La serie fue eliminada con éxito.');
        } catch (e: any) {
            setSets(prevSnapshot);
            notify.error('Ocurrió un error', e?.message || 'Error al intentar borrar la serie.');
        }
    };

    const handleAddSet = async () => {
        if (!workoutId) return;
        if (workoutLocked) {
            notify.info('Entrenamiento cerrado', 'No se puede agregar a un entrenamiento finalizado.');
            return;
        }
        const nextIndex = sets.length;
        try {
            const newSetId = await workoutService.addSet(workoutId, exerciseId, 'normal', { order_index: nextIndex });
            if (newSetId) {
                loadTrackData();
                notify.success('Serie creada', 'Nueva serie en blanco lista.');
            }
        } catch (e: any) {
            notify.error('Atención', e?.message || 'No se pudo crear una nueva serie.');
        }
    };

    const handleCopySet = async (setId: string) => {
        if (!workoutId) return;
        if (workoutLocked) {
            notify.info('Bloqueado', 'El entrenamiento finalizó. Para editar debés reabrirlo.');
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
            notify.success('Serie duplicada', 'Se copiaron exitosamente sus valores.');
        } catch (e: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            notify.error('Error al clonar', e?.message || 'Fallo general al clonar la serie.');
        }
    };

    const copyFromHistory = async (histSets: WorkoutSet[]) => {
        if (!workoutId) return;
        if (workoutLocked) {
            notify.info('Bloqueado', 'Este entrenamiento está cerrado.');
            return;
        }
        try {
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
            notify.success('Historial copiado', 'Series incorporadas exitosamente.');
        } catch (e: any) {
            notify.error('Error', e?.message || 'Fallo de red importando historial.');
        }
    };

    const handleAddWarmupSets = async (newSets: Partial<WorkoutSet>[]) => {
        if (!workoutId) return;
        if (workoutLocked) {
            notify.info('Desactivado', 'El entrenamiento cerró. No puedes enviar más series.');
            return;
        }
        try {
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
            notify.success('Rutina de warmup cargada', 'Listos para empezar duro.');
        } catch (e: any) {
            notify.error('Carga incompleta', e?.message || 'Error de base de datos calculando.');
        }
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
        if (!workoutId) return <View style={{ paddingVertical: 40, alignItems: 'center' }}><Text style={{ color: colors.iron[500], fontWeight: '700' }}>No active workout</Text></View>;

        return (
            <IronCard className="mb-4">
                {workoutLocked && (
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: withAlpha(colors.red, '10'), borderRadius: 12, borderWidth: 1, borderColor: withAlpha(colors.red, '25'), padding: 12, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: colors.red }}>
                        <Info size={14} color={colors.red} style={{ marginRight: 8, marginTop: 2 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.iron[950], fontWeight: '800', fontSize: 13 }}>Entrenamiento finalizado</Text>
                            <Text style={{ color: colors.iron[400], fontSize: 11, marginTop: 2 }}>Para editar, reabre el entrenamiento desde su pantalla.</Text>
                        </View>
                    </View>
                )}
                {(() => {
                    let normalCount = 0;
                    return sets.map((set, idx) => {
                        const isNormal = (set.type || 'normal') === 'normal';
                        const ni = isNormal ? normalCount : 0;
                        if (isNormal) normalCount++;
                        return (
                            <SetRow
                                key={set.id}
                                set={set}
                                index={idx}
                                normalIndex={ni}
                                onUpdate={handleUpdateSet}
                                onDelete={handleDeleteSet}
                                onCopy={handleCopySet}
                                exerciseType={currentExercise?.type ?? 'weight_reps'}
                                disabled={workoutLocked}
                            />
                        );
                    });
                })()}

                {!workoutLocked && (
                    <View style={{ marginTop: 16 }}>
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

    const renderChip = (id: string, label: string, isActive: boolean, onPress: () => void) => (
        <TouchableOpacity
            key={id}
            onPress={onPress}
            style={{
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
                backgroundColor: isActive ? colors.primary.DEFAULT + '15' : 'transparent',
                borderColor: isActive ? colors.primary.DEFAULT : colors.iron[700],
            }}
            accessibilityRole="button"
        >
            <Text style={{ fontWeight: '700', fontSize: 12, color: isActive ? colors.primary.DEFAULT : colors.iron[500] }}>{label}</Text>
        </TouchableOpacity>
    );

    const renderHistory = () => (
        <View style={{ paddingBottom: 32, paddingHorizontal: 2 }}>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                {[30, 90, 365].map((d) => renderChip(String(d), `${d}D`, historyRangeDays === d, () => setHistoryRangeDays(d as 30 | 90 | 365)))}
            </View>

            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                {([{ id: 'sessions', label: 'Sesiones' }, { id: 'sets', label: 'Series' }] as const).map((t) =>
                    renderChip(t.id, t.label, historyTab === t.id, () => setHistoryTab(t.id))
                )}
            </View>

            {(!history || history.length === 0) ? (
                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.iron[700], marginTop: 8 }}>
                    <Info size={36} color={colors.iron[300]} />
                    <Text style={{ color: colors.iron[950], textAlign: 'center', fontWeight: '800', fontSize: 14, marginTop: 10 }}>Aún no hay historial</Text>
                    <Text style={{ color: colors.iron[400], textAlign: 'center', fontSize: 12, marginTop: 4, paddingHorizontal: 24 }}>Aparecerá aquí cuando completes series de este ejercicio.</Text>
                </View>
            ) : historyTab === 'sets' ? (
                <View>
                    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                        {(exType === 'distance_time'
                            ? ([{ id: 'recent', label: 'Recientes' }, { id: 'distance', label: 'Distancia' }, { id: 'time', label: 'Tiempo' }, { id: 'pace', label: 'Ritmo' }, { id: 'speed', label: 'Velocidad' }] as const)
                            : exType === 'reps_only'
                                ? ([{ id: 'recent', label: 'Recientes' }, { id: 'reps', label: 'Reps' }] as const)
                                : exType === 'weight_only'
                                    ? ([{ id: 'recent', label: 'Recientes' }, { id: 'weight', label: 'Peso' }] as const)
                                    : ([{ id: 'recent', label: 'Recientes' }, { id: 'weight', label: 'Peso' }, { id: 'orm', label: '1RM' }, { id: 'volume', label: 'Carga' }] as const)
                        ).map((s) => renderChip(s.id, s.label, setsSort === s.id, () => setSetsSort(s.id)))}
                    </View>

                    {sortedHistorySets.length === 0 ? (
                        <Text style={{ color: colors.iron[400], textAlign: 'center', marginTop: 40, fontSize: 13, fontWeight: '600' }}>No hay series completadas en este rango.</Text>
                    ) : (
                        <View style={{ gap: 12 }}>
                            {sortedHistorySets.slice(0, 80).map((s: any, idx: number) => {
                                const dateLabel = (() => {
                                    try {
                                        const d = new Date(s.__date || Date.now());
                                        return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
                                    } catch {
                                        return '—';
                                    }
                                })();
                                return (
                                    <View key={`${s.id}-${idx}`} style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, elevation: 2, shadowColor: ThemeFx.shadowColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <View style={{ backgroundColor: colors.iron[200], paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border }}>
                                                    <Text style={{ color: colors.iron[600], fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>{dateLabel}</Text>
                                                </View>
                                                {(() => {
                                                    const t = (s as any).type || 'normal';
                                                    if (t === 'normal') return null;
                                                    const cfg = SET_TYPE_CONFIG.find((c: SetTypeConfigItemWithColors) => c.key === t);
                                                    if (!cfg) return null;
                                                    return (
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: cfg.bg, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 12, borderWidth: 1.5, borderColor: cfg.text + '25' }}>

                                                            <cfg.Icon size={9} color={cfg.text} />
                                                            <Text style={{ fontSize: 9, fontWeight: '900', color: cfg.text }}>{cfg.shortLabel}</Text>
                                                        </View>
                                                    );
                                                })()}
                                            </View>
                                            {s.rpe ? <View style={{ backgroundColor: colors.primary.DEFAULT + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary.DEFAULT + '30' }}><Text style={{ fontSize: 10, fontWeight: '900', color: colors.primary.DEFAULT }}>RPE @{s.rpe}</Text></View> : null}
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16 }}>
                                            <Text style={{ color: colors.iron[950], fontWeight: '900', fontSize: 26, letterSpacing: -0.5 }}>
                                                {exType === 'distance_time'
                                                    ? `${Math.round((s.__distKm || 0) * 100) / 100} km`
                                                    : exType === 'reps_only'
                                                        ? `${s.reps || 0} reps`
                                                        : exType === 'weight_only'
                                                            ? `${Math.round((s.__w || 0) * 100) / 100} ${unit}`
                                                            : (
                                                                <>
                                                                    {Math.round((s.__w || 0) * 100) / 100}<Text style={{ color: colors.iron[500], fontSize: 14, fontWeight: '700' }}> {unit}</Text>
                                                                    <Text style={{ color: colors.iron[500], fontSize: 14, fontWeight: '700' }}> × </Text>
                                                                    {s.reps || 0}<Text style={{ color: colors.iron[500], fontSize: 14, fontWeight: '700' }}> reps</Text>
                                                                </>
                                                            )
                                                }
                                            </Text>
                                            {exType === 'distance_time' ? (
                                                <Text style={{ color: colors.iron[500], fontSize: 13, fontWeight: '800' }}>{formatTimeSeconds(s.__timeSec || 0)}</Text>
                                            ) : null}
                                        </View>
                                        <View style={{ height: 1, backgroundColor: colors.iron[200], marginBottom: 12 }} />
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                            {exType === 'weight_reps' ? (
                                                <>
                                                    <Text style={{ color: colors.iron[500], fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }}>1RM: <Text style={{ color: colors.iron[950] }}>{s.__orm || 0}</Text></Text>
                                                    <Text style={{ color: colors.iron[500], fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }}>Vol: <Text style={{ color: colors.iron[950] }}>{Math.round(s.__vol || 0)}</Text></Text>
                                                </>
                                            ) : exType === 'distance_time' ? (
                                                <>
                                                    <Text style={{ color: colors.iron[500], fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }}>Ritmo: <Text style={{ color: colors.iron[950] }}>{s.__pace ? formatTimeSeconds(s.__pace) : '—'}</Text></Text>
                                                    <Text style={{ color: colors.iron[500], fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }}>Vel: <Text style={{ color: colors.iron[950] }}>{s.__speed ? `${Math.round(s.__speed * 10) / 10} km/h` : '—'}</Text></Text>
                                                </>
                                            ) : exType === 'reps_only' ? (
                                                <Text style={{ color: colors.iron[500], fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }}>Reps: <Text style={{ color: colors.iron[950] }}>{s.reps || 0}</Text></Text>
                                            ) : (
                                                <Text style={{ color: colors.iron[500], fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }}>Peso: <Text style={{ color: colors.iron[950] }}>{Math.round((s.__w || 0) * 100) / 100}</Text> {unit}</Text>
                                            )}
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>
            ) : history.map((h, i) => {
                let dateDisplay = { day: '?', month: '???' };
                try {
                    const d = new Date(h.date || Date.now());
                    dateDisplay = { day: d.getDate().toString(), month: d.toLocaleString('es-ES', { month: 'short' }) };
                } catch (e) { }

                return (
                    <View key={i} style={{ flexDirection: 'row', marginBottom: 16 }}>
                        {/* Left Date Column */}
                        <View style={{ width: 56, alignItems: 'center', marginRight: 12, paddingTop: 4 }}>
                            <View style={{ backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 6, paddingVertical: 10, alignItems: 'center', width: '100%', borderWidth: 1.5, borderColor: colors.border, elevation: 2, shadowColor: ThemeFx.shadowColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 }}>
                                <Text style={{ fontWeight: '900', color: colors.iron[950], fontSize: 20 }}>{dateDisplay.day}</Text>
                                <Text style={{ color: colors.iron[500], fontSize: 9, textTransform: 'uppercase', fontWeight: '900', letterSpacing: 1, marginTop: 2 }}>{dateDisplay.month}</Text>
                            </View>
                            {i < history.length - 1 && <View style={{ flex: 1, width: 2, backgroundColor: colors.iron[300], marginVertical: 8, borderRadius: 1 }} />}
                        </View>

                        {/* Right Content Card */}
                        <View style={{ flex: 1, paddingTop: 4 }}>
                            <View style={{ padding: 16, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, elevation: 2, shadowColor: ThemeFx.shadowColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.iron[200], paddingBottom: 12 }}>
                                    <Text style={{ fontSize: 12, color: colors.iron[500], fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>Sesión completada</Text>
                                    {workoutId && (
                                        <TouchableOpacity
                                            onPress={() => copyFromHistory(h.sets)}
                                            style={{ backgroundColor: colors.iron[200], paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border }}
                                            accessibilityRole="button"
                                            accessibilityLabel="Copiar series de esta sesión"
                                        >
                                            <Text style={{ color: colors.iron[950], fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>COPIAR</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                <View style={{ gap: 8 }}>
                                    {(h.sets && h.sets.length > 0) ? h.sets.map((s, idx) => (
                                        <View key={idx} style={{
                                            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                            backgroundColor: colors.iron[100], padding: 12, borderRadius: 12,
                                            borderWidth: 1, borderColor: colors.iron[200],
                                            ...(s.type && s.type !== 'normal' ? {
                                                borderColor: (SET_TYPE_CONFIG.find((c: SetTypeConfigItemWithColors) => c.key === s.type)?.text || colors.iron[300]) + '25',
                                                borderLeftWidth: 3,
                                                borderLeftColor: SET_TYPE_CONFIG.find((c: SetTypeConfigItemWithColors) => c.key === s.type)?.text || colors.iron[300],

                                            } : {}),
                                        }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                                {(() => {
                                                    const cfg = SET_TYPE_CONFIG.find((c: SetTypeConfigItemWithColors) => c.key === (s.type || 'normal')) || SET_TYPE_CONFIG[0];

                                                    const isNormal = (s.type || 'normal') === 'normal';
                                                    return (
                                                        <View style={{ width: isNormal ? 28 : 'auto' as any, minWidth: 28, height: 28, borderRadius: 8, backgroundColor: cfg.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: isNormal ? 0 : 6, flexDirection: 'row', gap: 4 }}>
                                                            {!isNormal && <cfg.Icon size={10} color={cfg.text} />}
                                                            <Text style={{ fontSize: isNormal ? 12 : 9, fontWeight: '900', color: cfg.text }}>
                                                                {isNormal ? idx + 1 : cfg.shortLabel}
                                                            </Text>
                                                        </View>
                                                    );
                                                })()}
                                                <View>
                                                    <Text style={{ fontWeight: '900', color: colors.iron[950], fontSize: 18, letterSpacing: -0.3 }}>
                                                        {exType === 'distance_time'
                                                            ? `${Math.round((((s as any).distance || 0) / 1000) * 100) / 100} km`
                                                            : exType === 'reps_only'
                                                                ? `${s.reps !== undefined && s.reps !== null ? s.reps : 0}`
                                                                : exType === 'weight_only'
                                                                    ? `${s.weight !== undefined && s.weight !== null ? Math.round(displayWeight(s.weight) * 100) / 100 : 0}`
                                                                    : `${s.weight !== undefined && s.weight !== null ? Math.round(displayWeight(s.weight) * 100) / 100 : 0}`
                                                        }
                                                        {exType === 'weight_reps' || exType === 'weight_only' ? (
                                                            <Text style={{ fontSize: 12, fontWeight: '800', color: colors.iron[500] }}> {unit}</Text>
                                                        ) : null}
                                                        {exType === 'reps_only' ? (
                                                            <Text style={{ fontSize: 12, fontWeight: '800', color: colors.iron[500] }}> reps</Text>
                                                        ) : null}
                                                    </Text>
                                                    {exType === 'distance_time' ? (
                                                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.iron[500], marginTop: 2 }}>
                                                            {formatTimeSeconds((s as any).time || 0)}
                                                        </Text>
                                                    ) : null}
                                                </View>
                                            </View>

                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                {exType === 'weight_reps' ? (
                                                    <Text style={{ fontWeight: '900', color: colors.iron[950], fontSize: 18, letterSpacing: -0.3 }}>
                                                        {s.reps !== undefined && s.reps !== null ? s.reps : 0}
                                                        <Text style={{ fontSize: 12, fontWeight: '800', color: colors.iron[500] }}> reps</Text>
                                                    </Text>
                                                ) : exType === 'distance_time' ? (
                                                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.iron[500] }}>
                                                        {(() => {
                                                            const dKm = (((s as any).distance || 0) / 1000);
                                                            const t = (s as any).time || 0;
                                                            if (dKm <= 0 || t <= 0) return '—';
                                                            const pace = t / dKm;
                                                            return `${formatTimeSeconds(pace)}/km`;
                                                        })()}
                                                    </Text>
                                                ) : null}
                                                {s.rpe ? <View style={{ backgroundColor: colors.primary.DEFAULT, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 12 }}><Text style={{ fontSize: 10, fontWeight: '900', color: colors.surface }}>@{s.rpe}</Text></View> : null}
                                            </View>
                                        </View>
                                    )) : (
                                        <View style={{ padding: 14, backgroundColor: colors.iron[200], borderRadius: 12, borderWidth: 1.5, borderColor: colors.border }}>
                                            <Text style={{ color: colors.iron[500], fontWeight: '800', fontSize: 13, textAlign: 'center' }}>Sin datos en esta sesión</Text>
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
        <View style={{ gap: 16, paddingBottom: 32 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
                {([{ id: 'overview', label: 'Resumen' }, { id: 'prs', label: 'PRs' }, { id: 'tools', label: 'Herramientas' }] as const).map((t) =>
                    renderChip(t.id, t.label, analysisTab === t.id, () => setAnalysisTab(t.id))
                )}
            </View>

            {analysisTab === 'overview' ? (
                <View style={{ gap: 20 }}>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <IronCard className="flex-1">
                            <Text style={{ color: colors.iron[400], fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>Sesiones (30d)</Text>
                            <Text style={{ color: colors.iron[950], fontSize: 24, fontWeight: '900', marginTop: 4 }}>{insights.sessions30}</Text>
                            <Text style={{ color: colors.iron[400], fontSize: 11, fontWeight: '700' }}>última: {insights.daysSince == null ? '—' : `${insights.daysSince}d`}</Text>
                        </IronCard>
                        <IronCard className="flex-1">
                            <Text style={{ color: colors.iron[400], fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                {exType === 'distance_time'
                                    ? cardioMetric === 'distance' ? 'Mejor distancia' : cardioMetric === 'time' ? 'Mayor tiempo' : cardioMetric === 'pace' ? 'Mejor ritmo' : 'Mejor velocidad'
                                    : exType === 'reps_only' ? 'Mejor reps' : exType === 'weight_only' ? 'Mejor peso' : 'Mejor 1RM'
                                }
                            </Text>
                            <Text style={{ color: colors.iron[950], fontSize: 24, fontWeight: '900', marginTop: 4 }}>
                                {exType === 'distance_time'
                                    ? cardioMetric === 'distance'
                                        ? (insights.bestSessionDistance?.distKm != null ? Math.round(insights.bestSessionDistance.distKm * 100) / 100 : 0)
                                        : cardioMetric === 'time' ? formatTimeSeconds(insights.bestSessionTime?.timeSec ?? 0) : cardioMetric === 'pace' ? (insights.bestPace?.paceSecPerKm ? formatTimeSeconds(insights.bestPace.paceSecPerKm) : '—') : (insights.bestSpeed?.speedKmh ?? 0)
                                    : exType === 'reps_only' ? (insights.bestReps?.reps ?? 0) : exType === 'weight_only' ? (insights.heaviest?.weight ?? 0) : (insights.best1rm?.est ?? 0)
                                }
                            </Text>
                            <Text style={{ color: colors.iron[400], fontSize: 11, fontWeight: '700' }}>
                                {exType === 'distance_time' ? cardioMetric === 'distance' ? 'km' : cardioMetric === 'time' ? '' : cardioMetric === 'pace' ? '/km' : 'km/h' : exType === 'reps_only' ? 'reps' : unit}
                            </Text>
                        </IronCard>
                    </View>

                    {exType === 'weight_reps' ? (
                        <>
                            <View style={{ borderRadius: 14, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.iron[700], elevation: 1 }}>
                                <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.iron[100], flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: colors.iron[200] }}>
                                    <View style={{ width: 5, height: 16, backgroundColor: colors.primary.DEFAULT, borderRadius: 3 }} />
                                    <Text style={{ color: colors.iron[950], fontWeight: '900', letterSpacing: -0.3, fontSize: 13, textTransform: 'uppercase' }}>1RM estimado</Text>
                                </View>
                                <View style={{ paddingVertical: 24, alignItems: 'center', backgroundColor: colors.surface }}>
                                    {oneRmSeries.length > 1 ? (
                                        <LineChart
                                            data={oneRmSeries}
                                            color={colors.primary.DEFAULT}
                                            thickness={3}
                                            dataPointsColor={colors.primary.DEFAULT}
                                            dataPointsRadius={4}
                                            hideRules={false}
                                            rulesColor={colors.iron[200]}
                                            rulesType="solid"
                                            height={200}
                                            width={screenWidth - 64}
                                            curved
                                            isAnimated
                                            animationDuration={400}
                                            startFillColor={colors.primary.DEFAULT}
                                            endFillColor={colors.primary.DEFAULT}
                                            startOpacity={0.2}
                                            endOpacity={0}
                                            areaChart
                                            yAxisTextStyle={{ color: colors.iron[400], fontSize: 10, fontWeight: '600' }}
                                            xAxisLabelTextStyle={{ color: colors.iron[400], fontSize: 10, fontWeight: '600' }}
                                            initialSpacing={0}
                                            endSpacing={0}
                                            yAxisLabelSuffix={` ${unit}`}
                                            yAxisLabelWidth={36}
                                            xAxisThickness={1}
                                            xAxisColor={colors.iron[200]}
                                            yAxisThickness={0}
                                        />
                                    ) : (
                                        <EmptyChartPlaceholder
                                            title="Sin datos de 1RM"
                                            message="Necesitás al menos 2 sesiones con peso y reps para ver tu estimación."
                                        />
                                    )}
                                </View>
                            </View>

                            <View style={{ borderRadius: 14, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.iron[700], elevation: 1 }}>
                                <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.iron[100], flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: colors.iron[200] }}>
                                    <View style={{ width: 5, height: 16, backgroundColor: colors.iron[600], borderRadius: 3 }} />
                                    <Text style={{ color: colors.iron[950], fontWeight: '900', letterSpacing: -0.3, fontSize: 13, textTransform: 'uppercase' }}>Carga</Text>
                                </View>
                                <View style={{ paddingVertical: 24, alignItems: 'center', backgroundColor: colors.surface }}>
                                    {volumeData.length > 0 ? (
                                        <BarChart
                                            data={volumeData}
                                            frontColor={colors.primary.dark}
                                            barWidth={18}
                                            spacing={18}
                                            roundedTop
                                            roundedBottom
                                            hideRules={false}
                                            rulesColor={colors.iron[200]}
                                            rulesType="solid"
                                            yAxisTextStyle={{ color: colors.iron[400], fontSize: 10, fontWeight: '600' }}
                                            xAxisLabelTextStyle={{ color: colors.iron[400], fontSize: 10, fontWeight: '600' }}
                                            initialSpacing={0}
                                            endSpacing={0}
                                            isAnimated
                                            animationDuration={400}
                                            yAxisLabelSuffix=" kg"
                                            yAxisLabelWidth={36}
                                            xAxisThickness={1}
                                            xAxisColor={colors.iron[200]}
                                        />
                                    ) : (
                                        <EmptyChartPlaceholder
                                            title="Sin carga"
                                            message="Completá series con peso para ver tu carga acumulada."
                                        />
                                    )}
                                </View>
                            </View>
                        </>
                    ) : exType === 'distance_time' ? (
                        <>
                            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                                {([{ id: 'distance', label: 'Distancia' }, { id: 'time', label: 'Tiempo' }, { id: 'pace', label: 'Ritmo' }, { id: 'speed', label: 'Velocidad' }] as const).map((m) =>
                                    renderChip(m.id, m.label, cardioMetric === m.id, () => void setCardioMetricPersisted(m.id))
                                )}
                            </View>

                            <View style={{ borderRadius: 14, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.iron[700], elevation: 1 }}>
                                <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.iron[100], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottomWidth: 1, borderBottomColor: colors.iron[200] }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <View style={{ width: 5, height: 16, borderRadius: 3, backgroundColor: cardioMetric === 'distance' ? colors.primary.DEFAULT : colors.iron[600] }} />
                                        <Text style={{ color: colors.iron[950], fontWeight: '900', letterSpacing: -0.3, fontSize: 13, textTransform: 'uppercase' }}>
                                            {cardioMetric === 'distance' ? 'Distancia por sesión' : cardioMetric === 'time' ? 'Tiempo por sesión' : cardioMetric === 'pace' ? 'Ritmo (min/km)' : 'Velocidad (km/h)'}
                                        </Text>
                                    </View>
                                    {cardioPrimarySummary ? (
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={{ color: colors.iron[400], fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>
                                                PR: {cardioPrimarySummary.title}{cardioPrimarySummary.dateLabel ? ` • ${cardioPrimarySummary.dateLabel}` : ''}
                                            </Text>
                                            <Text style={{ color: colors.iron[950], fontSize: 12, fontWeight: '900' }}>{cardioPrimarySummary.value}</Text>
                                        </View>
                                    ) : null}
                                </View>
                                <View style={{ paddingVertical: 24, alignItems: 'center', backgroundColor: colors.surface }}>
                                    {cardioMetric === 'distance' ? (
                                        distanceSeries.length > 0 ? (
                                            <BarChart
                                                data={distanceSeries}
                                                frontColor={colors.primary.DEFAULT}
                                                barWidth={18}
                                                spacing={18}
                                                roundedTop
                                                roundedBottom
                                                hideRules={false}
                                                rulesColor={colors.iron[200]}
                                                rulesType="solid"
                                                xAxisThickness={1}
                                                xAxisColor={colors.iron[200]}
                                                yAxisThickness={0}
                                                height={200}
                                                width={screenWidth - 64}
                                                yAxisTextStyle={{ color: colors.iron[400], fontSize: 10, fontWeight: '600' }}
                                                xAxisLabelTextStyle={{ color: colors.iron[400], fontSize: 10, fontWeight: '600' }}
                                                initialSpacing={0}
                                                endSpacing={0}
                                                isAnimated
                                                animationDuration={400}
                                                yAxisLabelSuffix=" km"
                                                yAxisLabelWidth={36}
                                            />
                                        ) : (
                                            <EmptyChartPlaceholder
                                                title="Sin distancia"
                                                message="Registrá sesiones de cardio para ver tu progreso de distancia."
                                            />
                                        )
                                    ) : cardioMetric === 'speed' ? (
                                        speedSeries.length > 1 ? (
                                            <LineChart
                                                data={speedSeries}
                                                color={colors.primary.DEFAULT}
                                                thickness={3}
                                                dataPointsColor={colors.primary.DEFAULT}
                                                dataPointsRadius={4}
                                                hideRules={false}
                                                rulesColor={colors.iron[200]}
                                                rulesType="solid"
                                                height={200}
                                                width={screenWidth - 64}
                                                curved
                                                isAnimated
                                                animationDuration={400}
                                                startFillColor={colors.primary.DEFAULT}
                                                endFillColor={colors.primary.DEFAULT}
                                                startOpacity={0.2}
                                                endOpacity={0}
                                                areaChart
                                                yAxisTextStyle={{ color: colors.iron[400], fontSize: 10, fontWeight: '600' }}
                                                xAxisLabelTextStyle={{ color: colors.iron[400], fontSize: 10, fontWeight: '600' }}
                                                initialSpacing={0}
                                                endSpacing={0}
                                                yAxisLabelSuffix=" km/h"
                                                yAxisLabelWidth={45}
                                                xAxisThickness={1}
                                                xAxisColor={colors.iron[200]}
                                                yAxisThickness={0}
                                                pointerConfig={{
                                                    pointerStripHeight: 190,
                                                    pointerStripColor: colors.iron[300],
                                                    pointerStripWidth: 2,
                                                    pointerColor: colors.primary.DEFAULT,
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
                                                            <View style={{ backgroundColor: colors.iron[900], borderWidth: 1, borderColor: colors.iron[700], borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }}>
                                                                <Text style={{ color: colors.iron[400], fontSize: 10, fontWeight: '700' }}>{String(it.label ?? '')}</Text>
                                                                <Text style={{ color: colors.iron[950], fontSize: 15, fontWeight: '900' }}>{speed > 0 ? `${speed} km/h` : '—'}</Text>
                                                            </View>
                                                        );
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <EmptyChartPlaceholder
                                                title="Sin datos de velocidad"
                                                message="Necesitás al menos 2 sesiones con distancia y tiempo para ver velocidad."
                                            />
                                        )
                                    ) : cardioMetric === 'time' ? (
                                        timeSeries.length > 0 ? (
                                            <BarChart
                                                data={timeSeries}
                                                frontColor={colors.primary.DEFAULT}
                                                barWidth={18}
                                                spacing={18}
                                                roundedTop
                                                roundedBottom
                                                hideRules={false}
                                                rulesColor={colors.iron[200]}
                                                rulesType="solid"
                                                xAxisThickness={1}
                                                xAxisColor={colors.iron[200]}
                                                yAxisThickness={0}
                                                height={200}
                                                width={screenWidth - 64}
                                                yAxisTextStyle={{ color: colors.iron[400], fontSize: 10, fontWeight: '600' }}
                                                xAxisLabelTextStyle={{ color: colors.iron[400], fontSize: 10, fontWeight: '600' }}
                                                initialSpacing={0}
                                                endSpacing={0}
                                                isAnimated
                                                animationDuration={400}
                                                yAxisLabelSuffix=" m"
                                                yAxisLabelWidth={36}
                                            />
                                        ) : (
                                            <EmptyChartPlaceholder
                                                title="Sin tiempo registrado"
                                                message="Registrá sesiones con tiempo para ver tu historial."
                                            />
                                        )
                                    ) : (
                                        paceSeries.length > 1 ? (
                                            <LineChart
                                                data={paceSeries}
                                                color={colors.primary.DEFAULT}
                                                thickness={3}
                                                dataPointsColor={colors.primary.DEFAULT}
                                                dataPointsRadius={4}
                                                hideRules={false}
                                                rulesColor={colors.iron[200]}
                                                rulesType="solid"
                                                height={200}
                                                width={screenWidth - 64}
                                                curved
                                                isAnimated
                                                animationDuration={400}
                                                startFillColor={colors.primary.DEFAULT}
                                                endFillColor={colors.primary.DEFAULT}
                                                startOpacity={0.2}
                                                endOpacity={0}
                                                areaChart
                                                yAxisTextStyle={{ color: colors.iron[400], fontSize: 10, fontWeight: '600' }}
                                                xAxisLabelTextStyle={{ color: colors.iron[400], fontSize: 10, fontWeight: '600' }}
                                                formatYLabel={(label: string) => {
                                                    const n = Number(String(label).replace(',', '.'));
                                                    if (!Number.isFinite(n) || n <= 0) return label;
                                                    return formatTimeSeconds(Math.round(n * 60));
                                                }}
                                                initialSpacing={0}
                                                endSpacing={0}
                                                xAxisThickness={1}
                                                xAxisColor={colors.iron[200]}
                                                yAxisThickness={0}
                                                yAxisLabelWidth={45}
                                                pointerConfig={{
                                                    pointerStripHeight: 190,
                                                    pointerStripColor: colors.iron[300],
                                                    pointerStripWidth: 2,
                                                    pointerColor: colors.primary.DEFAULT,
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
                                                            <View style={{ backgroundColor: colors.iron[900], borderWidth: 1, borderColor: colors.iron[700], borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }}>
                                                                <Text style={{ color: colors.iron[400], fontSize: 10, fontWeight: '700' }}>{String(it.label ?? '')}</Text>
                                                                <Text style={{ color: colors.iron[950], fontSize: 15, fontWeight: '900' }}>
                                                                    {paceSec > 0 ? `${formatTimeSeconds(paceSec)}/km` : '—'}
                                                                </Text>
                                                            </View>
                                                        );
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <EmptyChartPlaceholder
                                                title="Sin datos de ritmo"
                                                message="Necesitás al menos 2 sesiones para ver tu ritmo."
                                            />
                                        )
                                    )}
                                </View>
                            </View>
                        </>
                    ) : exType === 'reps_only' ? (
                        <View style={{ borderRadius: 14, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.iron[700], elevation: 1 }}>
                            <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.iron[100], flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: colors.iron[200] }}>
                                <View style={{ width: 5, height: 16, backgroundColor: colors.primary.DEFAULT, borderRadius: 3 }} />
                                <Text style={{ color: colors.iron[950], fontWeight: '900', letterSpacing: -0.3, fontSize: 13, textTransform: 'uppercase' }}>Reps máximas</Text>
                            </View>
                            <View style={{ paddingVertical: 24, alignItems: 'center', backgroundColor: colors.surface }}>
                                {repsSeries.length > 1 ? (
                                    <LineChart
                                        data={repsSeries}
                                        color={colors.primary.DEFAULT}
                                        thickness={3}
                                        dataPointsColor={colors.primary.DEFAULT}
                                        dataPointsRadius={4}
                                        hideRules={false}
                                        rulesColor={colors.iron[200]}
                                        rulesType="solid"
                                        height={200}
                                        width={screenWidth - 64}
                                        curved
                                        isAnimated
                                        animationDuration={400}
                                        startFillColor={colors.primary.DEFAULT}
                                        endFillColor={colors.primary.DEFAULT}
                                        startOpacity={0.2}
                                        endOpacity={0}
                                        areaChart
                                        yAxisTextStyle={{ color: colors.iron[400], fontSize: 10, fontWeight: '600' }}
                                        xAxisLabelTextStyle={{ color: colors.iron[400], fontSize: 10, fontWeight: '600' }}
                                        initialSpacing={0}
                                        endSpacing={0}
                                        yAxisLabelSuffix=" rep"
                                        yAxisLabelWidth={35}
                                        xAxisThickness={1}
                                        xAxisColor={colors.iron[200]}
                                        yAxisThickness={0}
                                    />
                                ) : (
                                    <EmptyChartPlaceholder
                                        title="Sin repeticiones"
                                        message="Necesitás al menos 2 sesiones para ver tu progreso de reps."
                                    />
                                )}
                            </View>
                        </View>
                    ) : (
                        <View style={{ borderRadius: 14, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.iron[700], elevation: 1 }}>
                            <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.iron[100], flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: colors.iron[200] }}>
                                <View style={{ width: 5, height: 16, backgroundColor: colors.primary.DEFAULT, borderRadius: 3 }} />
                                <Text style={{ color: colors.iron[950], fontWeight: '900', letterSpacing: -0.3, fontSize: 13, textTransform: 'uppercase' }}>Peso máximo</Text>
                            </View>
                            <View style={{ paddingVertical: 24, alignItems: 'center', backgroundColor: colors.surface }}>
                                {weightSeries.length > 1 ? (
                                    <LineChart
                                        data={weightSeries}
                                        color={colors.primary.DEFAULT}
                                        thickness={3}
                                        dataPointsColor={colors.primary.DEFAULT}
                                        dataPointsRadius={4}
                                        hideRules={false}
                                        rulesColor={colors.iron[200]}
                                        rulesType="solid"
                                        height={200}
                                        width={screenWidth - 64}
                                        curved
                                        isAnimated
                                        animationDuration={400}
                                        startFillColor={colors.primary.DEFAULT}
                                        endFillColor={colors.primary.DEFAULT}
                                        startOpacity={0.2}
                                        endOpacity={0}
                                        areaChart
                                        yAxisTextStyle={{ color: colors.iron[400], fontSize: 10, fontWeight: '600' }}
                                        xAxisLabelTextStyle={{ color: colors.iron[400], fontSize: 10, fontWeight: '600' }}
                                        initialSpacing={0}
                                        endSpacing={0}
                                        yAxisLabelSuffix={` ${unit}`}
                                        yAxisLabelWidth={35}
                                        xAxisThickness={1}
                                        xAxisColor={colors.iron[200]}
                                        yAxisThickness={0}
                                    />
                                ) : (
                                    <EmptyChartPlaceholder
                                        title="Sin datos de peso"
                                        message="Necesitás al menos 2 sesiones para ver tu progreso de carga."
                                    />
                                )}
                            </View>
                        </View>
                    )}
                </View>
            ) : analysisTab === 'prs' ? (
                <View style={{ gap: 16 }}>
                    <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 24, borderWidth: 1.5, borderColor: colors.border, elevation: 2, shadowColor: ThemeFx.shadowColor, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.iron[200] }}>
                            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primary.DEFAULT + '15', justifyContent: 'center', alignItems: 'center' }}>
                                <Trophy size={20} color={colors.primary.DEFAULT} />
                            </View>
                            <View>
                                <Text style={{ color: colors.iron[950], fontWeight: '900', fontSize: 18, letterSpacing: -0.3 }}>Mejores Marcas</Text>
                                <Text style={{ color: colors.iron[500], fontWeight: '700', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>En el rango seleccionado</Text>
                            </View>
                        </View>

                        {exType === 'weight_reps' ? (
                            <View style={{ gap: 8 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.iron[100], padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.iron[200] }}>
                                    <Text style={{ color: colors.iron[500], fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Serie más pesada</Text>
                                    <Text style={{ color: colors.iron[950], fontWeight: '900', fontSize: 16 }}>{(insights.heaviest?.weight ?? 0)} <Text style={{ color: colors.iron[500], fontSize: 12 }}>{unit} ×</Text> {(insights.heaviest?.reps ?? 0)}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.iron[100], padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.iron[200] }}>
                                    <Text style={{ color: colors.iron[500], fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>1RM Estimado (Epley)</Text>
                                    <Text style={{ color: colors.iron[950], fontWeight: '900', fontSize: 16 }}>{insights.best1rm?.est ?? 0} <Text style={{ color: colors.iron[500], fontSize: 12 }}>{unit}</Text></Text>
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.iron[100], padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.iron[200] }}>
                                    <Text style={{ color: colors.iron[500], fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Carga Max / Sesión</Text>
                                    <Text style={{ color: colors.iron[950], fontWeight: '900', fontSize: 16 }}>{insights.bestSessionVol?.vol ? Math.round(insights.bestSessionVol.vol) : 0}</Text>
                                </View>
                                <Text style={{ color: colors.iron[400], fontSize: 10, marginTop: 12, fontStyle: 'italic', textAlign: 'center' }}>Las PRs se calculan únicamente en base a tus series completadas.</Text>
                            </View>
                        ) : exType === 'distance_time' ? (
                            <View style={{ gap: 8 }}>
                                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                                    {([{ id: 'speed', label: 'Velocidad' }, { id: 'pace', label: 'Ritmo' }, { id: 'distance', label: 'Distancia' }, { id: 'time', label: 'Tiempo' }] as const).map((m) =>
                                        renderChip(m.id, m.label, cardioPrimaryPR === m.id, () => void setCardioPrimaryPRPersisted(m.id))
                                    )}
                                </View>

                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.primary.DEFAULT + '10', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.primary.DEFAULT + '30' }}>
                                    <Text style={{ color: colors.primary.DEFAULT, fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                        {cardioPrimaryPR === 'distance' ? 'Mejor distancia' : cardioPrimaryPR === 'time' ? 'Mayor tiempo' : cardioPrimaryPR === 'pace' ? 'Mejor ritmo' : 'Mejor velocidad'}
                                    </Text>
                                    <Text style={{ color: colors.primary.DEFAULT, fontWeight: '900', fontSize: 18 }}>
                                        {cardioPrimaryPR === 'distance' ? `${insights.bestSessionDistance?.distKm != null ? (Math.round(insights.bestSessionDistance.distKm * 100) / 100) : 0} km` : cardioPrimaryPR === 'time' ? (insights.bestSessionTime?.timeSec ? formatTimeSeconds(insights.bestSessionTime.timeSec) : '—') : cardioPrimaryPR === 'pace' ? (insights.bestPace?.paceSecPerKm ? `${formatTimeSeconds(insights.bestPace.paceSecPerKm)}/km` : '—') : `${insights.bestSpeed?.speedKmh != null ? (Math.round(insights.bestSpeed.speedKmh * 10) / 10) : 0} km/h`}
                                    </Text>
                                </View>
                            </View>
                        ) : exType === 'reps_only' ? (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.iron[100], padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.iron[200] }}>
                                <Text style={{ color: colors.iron[500], fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Serie más larga</Text>
                                <Text style={{ color: colors.iron[950], fontWeight: '900', fontSize: 16 }}>{insights.bestReps?.reps ?? 0} <Text style={{ color: colors.iron[500], fontSize: 12 }}>reps</Text></Text>
                            </View>
                        ) : (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.iron[100], padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.iron[200] }}>
                                <Text style={{ color: colors.iron[500], fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Serie más pesada</Text>
                                <Text style={{ color: colors.iron[950], fontWeight: '900', fontSize: 16 }}>{insights.heaviest?.weight ?? 0} <Text style={{ color: colors.iron[500], fontSize: 12 }}>{unit}</Text></Text>
                            </View>
                        )}
                    </View>
                </View>
            ) : (
                <View style={{ gap: 16 }}>
                    <IronCard>
                        <Text style={{ color: colors.iron[950], fontWeight: '900', fontSize: 16, marginBottom: 16, letterSpacing: -0.3 }}>Herramientas</Text>
                        <TouchableOpacity
                            onPress={() => useTimerStore.getState().startTimer(configService.get('defaultRestTimer'))}
                            style={{ backgroundColor: colors.primary.DEFAULT, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: colors.primary.DEFAULT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 }}
                            accessibilityRole="button"
                            accessibilityLabel="Iniciar descanso"
                        >
                            <Text style={{ color: colors.white, fontWeight: '900', fontSize: 14 }}>Iniciar descanso ({configService.get('defaultRestTimer')}s)</Text>
                            <Timer size={18} color={colors.white} />
                        </TouchableOpacity>

                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            {[60, 90, 120].map((s) => (
                                <TouchableOpacity
                                    key={s}
                                    onPress={async () => { await configService.set('defaultRestTimer', s); useTimerStore.getState().startTimer(s); }}
                                    style={{ flex: 1, backgroundColor: colors.iron[200], paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' }}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Iniciar descanso de ${s} segundos`}
                                >
                                    <Text style={{ color: colors.iron[950], fontWeight: '800', fontSize: 14 }}>{s}s</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={{ height: 1, backgroundColor: colors.iron[200], marginVertical: 16 }} />

                        <TouchableOpacity
                            onPress={() => router.push('/tools/plate-calculator' as any)}
                            style={{ backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.iron[700] }}
                            accessibilityRole="button"
                            accessibilityLabel="Abrir calculadora de discos"
                        >
                            <Text style={{ color: colors.iron[950], fontWeight: '800', fontSize: 14 }}>Calculadora de discos</Text>
                            <Text style={{ color: colors.iron[400], fontSize: 12, marginTop: 4 }}>Útil si no llegas exacto: muestra alternativas por arriba/abajo.</Text>
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
        <SafeAreaWrapper style={{ flex: 1, backgroundColor: colors.iron[900] }} edges={['bottom', 'left', 'right']}>
            <Stack.Screen options={{
                title: currentExercise?.name || exerciseName || 'Exercise',
                headerBackTitle: 'Volver',
                headerTitleStyle: { fontWeight: '900', color: colors.iron[950], fontSize: 16, letterSpacing: -0.3 } as any,
                headerStyle: { backgroundColor: colors.iron[900] },
                headerTintColor: colors.primary.DEFAULT,
                headerRight: () => (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        {!workoutId && (
                            <TouchableOpacity
                                onPress={() => setIsConfigVisible(true)}
                                style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.iron[200], borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' }}
                            >
                                <Pencil size={16} color={colors.iron[500]} />
                            </TouchableOpacity>
                        )}
                        {workoutId && (exType === 'weight_reps' || exType === 'weight_only') && (
                            <TouchableOpacity
                                onPress={() => {
                                    if (workoutLocked) { notify.info('Bloqueado', 'El entrenamiento finalizó. Para editar debés reabrirlo.'); return; }
                                    setWarmupVisible(true);
                                }}
                                style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: withAlpha(colors.yellow, '15'), borderWidth: 1, borderColor: withAlpha(colors.yellow, '30'), justifyContent: 'center', alignItems: 'center' }}
                                accessibilityRole="button"
                                accessibilityLabel="Abrir calculadora de calentamiento"
                            >
                                <Zap size={16} color={colors.yellow} fill={colors.yellow} />
                            </TouchableOpacity>
                        )}
                    </View>
                )
            }} />

            {notes && (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: withAlpha(colors.yellow, '10'), borderBottomWidth: 1, borderBottomColor: withAlpha(colors.yellow, '25'), padding: 12 }}>
                    <View style={{ width: 3, height: '100%' as any, borderRadius: 2, backgroundColor: colors.yellow, marginRight: 10, minHeight: 18 }} />
                    <Info size={14} color={colors.yellow} style={{ marginTop: 1, marginRight: 8 }} />
                    <Text style={{ color: colors.yellow, fontWeight: '700', flex: 1, fontSize: 13, lineHeight: 18 }}>{notes}</Text>
                </View>
            )}

            <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, backgroundColor: colors.iron[900] }}>
                <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.surface, padding: 4, borderRadius: 14, borderWidth: 1, borderColor: colors.iron[700] }}>
                    {availableTabs.map(tab => (
                        <TouchableOpacity
                            key={tab}
                            onPress={() => setActiveTab(tab)}
                            style={{
                                flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
                                ...(activeTab === tab ? { backgroundColor: colors.primary.DEFAULT } : {})
                            }}
                        >
                            <Text style={{
                                fontWeight: '800', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5,
                                color: activeTab === tab ? colors.white : colors.iron[500]
                            }}>
                                {tab === 'track' ? 'Registrar' : tab === 'history' ? 'Historial' : 'Análisis'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 100 }}>
                {currentExercise?.badges && currentExercise.badges.length > 0 && (
                    <View style={{ marginBottom: 16 }}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ gap: 8 }}
                        >
                            {currentExercise.badges.map((b, i) => (
                                <BadgePill key={i} name={b.name} color={b.color} icon={b.icon} size="sm" />
                            ))}
                        </ScrollView>
                    </View>
                )}
                {loading ? (
                    <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                        <Text style={{ color: colors.iron[500], fontWeight: '700' }}>Cargando…</Text>
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
