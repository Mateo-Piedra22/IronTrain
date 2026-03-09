import { WorkoutSet } from '@/src/types/db';
import { LucideCheck } from 'lucide-react-native';
import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useColors } from '../src/hooks/useColors';
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
    const colors = useColors();
    const ss = useMemo(() => StyleSheet.create({
        row: { flexDirection: 'row', alignItems: 'center', padding: 8, gap: 8, borderRadius: 12, borderWidth: 1 },
        rowDefault: { backgroundColor: colors.surface, borderColor: colors.iron[200] },
        rowCompleted: { backgroundColor: colors.iron[50], borderColor: colors.primary.DEFAULT },
        indexCol: { width: 24, alignItems: 'center' },
        indexText: { fontSize: 13, fontWeight: '700', color: colors.iron[400] },
        inputCol: { flex: 1, backgroundColor: colors.iron[200], borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center' },
        input: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.iron[950], textAlign: 'center', padding: 4 },
        unitLabel: { fontSize: 9, fontWeight: '800', color: colors.iron[400], marginLeft: 4 },
        checkBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
        checkActive: { backgroundColor: colors.primary.DEFAULT },
        checkInactive: { backgroundColor: colors.iron[300] + '33', borderWidth: 1, borderColor: colors.iron[300] },
        checkDisabled: { opacity: 0.5 },
    }), [colors]);

    const unit = configService.get('weightUnit');
    const displayWeight = unit === 'kg' ? (set.weight || 0) : UnitService.kgToLbs(set.weight || 0);
    const isCompleted = !!set.completed;

    return (
        <View style={[ss.row, isCompleted ? ss.rowCompleted : ss.rowDefault]}>
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
                    placeholderTextColor={colors.iron[400]}
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
                <LucideCheck size={22} color={isCompleted ? "white" : colors.iron[400]} strokeWidth={3} />
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
        prev.disabled === next.disabled
    );
});


