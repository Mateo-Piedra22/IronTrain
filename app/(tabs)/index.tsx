import { CopyWorkoutModal } from '@/components/CopyWorkoutModal';
import { DateStrip } from '@/components/DateStrip';
import { ExerciseList } from '@/components/ExerciseList';
import { HistoryModal } from '@/components/HistoryModal';
import { IntervalTimerModal } from '@/components/IntervalTimerModal';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { WorkoutLog } from '@/components/WorkoutLog';
import { configService } from '@/src/services/ConfigService';
import { useTimerStore } from '@/src/store/timerStore';
import { Colors } from '@/src/theme';
import { addDays, subDays } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { Copy, Info, Plus, Timer, X } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  const [timerVisible, setTimerVisible] = useState(false);

  // History State
  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyData, setHistoryData] = useState<{ date: number; sets: WorkoutSet[] }[]>([]);
  const [historyExerciseName, setHistoryExerciseName] = useState('');
  const [historyExerciseType, setHistoryExerciseType] = useState<ExerciseType>('weight_reps');

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

  // Reload when date changes or screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [selectedDate]) // Re-fetch on focus just in case
  );

  const [isPickerVisible, setIsPickerVisible] = useState(false);

  const handleAddSet = async (exerciseId: string) => {
    if (!workout) return;
    await workoutService.addSet(workout.id, exerciseId, 'normal');
    loadData(); // Refresh
    setIsPickerVisible(false); // Close picker if open
  };

  const handleCopySet = async (originalSetId: string) => {
    if (!workout) return;
    const originalSet = sets.find(s => s.id === originalSetId);
    if (!originalSet) return;
    await workoutService.addSet(workout.id, originalSet.exercise_id, originalSet.type, {
      weight: originalSet.weight,
      reps: originalSet.reps,
      distance: (originalSet as any).distance,
      time: (originalSet as any).time,
      notes: originalSet.notes,
      rpe: originalSet.rpe
    });
    loadData();
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
      Alert.alert('Error', e?.message ?? 'No se pudo actualizar la serie');
    }
  };

  const handleDeleteSet = async (setId: string) => {
    await workoutService.deleteSet(setId);
    loadData();
  };

  const handleFinishWorkout = async () => {
    if (!workout) return;
    await workoutService.finishWorkout(workout.id);
    loadData();
  };

  const handleLinkExercise = async (exerciseId: string) => {
    if (!workout) return;

    // derived ordered list of exercise IDs
    const uniqueExercises = Array.from(new Set(sets.map(s => s.exercise_id)));
    const currentIndex = uniqueExercises.indexOf(exerciseId);

    if (currentIndex === -1 || currentIndex >= uniqueExercises.length - 1) {
      Alert.alert('Aviso', 'No hay un ejercicio debajo para enlazar.');
      return;
    }

    const nextExerciseId = uniqueExercises[currentIndex + 1];

    // Check if they are already in supersets
    const currentSet = sets.find(s => s.exercise_id === exerciseId);
    const nextSet = sets.find(s => s.exercise_id === nextExerciseId);

    if (!currentSet || !nextSet) return;

    if (currentSet.superset_id && nextSet.superset_id && currentSet.superset_id === nextSet.superset_id) {
      Alert.alert('Aviso', 'Ya están enlazados.');
      return;
    }

    if (currentSet.superset_id) {
      // Add next to current's superset
      await workoutService.addToSuperset(workout.id, currentSet.superset_id, nextExerciseId);
    } else if (nextSet.superset_id) {
      // Add current to next's superset
      await workoutService.addToSuperset(workout.id, nextSet.superset_id, exerciseId);
    } else {
      // Create new superset
      await workoutService.createSuperset(workout.id, [exerciseId, nextExerciseId]);
    }
    loadData();
  };

  const handleUnlinkExercise = async (exerciseId: string) => {
    if (!workout) return;
    await workoutService.removeFromSuperset(workout.id, exerciseId);
    loadData();
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
          <View className="px-4 py-3 flex-row justify-between items-center bg-iron-900 border-b border-iron-700">
            <View className="flex-row items-center">
              <Text className="text-xl font-bold text-iron-950 mr-4">Registro diario</Text>
            </View>
            <View className="absolute inset-0 items-center justify-center pointer-events-none">
              <Image
                source={require('../../assets/images/icon.png')}
                style={{ width: 60, height: 60, resizeMode: 'contain', transform: [{ scale: 1.2 }] }}
              />
            </View>
            <View className="w-10 items-end">
              <Link href="/changelog" asChild>
                <TouchableOpacity>
                  <Info size={28} color={Colors.iron[950]} />
                </TouchableOpacity>
              </Link>
            </View>
          </View>
          <DateStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} markedDates={markedDates} />
        </View>
      </GestureDetector>

      {/* Workout Status Toggle */}
      {workout && (
        <View className="flex-row items-center justify-between px-4 py-3 bg-iron-900 border-b border-iron-700">
          <Text className="text-iron-950 font-bold uppercase text-xs">Estado del entrenamiento</Text>
          <View className="flex-row items-center gap-3">
            <Text className={`font-bold ${workout.status === 'completed' ? 'text-green-600' : 'text-iron-950'}`}>
              {workout.status === 'completed' ? 'FINALIZADO' : 'ACTIVO'}
            </Text>
            <Switch
              value={workout.status === 'completed'}
              onValueChange={async (val) => {
                if (val) {
                  await workoutService.finishWorkout(workout.id);
                  import('expo-haptics').then(H => H.notificationAsync(H.NotificationFeedbackType.Success));
                } else {
                  await workoutService.resumeWorkout(workout.id);
                  import('expo-haptics').then(H => H.impactAsync(H.ImpactFeedbackStyle.Medium));
                }
                loadData();
              }}
              trackColor={{ false: Colors.iron[300], true: Colors.green }}
              thumbColor={'#ffffff'}
            />
          </View>
        </View>
      )}

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={Colors.primary.DEFAULT} />
        </View>
      ) : (
        <>
          <View className="items-center mt-4 mb-2">
            <TouchableOpacity
              onPress={() => setCopyModalVisible(true)}
              className="bg-surface px-4 py-2 rounded-full border border-iron-700 flex-row items-center border-dashed active:bg-iron-200"
              accessibilityRole="button"
              accessibilityLabel="Copiar ejercicios desde otro día"
            >
              <Copy size={14} color={Colors.iron[500]} />
              <Text className="text-iron-950 text-xs font-bold ml-2 uppercase">
                {sets.length === 0 ? 'Copiar del historial' : 'Copiar (agregar/reemplazar)'}
              </Text>
            </TouchableOpacity>
          </View>

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
          />
        </>
      )}

      {/* ... FAB ... */}
      {!loading && (
        <TouchableOpacity
          onPress={handleAddButton}
          className="absolute bottom-6 right-6 w-14 h-14 bg-primary rounded-full items-center justify-center elevation-3 active:scale-95"
        >
          <Plus color="white" size={30} />
        </TouchableOpacity>
      )}

      {/* ... Pickers ... */}
      <Modal visible={isPickerVisible} animationType="slide" presentationStyle="pageSheet">
        {/* ... */}
        <View className="flex-1 bg-iron-900">
          <SafeAreaView edges={['top']} className="bg-iron-800 border-b border-iron-800">
            <View className="flex-row justify-between items-center p-4">
              <Text className="text-iron-950 font-bold text-lg">Seleccionar ejercicio</Text>
              <TouchableOpacity
                onPress={() => setIsPickerVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Cerrar selector de ejercicios"
              >
                <X color={Colors.iron[950]} size={24} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
          <ExerciseList onSelect={handleAddSet} />
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

      <IntervalTimerModal
        visible={timerVisible}
        onClose={() => setTimerVisible(false)}
      />

      {/* Timer FAB (Left Side) */}
      {!loading && (
        <TouchableOpacity
          onPress={() => setTimerVisible(true)}
          className="absolute bottom-6 left-6 w-12 h-12 bg-iron-800 rounded-full items-center justify-center shadow-lg border border-iron-700"
        >
          <Timer color="#94a3b8" size={24} />
        </TouchableOpacity>
      )}
    </SafeAreaWrapper>

  );
}
