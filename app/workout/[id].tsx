import { useWorkoutStore } from '@/src/store/workoutStore';
import { WorkoutSet } from '@/src/types/db';
import { FlashList } from '@shopify/flash-list';
import { clsx } from 'clsx';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { LucideCheck, LucideClock, LucideMoreVertical } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';

export default function ActiveWorkoutScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const {
        activeWorkout,
        activeSets,
        isTimerRunning,
        workoutTimer,
        resumeWorkout,
        finishWorkout,
        updateSet,
        addSet,
        toggleSetComplete,
        removeSet,
        cancelWorkout
    } = useWorkoutStore();

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

    // Render Set Row
    const renderSet = (set: WorkoutSet, index: number) => (
        <View key={set.id} className={clsx("flex-row items-center mb-2 p-2 rounded", set.completed ? "bg-green-900/20" : "bg-iron-800")}>
            <View className="w-8 items-center justify-center">
                <Text className="text-iron-400 font-bold">{index + 1}</Text>
            </View>
            <View className="flex-1 px-2">
                <Text className="text-xs text-iron-500 mb-1">KG</Text>
                <TextInput
                    keyboardType="numeric"
                    className="bg-iron-900 text-white p-2 rounded text-center font-bold"
                    value={(set.weight || 0).toString()}
                    onChangeText={(t) => updateSet(set.id, { weight: parseFloat(t) || 0 })}
                />
            </View>
            <View className="flex-1 px-2">
                <Text className="text-xs text-iron-500 mb-1">REPS</Text>
                <TextInput
                    keyboardType="numeric"
                    className="bg-iron-900 text-white p-2 rounded text-center font-bold"
                    value={(set.reps || 0).toString()}
                    onChangeText={(t) => updateSet(set.id, { reps: parseFloat(t) || 0 })}
                />
            </View>
            <View className="flex-1 px-2">
                <Text className="text-xs text-iron-500 mb-1">RPE</Text>
                <TextInput
                    keyboardType="numeric"
                    className="bg-iron-900 text-white p-2 rounded text-center font-bold"
                    value={set.rpe?.toString() ?? ''}
                    placeholder="-"
                    placeholderTextColor="#555"
                    onChangeText={(t) => updateSet(set.id, { rpe: parseFloat(t) || undefined })}
                />
            </View>
            <Pressable
                onPress={() => toggleSetComplete(set.id)}
                className={clsx("w-10 h-10 rounded items-center justify-center ml-2", set.completed ? "bg-green-500" : "bg-iron-700")}
            >
                <LucideCheck size={20} color={set.completed ? "white" : "#a4a4a4"} />
            </Pressable>
        </View>
    );

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-iron-900">
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View className="pt-12 px-4 pb-4 bg-iron-800 border-b border-iron-700 flex-row justify-between items-center">
                <View className="flex-1 mr-4">
                    <Text className="text-white font-bold text-lg" numberOfLines={1}>{activeWorkout?.name || 'Workout'}</Text>
                </View>

                <View className="flex-row items-center gap-3">
                    {/* Timer */}
                    {activeWorkout?.status !== 'completed' && (
                        <View className="flex-row items-center bg-iron-900 px-2.5 py-1.5 rounded-lg border border-iron-700">
                            <LucideClock size={14} color="#f97316" />
                            <Text className="text-orange-500 ml-1.5 font-mono text-sm font-bold tracking-tight">{formatTime(workoutTimer)}</Text>
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
                                ? "bg-green-900/30 border-green-500/50"
                                : "bg-iron-700 border-iron-600"
                        )}
                    >
                        <View className={clsx(
                            "w-2 h-2 rounded-full mr-2",
                            activeWorkout?.status === 'completed' ? "bg-green-500" : "bg-orange-500"
                        )} />
                        <Text className={clsx(
                            "text-xs font-bold uppercase tracking-wider",
                            activeWorkout?.status === 'completed' ? "text-green-400" : "text-iron-300"
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
                            <Text className="text-white font-bold text-lg">{exerciseNames[exId] || 'Loading Exercise...'}</Text>
                            <Pressable onPress={() => { }}><LucideMoreVertical size={20} color="#666" /></Pressable>
                        </View>

                        {/* Sets Header */}
                        <View className="flex-row mb-2 px-2">
                            <View className="w-8"></View>
                            <View className="flex-1"><Text className="text-center text-iron-500 text-xs">KG</Text></View>
                            <View className="flex-1"><Text className="text-center text-iron-500 text-xs">REPS</Text></View>
                            <View className="flex-1"><Text className="text-center text-iron-500 text-xs">RPE</Text></View>
                            <View className="w-10"></View>
                        </View>

                        {/* Sets List */}
                        {groupedSets[exId].map((set, idx) => renderSet(set, idx))}

                        {/* Add Set Button */}
                        <Pressable
                            onPress={() => addSet(exId)}
                            className="bg-iron-800 py-2 rounded items-center mt-2 border border-iron-700 border-dashed"
                        >
                            <Text className="text-iron-400 text-xs font-bold uppercase">+ Add Set</Text>
                        </Pressable>
                    </View>
                )}
                ListFooterComponent={
                    <Pressable
                        onPress={() => router.push('/(tabs)/library')} // Assuming library handles 'select' mode or we just add from there
                        className="bg-iron-800 py-4 rounded-xl items-center border border-iron-600 mb-8"
                    >
                        <Text className="text-primary font-bold uppercase">+ Add Exercise</Text>
                    </Pressable>
                }
            />
        </KeyboardAvoidingView>
    );
}
