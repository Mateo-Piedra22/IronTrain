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
import { useTimerStore } from '@/src/store/timerStore';
import { notify } from '@/src/utils/notify';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { addDays, subDays } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { Info, Plus, Timer, X } from 'lucide-react-native';
import React, { useCallback, useContext, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../../src/hooks/useColors';
import { workoutService } from '../../src/services/WorkoutService';
import { ThemeFx } from '../../src/theme';
import { ExerciseType, Workout, WorkoutSet } from '../../src/types/db';

export default function DailyLogScreen() {
  const router = useRouter();
  const colors = useColors();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [workout, setWorkout] = useState<Workout | null>(null);
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

  const loadData = async () => {
    setLoading(true);
    try {
      const activeWorkout = await workoutService.getActiveWorkout(selectedDate);
      setWorkout(activeWorkout);

      const workoutSets = await workoutService.getSets(activeWorkout.id);
      setSets(workoutSets);

      // Load calendar marks (Rich events)
      const events = await workoutService.getCalendarEvents();
      // DateStrip expects this exact format { status, colors }
      setMarkedDates(events);

    } catch (e) {
      console.error('Failed to load workout data', e);
    } finally {
      setLoading(false);
    }
  };

  // Lightweight refresh — updates workout + calendar without showing loading spinner
  const refreshWorkoutOnly = async () => {
    try {
      const activeWorkout = await workoutService.getActiveWorkout(selectedDate);
      setWorkout(activeWorkout);
      const events = await workoutService.getCalendarEvents();
      setMarkedDates(events);
    } catch (e) {
      console.error('Failed to refresh workout', e);
    }
  };

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
    }, [selectedDate]) // Re-fetch on focus just in case
  );

  useDataReload(() => {
    loadData();
  });

  const [isPickerVisible, setIsPickerVisible] = useState(false);

  const handleAddSet = async (exerciseId: string) => {
    if (!workout) return;
    try {
      await workoutService.addSet(workout.id, exerciseId, 'normal');
      loadData();
      setIsPickerVisible(false);
      notify.success('Serie agregada', 'Ejercicio añadido al entrenamiento.');
    } catch (e: any) {
      notify.error('Fallo de conexión', e?.message || 'No se pudo agregar el ejercicio.');
    }
  };

  const handleLoadRoutineDay = async (day: RoutineDayWithExercises) => {
    if (!workout) return;
    try {
      for (const ex of day.exercises) {
        await workoutService.addSet(workout.id, ex.exercise_id, 'normal', {
          notes: ex.notes || undefined
        });
      }
      loadData();
      notify.success('Rutina cargada', `${day.name} fue añadido al entrenamiento.`);
    } catch (e: any) {
      notify.error('Fallo de carga', e?.message || 'No se pudo cargar la rutina.');
    }
  };

  const handleCopySet = async (originalSetId: string) => {
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
      loadData();
      notify.success('Serie multiplicada', 'Los valores se han copiado exitosamente.');
    } catch (e: any) {
      notify.error('Error al clonar', e?.message || 'Fallo general de base de datos.');
    }
  };

  const handleUpdateSet = async (setId: string, updates: Partial<WorkoutSet>) => {
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
      if (shouldAutoRest) {
        useTimerStore.getState().startTimer(configService.get('defaultRestTimer'));
      }
    } catch (e: any) {
      setSets(prevSetsSnapshot);
      notify.error('Datos revertidos', e?.message || 'Fallo de integridad al actualizar.');
    }
  };

  const handleDeleteSet = async (setId: string) => {
    try {
      await workoutService.deleteSet(setId);
      loadData();
      notify.success('Descartada', 'La serie fue eliminada.');
    } catch (e: any) {
      notify.error('Operación fallida', e?.message || 'No se pudo borrar la serie.');
    }
  };

  const handleLinkExercise = async (exerciseId: string) => {
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
      loadData();
      notify.success('Ejercicios unidos', 'Superset configurado.');
    } catch (e: any) {
      notify.error('Error en Superset', e?.message || 'No fue posible unirlos.');
    }
  };

  const handleUnlinkExercise = async (exerciseId: string) => {
    if (!workout) return;
    try {
      await workoutService.removeFromSuperset(workout.id, exerciseId);
      loadData();
      notify.success('Desvinculado', 'El ejercicio es independiente de nuevo.');
    } catch (e: any) {
      notify.error('No se pudo desvincular', e?.message || 'Error general de red.');
    }
  };

  const handleViewHistory = async (exerciseId: string) => {
    const exSet = sets.find(s => s.exercise_id === exerciseId);
    const name = exSet?.exercise_name || 'Ejercicio';
    setHistoryExerciseName(name);
    setHistoryExerciseType(exSet?.exercise_type ?? 'weight_reps');

    // Fetch
    const history = await workoutService.getExerciseHistory(exerciseId);
    setHistoryData(history);
    setHistoryVisible(true);
  };

  const handleAddButton = () => {
    setIsPickerVisible(true);
  };

  // Swipe Gesture
  const changeDate = (direction: 'next' | 'prev') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newDate = direction === 'next' ? addDays(selectedDate, 1) : subDays(selectedDate, 1);
    setSelectedDate(newDate);
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
              <Image
                source={require('../../assets/images/icon.png')}
                style={{ width: 100, height: 100, resizeMode: 'contain' }}
              />
            }
            headerRight={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Link href="/changelog" asChild>
                  <Pressable
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.7 : 1,
                      width: 42, height: 42, borderRadius: 21,
                      backgroundColor: colors.surface,
                      alignItems: 'center', justifyContent: 'center',
                      borderWidth: 1.5, borderColor: colors.border,
                      ...ThemeFx.shadowSm,
                    })}
                  >
                    <Info size={20} color={hasNewChangelog ? colors.primary.DEFAULT : colors.textMuted} />
                    {hasNewChangelog && (
                      <View style={{ position: 'absolute', top: -1, right: -1, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.red, borderWidth: 1.5, borderColor: colors.background }} />
                    )}
                  </Pressable>
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
          />
        )
      }

      {
        loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
          </View>
        ) : (
          <>
            <WorkoutLog
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
          </>
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
