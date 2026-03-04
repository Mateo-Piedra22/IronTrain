import { Colors } from '@/src/theme';
import { WorkoutSet } from '@/src/types/db';
import { LucideCheck } from 'lucide-react-native';
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
    const isCompleted = !!set.completed;

    return (
        <View style={[ss.row, isCompleted ? ss.rowCompleted : ss.rowDefault]}>
            {/* Index */}
            <View style={ss.indexCol}>
                <Text style={[ss.indexText, isCompleted && { color: '#166534' }]}>{index + 1}</Text>
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
                accessibilityLabel={isCompleted ? "Marcar serie como incompleta" : "Marcar serie como completada"}
                accessibilityRole="button"
                onPress={() => {
                    if (disabled) return;
                    onToggleComplete(set.id);
                }}
                style={[ss.checkBtn, disabled ? ss.checkDisabled : (isCompleted ? ss.checkActive : ss.checkInactive)]}
            >
                <LucideCheck size={22} color={isCompleted ? "white" : Colors.iron[400]} strokeWidth={3} />
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

const ss = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, padding: 8, borderRadius: 14, borderWidth: 1 },
    rowDefault: { backgroundColor: Colors.surface, borderColor: Colors.iron[700], elevation: 1 },
    rowCompleted: { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' },
    indexCol: { width: 32, alignItems: 'center', justifyContent: 'center' },
    indexText: { fontWeight: '800', fontSize: 16, color: Colors.iron[400] },
    inputCol: { flex: 1, paddingHorizontal: 6 },
    input: { backgroundColor: Colors.iron[200], color: Colors.iron[950], padding: 10, borderRadius: 10, textAlign: 'center', fontWeight: '800', fontSize: 16 },
    unitLabel: { fontSize: 9, color: Colors.iron[400], fontWeight: '800', marginTop: 3, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
    checkBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
    checkActive: { backgroundColor: '#22c55e', shadowColor: '#22c55e', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 2 },
    checkInactive: { backgroundColor: Colors.iron[200], borderWidth: 1, borderColor: Colors.iron[300] },
    checkDisabled: { backgroundColor: Colors.iron[300] },
});
