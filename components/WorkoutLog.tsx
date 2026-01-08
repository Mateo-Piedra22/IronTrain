import { Colors } from '@/src/theme';
import { Dumbbell } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { FlatList, Text, View } from 'react-native';
import { WorkoutSet } from '../src/types/db';
import { ExerciseSummary } from './ExerciseSummary';

interface WorkoutLogProps {
    sets: (WorkoutSet & { exercise_name: string; category_color: string })[];
    onAddSet: (exerciseId: string) => void;
    onFinish: () => void;
    isFinished: boolean;
    onExercisePress: (exerciseId: string, exerciseName: string) => void; // New prop
}

interface GroupedExercise {
    exercise_id: string;
    exercise_name: string;
    category_color: string;
    sets: WorkoutSet[];
}

export function WorkoutLog({ sets, onFinish, isFinished, onExercisePress }: WorkoutLogProps) {
    // Group sets by exercise
    const groupedData = useMemo(() => {
        const groups: Record<string, GroupedExercise> = {};
        const orderedGroups: GroupedExercise[] = [];

        sets.forEach(set => {
            if (!groups[set.exercise_id]) {
                const group = {
                    exercise_id: set.exercise_id,
                    exercise_name: set.exercise_name,
                    category_color: set.category_color,
                    sets: []
                };
                groups[set.exercise_id] = group;
                orderedGroups.push(group);
            }
            groups[set.exercise_id].sets.push(set);
        });

        return orderedGroups;
    }, [sets]);

    if (groupedData.length === 0) {
        return (
            <View className="flex-1 items-center justify-center p-8">
                <Dumbbell size={48} color={Colors.iron[600]} />
                <Text className="text-iron-500 text-center text-lg mt-4">No exercises logged yet.</Text>
                <Text className="text-iron-600 text-center mt-2">Tap "+" to add an exercise.</Text>
            </View>
        );
    }

    return (
        <View className="flex-1 px-4 pt-2">
            <FlatList
                data={groupedData}
                keyExtractor={(item) => item.exercise_id}
                contentContainerStyle={{ paddingBottom: 100 }}
                renderItem={({ item: group }) => (
                    <ExerciseSummary
                        exerciseName={group.exercise_name}
                        sets={group.sets}
                        categoryColor={group.category_color}
                        onPress={() => onExercisePress(group.exercise_id, group.exercise_name)}
                    />
                )}
                ListFooterComponent={<View className="h-24" />}
            />
        </View>
    );
}
