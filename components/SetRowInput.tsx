import { WorkoutSet } from '@/src/types/db';
import { LucideCheck, LucideMenu } from 'lucide-react-native';
import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useColors } from '../src/hooks/useColors';
import { configService } from '../src/services/ConfigService';
import { UnitService } from '../src/services/UnitService';
import { withAlpha } from '../src/theme';

interface SetRowInputProps {
    index: number;
    set: WorkoutSet;
    onUpdate: (id: string, updates: Partial<WorkoutSet>) => void;
    onToggleComplete: (id: string) => void;
    disabled?: boolean;
    drag?: () => void;
    isActive?: boolean;
}

export const SetRowInput = memo(({ index, set, onUpdate, onToggleComplete, disabled, drag, isActive }: SetRowInputProps) => {
    const colors = useColors();
    const ss = useMemo(() => StyleSheet.create({
        row: { flexDirection: 'row', alignItems: 'center', padding: 8, gap: 8, borderRadius: 12, borderWidth: 1 },
        rowDefault: { backgroundColor: colors.surface, borderColor: colors.border },
        rowCompleted: { backgroundColor: colors.surfaceLighter, borderColor: colors.primary.DEFAULT },
        dragBtn: { width: 24, alignItems: 'flex-start', justifyContent: 'center' },
        indexCol: { width: 20, alignItems: 'center' },
        indexText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
        inputCol: { flex: 1, backgroundColor: colors.surfaceLighter, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center' },
        input: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center', padding: 4 },
        unitLabel: { fontSize: 9, fontWeight: '800', color: colors.textMuted, marginLeft: 4 },
        checkBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
        checkActive: { backgroundColor: colors.primary.DEFAULT },
        checkInactive: { backgroundColor: withAlpha(colors.border, '33'), borderWidth: 1, borderColor: colors.border },
        checkDisabled: { opacity: 0.5 },
    }), [colors]);

    const unit = configService.get('weightUnit');
    const displayWeight = unit === 'kg' ? (set.weight || 0) : UnitService.kgToLbs(set.weight || 0);
    const isCompleted = !!set.completed;

    return (
        <View style={[ss.row, isCompleted ? ss.rowCompleted : ss.rowDefault, isActive && { opacity: 0.8, borderColor: colors.primary.DEFAULT, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 }]}>
            {/* Drag Handle */}
            {drag && !disabled && (
                <TouchableOpacity onLongPress={drag} style={ss.dragBtn} delayLongPress={100}>
                    <LucideMenu size={20} color={colors.textMuted} />
                </TouchableOpacity>
            )}

            {/* Index */}
            <View style={ss.indexCol}>
                <Text style={[ss.indexText, isCompleted && { color: colors.green }]}>{index + 1}</Text>
            </View>

            {/* Weight */}
            <View style={ss.inputCol}>
                <TextInput
                    accessibilityLabel={`Serie ${index + 1} peso`}
                    keyboardType="numeric"
                    style={ss.input}
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
                <Text style={ss.unitLabel}>{unit.toUpperCase()}</Text>
            </View>

            {/* Reps */}
            <View style={ss.inputCol}>
                <TextInput
                    accessibilityLabel={`Serie ${index + 1} repeticiones`}
                    keyboardType="numeric"
                    style={ss.input}
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
            <View style={ss.inputCol}>
                <TextInput
                    accessibilityLabel={`Serie ${index + 1} RPE`}
                    keyboardType="numeric"
                    style={ss.input}
                    value={set.rpe?.toString() ?? ''}
                    placeholder="-"
                    placeholderTextColor={colors.textMuted}
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
                accessibilityLabel={isCompleted ? "Marcar serie como incompleta" : "Marcar serie como completada"}
                accessibilityRole="button"
                onPress={() => {
                    if (disabled) return;
                    onToggleComplete(set.id);
                }}
                style={[ss.checkBtn, disabled ? ss.checkDisabled : (isCompleted ? ss.checkActive : ss.checkInactive)]}
            >
                <LucideCheck size={22} color={isCompleted ? "white" : colors.textMuted} strokeWidth={3} />
            </Pressable>
        </View>
    );
}, (prev, next) => {
    return (
        prev.set.weight === next.set.weight &&
        prev.set.reps === next.set.reps &&
        prev.set.rpe === next.set.rpe &&
        prev.set.completed === next.set.completed &&
        prev.index === next.index &&
        prev.disabled === next.disabled &&
        prev.isActive === next.isActive
    );
});


