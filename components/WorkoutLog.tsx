import { dbService } from '@/src/services/DatabaseService';
import { workoutService } from '@/src/services/WorkoutService';
import { Colors } from '@/src/theme';
import * as Haptics from 'expo-haptics';
import { Dumbbell, GripVertical, Trash2 } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Animated, Text, TouchableOpacity, View } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { Swipeable } from 'react-native-gesture-handler';
import type { ExerciseType } from '../src/types/db';
import { WorkoutSet } from '../src/types/db';
import { ExerciseSummary } from './ExerciseSummary';

interface WorkoutLogProps {
    sets: (WorkoutSet & { exercise_name: string; category_color: string; exercise_type: ExerciseType })[];
    onExercisePress: (exerciseId: string, exerciseName: string) => void;
    onRefresh: () => void; // Need refresh to reload data after reorder/delete
    workoutId: string;
}

interface GroupedExercise {
    exercise_id: string;
    exercise_name: string;
    category_color: string;
    exercise_type: ExerciseType;
    sets: WorkoutSet[];
}

export function WorkoutLog({ sets, onExercisePress, onRefresh, workoutId }: WorkoutLogProps) {
    const [localGroups, setLocalGroups] = useState<GroupedExercise[]>([]);

    const grouped = useMemo(() => {
        const groups: Record<string, GroupedExercise> = {};
        const orderedGroups: GroupedExercise[] = [];

        sets.forEach((set) => {
            if (!groups[set.exercise_id]) {
                const group: GroupedExercise = {
                    exercise_id: set.exercise_id,
                    exercise_name: set.exercise_name,
                    category_color: set.category_color,
                    exercise_type: set.exercise_type,
                    sets: []
                };
                groups[set.exercise_id] = group;
                orderedGroups.push(group);
            }
            groups[set.exercise_id].sets.push(set);
        });

        return orderedGroups;
    }, [sets]);

    useEffect(() => {
        setLocalGroups(grouped);
    }, [grouped]);

    const handleReorder = async (data: GroupedExercise[]) => {
        const snapshot = localGroups;
        setLocalGroups(data);
        const newOrderIds = data.map((g) => g.exercise_id);
        try {
            await workoutService.reorderExercises(workoutId, newOrderIds);
        } catch (e) {
            setLocalGroups(snapshot);
            Alert.alert('Error', 'No se pudo reordenar. Intenta de nuevo.');
        }
    };

    const handleDeleteExercise = (exerciseId: string, exerciseName: string) => {
        Alert.alert(
            "Eliminar ejercicio",
            `¿Quitar ${exerciseName} y todas sus series?`,
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Eliminar",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            await dbService.run('DELETE FROM workout_sets WHERE workout_id = ? AND exercise_id = ?', [workoutId, exerciseId]);
                            onRefresh();
                        } catch (e) {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                            Alert.alert('Error', 'No se pudo eliminar el ejercicio.');
                        }
                    }
                }
            ]
        );
    };

    if (localGroups.length === 0) {
        return (
            <View className="flex-1 items-center justify-center p-8">
                <Dumbbell size={48} color={Colors.iron[600]} />
                <Text className="text-iron-500 text-center text-lg mt-4">Todavía no registraste ejercicios.</Text>
                <Text className="text-iron-600 text-center mt-2">Toca “+” para agregar uno.</Text>
            </View>
        );
    }

    const renderItem = ({ item: group, drag, isActive }: RenderItemParams<GroupedExercise>) => {
        const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
            const scale = dragX.interpolate({
                inputRange: [-100, -50, 0],
                outputRange: [1, 0.5, 0],
                extrapolate: 'clamp'
            });

            return (
                <View
                    className="justify-center items-end rounded-r-xl my-1 ml-[-20px] w-24"
                    style={{
                        backgroundColor: Colors.red,
                        shadowColor: '#000',
                        shadowOpacity: 0.08,
                        shadowRadius: 6,
                        shadowOffset: { width: 0, height: 2 },
                        elevation: 1,
                    }}
                >
                    <Animated.View style={{ transform: [{ scale }], width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', paddingLeft: 20 }}>
                        <TouchableOpacity
                            onPress={() => handleDeleteExercise(group.exercise_id, group.exercise_name)}
                            style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
                            accessibilityRole="button"
                            accessibilityLabel={`Eliminar ${group.exercise_name}`}
                        >
                            <Trash2 size={24} color="white" />
                            <Text className="text-white text-[10px] font-bold mt-1">ELIMINAR</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            );
        };

        const renderLeftActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
            const scale = dragX.interpolate({
                inputRange: [0, 50, 100],
                outputRange: [0, 0.8, 1],
                extrapolate: 'clamp'
            });

            return (
                <View
                    className="justify-center items-start w-24 rounded-l-xl my-1 mr-[-20px]"
                    style={{
                        backgroundColor: Colors.primary.dark,
                        shadowColor: '#000',
                        shadowOpacity: 0.08,
                        shadowRadius: 6,
                        shadowOffset: { width: 0, height: 2 },
                        elevation: 1,
                    }}
                >
                    <Animated.View style={{ transform: [{ scale }], width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', paddingRight: 20 }}>
                        <TouchableOpacity
                            onLongPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                drag();
                            }}
                            delayLongPress={180}
                            disabled={isActive}
                            style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
                            accessibilityRole="button"
                            accessibilityLabel={`Mantener para reordenar ${group.exercise_name}`}
                        >
                            <GripVertical size={22} color="white" />
                            <Text className="text-white text-[10px] font-bold mt-1">ORDENAR</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            );
        };

        return (
            <ScaleDecorator>
                <View className="mb-3">
                    <Swipeable
                        renderRightActions={renderRightActions}
                        renderLeftActions={renderLeftActions}
                        overshootRight={false}
                        overshootLeft={false}
                        containerStyle={{ overflow: 'visible' }}
                        rightThreshold={40}
                        leftThreshold={40}
                    >
                        <ExerciseSummary
                            exerciseName={group.exercise_name}
                            exerciseType={group.exercise_type}
                            sets={group.sets}
                            categoryColor={group.category_color}
                            onPress={() => onExercisePress(group.exercise_id, group.exercise_name)}
                            disabled={isActive}
                        />
                    </Swipeable>
                </View>
            </ScaleDecorator>
        );
    };

    return (
        <View className="flex-1 px-4 pt-2">
            <DraggableFlatList
                data={localGroups}
                onDragEnd={({ data }) => handleReorder(data)}
                keyExtractor={(item) => item.exercise_id}
                renderItem={renderItem}
                contentContainerStyle={{ paddingBottom: 100 }}
                ListFooterComponent={<View className="h-24" />}
                activationDistance={20} // Delay drag to allow horizontal swipe
            />
        </View>
    );
}
