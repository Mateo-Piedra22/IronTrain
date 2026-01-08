import { Colors } from '@/src/theme';
import { WorkoutSet } from '@/src/types/db';
import { ChevronRight, Trophy } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface ExerciseSummaryProps {
    exerciseName: string;
    sets: WorkoutSet[];
    categoryColor?: string;
    onPress: () => void;
}

export function ExerciseSummary({ exerciseName, sets, categoryColor = Colors.primary.dark, onPress }: ExerciseSummaryProps) {
    const setCheck = sets.filter(s => s.completed).length; // Completed sets? Or just total? FitNotes shows total.
    const totalSets = sets.length;

    // Calculate best set (max weight)
    const maxWeight = Math.max(...sets.map(s => s.weight || 0));

    // Calculate volume
    const volume = sets.reduce((acc, s) => acc + (s.weight || 0) * (s.reps || 0), 0);

    return (
        <TouchableOpacity
            onPress={onPress}
            className="flex-row items-center bg-iron-800 p-4 mb-3 rounded-xl border border-iron-700 active:bg-iron-700"
        >
            {/* Color Indicator */}
            <View className="w-1.5 self-stretch rounded-full mr-4" style={{ backgroundColor: categoryColor }} />

            <View className="flex-1">
                <Text className="text-white font-bold text-lg mb-1">{exerciseName}</Text>

                <View className="flex-row items-center gap-4">
                    <Text className="text-iron-400 text-xs font-semibold">
                        {totalSets} sets
                    </Text>
                    <Text className="text-iron-500 text-xs">•</Text>
                    <Text className="text-iron-400 text-xs font-semibold">
                        Vol: {(volume / 1000).toFixed(1)}k kg
                    </Text>
                </View>
            </View>

            {/* Best Set Badge */}
            {maxWeight > 0 && (
                <View className="items-end mr-2">
                    <View className="flex-row items-center bg-iron-900/50 px-2 py-1 rounded">
                        <Trophy size={10} color={Colors.yellow} style={{ marginRight: 4 }} />
                        <Text className="text-amber-400 text-xs font-bold">{maxWeight}kg</Text>
                    </View>
                </View>
            )}

            <ChevronRight size={20} color={Colors.iron[500]} />
        </TouchableOpacity>
    );
}
