import { feedbackService } from '@/src/services/FeedbackService';
import { workoutService } from '@/src/services/WorkoutService';
import { useWorkoutStore } from '@/src/store/workoutStore';
import { ThemeFx, withAlpha } from '@/src/theme';
import { Workout, WorkoutSet } from '@/src/types/db';
import { notify } from '@/src/utils/notify';
import { Check, Pause, Pencil, Play, RotateCcw, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useColors } from '../src/hooks/useColors';
import { confirm } from '../src/store/confirmStore';

// ─── Types ───────────────────────────────────────────────────────────────────
type WorkoutPhase = 'idle' | 'active' | 'completed';

interface WorkoutStatusBarProps {
    workout: Workout;
    sets: WorkoutSet[];
    onStatusChange: () => void;
    sessionNumber: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatTimer(totalSeconds: number): string {
    const sanitizedSeconds = totalSeconds > 31536000 ? Math.floor(totalSeconds / 1000) : totalSeconds;
    if (isNaN(sanitizedSeconds) || sanitizedSeconds < 0) return '00:00';
    const h = Math.floor(sanitizedSeconds / 3600);
    const m = Math.floor((sanitizedSeconds % 3600) / 60);
    const s = sanitizedSeconds % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
}

export function WorkoutStatusBar({ workout, sets, onStatusChange, sessionNumber }: WorkoutStatusBarProps) {
    const colors = useColors();
    const st = useMemo(() => StyleSheet.create({
        wrapper: {
            paddingHorizontal: 16,
            paddingTop: 8,
        },
        card: {
            backgroundColor: colors.surface,
            borderRadius: 24,
            borderWidth: 1.5,
            borderColor: colors.border,
            paddingHorizontal: 16,
            paddingVertical: 14,
            ...ThemeFx.shadowSm,
        },
        cardActive: {
            borderColor: withAlpha(colors.primary.DEFAULT, '30'),
        },
        row: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        pill: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 100,
            borderWidth: 1,
        },
        pillIdle: {
            backgroundColor: colors.surfaceLighter,
            borderColor: colors.border,
        },
        pillActive: {
            backgroundColor: withAlpha(colors.primary.DEFAULT, '08'),
            borderColor: withAlpha(colors.primary.DEFAULT, '20'),
        },
        pillPaused: {
            backgroundColor: withAlpha(colors.yellow, '08'),
            borderColor: withAlpha(colors.yellow, '25'),
        },
        pillComplete: {
            backgroundColor: colors.primary.DEFAULT,
            borderColor: colors.primary.DEFAULT,
        },
        pillTextIdle: {
            fontSize: 11,
            fontWeight: '800',
            color: colors.textMuted,
        },
        pillTextActive: {
            fontSize: 11,
            fontWeight: '800',
            color: colors.primary.DEFAULT,
        },
        pillTextPaused: {
            fontSize: 11,
            fontWeight: '800',
            color: colors.yellow,
        },
        pillTextComplete: {
            fontSize: 11,
            fontWeight: '800',
            color: colors.onPrimary,
        },
        liveDot: {
            width: 6,
            height: 6,
            borderRadius: 3,
        },
        liveDotIdle: { backgroundColor: colors.textMuted },
        liveDotActive: { backgroundColor: colors.primary.DEFAULT },
        liveDotPaused: { backgroundColor: colors.yellow },
        centerBlock: {
            alignItems: 'center',
        },
        timerLabel: {
            fontSize: 9,
            fontWeight: '700',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 1,
        },
        timerTouchable: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        timerValue: {
            fontSize: 20,
            fontWeight: '900',
            color: colors.text,
            fontVariant: ['tabular-nums'],
            letterSpacing: -0.5,
        },
        timerEdit: {
            fontSize: 20,
            fontWeight: '900',
            color: colors.text,
            fontVariant: ['tabular-nums'],
            borderBottomWidth: 2,
            borderBottomColor: colors.primary.DEFAULT,
            paddingHorizontal: 6,
            paddingVertical: 2,
            minWidth: 72,
            textAlign: 'center',
        },
        controlsRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        ctrlBtn: {
            width: 34,
            height: 34,
            borderRadius: 12,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: colors.border,
            ...ThemeFx.shadowSm,
        },
        ctrlBtnFinish: {
            width: 34,
            height: 34,
            borderRadius: 12,
            backgroundColor: withAlpha(colors.primary.DEFAULT, '0A'),
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: withAlpha(colors.primary.DEFAULT, '25'),
        },
        primaryBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 12,
            backgroundColor: colors.primary.DEFAULT,
            ...ThemeFx.shadowSm,
        },
        primaryBtnText: {
            fontSize: 12,
            fontWeight: '800',
            color: colors.onPrimary,
        },
        secondaryBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 12,
            backgroundColor: colors.surface,
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        secondaryBtnText: {
            fontSize: 12,
            fontWeight: '700',
            color: colors.textMuted,
        },
        statsRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginTop: 8,
            paddingTop: 8,
            borderTopWidth: 1.5,
            borderTopColor: colors.border,
        },
        statText: {
            fontSize: 11,
            fontWeight: '700',
            color: colors.textMuted,
        },
        statDot: {
            width: 3,
            height: 3,
            borderRadius: 2,
            backgroundColor: colors.border,
        },
        pickerOverlay: {
            flex: 1,
            backgroundColor: ThemeFx.backdrop,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
        },
        pickerSheet: {
            backgroundColor: colors.surface,
            width: '100%',
            borderRadius: 24,
            padding: 16,
            borderWidth: 1.5,
            borderColor: colors.border,
            ...ThemeFx.shadowLg,
        },
        pickerHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: 16,
            marginBottom: 8,
            borderBottomWidth: 1.5,
            borderBottomColor: colors.border,
        },
        pickerTitle: {
            fontSize: 16,
            fontWeight: '900',
            color: colors.text,
        },
        pickerOption: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 12,
            marginBottom: 4,
        },
        pickerOptionActive: {
            backgroundColor: withAlpha(colors.primary.DEFAULT, '08'),
        },
        pickerOptionText: {
            fontSize: 15,
            fontWeight: '700',
            color: colors.textMuted,
        },
        pickerOptionTextActive: {
            color: colors.primary.DEFAULT,
        },
        pickerDot: {
            width: 12,
            height: 12,
            borderRadius: 6,
        },
        pickerDotIdle: { backgroundColor: colors.textMuted },
        pickerDotActive: { backgroundColor: colors.primary.DEFAULT },
        pickerDotPaused: { backgroundColor: colors.yellow },
        pickerOptionDelete: {
            marginTop: 12,
            borderTopWidth: 1.5,
            borderTopColor: colors.border,
            paddingTop: 16,
        },
        pickerOptionTextDelete: {
            color: colors.red,
            fontWeight: '800',
        },
    }), [colors]);

    const {
        activeWorkout,
        workoutTimer,
        isTimerRunning,
        startWorkout,
        resumeWorkout: storeResumeWorkout,
        pauseWorkout,
        unpauseWorkout,
        updateDuration,
        finishWorkout: storeFinishWorkout,
    } = useWorkoutStore();

    const isThisWorkoutActive = activeWorkout?.id === workout.id && workout.status !== 'completed';

    // ─── Phase ───────────────────────────────────────────────────────────────
    const phase = useMemo((): WorkoutPhase => {
        if (workout.status === 'completed') return 'completed';
        if (isThisWorkoutActive) return 'active';
        return 'idle';
    }, [workout.id, workout.status, isThisWorkoutActive]);

    const displaySeconds = isThisWorkoutActive ? workoutTimer : (workout.duration || 0);
    const isPaused = isThisWorkoutActive && !isTimerRunning;

    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');
    const [showStatePicker, setShowStatePicker] = useState(false);
    const dotPulse = useRef(new Animated.Value(1)).current;

    // ─── Pulsing dot ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (phase === 'active' && !isPaused) {
            const anim = Animated.loop(
                Animated.sequence([
                    Animated.timing(dotPulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
                    Animated.timing(dotPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
                ]),
            );
            anim.start();
            return () => anim.stop();
        }
        dotPulse.setValue(1);
    }, [phase, isPaused, dotPulse]);

    // ─── Stats ───────────────────────────────────────────────────────────────
    const completedSets = sets.filter(s => s.completed === 1).length;
    const uniqueExercises = new Set(sets.map(s => s.exercise_id)).size;

    // ═══════════════════════════════════════════════════════════════════════════
    // ACTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    const handleStart = async () => {
        try {
            await startWorkout(workout.name);
            feedbackService.buttonPress();
            onStatusChange();
        } catch (e: any) {
            notify.error('Error', e?.message ?? 'No se pudo iniciar.');
        }
    };

    const handleFinish = () => {
        const doFinish = async () => {
            try {
                if (isThisWorkoutActive) {
                    await storeFinishWorkout();
                } else {
                    await workoutService.finishWorkout(workout.id);
                }
                feedbackService.dayCompleted();
                notify.success('¡Día Finalizado!', `Duración: ${formatTimer(displaySeconds)} · ${completedSets} series`);
                onStatusChange();
            } catch (e: any) {
                notify.error('Error', e?.message ?? 'No se pudo finalizar.');
            }
        };

        if (phase === 'active' && displaySeconds > 0) {
            confirm.ask(
                '¿Finalizar entrenamiento?',
                `Duración: ${formatTimer(displaySeconds)} · ${completedSets} series completadas`,
                doFinish,
                'Finalizar'
            );
        } else {
            doFinish();
        }
    };

    const handleResume = async () => {
        try {
            await storeResumeWorkout(workout);
            feedbackService.buttonPress();
            notify.info('Entrenamiento Reabierto', 'Podés seguir editando.');
            onStatusChange();
        } catch (e: any) {
            notify.error('Error', e?.message ?? 'No se pudo reabrir.');
        }
    };

    const handleTogglePause = async () => {
        if (!isThisWorkoutActive) return;
        if (isPaused) {
            unpauseWorkout();
        } else {
            pauseWorkout();
        }
        feedbackService.buttonPress();
    };

    const handleEditTimer = () => {
        const h = Math.floor(displaySeconds / 3600);
        const m = Math.floor((displaySeconds % 3600) / 60);
        const s = displaySeconds % 60;
        setEditValue(`${h > 0 ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        setIsEditing(true);
        feedbackService.selection();
    };

    const handleSaveEdit = async () => {
        const parts = editValue.split(':').map(Number);
        let totalSec = 0;
        if (parts.length === 3) totalSec = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
        else if (parts.length === 2) totalSec = (parts[0] || 0) * 60 + (parts[1] || 0);
        else totalSec = parts[0] || 0;

        totalSec = Math.max(0, Math.min(totalSec, 86400));
        setIsEditing(false);

        if (isThisWorkoutActive) {
            await updateDuration(totalSec);
        } else {
            await workoutService.update(workout.id, { duration: totalSec });
            onStatusChange();
        }
        feedbackService.buttonPress();
    };

    const handleSelectState = async (newState: 'idle' | 'active' | 'paused' | 'completed') => {
        setShowStatePicker(false);
        try {
            if (newState === 'idle') {
                if (phase === 'idle') return;
                confirm.destructive(
                    '¿Volver a Sin Iniciar?',
                    'El temporizador volverá a 0 y el entrenamiento quedará como no iniciado.',
                    async () => {
                        if (isThisWorkoutActive) {
                            const { cancelWorkout } = useWorkoutStore.getState();
                            await cancelWorkout();
                        } else {
                            await workoutService.update(workout.id, { duration: 0, status: 'in_progress' });
                        }
                        onStatusChange();
                    },
                    'Reiniciar'
                );
            } else if (newState === 'active') {
                if (phase === 'idle' || isPaused) {
                    if (phase === 'idle') await handleStart();
                    else unpauseWorkout();
                } else if (phase === 'completed') {
                    await handleResume();
                    unpauseWorkout();
                }
            } else if (newState === 'paused') {
                if (phase === 'active' && !isPaused) {
                    pauseWorkout();
                } else if (phase === 'idle') {
                    await handleStart();
                    pauseWorkout();
                } else if (phase === 'completed') {
                    await handleResume();
                    pauseWorkout();
                }
            } else if (newState === 'completed') {
                if (phase !== 'completed') {
                    handleFinish();
                }
            }
        } catch (e: any) {
            notify.error('Error', e?.message ?? 'No se pudo cambiar el estado.');
        }
    };

    const handleDeleteWorkout = () => {
        setShowStatePicker(false);
        const setLength = sets.length;
        const msg = setLength > 0
            ? `Esta sesión tiene ${setLength} series. Se borrarán permanentemente todos los datos de este entrenamiento.`
            : 'Se borrará permanentemente este entrenamiento.';

        confirm.destructive(
            'Sesión No Iniciada',
            msg,
            async () => {
                try {
                    if (isThisWorkoutActive) {
                        const { cancelWorkout } = useWorkoutStore.getState();
                        await cancelWorkout();
                    }
                    await workoutService.deleteWorkout(workout.id);
                    feedbackService.buttonPress();
                    notify.success('Sesión eliminada');
                    onStatusChange();
                } catch (e: any) {
                    notify.error('Error al eliminar', e?.message);
                }
            },
            'Eliminar'
        );
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════════════

    const renderPhaseContent = () => {
        if (phase === 'completed') {
            return (
                <View style={st.card}>
                    <View style={st.row}>
                        <Pressable style={[st.pill, st.pillComplete]} onPress={() => setShowStatePicker(true)}>
                            <Check size={10} color={colors.onPrimary} strokeWidth={3} />
                            <Text style={st.pillTextComplete}>Finalizado</Text>
                        </Pressable>

                        <View style={st.centerBlock}>
                            <Text style={st.timerLabel}>Duración</Text>
                            <Text style={st.timerValue}>{formatTimer(displaySeconds)}</Text>
                        </View>

                        <Pressable onPress={handleResume} style={st.primaryBtn} hitSlop={8}>
                            <RotateCcw size={14} color={colors.onPrimary} />
                            <Text style={st.primaryBtnText}>Reabrir</Text>
                        </Pressable>
                    </View>

                    <View style={st.statsRow}>
                        <Text style={st.statText}>{completedSets} series</Text>
                        <View style={st.statDot} />
                        <Text style={st.statText}>{uniqueExercises} ejercicios</Text>
                    </View>
                </View>
            );
        }

        if (phase === 'active') {
            return (
                <View style={[st.card, st.cardActive]}>
                    <View style={st.row}>
                        <Pressable style={[st.pill, isPaused ? st.pillPaused : st.pillActive]} onPress={() => setShowStatePicker(true)}>
                            <Animated.View style={[
                                st.liveDot,
                                isPaused ? st.liveDotPaused : st.liveDotActive,
                                { opacity: isPaused ? 1 : dotPulse },
                            ]} />
                            <Text style={[st.pillTextActive, isPaused && st.pillTextPaused]}>
                                {isPaused ? 'Pausado' : 'En curso'}
                            </Text>
                        </Pressable>

                        <View style={st.centerBlock}>
                            <Text style={st.timerLabel}>Duración</Text>
                            {isEditing ? (
                                <TextInput
                                    style={st.timerEdit}
                                    value={editValue}
                                    onChangeText={setEditValue}
                                    onSubmitEditing={handleSaveEdit}
                                    onBlur={handleSaveEdit}
                                    keyboardType="numbers-and-punctuation"
                                    autoFocus
                                    selectTextOnFocus
                                />
                            ) : (
                                <Pressable onPress={handleEditTimer} style={st.timerTouchable} hitSlop={4}>
                                    <Text style={st.timerValue}>{formatTimer(displaySeconds)}</Text>
                                    <Pencil size={10} color={colors.textMuted} />
                                </Pressable>
                            )}
                        </View>

                        <View style={st.controlsRow}>
                            <Pressable
                                style={[
                                    st.ctrlBtn,
                                    !isPaused && {
                                        backgroundColor: withAlpha(colors.yellow, '10'),
                                        borderColor: withAlpha(colors.yellow, '20'),
                                        shadowOpacity: 0,
                                        elevation: 0
                                    }
                                ]}
                                onPress={handleTogglePause}
                                hitSlop={8}
                            >
                                {isPaused ? (
                                    <Play size={18} color={colors.primary.DEFAULT} fill={colors.primary.DEFAULT} />
                                ) : (
                                    <Pause size={18} color={colors.yellow} fill={colors.yellow} />
                                )}
                            </Pressable>
                            <Pressable style={st.ctrlBtnFinish} onPress={handleFinish} hitSlop={8}>
                                <Check size={18} color={colors.primary.DEFAULT} strokeWidth={3} />
                            </Pressable>
                        </View>
                    </View>

                    <View style={st.statsRow}>
                        <Text style={st.statText}>{completedSets} series completadas</Text>
                    </View>
                </View>
            );
        }

        // IDLE
        return (
            <View style={st.card}>
                <View style={st.row}>
                    <Pressable style={[st.pill, st.pillIdle]} onPress={() => setShowStatePicker(true)}>
                        <View style={[st.liveDot, st.liveDotIdle]} />
                        <Text style={st.pillTextIdle}>Sesión {sessionNumber}</Text>
                    </Pressable>

                    <View style={st.centerBlock}>
                        <Text style={st.timerLabel}>Lista para iniciar</Text>
                        <Text style={[st.timerValue, { color: colors.textMuted, opacity: 0.5 }]}>00:00</Text>
                    </View>

                    <Pressable style={st.primaryBtn} onPress={handleStart} hitSlop={8}>
                        <Play size={14} color={colors.onPrimary} fill={colors.onPrimary} />
                        <Text style={st.primaryBtnText}>Iniciar</Text>
                    </Pressable>
                </View>
            </View>
        );
    };

    return (
        <View style={st.wrapper}>
            {renderPhaseContent()}

            <Modal
                visible={showStatePicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowStatePicker(false)}
            >
                <Pressable style={st.pickerOverlay} onPress={() => setShowStatePicker(false)}>
                    <View style={st.pickerSheet}>
                        <View style={st.pickerHeader}>
                            <Text style={st.pickerTitle}>Estado de la Sesión</Text>
                            <Pressable onPress={() => setShowStatePicker(false)} hitSlop={8}>
                                <X size={20} color={colors.textMuted} />
                            </Pressable>
                        </View>

                        <Pressable
                            style={[st.pickerOption, phase === 'idle' && st.pickerOptionActive]}
                            onPress={() => handleSelectState('idle')}
                        >
                            <View style={[st.pickerDot, st.pickerDotIdle]} />
                            <Text style={[st.pickerOptionText, phase === 'idle' && st.pickerOptionTextActive]}>Sin Iniciar</Text>
                        </Pressable>

                        <Pressable
                            style={[st.pickerOption, (phase === 'active' && !isPaused) && st.pickerOptionActive]}
                            onPress={() => handleSelectState('active')}
                        >
                            <View style={[st.pickerDot, st.pickerDotActive]} />
                            <Text style={[st.pickerOptionText, (phase === 'active' && !isPaused) && st.pickerOptionTextActive]}>En curso</Text>
                        </Pressable>

                        <Pressable
                            style={[st.pickerOption, isPaused && st.pickerOptionActive]}
                            onPress={() => handleSelectState('paused')}
                        >
                            <View style={[st.pickerDot, st.pickerDotPaused]} />
                            <Text style={[st.pickerOptionText, isPaused && st.pickerOptionTextActive]}>Pausado</Text>
                        </Pressable>

                        <Pressable
                            style={[st.pickerOption, phase === 'completed' && st.pickerOptionActive]}
                            onPress={() => handleSelectState('completed')}
                        >
                            <Check size={14} color={phase === 'completed' ? colors.primary.DEFAULT : colors.textMuted} strokeWidth={3} />
                            <Text style={[st.pickerOptionText, phase === 'completed' && st.pickerOptionTextActive]}>Finalizado</Text>
                        </Pressable>

                        <Pressable style={[st.pickerOption, st.pickerOptionDelete]} onPress={handleDeleteWorkout}>
                            <X size={14} color={colors.red} strokeWidth={3} />
                            <Text style={st.pickerOptionTextDelete}>Eliminar Entrenamiento</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
}
