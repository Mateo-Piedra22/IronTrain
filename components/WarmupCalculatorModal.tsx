import { CalculatorService } from '@/src/services/CalculatorService';
import { configService } from '@/src/services/ConfigService';
import { ThemeFx, withAlpha } from '@/src/theme';
import { WorkoutSet } from '@/src/types/db';
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '../src/hooks/useColors';

interface WarmupCalculatorModalProps {
    visible: boolean;
    onClose: () => void;
    onAddSets: (sets: Partial<WorkoutSet>[]) => void;
    defaultWeight?: number;
}

export function WarmupCalculatorModal({ visible, onClose, onAddSets, defaultWeight = 0 }: WarmupCalculatorModalProps) {
    const colors = useColors();
    const unit = configService.get('weightUnit');
    const rounding = unit === 'kg' ? configService.get('calculatorsRoundingKg') : configService.get('calculatorsRoundingLbs');
    const defaultBar = unit === 'kg'
        ? configService.get('plateCalculatorDefaultBarWeightKg')
        : configService.get('plateCalculatorDefaultBarWeightLbs');

    const [targetWeight, setTargetWeight] = useState(defaultWeight > 0 ? defaultWeight.toString() : '');

    const st = useMemo(() => StyleSheet.create({
        overlay: {
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16
        },
        container: {
            backgroundColor: colors.surface,
            width: '100%',
            maxWidth: 380,
            borderRadius: 24,
            padding: 24,
            borderWidth: 1.5,
            borderColor: colors.border,
            ...ThemeFx.shadowLg,
        },
        title: {
            fontSize: 22,
            fontWeight: '900',
            color: colors.text,
            marginBottom: 8,
            letterSpacing: -0.6
        },
        description: {
            fontSize: 14,
            color: colors.textMuted,
            marginBottom: 24,
            lineHeight: 20,
            fontWeight: '500'
        },
        label: {
            color: colors.textMuted,
            fontSize: 10,
            fontWeight: '800',
            marginBottom: 10,
            textTransform: 'uppercase',
            letterSpacing: 1.2,
            marginLeft: 2
        },
        input: {
            backgroundColor: colors.surfaceLighter,
            borderRadius: 14,
            padding: 16,
            fontSize: 17,
            color: colors.text,
            borderWidth: 1.5,
            borderColor: colors.border,
            fontWeight: '700',
            marginBottom: 24
        },
        progressionCard: {
            backgroundColor: colors.surfaceLighter,
            borderRadius: 16,
            padding: 8,
            borderWidth: 1.5,
            borderColor: colors.border,
            marginBottom: 24
        },
        row: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 12,
            paddingHorizontal: 12,
        },
        rowBorder: {
            borderBottomWidth: 1.5,
            borderBottomColor: colors.border
        },
        badge: {
            width: 28,
            height: 28,
            borderRadius: 10,
            backgroundColor: withAlpha(colors.primary.DEFAULT, '12'),
            justifyContent: 'center',
            alignItems: 'center'
        },
        badgeText: {
            color: colors.primary.DEFAULT,
            fontSize: 12,
            fontWeight: '900'
        },
        weightText: {
            color: colors.text,
            fontWeight: '800',
            fontSize: 15
        },
        repsText: {
            color: colors.textMuted,
            fontWeight: '700',
            fontSize: 14
        },
        footer: {
            flexDirection: 'row',
            gap: 12
        },
        cancelBtn: {
            flex: 1,
            height: 52,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: colors.border,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.surface
        },
        cancelBtnText: {
            color: colors.textMuted,
            fontWeight: '800',
            fontSize: 15
        },
        addBtn: {
            flex: 1.4,
            height: 52,
            borderRadius: 16,
            justifyContent: 'center',
            alignItems: 'center',
            ...ThemeFx.shadowSm,
        },
        addBtnText: {
            color: colors.onPrimary,
            fontWeight: '900',
            fontSize: 15,
            textTransform: 'uppercase',
            letterSpacing: 0.5
        }
    }), [colors]);

    const calculateSets = () => {
        const weight = parseFloat(targetWeight);
        if (isNaN(weight) || weight <= 0) return [];

        const suggestions = CalculatorService.warmupSuggestions({ workingWeight: weight, barWeight: defaultBar, rounding });
        return suggestions.map((s) => ({ type: 'warmup', weight: s.weight, reps: s.reps, completed: 0, notes: s.note })) as Partial<WorkoutSet>[];
    };

    const calculatedSets = calculateSets();

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: ThemeFx.backdrop }}>
                    <ScrollView
                        contentContainerStyle={st.overlay}
                        keyboardShouldPersistTaps="handled"
                        bounces={false}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={st.container}>
                            <Text style={st.title}>Warm-up</Text>
                            <Text style={st.description}>
                                Generaremos un esquema progresivo de calentamiento seguro basado en tu peso objetivo.
                            </Text>

                            <Text style={st.label}>Peso objetivo ({unit})</Text>
                            <TextInput
                                value={targetWeight}
                                onChangeText={setTargetWeight}
                                placeholder={unit === 'kg' ? '100' : '225'}
                                placeholderTextColor={colors.textMuted}
                                keyboardType="numeric"
                                autoFocus
                                style={st.input}
                            />

                            {calculatedSets.length > 0 && (
                                <View style={{ marginBottom: 4 }}>
                                    <Text style={st.label}>Progresión sugerida</Text>
                                    <View style={st.progressionCard}>
                                        {calculatedSets.map((set, idx) => (
                                            <View key={idx} style={[st.row, idx < calculatedSets.length - 1 && st.rowBorder]}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                                    <View style={st.badge}>
                                                        <Text style={st.badgeText}>{idx + 1}</Text>
                                                    </View>
                                                    <Text style={st.weightText}>{set.weight} {unit}</Text>
                                                </View>
                                                <Text style={st.repsText}>{set.reps} reps</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                            <View style={st.footer}>
                                <TouchableOpacity onPress={onClose} style={st.cancelBtn}>
                                    <Text style={st.cancelBtnText}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => {
                                        if (calculatedSets.length > 0) {
                                            onAddSets(calculatedSets);
                                            onClose();
                                        }
                                    }}
                                    disabled={calculatedSets.length === 0}
                                    style={[
                                        st.addBtn,
                                        { backgroundColor: calculatedSets.length > 0 ? colors.primary.DEFAULT : colors.border }
                                    ]}
                                >
                                    <Text style={st.addBtnText}>Agregar series</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </KeyboardAvoidingView>
        </Modal>
    );
}
