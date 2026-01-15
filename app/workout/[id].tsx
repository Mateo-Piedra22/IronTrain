import { SetRowInput } from '@/components/SetRowInput';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { configService } from '@/src/services/ConfigService';
import { useWorkoutStore } from '@/src/store/workoutStore';
import { Colors } from '@/src/theme';
import { WorkoutSet } from '@/src/types/db';
import { FlashList } from '@shopify/flash-list';
import { clsx } from 'clsx';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { LucideClock, LucideMoreVertical } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AppState, KeyboardAvoidingView, Platform, Pressable, Switch, Text, View } from 'react-native';

export default function ActiveWorkoutScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const {
        activeWorkout,
        activeSets,
        isTimerRunning,
        workoutTimer,
        tickTimer,
        setWorkoutStatus,
        updateSet,
        addSet,
        toggleSetComplete,
        loadWorkoutById,
        exerciseNames,
    } = useWorkoutStore();

    const [unit, setUnit] = useState(configService.get('weightUnit'));

    // Optimize callbacks for memoized child
    const handleUpdateSet = useCallback((setId: string, updates: Partial<WorkoutSet>) => {
        updateSet(setId, updates);
    }, [updateSet]);

    const handleToggleComplete = useCallback((setId: string) => {
        toggleSetComplete(setId);
    }, [toggleSetComplete]);


    useFocusEffect(
        useCallback(() => {
            setUnit(configService.get('weightUnit'));
        }, [])
    );

    useEffect(() => {
        if (!id) return;
        if (!activeWorkout || activeWorkout.id !== id) {
            loadWorkoutById(id);
        }
    }, [id, activeWorkout?.id, loadWorkoutById]);

    // Timer effect
    useEffect(() => {
        let interval: any;
        if (isTimerRunning) {
            tickTimer();
            interval = setInterval(tickTimer, 1000);
        }
        return () => clearInterval(interval);
    }, [isTimerRunning, tickTimer]);

    useEffect(() => {
        const sub = AppState.addEventListener('change', (s) => {
            if (s === 'active') tickTimer();
        });
        return () => sub.remove();
    }, [tickTimer]);

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const isTemplate = activeWorkout?.is_template === 1;
    const isFinished = activeWorkout?.status === 'completed';
    const isEditable = !!activeWorkout && (!isFinished || isTemplate);

    const requestToggleStatus = (nextActive: boolean) => {
        if (!activeWorkout || isTemplate) return;
        if (!nextActive) {
            Alert.alert('Finalizar entrenamiento', '¿Marcar este entrenamiento como finalizado? (se bloquea la edición)', [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Finalizar',
                    style: 'destructive',
                    onPress: async () => {
                        await setWorkoutStatus('completed');
                    }
                }
            ]);
            return;
        }

        Alert.alert('Reabrir entrenamiento', '¿Volver a marcarlo como activo? (podrás editar y seguir registrando)', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Reabrir',
                onPress: async () => {
                    await setWorkoutStatus('in_progress');
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
    const emptyState = useMemo(() => {
        if (!activeWorkout) return 'No se encontró el entrenamiento.';
        if (activeSets.length === 0) return 'Todavía no hay ejercicios en este entrenamiento.';
        return null;
    }, [activeWorkout, activeSets.length]);

    return (
        <SafeAreaWrapper edges={['top', 'left', 'right']} className="bg-iron-900">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
                <Stack.Screen options={{ headerShown: false }} />

                {/* Header */}
                <View className="px-4 pb-4 pt-2 bg-iron-900 border-b border-iron-700 flex-row justify-between items-center">
                    <View className="flex-1 mr-4">
                        <Text className="text-iron-950 font-bold text-lg" numberOfLines={1}>{activeWorkout?.name || 'Entrenamiento'}</Text>
                        {activeWorkout?.date ? (
                            <Text className="text-iron-500 text-xs font-bold mt-0.5">
                                {isTemplate ? 'Plantilla' : (isFinished ? 'Finalizado' : 'Activo')}
                            </Text>
                        ) : null}
                    </View>

                    <View className="flex-row items-center gap-3">
                        {/* Timer */}
                        {!isTemplate && (
                            <View className="flex-row items-center bg-surface px-3 py-1.5 rounded-lg border border-iron-700 shadow-sm">
                                <LucideClock size={14} color={Colors.primary.DEFAULT} />
                                <Text className="text-primary ml-1.5 font-mono text-sm font-bold tracking-tight">{formatTime(workoutTimer)}</Text>
                            </View>
                        )}

                        {!isTemplate && activeWorkout && (
                            <View className={clsx(
                                "px-3 py-1.5 rounded-full flex-row items-center border shadow-sm",
                                isFinished ? "bg-green-100 border-green-500" : "bg-surface border-iron-700"
                            )}>
                                <Text className={clsx(
                                    "text-xs font-bold uppercase tracking-wider mr-2",
                                    isFinished ? "text-green-700" : "text-iron-950"
                                )}>
                                    {isFinished ? 'Finalizado' : 'Activo'}
                                </Text>
                                <Switch
                                    value={!isFinished}
                                    onValueChange={(v) => requestToggleStatus(v)}
                                />
                            </View>
                        )}
                    </View>
                </View>

                {emptyState && (
                    <View className="px-4 py-6">
                        <Text className="text-iron-500 font-bold text-center">{emptyState}</Text>
                    </View>
                )}

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
                                <View className="flex-1"><Text className="text-center text-iron-500 text-xs font-bold tracking-wider">{unit.toUpperCase()}</Text></View>
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
                                    disabled={!isEditable}
                                />
                            ))}

                            {/* Add Set Button */}
                            {isEditable && (
                                <Pressable
                                    onPress={() => addSet(exId)}
                                    className="bg-surface py-3 rounded-xl items-center mt-2 border border-iron-400 border-dashed active:bg-iron-200"
                                    accessibilityRole="button"
                                    accessibilityLabel="Agregar serie"
                                >
                                    <Text className="text-iron-950 text-xs font-bold uppercase">+ Agregar serie</Text>
                                </Pressable>
                            )}
                        </View>
                    )}
                    ListFooterComponent={
                        isEditable ? (
                            <Pressable
                                onPress={() => router.push('/(tabs)/exercises')}
                                className="bg-surface py-4 rounded-xl items-center border border-primary border-dashed mb-8 active:bg-iron-200"
                                accessibilityRole="button"
                                accessibilityLabel="Agregar ejercicio"
                            >
                                <Text className="text-primary font-bold uppercase">+ Agregar ejercicio</Text>
                            </Pressable>
                        ) : (
                            <Pressable
                                onPress={() => router.replace('/(tabs)')}
                                className="bg-surface py-4 rounded-xl items-center border border-iron-700 mb-8 active:bg-iron-200"
                                accessibilityRole="button"
                                accessibilityLabel="Volver"
                            >
                                <Text className="text-iron-950 font-bold uppercase">Volver</Text>
                            </Pressable>
                        )
                    }
                />
            </KeyboardAvoidingView>
        </SafeAreaWrapper>
    );
}
