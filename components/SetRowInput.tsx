import { Colors } from '@/src/theme';
import { WorkoutSet } from '@/src/types/db';
import { clsx } from 'clsx';
import { LucideCheck } from 'lucide-react-native';
import React, { memo } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

interface SetRowInputProps {
    index: number;
    set: WorkoutSet;
    onUpdate: (id: string, updates: Partial<WorkoutSet>) => void;
    onToggleComplete: (id: string) => void;
}

export const SetRowInput = memo(({ index, set, onUpdate, onToggleComplete }: SetRowInputProps) => {
    return (
        <View className={clsx("flex-row items-center mb-2 p-2 rounded-xl border", set.completed ? "bg-green-100 border-green-200" : "bg-surface border-iron-700 elevation-1")}>
            {/* Index */}
            <View className="w-8 items-center justify-center">
                <Text className={clsx("font-bold text-lg", set.completed ? "text-green-800" : "text-iron-500")}>{index + 1}</Text>
            </View>

            {/* Weight */}
            <View className="flex-1 px-2">
                <TextInput
                    accessibilityLabel={`Set ${index + 1} Weight`}
                    keyboardType="numeric"
                    className="bg-iron-200 text-iron-950 p-3 rounded-lg text-center font-bold text-lg"
                    value={(set.weight || 0).toString()}
                    onChangeText={(t) => onUpdate(set.id, { weight: parseFloat(t) || 0 })}
                    selectTextOnFocus
                />
            </View>

            {/* Reps */}
            <View className="flex-1 px-2">
                <TextInput
                    accessibilityLabel={`Set ${index + 1} Reps`}
                    keyboardType="numeric"
                    className="bg-iron-200 text-iron-950 p-3 rounded-lg text-center font-bold text-lg"
                    value={(set.reps || 0).toString()}
                    onChangeText={(t) => onUpdate(set.id, { reps: parseFloat(t) || 0 })}
                    selectTextOnFocus
                />
            </View>

            {/* RPE */}
            <View className="flex-1 px-2">
                <TextInput
                    accessibilityLabel={`Set ${index + 1} RPE`}
                    keyboardType="numeric"
                    className="bg-iron-200 text-iron-950 p-3 rounded-lg text-center font-bold text-lg"
                    value={set.rpe?.toString() ?? ''}
                    placeholder="-"
                    placeholderTextColor={Colors.iron[400]}
                    onChangeText={(t) => onUpdate(set.id, { rpe: parseFloat(t) || undefined })}
                    selectTextOnFocus
                />
            </View>

            {/* Complete Button */}
            <Pressable
                accessibilityLabel={set.completed ? "Mark set as incomplete" : "Mark set as complete"}
                accessibilityRole="button"
                onPress={() => onToggleComplete(set.id)}
                className={clsx("w-12 h-12 rounded-xl items-center justify-center ml-2 shadow-sm", set.completed ? "bg-green-500" : "bg-iron-200")}
            >
                <LucideCheck size={24} color={set.completed ? "white" : Colors.iron[400]} />
            </Pressable>
        </View>
    );
}, (prev, next) => {
    // Custom comparison for performance
    return (
        prev.set.weight === next.set.weight &&
        prev.set.reps === next.set.reps &&
        prev.set.rpe === next.set.rpe &&
        prev.set.completed === next.set.completed &&
        prev.index === next.index
    );
});
