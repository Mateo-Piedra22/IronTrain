import { CopyWorkoutModal } from '@/components/CopyWorkoutModal';
import { DateStrip } from '@/components/DateStrip';
import { ExerciseList } from '@/components/ExerciseList';
import { HistoryModal } from '@/components/HistoryModal';
import { IntervalTimerModal } from '@/components/IntervalTimerModal';
import { LoadRoutineModal } from '@/components/LoadRoutineModal';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { WorkoutLog } from '@/components/WorkoutLog';
import { WorkoutStatusBar } from '@/components/WorkoutStatusBar';
import { ChangelogService } from '@/src/services/ChangelogService';
import { configService } from '@/src/services/ConfigService';
import { RoutineDayWithExercises } from '@/src/services/RoutineService';
import { useTimerStore } from '@/src/store/timerStore';
import { Colors } from '@/src/theme';
import { notify } from '@/src/utils/notify';
import { addDays, subDays } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { Info, Plus, Timer, X } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Modal, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { workoutService } from '../../src/services/WorkoutService';
import { ExerciseType, Workout, WorkoutSet } from '../../src/types/db';

export default function DailyLogScreen() {
  const router = useRouter();
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

      // Check changelog unread badge
      const latestVersion = ChangelogService.getLatestRelease()?.version;
      const lastViewed = configService.get('lastViewedChangelogVersion');
      if (latestVersion && latestVersion !== lastViewed) {
        setHasNewChangelog(true);
      } else {
        setHasNewChangelog(false);
      }
    }, [selectedDate]) // Re-fetch on focus just in case
  );

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
    <SafeAreaWrapper edges={['top', 'left', 'right']} className="bg-iron-900">
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
              <Link href="/changelog" asChild>
                <TouchableOpacity className="relative p-1 active:opacity-50">
                  <Info size={24} color={Colors.iron[950]} />
                  {hasNewChangelog && (
                    <View className="absolute top-0 -right-1 w-3 h-3 rounded-full bg-red-500 border-2 border-iron-900" />
                  )}
                </TouchableOpacity>
              </Link>
            }
          />
        </View>
      </GestureDetector>

      {/* Workout Status Bar — Tri-state: idle → active → completed */}
      {workout && (
        <WorkoutStatusBar
          workout={workout}
          sets={sets}
          onStatusChange={refreshWorkoutOnly}
        />
      )}

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={Colors.primary.DEFAULT} />
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
      )}

      {/* ... FAB ... */}
      {!loading && (
        <TouchableOpacity
          onPress={handleAddButton}
          style={{ position: 'absolute', bottom: 24, right: 24, zIndex: 20, width: 56, height: 56, backgroundColor: Colors.primary.DEFAULT, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: Colors.primary.DEFAULT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
        >
          <Plus color="white" size={28} />
        </TouchableOpacity>
      )}

      {/* ... Pickers ... */}
      <Modal visible={isPickerVisible} transparent animationType="fade" onRequestClose={() => setIsPickerVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 48 }}>
          <View style={{
            backgroundColor: Colors.iron[900], borderWidth: 1, borderColor: Colors.iron[700],
            borderRadius: 20, flex: 1, maxHeight: '95%', width: '100%', overflow: 'hidden',
          }}>
            {/* Modal Header — CopyWorkoutModal pattern */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.iron[200] }}>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '900', color: Colors.iron[950], letterSpacing: -0.3 }}>Seleccionar ejercicio</Text>
                <Text style={{ fontSize: 11, color: Colors.iron[400], marginTop: 2 }}>Tocá uno para agregarlo al entrenamiento</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsPickerVisible(false)}
                style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.primary.DEFAULT, justifyContent: 'center', alignItems: 'center' }}
                accessibilityRole="button"
                accessibilityLabel="Cerrar selector de ejercicios"
              >
                <X color="#fff" size={18} />
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
      {!loading && (
        <TouchableOpacity
          onPress={() => setTimerVisible(true)}
          style={{ position: 'absolute', bottom: 24, left: 24, zIndex: 20, width: 48, height: 48, backgroundColor: Colors.iron[800], borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.iron[700], elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6 }}
        >
          <Timer color="#94a3b8" size={22} />
        </TouchableOpacity>
      )}
    </SafeAreaWrapper>

  );
}
