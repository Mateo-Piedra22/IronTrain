import { CopyWorkoutModal } from '@/components/CopyWorkoutModal';
import { DateStrip } from '@/components/DateStrip';
import { ExerciseList } from '@/components/ExerciseList';
import { HistoryModal } from '@/components/HistoryModal';
import { IntervalTimerModal } from '@/components/IntervalTimerModal';
import { WorkoutLog } from '@/components/WorkoutLog';
import { addDays, subDays } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { Copy, Plus, Timer, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { workoutService } from '../../src/services/WorkoutService';
import { Workout, WorkoutSet } from '../../src/types/db';

export default function DailyLogScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [sets, setSets] = useState<(WorkoutSet & { exercise_name: string; category_color: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [markedDates, setMarkedDates] = useState<Record<string, any>>({});
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [timerVisible, setTimerVisible] = useState(false);

  // History State
  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyData, setHistoryData] = useState<{ date: number; sets: WorkoutSet[] }[]>([]);
  const [historyExerciseName, setHistoryExerciseName] = useState('');

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
  useEffect(() => {
    loadData();
  }, [selectedDate]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [selectedDate]) // Re-fetch on focus just in case
  );

  const [isPickerVisible, setIsPickerVisible] = useState(false);

  const handleAddSet = async (exerciseId: string) => {
    if (!workout) return;

    // Calculate next order index
    const currentSetsForEx = sets.filter(s => s.exercise_id === exerciseId);
    const nextIndex = currentSetsForEx.length;

    await workoutService.addSet(workout.id, exerciseId, 'normal', nextIndex);
    loadData(); // Refresh
    setIsPickerVisible(false); // Close picker if open
  };

  const handleCopySet = async (originalSetId: string) => {
    if (!workout) return;
    const originalSet = sets.find(s => s.id === originalSetId);
    if (!originalSet) return;

    const currentSetsForEx = sets.filter(s => s.exercise_id === originalSet.exercise_id);
    const nextIndex = currentSetsForEx.length;

    // Add new set
    const newSetId = await workoutService.addSet(workout.id, originalSet.exercise_id, originalSet.type, nextIndex);

    // Update with copied values
    if (newSetId) {
      await workoutService.updateSet(newSetId, {
        weight: originalSet.weight,
        reps: originalSet.reps,
        notes: originalSet.notes
      });
      loadData();
    }
  };

  const handleUpdateSet = async (setId: string, updates: Partial<WorkoutSet>) => {
    // Optimistic update
    setSets(prev => prev.map(s => s.id === setId ? { ...s, ...updates } : s));

    // Timer Logic
    if (updates.completed === 1) {
      // Auto-start timer (90s default)
      const { startTimer } = require('../../src/store/timerStore').useTimerStore.getState();
      startTimer(90);
    }

    await workoutService.updateSet(setId, updates);
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
      alert("No exercise below to link with.");
      return;
    }

    const nextExerciseId = uniqueExercises[currentIndex + 1];

    // Check if they are already in supersets
    const currentSet = sets.find(s => s.exercise_id === exerciseId);
    const nextSet = sets.find(s => s.exercise_id === nextExerciseId);

    if (!currentSet || !nextSet) return;

    if (currentSet.superset_id && nextSet.superset_id && currentSet.superset_id === nextSet.superset_id) {
      alert("Already linked.");
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
    const name = exSet?.exercise_name || 'Exercise';
    setHistoryExerciseName(name);

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
    import('expo-haptics').then(Haptics => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    });
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
    <GestureDetector gesture={panGesture}>
      <SafeAreaView className="flex-1 bg-iron-900" edges={['top']}>
        <DateStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} markedDates={markedDates} />

        {/* Workout Status Toggle */}
        {workout && (
          <View className="flex-row items-center justify-between px-4 py-3 bg-iron-900 border-b border-iron-800">
            <Text className="text-iron-400 font-bold uppercase text-xs">Workout Status</Text>
            <View className="flex-row items-center gap-3">
              <Text className={`font-bold ${workout.status === 'completed' ? 'text-green-500' : 'text-iron-500'}`}>
                {workout.status === 'completed' ? 'FINISHED' : 'ACTIVE'}
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
                trackColor={{ false: '#334155', true: '#22c55e' }}
                thumbColor={'#ffffff'}
              />
            </View>
          </View>
        )}

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#f97316" />
          </View>
        ) : (
          <>
            {/* Copy Option if empty */}
            {sets.length === 0 && (
              <View className="items-center mt-4 mb-2">
                <TouchableOpacity
                  onPress={() => setCopyModalVisible(true)}
                  className="bg-iron-800 px-4 py-2 rounded-full border border-iron-700 flex-row items-center border-dashed"
                >
                  <Copy size={14} color="#64748b" />
                  <Text className="text-iron-400 text-xs font-bold ml-2 uppercase">Copy from History</Text>
                </TouchableOpacity>
              </View>
            )}

            <WorkoutLog
              sets={sets}
              onAddSet={(exId) => handleAddSet(exId)}
              onFinish={handleFinishWorkout}
              isFinished={workout?.status === 'completed'}
              onExercisePress={(exId, exName) => {
                router.push({
                  pathname: '/exercise/[id]' as any,
                  params: { id: exId, workoutId: workout?.id, exerciseId: exId, exerciseName: exName }
                });
              }}
            />
          </>
        )}

        {/* ... FAB ... */}
        {!loading && (
          <TouchableOpacity
            onPress={handleAddButton}
            className="absolute bottom-6 right-6 w-14 h-14 bg-primary rounded-full items-center justify-center shadow-lg border border-orange-400"
          >
            <Plus color="white" size={30} />
          </TouchableOpacity>
        )}

        {/* ... Pickers ... */}
        <Modal visible={isPickerVisible} animationType="slide" presentationStyle="pageSheet">
          {/* ... */}
          <View className="flex-1 bg-iron-900">
            <View className="flex-row justify-between items-center p-4 border-b border-iron-800 bg-iron-800">
              <Text className="text-white font-bold text-lg">Select Exercise</Text>
              <TouchableOpacity onPress={() => setIsPickerVisible(false)}>
                <X color="white" size={24} />
              </TouchableOpacity>
            </View>
            <ExerciseList onSelect={handleAddSet} />
          </View>
        </Modal>

        <HistoryModal
          visible={historyVisible}
          onClose={() => setHistoryVisible(false)}
          history={historyData}
          exerciseName={historyExerciseName}
        />

        <CopyWorkoutModal
          visible={copyModalVisible}
          onClose={() => setCopyModalVisible(false)}
          targetDate={selectedDate}
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
      </SafeAreaView>
    </GestureDetector>
  );
}
