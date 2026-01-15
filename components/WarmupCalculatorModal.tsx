import { IronButton } from '@/components/IronButton';
import { IronInput } from '@/components/IronInput';
import { CalculatorService } from '@/src/services/CalculatorService';
import { configService } from '@/src/services/ConfigService';
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
    const unit = configService.get('weightUnit');
    const rounding = unit === 'kg' ? configService.get('calculatorsRoundingKg') : configService.get('calculatorsRoundingLbs');
    const defaultBar = unit === 'kg'
        ? configService.get('plateCalculatorDefaultBarWeightKg')
        : configService.get('plateCalculatorDefaultBarWeightLbs');

    const [targetWeight, setTargetWeight] = useState(defaultWeight > 0 ? defaultWeight.toString() : '');

    const calculateSets = () => {
        const weight = parseFloat(targetWeight);
        if (isNaN(weight) || weight <= 0) return [];

        const suggestions = CalculatorService.warmupSuggestions({
            workingWeight: weight,
            barWeight: defaultBar,
            rounding
        });

        return suggestions.map((s) => ({
            type: 'warmup',
            weight: s.weight,
            reps: s.reps,
            completed: 0,
            notes: s.note
        })) as Partial<WorkoutSet>[];
    };

    const calculatedSets = calculateSets();

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View className="flex-1 bg-iron-950/80 justify-center items-center p-4">
                <View className="bg-iron-900 w-full max-w-sm rounded-2xl border border-iron-700 p-4">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-iron-950 font-bold text-xl">Warm-up</Text>
                        <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar warm-up">
                            <X color={Colors.iron[400]} size={24} />
                        </TouchableOpacity>
                    </View>

                    <Text className="text-iron-500 mb-2">Peso de trabajo ({unit})</Text>
                    <IronInput
                        value={targetWeight}
                        onChangeText={setTargetWeight}
                        placeholder={unit === 'kg' ? 'p. ej. 100' : 'p. ej. 225'}
                        keyboardType="numeric"
                        autoFocus
                    />

                    {calculatedSets.length > 0 && (
                        <View className="mt-4 mb-6">
                            <Text className="text-iron-500 font-bold mb-2">Sugerencia:</Text>
                            {calculatedSets.map((set, idx) => (
                                <View key={idx} className="flex-row justify-between items-center py-2 border-b border-iron-800">
                                    <View className="flex-row items-center">
                                        <View className="w-2 h-2 rounded-full bg-yellow-500 mr-2" />
                                        <Text className="text-iron-950 font-bold">{set.weight}{unit}</Text>
                                    </View>
                                    <Text className="text-iron-500">{set.reps} reps</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    <IronButton
                        label="Agregar al log"
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
