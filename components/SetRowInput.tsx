import { Colors } from '@/src/theme';
import { WorkoutSet } from '@/src/types/db';
import { clsx } from 'clsx';
import { LucideCheck } from 'lucide-react-native';
import React, { memo } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { configService } from '../src/services/ConfigService';
import { UnitService } from '../src/services/UnitService';

interface SetRowInputProps {
    index: number;
    set: WorkoutSet;
    onUpdate: (id: string, updates: Partial<WorkoutSet>) => void;
    onToggleComplete: (id: string) => void;
    disabled?: boolean;
}

export const SetRowInput = memo(({ index, set, onUpdate, onToggleComplete, disabled }: SetRowInputProps) => {
    const unit = configService.get('weightUnit');
    const displayWeight = unit === 'kg' ? (set.weight || 0) : UnitService.kgToLbs(set.weight || 0);
    return (
        <View className={clsx("flex-row items-center mb-2 p-2 rounded-xl border", set.completed ? "bg-green-100 border-green-200" : "bg-surface border-iron-700 elevation-1")}>
            {/* Index */}
            <View className="w-8 items-center justify-center">
                <Text className={clsx("font-bold text-lg", set.completed ? "text-green-800" : "text-iron-500")}>{index + 1}</Text>
            </View>

            {/* Weight */}
            <View className="flex-1 px-2">
                <TextInput
                    accessibilityLabel={`Serie ${index + 1} peso`}
                    keyboardType="numeric"
                    className="bg-iron-200 text-iron-950 p-3 rounded-lg text-center font-bold text-lg"
                    value={(Math.round(displayWeight * 100) / 100).toString()}
                    editable={!disabled}
                    onChangeText={(t) => {
                        if (disabled) return;
                        const v = parseFloat(t);
                        const display = Number.isFinite(v) ? v : 0;
                        const kg = unit === 'kg' ? display : UnitService.lbsToKg(display);
                        onUpdate(set.id, { weight: kg });
                    }}
                    selectTextOnFocus
                />
                <Text className="text-[10px] text-iron-500 font-bold mt-1 text-center">{unit.toUpperCase()}</Text>
            </View>

            {/* Reps */}
            <View className="flex-1 px-2">
                <TextInput
                    accessibilityLabel={`Serie ${index + 1} repeticiones`}
                    keyboardType="numeric"
                    className="bg-iron-200 text-iron-950 p-3 rounded-lg text-center font-bold text-lg"
                    value={(set.reps || 0).toString()}
                    editable={!disabled}
                    onChangeText={(t) => {
                        if (disabled) return;
                        onUpdate(set.id, { reps: parseFloat(t) || 0 });
                    }}
                    selectTextOnFocus
                />
            </View>

            {/* RPE */}
            <View className="flex-1 px-2">
                <TextInput
                    accessibilityLabel={`Serie ${index + 1} RPE`}
                    keyboardType="numeric"
                    className="bg-iron-200 text-iron-950 p-3 rounded-lg text-center font-bold text-lg"
                    value={set.rpe?.toString() ?? ''}
                    placeholder="-"
                    placeholderTextColor={Colors.iron[400]}
                    editable={!disabled}
                    onChangeText={(t) => {
                        if (disabled) return;
                        onUpdate(set.id, { rpe: parseFloat(t) || undefined });
                    }}
                    selectTextOnFocus
                />
            </View>

            {/* Complete Button */}
            <Pressable
                accessibilityLabel={set.completed ? "Marcar serie como incompleta" : "Marcar serie como completada"}
                accessibilityRole="button"
                onPress={() => {
                    if (disabled) return;
                    onToggleComplete(set.id);
                }}
                className={clsx(
                    "w-12 h-12 rounded-xl items-center justify-center ml-2 shadow-sm",
                    disabled ? "bg-iron-300" : (set.completed ? "bg-green-500" : "bg-iron-200")
                )}
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
        prev.index === next.index &&
        prev.disabled === next.disabled
    );
});
