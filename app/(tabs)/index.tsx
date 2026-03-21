import { CopyWorkoutModal } from '@/components/CopyWorkoutModal';
import { DateStrip } from '@/components/DateStrip';
import { ExerciseList } from '@/components/ExerciseList';
import { HistoryModal } from '@/components/HistoryModal';
import { IntervalTimerModal } from '@/components/IntervalTimerModal';
import { LoadRoutineModal } from '@/components/LoadRoutineModal';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { WorkoutLog } from '@/components/WorkoutLog';
import { WorkoutStatusBar } from '@/components/WorkoutStatusBar';
import { useDataReload } from '@/src/hooks/useDataReload';
import { ChangelogService } from '@/src/services/ChangelogService';
import { configService } from '@/src/services/ConfigService';
import { RoutineDayWithExercises } from '@/src/services/RoutineService';
import { confirm } from '@/src/store/confirmStore';
import { useTimerStore } from '@/src/store/timerStore';
import { formatTimeSeconds } from '@/src/utils/time';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { addDays, subDays } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { BookOpen, Check, Copy, Info, Plus, Timer, Wrench, X } from 'lucide-react-native';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IronTrainLogo } from '../../components/IronTrainLogo';
import { useColors } from '../../src/hooks/useColors';
import { workoutService } from '../../src/services/WorkoutService';
import { ThemeFx } from '../../src/theme';
import { ExerciseType, Workout, WorkoutSet } from '../../src/types/db';
import { logger } from '../../src/utils/logger';
import { notify } from '../../src/utils/notify';

