import { CalculatorService } from '@/src/services/CalculatorService';
import { configService } from '@/src/services/ConfigService';
import { Colors } from '@/src/theme';
import { WorkoutSet } from '@/src/types/db';
import React, { useState } from 'react';
import { Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';

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

        const suggestions = CalculatorService.warmupSuggestions({ workingWeight: weight, barWeight: defaultBar, rounding });
        return suggestions.map((s) => ({ type: 'warmup', weight: s.weight, reps: s.reps, completed: 0, notes: s.note })) as Partial<WorkoutSet>[];
    };

    const calculatedSets = calculateSets();

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
                <View style={{
                    backgroundColor: Colors.surface, width: '100%', maxWidth: 360,
                    borderRadius: 20, padding: 24, borderWidth: 1, borderColor: Colors.iron[700],
                    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 24,
                }}>
                    <Text style={{ fontSize: 20, fontWeight: '900', color: Colors.iron[950], marginBottom: 8, letterSpacing: -0.3 }}>
                        Calculadora de Calentamiento
                    </Text>
                    <Text style={{ fontSize: 13, color: Colors.iron[500], marginBottom: 20, lineHeight: 18 }}>
                        Ingresa el peso objetivo de tu serie principal y generaremos un esquema progresivo de calentamiento seguro.
                    </Text>

                    <Text style={{ color: Colors.iron[500], fontSize: 10, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Peso objetivo ({unit})</Text>
                    <TextInput
                        value={targetWeight}
                        onChangeText={setTargetWeight}
                        placeholder={unit === 'kg' ? 'Ej. 100' : 'Ej. 225'}
                        keyboardType="numeric"
                        autoFocus
                        style={{
                            backgroundColor: Colors.iron[200], borderRadius: 12, padding: 14,
                            fontSize: 16, color: Colors.iron[950], borderWidth: 1, borderColor: Colors.iron[300],
                            marginBottom: 20
                        }}
                    />

                    {calculatedSets.length > 0 && (
                        <View style={{ marginBottom: 24 }}>
                            <Text style={{ color: Colors.iron[500], fontSize: 10, fontWeight: '800', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Progresión sugerida</Text>
                            <View style={{ backgroundColor: Colors.iron[200], borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.iron[300] }}>
                                {calculatedSets.map((set, idx) => (
                                    <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: idx === calculatedSets.length - 1 ? 0 : 1, borderBottomColor: Colors.iron[300] }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                            <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: Colors.primary.DEFAULT + '20', justifyContent: 'center', alignItems: 'center' }}>
                                                <Text style={{ color: Colors.primary.DEFAULT, fontSize: 10, fontWeight: '900' }}>{idx + 1}</Text>
                                            </View>
                                            <Text style={{ color: Colors.iron[950], fontWeight: '800', fontSize: 14 }}>{set.weight} {unit}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={{ color: Colors.iron[600], fontWeight: '700', fontSize: 13 }}>{set.reps} reps</Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                            <TouchableOpacity onPress={onClose} style={{ padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.iron[300], alignItems: 'center' }}>
                                <Text style={{ color: Colors.iron[600], fontWeight: '700', fontSize: 14 }}>Cancelar</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={{ flex: 1 }}>
                            <TouchableOpacity
                                onPress={() => {
                                    if (calculatedSets.length > 0) {
                                        onAddSets(calculatedSets);
                                        onClose();
                                    }
                                }}
                                disabled={calculatedSets.length === 0}
                                style={{ backgroundColor: calculatedSets.length > 0 ? Colors.primary.DEFAULT : Colors.iron[300], padding: 14, borderRadius: 12, alignItems: 'center' }}
                            >
                                <Text style={{ color: Colors.surface, fontWeight: '800', fontSize: 14 }}>Agregar series</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
