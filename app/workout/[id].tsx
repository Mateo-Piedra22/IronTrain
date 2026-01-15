import { SetRowInput } from '@/components/SetRowInput';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { useWorkoutStore } from '@/src/store/workoutStore';
import { Colors } from '@/src/theme';
import { WorkoutSet } from '@/src/types/db';
import { FlashList } from '@shopify/flash-list';
import { clsx } from 'clsx';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { LucideClock, LucideMoreVertical } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';

export default function ActiveWorkoutScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const {
        activeWorkout,
        activeSets,
        isTimerRunning,
        workoutTimer,
        finishWorkout,
        updateSet,
        addSet,
        toggleSetComplete,
    } = useWorkoutStore();

    // Optimize callbacks for memoized child
    const handleUpdateSet = useCallback((setId: string, updates: Partial<WorkoutSet>) => {
        updateSet(setId, updates);
    }, [updateSet]);

    const handleToggleComplete = useCallback((setId: string) => {
        toggleSetComplete(setId);
    }, [toggleSetComplete]);


    useEffect(() => {
        if (!activeWorkout && id) {
            // Store hydration check
        }
    }, [id, activeWorkout]);

    // Timer effect
    useEffect(() => {
        let interval: any;
        if (isTimerRunning) {
            interval = setInterval(() => {
                useWorkoutStore.setState(state => ({ workoutTimer: state.workoutTimer + 1 }));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isTimerRunning]);

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleFinish = async () => {
        Alert.alert('Finish Workout', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Finish',
                style: 'default',
                onPress: async () => {
                    await finishWorkout();
                    router.replace('/(tabs)');
                }
            }
        ]);
    };

    // Group sets by exercise
    const groupedSets = activeSets.reduce((acc, set) => {
        if (!acc[set.exercise_id]) acc[set.exercise_id] = [];
        acc[set.exercise_id].push(set);
        return acc;
    }, {} as Record<string, WorkoutSet[]>);

    const exerciseIds = Object.keys(groupedSets);

    // Resolve Exercise Names
    const [exerciseNames, setExerciseNames] = useState<Record<string, string>>({});

    useEffect(() => {
        const loadNames = async () => {
            if (exerciseIds.length === 0) return;
            try {
                // @ts-ignore
                const placeholders = exerciseIds.map(() => '?').join(',');
                const query = `SELECT id, name FROM exercises WHERE id IN (${placeholders})`;
                // @ts-ignore
                const results = await import('@/src/services/DatabaseService').then(m => m.dbService.getAll<{ id: string, name: string }>(query, exerciseIds));

                const map: Record<string, string> = {};
                results.forEach(r => map[r.id] = r.name);
                setExerciseNames(map);
            } catch (e) {
                console.error(e);
            }
        };
        loadNames();
    }, [exerciseIds.length]);

    return (
        <SafeAreaWrapper edges={['top', 'left', 'right']} className="bg-iron-900">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
                <Stack.Screen options={{ headerShown: false }} />

                {/* Header */}
                <View className="px-4 pb-4 pt-2 bg-iron-900 border-b border-iron-700 flex-row justify-between items-center">
                    <View className="flex-1 mr-4">
                        <Text className="text-iron-950 font-bold text-lg" numberOfLines={1}>{activeWorkout?.name || 'Workout'}</Text>
                    </View>

                    <View className="flex-row items-center gap-3">
                        {/* Timer */}
                        {activeWorkout?.status !== 'completed' && (
                            <View className="flex-row items-center bg-surface px-3 py-1.5 rounded-lg border border-iron-700 shadow-sm">
                                <LucideClock size={14} color={Colors.primary.DEFAULT} />
                                <Text className="text-primary ml-1.5 font-mono text-sm font-bold tracking-tight">{formatTime(workoutTimer)}</Text>
                            </View>
                        )}

                        {/* Status Toggle */}
                        <Pressable
                            onPress={activeWorkout?.status === 'completed'
                                ? async () => {
                                    // Resume
                                    if (!activeWorkout) return;
                                    await import('@/src/services/WorkoutService').then(m => m.workoutService.update(activeWorkout.id, { status: 'in_progress' }));
                                    useWorkoutStore.setState({ activeWorkout: { ...activeWorkout, status: 'in_progress' }, isTimerRunning: true });
                                }
                                : handleFinish
                            }
                            className={clsx(
                                "px-3 py-1.5 rounded-full flex-row items-center border shadow-sm",
                                activeWorkout?.status === 'completed'
                                    ? "bg-green-100 border-green-500"
                                    : "bg-surface border-iron-700"
                            )}
                        >
                            <View className={clsx(
                                "w-2 h-2 rounded-full mr-2",
                                activeWorkout?.status === 'completed' ? "bg-green-500" : "bg-primary"
                            )} />
                            <Text className={clsx(
                                "text-xs font-bold uppercase tracking-wider",
                                activeWorkout?.status === 'completed' ? "text-green-700" : "text-iron-950"
                            )}>
                                {activeWorkout?.status === 'completed' ? "Finished" : "Active"}
                            </Text>
                        </Pressable>
                    </View>
                </View>

                <FlashList
                    data={exerciseIds}
                    // @ts-ignore
                    estimatedItemSize={200}
                    contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                    renderItem={({ item: exId }) => (
                        <View className="mb-6">
                            <View className="flex-row justify-between items-center mb-2">
                                <Text className="text-iron-950 font-bold text-lg">{exerciseNames[exId] || 'Loading Exercise...'}</Text>
                                <Pressable onPress={() => { }}><LucideMoreVertical size={20} color={Colors.iron[400]} /></Pressable>
                            </View>

                            {/* Sets Header */}
                            <View className="flex-row mb-2 px-2">
                                <View className="w-8"></View>
                                <View className="flex-1"><Text className="text-center text-iron-500 text-xs font-bold tracking-wider">KG</Text></View>
                                <View className="flex-1"><Text className="text-center text-iron-500 text-xs font-bold tracking-wider">REPS</Text></View>
                                <View className="flex-1"><Text className="text-center text-iron-500 text-xs font-bold tracking-wider">RPE</Text></View>
                                <View className="w-12"></View>
                            </View>

                            {/* Sets List */}
                            {groupedSets[exId].map((set, idx) => (
                                <SetRowInput
                                    key={set.id}
                                    index={idx}
                                    set={set}
                                    onUpdate={handleUpdateSet}
                                    onToggleComplete={handleToggleComplete}
                                />
                            ))}

                            {/* Add Set Button */}
                            <Pressable
                                onPress={() => addSet(exId)}
                                className="bg-surface py-3 rounded-xl items-center mt-2 border border-iron-400 border-dashed active:bg-iron-200"
                            >
                                <Text className="text-iron-950 text-xs font-bold uppercase">+ Add Set</Text>
                            </Pressable>
                        </View>
                    )}
                    ListFooterComponent={
                        <Pressable
                            onPress={() => router.push('/(tabs)/exercises')} // Assuming library handles 'select' mode or we just add from there
                            className="bg-surface py-4 rounded-xl items-center border border-primary border-dashed mb-8 active:bg-iron-200"
                        >
                            <Text className="text-primary font-bold uppercase">+ Add Exercise</Text>
                        </Pressable>
                    }
                />
            </KeyboardAvoidingView>
        </SafeAreaWrapper>
    );
}