export default function DailyLogScreen() {
  const router = useRouter();
  const colors = useColors();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [activeWorkoutIndex, setActiveWorkoutIndex] = useState(0);
  const workout = workouts[activeWorkoutIndex] || null;

  const [sets, setSets] = useState<(WorkoutSet & { exercise_name: string; category_color: string; exercise_type: ExerciseType })[]>([]);
  const [loading, setLoading] = useState(true);
  const [markedDates, setMarkedDates] = useState<Record<string, any>>({});
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [loadRoutineModalVisible, setLoadRoutineModalVisible] = useState(false);
  const [timerVisible, setTimerVisible] = useState(false);

  // History State
  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyData, setHistoryData] = useState<{ date: number; sets: WorkoutSet[] }[]>([]);
  const [historyExerciseName, setHistoryExerciseName] = useState('');
  const [historyExerciseType, setHistoryExerciseType] = useState<ExerciseType>('weight_reps');
  const [hasNewChangelog, setHasNewChangelog] = useState(false);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);

  const insets = useSafeAreaInsets();
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
  const bottomOffset = (tabBarHeight ? tabBarHeight : insets.bottom) + 12;

  // --- Data Loading ---
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const dayWorkouts = await workoutService.getWorkoutsForDate(selectedDate);
      setWorkouts(dayWorkouts);

      // If we change date, reset index to 0 (most recent)
      setActiveWorkoutIndex(0);

      if (dayWorkouts.length > 0) {
        const workoutSets = await workoutService.getSets(dayWorkouts[0].id);
        setSets(workoutSets);
      } else {
        // No sessions found for this date. We'll show an empty state instead of 
        // automatically creating a session to avoid "garbage" records.
        setWorkouts([]);
        setSets([]);
      }

      const events = await workoutService.getCalendarEvents();
      setMarkedDates(events);

    } catch (e) {
      logger.captureException(e, { scope: 'HomeTab.loadData', message: 'Failed to load workout data' });
      notify.error('Error', 'No se pudo cargar el entrenamiento.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  // Update sets when active session changes
  const refreshActiveSessionSets = useCallback(async (index: number) => {
    const target = workouts[index];
    if (!target) return;
    try {
      const s = await workoutService.getSets(target.id);
      setSets(s);
    } catch (e) {
      logger.captureException(e, { scope: 'HomeTab.refreshActiveSessionSets' });
    }
  }, [workouts]);

  // Lightweight refresh — updates workout + calendar without showing loading spinner
  const refreshWorkoutOnly = useCallback(async () => {
    try {
      const dayWorkouts = await workoutService.getWorkoutsForDate(selectedDate);
      setWorkouts(dayWorkouts);

      const current = dayWorkouts[activeWorkoutIndex];
      if (current) {
        const s = await workoutService.getSets(current.id);
        setSets(s);
      }

      const events = await workoutService.getCalendarEvents();
      setMarkedDates(events);
    } catch (e) {
      logger.captureException(e, { scope: 'HomeTab.refreshWorkoutOnly', message: 'Failed to refresh workout' });
    }
  }, [selectedDate, activeWorkoutIndex]);

  // Reload when date changes or screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();

      const checkChangelogBadge = async () => {
        const latestRelease = await ChangelogService.getLatestRelease();
        const latestVersion = latestRelease?.version;
        const lastViewed = configService.get('lastViewedChangelogVersion');
        setHasNewChangelog(!!latestVersion && latestVersion !== lastViewed);
      };

      checkChangelogBadge();
    }, [loadData]) // Re-fetch on focus just in case
  );

  useDataReload(loadData);

  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionTicker, setSessionTicker] = useState(0);

  // Modal local ticker
  useEffect(() => {
    let interval: any;
    if (showSessionModal) {
      interval = setInterval(() => {
        setSessionTicker(t => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showSessionModal]);

  // Add Set logic
  const handleAddSet = useCallback(async (exerciseId: string) => {
    if (!workout) return;
    try {
      await workoutService.addSet(workout.id, exerciseId, 'normal');
      // Just refresh sets for the current session, no need to reload everything
      const updatedSets = await workoutService.getSets(workout.id);
      setSets(updatedSets);

      // Refresh markers on the DateStrip
      refreshWorkoutOnly();

      setIsPickerVisible(false);
      notify.success('Serie agregada', 'Ejercicio añadido al entrenamiento.');
    } catch (e: any) {
      notify.error('Fallo de conexión', e?.message || 'No se pudo agregar el ejercicio.');
    }
  }, [workout]);

  const handleStartNewSession = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await workoutService.startNewSession(selectedDate);
      await loadData();
      notify.success('Nueva sesión', 'Se ha iniciado un nuevo entrenamiento.');
    } catch (e) {
      logger.captureException(e, { scope: 'HomeTab.handleStartNewSession' });
      notify.error('Error', 'No se pudo iniciar la sesión.');
    }
  }, [selectedDate, loadData]);

  const handleLoadRoutineDay = useCallback(async (day: RoutineDayWithExercises) => {
    let targetWorkoutId = workout?.id;
    if (!targetWorkoutId) {
      try {
        const newWorkout = await workoutService.startNewSession(selectedDate);
        targetWorkoutId = newWorkout.id;
      } catch (e) {
        notify.error('Error', 'No se pudo crear la sesión para cargar la rutina.');
        return;
      }
    }

    try {
      for (const ex of day.exercises) {
        await workoutService.addSet(targetWorkoutId, ex.exercise_id, 'normal', {
          notes: ex.notes || undefined
        });
      }
      loadData();
      notify.success('Rutina cargada', `${day.name} fue añadido al entrenamiento.`);
    } catch (e: any) {
      notify.error('Fallo de carga', e?.message || 'No se pudo cargar la rutina.');
    }
  }, [workout, selectedDate, loadData]);

  const handleCopySet = useCallback(async (originalSetId: string) => {
    if (!workout) return;
    const originalSet = sets.find(s => s.id === originalSetId);
    if (!originalSet) return;

    try {
      await workoutService.addSet(workout.id, originalSet.exercise_id, originalSet.type, {
        weight: originalSet.weight,
        reps: originalSet.reps,
        distance: (originalSet as any).distance,
        time: (originalSet as any).time,
        notes: originalSet.notes,
        rpe: originalSet.rpe
      });
      refreshActiveSessionSets(activeWorkoutIndex);
      refreshWorkoutOnly(); // Refresh indicators
      notify.success('Serie multiplicada', 'Los valores se han copiado exitosamente.');
    } catch (e: any) {
      notify.error('Error al clonar', e?.message || 'Fallo general de base de datos.');
    }
  }, [workout, sets, activeWorkoutIndex, refreshActiveSessionSets]);

  const handleUpdateSet = useCallback(async (setId: string, updates: Partial<WorkoutSet>) => {
    const prevSet = sets.find(s => s.id === setId);
    const prevSetsSnapshot = sets;
    const shouldAutoRest =
      updates.completed === 1 &&
      prevSet?.completed !== 1 &&
      configService.get('autoStartRestTimerOnSetComplete');

    // Optimistic update
    setSets(prev => prev.map(s => s.id === setId ? { ...s, ...updates } : s));

    try {
      await workoutService.updateSet(setId, updates);

      // If categories might have changed or status might have changed, refresh indicators
      refreshWorkoutOnly();

      if (shouldAutoRest) {
        useTimerStore.getState().startTimer(configService.get('defaultRestTimer'));
      }
    } catch (e: any) {
      setSets(prevSetsSnapshot);
      notify.error('Datos revertidos', e?.message || 'Fallo de integridad al actualizar.');
    }
  }, [sets]);

  const handleDeleteSet = useCallback(async (setId: string) => {
    try {
      await workoutService.deleteSet(setId);
      refreshActiveSessionSets(activeWorkoutIndex);
      refreshWorkoutOnly(); // Refresh indicators
      notify.success('Descartada', 'La serie fue eliminada.');
    } catch (e: any) {
      notify.error('Operación fallida', e?.message || 'No se pudo borrar la serie.');
    }
  }, [activeWorkoutIndex, refreshActiveSessionSets]);

  const handleLinkExercise = useCallback(async (exerciseId: string) => {
    if (!workout) return;

    // derived ordered list of exercise IDs
    const uniqueExercises = Array.from(new Set(sets.map(s => s.exercise_id)));
    const currentIndex = uniqueExercises.indexOf(exerciseId);

    if (currentIndex === -1 || currentIndex >= uniqueExercises.length - 1) {
      notify.warning('Movimiento inválido', 'No hay un ejercicio debajo para enlazar.');
      return;
    }

    const nextExerciseId = uniqueExercises[currentIndex + 1];

    // Check if they are already in supersets
    const currentSet = sets.find(s => s.exercise_id === exerciseId);
    const nextSet = sets.find(s => s.exercise_id === nextExerciseId);

    if (!currentSet || !nextSet) return;

    if (currentSet.superset_id && nextSet.superset_id && currentSet.superset_id === nextSet.superset_id) {
      notify.warning('Atención', 'Estos ejercicios ya están enlazados.');
      return;
    }

    try {
      if (currentSet.superset_id) {
        await workoutService.addToSuperset(workout.id, currentSet.superset_id, nextExerciseId);
      } else if (nextSet.superset_id) {
        await workoutService.addToSuperset(workout.id, nextSet.superset_id, exerciseId);
      } else {
        await workoutService.createSuperset(workout.id, [exerciseId, nextExerciseId]);
      }
      refreshActiveSessionSets(activeWorkoutIndex);
      notify.success('Ejercicios unidos', 'Superset configurado.');
    } catch (e: any) {
      notify.error('Error en Superset', e?.message || 'No fue posible unirlos.');
    }
  }, [workout, sets, activeWorkoutIndex, refreshActiveSessionSets]);

  const handleUnlinkExercise = useCallback(async (exerciseId: string) => {
    if (!workout) return;
    try {
      await workoutService.removeFromSuperset(workout.id, exerciseId);
      refreshActiveSessionSets(activeWorkoutIndex);
      notify.success('Desvinculado', 'El ejercicio es independiente de nuevo.');
    } catch (e: any) {
      notify.error('No se pudo desvincular', e?.message || 'Error general de red.');
    }
  }, [workout, activeWorkoutIndex, refreshActiveSessionSets]);

  const handleViewHistory = useCallback(async (exerciseId: string) => {
    const exSet = sets.find(s => s.exercise_id === exerciseId);
    const name = exSet?.exercise_name || 'Ejercicio';
    setHistoryExerciseName(name);
    setHistoryExerciseType(exSet?.exercise_type ?? 'weight_reps');

    // Fetch
    const history = await workoutService.getExerciseHistory(exerciseId);
    setHistoryData(history);
    setHistoryVisible(true);
  }, [sets]);

  const handleAddButton = () => {
    setIsPickerVisible(true);
  };

  // Swipe Gesture
  const changeDate = (direction: 'next' | 'prev') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newDate = direction === 'next' ? addDays(selectedDate, 1) : subDays(selectedDate, 1);
    setSelectedDate(newDate);
  };
  const handleSessionSwitch = async (index: number) => {
    setActiveWorkoutIndex(index);
    setShowSessionModal(false);

    // Timer safety: If switching to an active session, focus it in the notification
    const target = workouts[index];
    if (target && target.status === 'in_progress') {
      const hasStart = !!configService.getGeneric(`runningWorkoutTimerStartTimestamp_${target.id}`);
      if (hasStart) {
        await configService.set('runningWorkoutTimerWorkoutId', target.id);
      }
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDeleteSession = async (workoutId: string) => {
    confirm.ask(
      '¿Eliminar Sesión?',
      'Esta acción borrará este entrenamiento y todas sus series de forma permanente.',
      async () => {
        try {
          await workoutService.deleteWorkout(workoutId);

          // If we deleted the "focused" timer session, clear global focus
          const focusedId = configService.get('runningWorkoutTimerWorkoutId');
          if (focusedId === workoutId) {
            await configService.set('runningWorkoutTimerWorkoutId', null);
          }

          // Refresh local data
          const updated = await workoutService.getWorkoutsForDate(selectedDate);
          setWorkouts(updated);

          if (updated.length === 0) {
            setActiveWorkoutIndex(-1);
          } else {
            // Try to stay on the same relative index
            setActiveWorkoutIndex(Math.min(activeWorkoutIndex, updated.length - 1));
          }

          notify.success('Cerrado', 'Sesión eliminada correctamente.');
          setShowSessionModal(false);
        } catch (e: any) {
          notify.error('Error', e?.message ?? 'No se pudo eliminar.');
        }
      },
      'Eliminar'
    );
  };

  const panGesture = Gesture.Pan()
    .enabled(!isCalendarExpanded)
    .activeOffsetX([-20, 20]) // Only activate on horizontal swipe
    .onEnd((e) => {
      if (e.translationX < -50) {
        runOnJS(changeDate)('next');
      } else if (e.translationX > 50) {
        runOnJS(changeDate)('prev');
      }
    });

  const sessionStatus = useMemo(() => {
    if (loading || workouts.length === 0) return null;
    const total = workouts.length;
    const completed = workouts.filter(w => w.status === 'completed').length;
    const inProgress = workouts.filter(w => w.status === 'in_progress').length;

    if (inProgress > 0) return { border: colors.blue, bg: ThemeFx.withAlpha(colors.blue, 0.15), text: colors.blue };
    if (completed === total) return { border: colors.green, bg: ThemeFx.withAlpha(colors.green, 0.15), text: colors.green };
    if (completed > 0) return { border: colors.yellow, bg: ThemeFx.withAlpha(colors.yellow, 0.15), text: colors.yellow };
    return { border: colors.border, bg: colors.surface, text: colors.textMuted };
  }, [loading, workouts, colors]);

  return (
    <SafeAreaWrapper edges={['top', 'left', 'right']} style={{ backgroundColor: colors.background }}>
      <GestureDetector gesture={panGesture}>
        <View>
          <DateStrip
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onExpandedChange={setIsCalendarExpanded}
            markedDates={markedDates}
            headerCenter={
              <IronTrainLogo size={60} />
            }
            headerRight={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {/* Compact Session Pill */}
                {sessionStatus && (
                  <TouchableOpacity
                    onPress={() => setShowSessionModal(true)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: sessionStatus.bg,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor: sessionStatus.border,
                      ...ThemeFx.shadowSm,
                    }}
                  >
                    <Text style={{
                      fontSize: 12,
                      fontWeight: '900',
                      color: sessionStatus.text,
                      letterSpacing: -0.2
                    }}>
                      {workouts.filter(w => w.status === 'completed').length}/{workouts.length}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Vertical Divider */}
                <View style={{ width: 1.5, height: 20, backgroundColor: colors.border, marginHorizontal: 2 }} />

                {/* Changelog Info */}
                <Link href="/changelog" asChild>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: colors.surface,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1.5,
                      borderColor: colors.border,
                      ...ThemeFx.shadowSm,
                    }}
                  >
                    <Info size={19} color={hasNewChangelog ? colors.primary.DEFAULT : colors.textMuted} />
                    {hasNewChangelog && (
                      <View style={{
                        position: 'absolute',
                        top: -1,
                        right: -1,
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: colors.red,
                        borderWidth: 1.5,
                        borderColor: colors.background
                      }} />
                    )}
                  </TouchableOpacity>
                </Link>
              </View>
            }
          />
        </View>
      </GestureDetector>

      {/* Workout Status Bar — Tri-state: idle → active → completed */}
      {
        workout && (
          <WorkoutStatusBar
            workout={workout}
            sets={sets}
            onStatusChange={refreshWorkoutOnly}
            sessionNumber={workouts.length - activeWorkoutIndex}
          />
        )
      }

      {
        loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
          </View>
        ) : workouts.length === 0 ? (
          /* Empty State View */
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: ThemeFx.withAlpha(colors.surface, 0.5),
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 20
            }}>
              <Plus size={40} color={colors.textMuted} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' }}>
              No hay entrenamientos
            </Text>
            <Text style={{ fontSize: 15, color: colors.textMuted, textAlign: 'center', marginTop: 8, marginBottom: 32 }}>
              Presiona el botón para iniciar tu primera sesión del día.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <TouchableOpacity
                onPress={handleStartNewSession}
                style={{
                  backgroundColor: colors.primary.DEFAULT,
                  paddingHorizontal: 24,
                  paddingVertical: 14,
                  borderRadius: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  ...ThemeFx.shadowSm,
                  shadowColor: colors.primary.DEFAULT
                }}
              >
                <Plus size={18} color={colors.onPrimary} style={{ marginRight: 6 }} />
                <Text style={{ color: colors.onPrimary, fontWeight: '800', fontSize: 14 }}>
                  Nuevo
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setLoadRoutineModalVisible(true)}
                style={{
                  backgroundColor: colors.surface,
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  borderRadius: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  ...ThemeFx.shadowSm,
                }}
              >
                <BookOpen size={18} color={colors.text} style={{ marginRight: 6 }} />
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14 }}>
                  Rutina
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  if (!workout) {
                    try {
                      await workoutService.startNewSession(selectedDate);
                      await loadData();
                    } catch (e) {
                      notify.error('Error', 'No se pudo preparar el entrenamiento.');
                      return;
                    }
                  }
                  setCopyModalVisible(true);
                }}
                style={{
                  backgroundColor: colors.surface,
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  borderRadius: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  ...ThemeFx.shadowSm,
                }}
              >
                <Copy size={18} color={colors.text} style={{ marginRight: 6 }} />
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14 }}>
                  Historial
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/(tabs)/analysis' as any)}
                style={{
                  backgroundColor: colors.surface,
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  borderRadius: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  ...ThemeFx.shadowSm,
                }}
              >
                <Wrench size={18} color={colors.text} style={{ marginRight: 6 }} />
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14 }}>
                  Herramientas
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <WorkoutLog
              key={workout?.id} // Force re-mount or re-render of list when session changes
              sets={sets}
              onExercisePress={(exId, exName) => {
                router.push({
                  pathname: '/exercise/[id]' as any,
                  params: { id: exId, workoutId: workout?.id, exerciseId: exId, exerciseName: exName }
                });
              }}
              workoutId={workout?.id || ''}
              onRefresh={loadData}
              onCopyPress={() => setCopyModalVisible(true)}
              onLoadRoutinePress={() => setLoadRoutineModalVisible(true)}
            />
          </View>
        )
      }

      {/* ... FAB ... */}
      {
        !loading && (
          <TouchableOpacity
            onPress={handleAddButton}
            style={{
              position: 'absolute',
              bottom: bottomOffset,
              right: 24,
              zIndex: 20,
              width: 56,
              height: 56,
              backgroundColor: colors.primary.DEFAULT,
              borderRadius: 28,
              alignItems: 'center',
              justifyContent: 'center',
              ...ThemeFx.shadowLg,
              shadowColor: colors.primary.DEFAULT,
              shadowOpacity: 0.35,
            }}
          >
            <Plus color={colors.onPrimary} size={28} />
          </TouchableOpacity>
        )
      }

      {/* ... Pickers ... */}
      <Modal visible={isPickerVisible} transparent animationType="fade" onRequestClose={() => setIsPickerVisible(false)}>
        <View style={{ flex: 1, backgroundColor: ThemeFx.backdropStrong, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 48 }}>
          <View style={{
            backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border,
            borderRadius: 32, flex: 1, maxHeight: '95%', width: '100%', overflow: 'hidden',
            ...ThemeFx.shadowLg,
          }}>
            {/* Modal Header — CopyWorkoutModal pattern */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: colors.surface, borderBottomWidth: 1.5, borderBottomColor: colors.border }}>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '900', color: colors.text, letterSpacing: -0.3 }}>Seleccionar ejercicio</Text>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>Tocá uno para agregarlo al entrenamiento</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsPickerVisible(false)}
                style={{ padding: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Cerrar selector de ejercicios"
              >
                <X color={colors.text} size={18} />
              </TouchableOpacity>
            </View>

            {/* List */}
            <View style={{ flex: 1 }}>
              <ExerciseList onSelect={handleAddSet} inModal />
            </View>
          </View>
        </View>
      </Modal>

      <HistoryModal
        visible={historyVisible}
        onClose={() => setHistoryVisible(false)}
        history={historyData}
        exerciseName={historyExerciseName}
        exerciseType={historyExerciseType}
      />

      <CopyWorkoutModal
        visible={copyModalVisible}
        onClose={() => setCopyModalVisible(false)}
        targetDate={selectedDate}
        targetWorkoutId={workout?.id || ''}
        onCopyComplete={loadData}
        markedDates={markedDates}
      />

      {/* Session Management Modal */}
      <Modal
        visible={showSessionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSessionModal(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
          onPress={() => setShowSessionModal(false)}
          activeOpacity={1}
        >
          <View style={{
            width: '100%',
            maxWidth: 320,
            backgroundColor: colors.background,
            borderRadius: 24,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.border,
            ...ThemeFx.shadowLg
          }}>
            <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text }}>Sesiones de Hoy</Text>
              <TouchableOpacity onPress={() => setShowSessionModal(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 300 }}>
              {workouts.map((w, idx) => {
                const isActive = activeWorkoutIndex === idx;
                const setNum = workouts.length - idx;
                return (
                  <TouchableOpacity
                    key={w.id}
                    onPress={() => handleSessionSwitch(idx)}
                    style={{
                      padding: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: isActive ? ThemeFx.withAlpha(colors.primary.DEFAULT, 0.05) : 'transparent',
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border
                    }}
                  >
                    <View style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: isActive ? colors.primary.DEFAULT : colors.surface,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12
                    }}>
                      <Text style={{ fontSize: 13, fontWeight: '900', color: isActive ? colors.onPrimary : colors.textMuted }}>{setNum}</Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>
                        {w.name || `Sesión ${setNum}`}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        {w.status === 'completed' ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Check size={10} color={colors.green} strokeWidth={3} style={{ marginRight: 4 }} />
                            <Text style={{ fontSize: 12, color: colors.green, fontWeight: '600' }}>Completado</Text>
                          </View>
                        ) : (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.blue, marginRight: 6 }} />
                            <Text style={{ fontSize: 12, color: colors.textMuted }}>En progreso</Text>
                          </View>
                        )}
                        <Text style={{ fontSize: 12, color: colors.textMuted }}>
                          {' • '}
                          {(() => {
                            const rawDur = Number(w.duration) || 0;
                            let totalSec = rawDur;

                            const startTs = configService.getGeneric(`runningWorkoutTimerStartTimestamp_${w.id}`);
                            const baseSec = configService.getGeneric(`runningWorkoutTimerBaseSeconds_${w.id}`);

                            if (typeof startTs === 'number' && startTs > 0) {
                              const b = typeof baseSec === 'number' ? baseSec : 0;
                              totalSec = b + Math.floor((Date.now() - startTs) / 1000);
                            } else if (typeof baseSec === 'number') {
                              totalSec = Math.max(rawDur, baseSec);
                            }

                            return formatTimeSeconds(totalSec);
                          })()}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeleteSession(w.id);
                      }}
                      style={{ padding: 8 }}
                    >
                      <X size={18} color={colors.red} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              onPress={() => {
                setShowSessionModal(false);
                handleStartNewSession();
              }}
              style={{ padding: 20, backgroundColor: colors.surface, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
            >
              <Plus size={18} color={colors.primary.DEFAULT} />
              <Text style={{ fontSize: 15, fontWeight: '800', color: colors.primary.DEFAULT }}>Nueva Sesión</Text>
            </TouchableOpacity>

            <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: ThemeFx.withAlpha(colors.surface, 0.5) }}>
              <TouchableOpacity
                onPress={() => {
                  setShowSessionModal(false);
                  router.push('/(tabs)/analysis' as any);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 12,
                  borderRadius: 16,
                  backgroundColor: colors.surface,
                  borderWidth: 1.5,
                  borderColor: colors.border,
                }}
              >
                <Wrench size={16} color={colors.primary.DEFAULT} style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>Análisis y Herramientas</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <LoadRoutineModal
        visible={loadRoutineModalVisible}
        onClose={() => setLoadRoutineModalVisible(false)}
        onLoadDay={handleLoadRoutineDay}
      />

      <IntervalTimerModal
        visible={timerVisible}
        onClose={() => setTimerVisible(false)}
      />

      {/* Timer FAB (Left Side) */}
      {
        !loading && (
          <TouchableOpacity
            onPress={() => setTimerVisible(true)}
            style={{
              position: 'absolute',
              bottom: bottomOffset,
              left: 24,
              zIndex: 20,
              width: 52,
              height: 52,
              backgroundColor: colors.surface,
              borderRadius: 26,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1.5,
              borderColor: colors.border,
              ...ThemeFx.shadowSm,
            }}
          >
            <Timer color={colors.text} size={24} />
          </TouchableOpacity>
        )
      }
    </SafeAreaWrapper >
  );
}
