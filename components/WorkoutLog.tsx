import { dbService } from '@/src/services/DatabaseService';
import { workoutService } from '@/src/services/WorkoutService';
import { Colors } from '@/src/theme';
import { Dumbbell, Trash2 } from 'lucide-react-native';
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
                            await dbService.run('DELETE FROM workout_sets WHERE workout_id = ? AND exercise_id = ?', [workoutId, exerciseId]);
                            onRefresh();
                        } catch (e) {
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
            const trans = dragX.interpolate({
                inputRange: [-100, 0],
                outputRange: [0, 100],
                extrapolate: 'clamp'
            });

            const scale = dragX.interpolate({
                inputRange: [-100, -50, 0],
                outputRange: [1, 0.5, 0],
                extrapolate: 'clamp'
            });

            return (
                <View className="flex-1 bg-red-600 justify-center items-end mb-3 rounded-r-xl overflow-hidden">
                    <Animated.View
                        className="w-[100px] h-full justify-center items-center pr-5"
                        style={{
                            transform: [{ translateX: trans }, { scale }],
                        }}
                    >
                        <Trash2 size={28} color="white" />
                    </Animated.View>
                    {/* Invisible Touchable Overlay for Action */}
                    <TouchableOpacity
                        className="absolute inset-0"
                        onPress={() => handleDeleteExercise(group.exercise_id, group.exercise_name)}
                        accessibilityRole="button"
                        accessibilityLabel={`Eliminar ${group.exercise_name}`}
                    />
                </View>
            );
        };

        return (
            <ScaleDecorator>
                <Swipeable
                    renderRightActions={renderRightActions}
                    overshootRight={false}
                >
                    <View className="flex-row items-center mb-3 bg-iron-900">
                        <View className="flex-1">
                            <ExerciseSummary
                                exerciseName={group.exercise_name}
                                exerciseType={group.exercise_type}
                                sets={group.sets}
                                categoryColor={group.category_color}
                                onPress={() => onExercisePress(group.exercise_id, group.exercise_name)}
                                onLongPress={drag}
                                disabled={isActive}
                            />
                        </View>
                    </View>
                </Swipeable>
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
