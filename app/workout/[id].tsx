import { SetRowInput } from '@/components/SetRowInput';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { configService } from '@/src/services/ConfigService';
import { useWorkoutStore } from '@/src/store/workoutStore';
import { withAlpha } from '@/src/theme';
import { WorkoutSet } from '@/src/types/db';
import { FlashList } from '@shopify/flash-list';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { LucideClock, LucideMoreVertical } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useColors } from '../../src/hooks/useColors';
import { confirm } from '../../src/store/confirmStore';

export default function ActiveWorkoutScreen() {
    const colors = useColors();
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const {
        activeWorkout, activeSets, isTimerRunning, workoutTimer, tickTimer,
        setWorkoutStatus, updateSet, addSet, toggleSetComplete, loadWorkoutById, exerciseNames,
    } = useWorkoutStore();

    const [unit, setUnit] = useState(configService.get('weightUnit'));

    const ss = useMemo(() => StyleSheet.create({
        header: {
            paddingHorizontal: 16,
            paddingBottom: 14,
            paddingTop: 8,
            backgroundColor: colors.background,
            borderBottomWidth: 1.5,
            borderBottomColor: colors.border,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center'
        },
        headerTitle: {
            color: colors.text,
            fontWeight: '900',
            fontSize: 17,
            letterSpacing: -0.3
        },
        headerSub: {
            color: colors.textMuted,
            fontSize: 11,
            fontWeight: '700',
            marginTop: 2
        },
        headerActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10
        },
        timerChip: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: colors.border
        },
        timerText: {
            color: colors.primary.DEFAULT,
            marginLeft: 6,
            fontSize: 13,
            fontWeight: '800',
            fontVariant: ['tabular-nums']
        },
        statusChip: {
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1.5
        },
        statusFinished: {
            backgroundColor: withAlpha(colors.green, '1A'),
            borderColor: withAlpha(colors.green, '66')
        },
        statusActive: {
            backgroundColor: colors.surface,
            borderColor: colors.border
        },
        statusText: {
            fontSize: 10,
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginRight: 6
        },
        exerciseHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8
        },
        exerciseName: {
            color: colors.text,
            fontWeight: '800',
            fontSize: 16
        },
        setsHeaderRow: {
            flexDirection: 'row',
            marginBottom: 8,
            paddingHorizontal: 8
        },
        colLabel: {
            textAlign: 'center',
            color: colors.textMuted,
            fontSize: 10,
            fontWeight: '800',
            letterSpacing: 0.8
        },
        addSetBtn: {
            backgroundColor: colors.surface,
            paddingVertical: 12,
            borderRadius: 14,
            alignItems: 'center',
            marginTop: 8,
            borderWidth: 1.5,
            borderColor: colors.border,
            borderStyle: 'dashed'
        },
        addSetText: {
            color: colors.text,
            fontSize: 11,
            fontWeight: '800',
            textTransform: 'uppercase'
        },
        addExerciseBtn: {
            backgroundColor: colors.surface,
            paddingVertical: 14,
            borderRadius: 14,
            alignItems: 'center',
            borderWidth: 1.5,
            borderColor: colors.primary.DEFAULT,
            borderStyle: 'dashed',
            marginBottom: 32
        },
        addExerciseText: {
            color: colors.primary.DEFAULT,
            fontWeight: '800',
            textTransform: 'uppercase',
            fontSize: 13
        },
        backBtn: {
            backgroundColor: colors.surface,
            paddingVertical: 14,
            borderRadius: 14,
            alignItems: 'center',
            borderWidth: 1.5,
            borderColor: colors.border,
            marginBottom: 32
        },
        backBtnText: {
            color: colors.text,
            fontWeight: '800',
            textTransform: 'uppercase',
            fontSize: 13
        },
    }), [colors]);

    const handleUpdateSet = useCallback((setId: string, updates: Partial<WorkoutSet>) => {
        updateSet(setId, updates);
    }, [updateSet]);

    const handleToggleComplete = useCallback((setId: string) => {
        toggleSetComplete(setId);
    }, [toggleSetComplete]);

    useFocusEffect(useCallback(() => { setUnit(configService.get('weightUnit')); }, []));

    useEffect(() => {
        if (!id) return;
        if (!activeWorkout || activeWorkout.id !== id) { loadWorkoutById(id); }
    }, [id, activeWorkout?.id, loadWorkoutById]);

    useEffect(() => {
        let interval: any;
        if (isTimerRunning) { tickTimer(); interval = setInterval(tickTimer, 1000); }
        return () => clearInterval(interval);
    }, [isTimerRunning, tickTimer]);

    useEffect(() => {
        const sub = AppState.addEventListener('change', (s) => { if (s === 'active') tickTimer(); });
        return () => sub.remove();
    }, [tickTimer]);

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const isTemplate = activeWorkout?.is_template === 1;
    const isFinished = activeWorkout?.status === 'completed';
    const isEditable = !!activeWorkout && (!isFinished || isTemplate);

    const requestToggleStatus = (nextActive: boolean) => {
        if (!activeWorkout || isTemplate) return;
        if (!nextActive) {
            confirm.ask(
                'Finalizar entrenamiento',
                '¿Marcar este entrenamiento como finalizado? (se bloquea la edición)',
                async () => { await setWorkoutStatus('completed'); },
                'Finalizar'
            );
            return;
        }
        confirm.ask(
            'Reabrir entrenamiento',
            '¿Volver a marcarlo como activo? (podrás editar y seguir registrando)',
            async () => { await setWorkoutStatus('in_progress'); },
            'Reabrir'
        );
    };

    const groupedSets = activeSets.reduce((acc, set) => {
        if (!acc[set.exercise_id]) acc[set.exercise_id] = [];
        acc[set.exercise_id].push(set);
        return acc;
    }, {} as Record<string, WorkoutSet[]>);

    const exerciseIds = Object.keys(groupedSets);
    const emptyState = useMemo(() => {
        if (!activeWorkout) return 'No se encontró el entrenamiento.';
        if (activeSets.length === 0) return 'Todavía no hay ejercicios en este entrenamiento.';
        return null;
    }, [activeWorkout, activeSets.length]);

    return (
        <SafeAreaWrapper style={{ backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <Stack.Screen options={{ headerShown: false }} />

                {/* Header */}
                <View style={ss.header}>
                    <View style={{ flex: 1, marginRight: 16 }}>
                        <Text style={ss.headerTitle} numberOfLines={1}>{activeWorkout?.name || 'Entrenamiento'}</Text>
                        {activeWorkout?.date ? (
                            <Text style={ss.headerSub}>
                                {isTemplate ? 'Plantilla' : (isFinished ? 'Finalizado' : 'Activo')}
                            </Text>
                        ) : null}
                    </View>

                    <View style={ss.headerActions}>
                        {!isTemplate && (
                            <View style={ss.timerChip}>
                                <LucideClock size={14} color={colors.primary.DEFAULT} />
                                <Text style={ss.timerText}>{formatTime(workoutTimer)}</Text>
                            </View>
                        )}

                        {!isTemplate && activeWorkout && (
                            <View style={[ss.statusChip, isFinished ? ss.statusFinished : ss.statusActive]}>
                                <Text style={[ss.statusText, isFinished ? { color: colors.green } : { color: colors.text }]}>
                                    {isFinished ? 'Finalizado' : 'Activo'}
                                </Text>
                                <Switch value={!isFinished} onValueChange={(v) => requestToggleStatus(v)} />
                            </View>
                        )}
                    </View>
                </View>

                {emptyState && (
                    <View style={{ paddingHorizontal: 16, paddingVertical: 24 }}>
                        <Text style={{ color: colors.textMuted, fontWeight: '700', textAlign: 'center' }}>{emptyState}</Text>
                    </View>
                )}

                <FlashList
                    data={exerciseIds}
                    // @ts-ignore
                    estimatedItemSize={200}
                    contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                    renderItem={({ item: exId }) => (
                        <View style={{ marginBottom: 24 }}>
                            <View style={ss.exerciseHeader}>
                                <Text style={ss.exerciseName}>{exerciseNames[exId] || 'Loading Exercise...'}</Text>
                                <Pressable onPress={() => { }}><LucideMoreVertical size={20} color={colors.textMuted} /></Pressable>
                            </View>

                            {/* Sets Header */}
                            <View style={ss.setsHeaderRow}>
                                <View style={{ width: 32 }} />
                                <View style={{ flex: 1 }}><Text style={ss.colLabel}>{unit.toUpperCase()}</Text></View>
                                <View style={{ flex: 1 }}><Text style={ss.colLabel}>REPS</Text></View>
                                <View style={{ flex: 1 }}><Text style={ss.colLabel}>RPE</Text></View>
                                <View style={{ width: 48 }} />
                            </View>

                            {groupedSets[exId].map((set, idx) => (
                                <SetRowInput key={set.id} index={idx} set={set} onUpdate={handleUpdateSet} onToggleComplete={handleToggleComplete} disabled={!isEditable} />
                            ))}

                            {isEditable && (
                                <Pressable onPress={() => addSet(exId)} style={ss.addSetBtn} accessibilityRole="button" accessibilityLabel="Agregar serie">
                                    <Text style={ss.addSetText}>+ Agregar serie</Text>
                                </Pressable>
                            )}
                        </View>
                    )}
                    ListFooterComponent={
                        isEditable ? (
                            <Pressable onPress={() => router.push('/(tabs)/exercises')} style={ss.addExerciseBtn} accessibilityRole="button" accessibilityLabel="Agregar ejercicio">
                                <Text style={ss.addExerciseText}>+ Agregar ejercicio</Text>
                            </Pressable>
                        ) : (
                            <Pressable onPress={() => router.replace('/(tabs)')} style={ss.backBtn} accessibilityRole="button" accessibilityLabel="Volver">
                                <Text style={ss.backBtnText}>Volver</Text>
                            </Pressable>
                        )
                    }
                />
            </KeyboardAvoidingView>
        </SafeAreaWrapper>
    );
}

