import { IronButton } from '@/components/IronButton';
import { IronInput } from '@/components/IronInput';
import { Colors } from '@/src/theme';
import { WorkoutSet } from '@/src/types/db';
import { X } from 'lucide-react-native';
import React, { useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

interface WarmupCalculatorModalProps {
    visible: boolean;
    onClose: () => void;
    onAddSets: (sets: Partial<WorkoutSet>[]) => void;
    defaultWeight?: number;
}

export function WarmupCalculatorModal({ visible, onClose, onAddSets, defaultWeight = 0 }: WarmupCalculatorModalProps) {
    const [targetWeight, setTargetWeight] = useState(defaultWeight > 0 ? defaultWeight.toString() : '');

    const calculateSets = () => {
        const weight = parseFloat(targetWeight);
        if (isNaN(weight) || weight <= 0) return [];

        // Simple 3-set default warmup
        // 1. Empty Bar (20kg) x 15 - usually just type 'warmup'
        // 2. 50% x 10
        // 3. 75% x 5
        // 4. 90% x 2

        const sets: Partial<WorkoutSet>[] = [
            { type: 'warmup', weight: 20, reps: 15, completed: 0, notes: 'Bar only' },
            { type: 'warmup', weight: Math.round((weight * 0.5) / 2.5) * 2.5, reps: 10, completed: 0 },
            { type: 'warmup', weight: Math.round((weight * 0.75) / 2.5) * 2.5, reps: 5, completed: 0 },
            { type: 'warmup', weight: Math.round((weight * 0.9) / 2.5) * 2.5, reps: 2, completed: 0 },
        ];

        return sets.filter(s => (s.weight || 0) < weight); // Don't suggest warmups heavier than target
    };

    const calculatedSets = calculateSets();

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View className="flex-1 bg-black/80 justify-center items-center p-4">
                <View className="bg-iron-900 w-full max-w-sm rounded-2xl border border-iron-700 p-4">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-white font-bold text-xl">Warm-up Calculator</Text>
                        <TouchableOpacity onPress={onClose}>
                            <X color={Colors.iron[400]} size={24} />
                        </TouchableOpacity>
                    </View>

                    <Text className="text-iron-400 mb-2">Target Working Weight (kg)</Text>
                    <IronInput
                        value={targetWeight}
                        onChangeText={setTargetWeight}
                        placeholder="e.g. 100"
                        keyboardType="numeric"
                        autoFocus
                    />

                    {calculatedSets.length > 0 && (
                        <View className="mt-4 mb-6">
                            <Text className="text-iron-300 font-bold mb-2">Suggested Warm-up:</Text>
                            {calculatedSets.map((set, idx) => (
                                <View key={idx} className="flex-row justify-between items-center py-2 border-b border-iron-800">
                                    <View className="flex-row items-center">
                                        <View className="w-2 h-2 rounded-full bg-yellow-500 mr-2" />
                                        <Text className="text-white font-bold">{set.weight}kg</Text>
                                    </View>
                                    <Text className="text-iron-400">{set.reps} reps</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    <IronButton
                        label="Add Exercises to Log"
                        onPress={() => {
                            if (calculatedSets.length > 0) {
                                onAddSets(calculatedSets);
                                onClose();
                            }
                        }}
                        variant="solid"
                        disabled={calculatedSets.length === 0}
                    />
                </View>
            </View>
        </Modal>
    );
}
