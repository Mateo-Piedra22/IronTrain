import { feedbackService } from '@/src/services/FeedbackService';
import { systemNotificationService } from '@/src/services/SystemNotificationService';
import { workoutService } from '@/src/services/WorkoutService';
import { ThemeFx, withAlpha } from '@/src/theme';
import { Workout, WorkoutSet } from '@/src/types/db';
import { notify } from '@/src/utils/notify';
import { Check, Pencil, Play, Square, Timer } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useColors } from '../src/hooks/useColors';
import { configService } from '../src/services/ConfigService';
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
    // Sanitization: If value is ridiculously large (> 1 year in seconds), 
    // it was likely stored in milliseconds by mistake.
    const sanitizedSeconds = totalSeconds > 31536000 ? Math.floor(totalSeconds / 1000) : totalSeconds;

    if (isNaN(sanitizedSeconds) || sanitizedSeconds < 0) return '00:00';
    const h = Math.floor(sanitizedSeconds / 3600);
    const m = Math.floor((sanitizedSeconds % 3600) / 60);
    const s = sanitizedSeconds % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
}

/**
 * Workout status bar — integrated into the main page between the DateStrip and WorkoutLog.
 * Uses the app's warm industrial design language (brown primary, cream bg, rounded cards).
 *
 * Duration is stored in the `workouts.duration` column (INTEGER, seconds).
 */
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
            maxWidth: 320,
            borderRadius: 24,
            padding: 16,
            borderWidth: 1.5,
            borderColor: colors.border,
            ...ThemeFx.shadowLg,
        },
        pickerHeader: {
            paddingBottom: 16,
            marginBottom: 8,
            borderBottomWidth: 1.5,
            borderBottomColor: colors.border,
        },
        pickerTitle: {
            fontSize: 16,
            fontWeight: '900',
            color: colors.text,
            textAlign: 'center',
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
        },
    }), [colors]);
    const config: any = configService;

    // ─── Phase ───────────────────────────────────────────────────────────────
    const derivePhase = useCallback((): WorkoutPhase => {
        if (workout.status === 'completed') return 'completed';
        const startTs = config.getGeneric(`runningWorkoutTimerStartTimestamp_${workout.id}`) as number | null;
        // If it has a start timestamp, it's active
        if (startTs) return 'active';
        // If it's in progress but no live timer, it might be paused or idle
        return 'idle';
    }, [workout.id, workout.status]);

    // ─── Initial State Recovery ─────────────────────────────────────────────
    const getInitialSeconds = useCallback(() => {
        let raw = workout.duration || 0;
        // Sanitization: If value is ridiculously large (> 1 year in seconds), 
        // it was likely stored in milliseconds by mistake.
        let seconds = raw > 31536000 ? Math.floor(raw / 1000) : raw;

        const startTs = config.getGeneric(`runningWorkoutTimerStartTimestamp_${workout.id}`) as number | null;
        const baseSec = config.getGeneric(`runningWorkoutTimerBaseSeconds_${workout.id}`) as number | null;
        if (startTs) {
            const deltaSec = Math.floor((Date.now() - startTs) / 1000);
            // Cap delta at 12 hours (43200 seconds) to prevent ridiculous durations if app left running
            const safeDeltaSec = Math.min(deltaSec, 43200);
            const liveSeconds = (baseSec ?? 0) + safeDeltaSec;
            seconds = Math.max(seconds, liveSeconds);
        } else if (baseSec !== null && baseSec !== undefined) {
            seconds = Math.max(seconds, baseSec);
        }
        return seconds;
    }, [workout.id, workout.duration]);

    const [phase, setPhase] = useState<WorkoutPhase>(derivePhase);
    const [timerSeconds, setTimerSeconds] = useState(getInitialSeconds);
    const [isPaused, setIsPaused] = useState(() => {
        const hasBase = config.getGeneric(`runningWorkoutTimerBaseSeconds_${workout.id}`) !== null;
        const hasStart = !!config.getGeneric(`runningWorkoutTimerStartTimestamp_${workout.id}`);
        return hasBase && !hasStart;
    });
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');
    const [showStatePicker, setShowStatePicker] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastTickRef = useRef<number>(Date.now());
    const notifCounterRef = useRef<number>(0);
    const dotPulse = useRef(new Animated.Value(1)).current;

    // Sync on external workout changes or navigation
    useEffect(() => {
        const p = derivePhase();
        setPhase(p);
        const initialSeconds = getInitialSeconds();
        setTimerSeconds(initialSeconds);

        const hasBase = config.getGeneric(`runningWorkoutTimerBaseSeconds_${workout.id}`) !== null;
        const hasStart = !!config.getGeneric(`runningWorkoutTimerStartTimestamp_${workout.id}`);
        setIsPaused(hasBase && !hasStart);

        setIsEditing(false);
    }, [workout.id, workout.status, workout.duration, derivePhase, getInitialSeconds]);

    const isTimerOwner = useCallback(() => {
        // Now only checks if the local phase is active. 
        // This ensures the local UI timer keeps running even if another session has the notification focus.
        return phase === 'active';
    }, [phase]);

    // ─── Pulsing dot ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (phase === 'active' && !isPaused && isTimerOwner()) {
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
    }, [phase, isPaused, dotPulse, isTimerOwner]);

    // ─── Timer tick ──────────────────────────────────────────────────────────
    const timerSecondsRef = useRef(timerSeconds);
    timerSecondsRef.current = timerSeconds;

    useEffect(() => {
        if (phase === 'active' && !isPaused && isTimerOwner()) {
            lastTickRef.current = Date.now();
            intervalRef.current = setInterval(() => {
                const now = Date.now();
                let delta = Math.floor((now - lastTickRef.current) / 1000);
                if (delta <= 0) return;
                
                if (delta > 43200) delta = 43200; // Cap at 12 hours
                
                lastTickRef.current = now;

                setTimerSeconds(prev => {
                    const next = prev + delta;
                    if (next % 10 < delta) {
                        workoutService.update(workout.id, { duration: next });
                    }
                    timerSecondsRef.current = next;
                    return next;
                });

                notifCounterRef.current += 1;
                if (notifCounterRef.current % 15 === 0) {
                    const focusedId = config.get('runningWorkoutTimerWorkoutId');
                    // Only update global notification if THIS workout has the focus
                    if (focusedId === workout.id) {
                        const cs = sets.filter(s => s.completed === 1).length;
                        const ue = new Set(sets.map(s => s.exercise_id)).size;
                        systemNotificationService.showPersistentWorkout({
                            elapsedSeconds: timerSecondsRef.current,
                            completedSets: cs,
                            totalExercises: ue,
                            isPaused: false,
                            workoutName: workout.name || `Sesión ${sessionNumber}`
                        });
                    }
                }
            }, 1000);

            return () => {
                if (intervalRef.current) clearInterval(intervalRef.current);
            };
        }
        if (intervalRef.current) clearInterval(intervalRef.current);
        return undefined;
    }, [phase, isPaused, workout.id, sets, isTimerOwner, config.get('runningWorkoutTimerWorkoutId')]);

    // ─── Stats ───────────────────────────────────────────────────────────────
    const completedSets = sets.filter(s => s.completed === 1).length;
    const uniqueExercises = new Set(sets.map(s => s.exercise_id)).size;

    // ═══════════════════════════════════════════════════════════════════════════
    // ACTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    const handleStart = async () => {
        try {
            const now = Date.now();
            await config.set('runningWorkoutTimerWorkoutId', workout.id);
            await config.setGeneric(`runningWorkoutTimerStartTimestamp_${workout.id}`, now);
            await config.setGeneric(`runningWorkoutTimerBaseSeconds_${workout.id}`, workout.duration || 0);

            setPhase('active');
            setIsPaused(false);
            setTimerSeconds(prev => prev || 0);
            const currentSeconds = timerSeconds || workout.duration || 0;
            lastTickRef.current = now;
            notifCounterRef.current = 0;

            await workoutService.resumeWorkout(workout.id);
            feedbackService.buttonPress();

            systemNotificationService.showPersistentWorkout({
                elapsedSeconds: currentSeconds,
                completedSets,
                totalExercises: uniqueExercises,
                isPaused: false,
                workoutName: workout.name || `Sesión ${sessionNumber}`
            });
            systemNotificationService.scheduleInactivityReminder(currentSeconds);
            onStatusChange();
        } catch (e: any) {
            notify.error('Error', e?.message ?? 'No se pudo iniciar.');
        }
    };

    const handleFinish = () => {
        const doFinish = async () => {
            try {
                if (intervalRef.current) clearInterval(intervalRef.current);
                setPhase('completed');
                setIsPaused(false);

                await workoutService.update(workout.id, { duration: timerSeconds });
                await workoutService.finishWorkout(workout.id);

                await config.setGeneric(`runningWorkoutTimerStartTimestamp_${workout.id}`, null);
                await config.setGeneric(`runningWorkoutTimerBaseSeconds_${workout.id}`, 0);

                const focusedId = config.get('runningWorkoutTimerWorkoutId');
                if (focusedId === workout.id) {
                    await config.set('runningWorkoutTimerWorkoutId', null);
                    systemNotificationService.dismissPersistentWorkout();
                    systemNotificationService.cancelInactivityReminder();
                }

                feedbackService.dayCompleted();

                if (focusedId === workout.id) {
                    systemNotificationService.showCongratulation({
                        durationSeconds: timerSeconds,
                        completedSets,
                        totalExercises: uniqueExercises,
                        workoutName: workout.name || `Sesión ${sessionNumber}`
                    });
                }

                notify.success('¡Día Finalizado!', `Duración: ${formatTimer(timerSeconds)} · ${completedSets} series`);
                onStatusChange();
            } catch (e: any) {
                notify.error('Error', e?.message ?? 'No se pudo finalizar.');
            }
        };

        if (phase === 'active' && timerSeconds > 0) {
            confirm.ask(
                '¿Finalizar entrenamiento?',
                `Duración: ${formatTimer(timerSeconds)} · ${completedSets} series completadas`,
                doFinish,
                'Finalizar'
            );
        } else {
            doFinish();
        }
    };

    const handleResume = async () => {
        try {
            const now = Date.now();
            await workoutService.resumeWorkout(workout.id);
            await config.set('runningWorkoutTimerWorkoutId', workout.id);
            await config.setGeneric(`runningWorkoutTimerStartTimestamp_${workout.id}`, now);
            await config.setGeneric(`runningWorkoutTimerBaseSeconds_${workout.id}`, workout.duration || 0);

            setPhase('active');
            setIsPaused(false);
            const currentSeconds = workout.duration || 0;
            setTimerSeconds(currentSeconds);
            lastTickRef.current = now;
            feedbackService.buttonPress();

            systemNotificationService.showPersistentWorkout({
                elapsedSeconds: currentSeconds,
                completedSets,
                totalExercises: uniqueExercises,
                isPaused: false,
                workoutName: workout.name || `Sesión ${sessionNumber}`
            });

            notify.info('Entrenamiento Reabierto', 'Podés seguir editando.');
            onStatusChange();
        } catch (e: any) {
            notify.error('Error', e?.message ?? 'No se pudo reabrir.');
        }
    };

    const handleTogglePause = async () => {
        if (isPaused) {
            const now = Date.now();
            setIsPaused(false);
            lastTickRef.current = now;
            await config.setGeneric(`runningWorkoutTimerStartTimestamp_${workout.id}`, now);
            await config.setGeneric(`runningWorkoutTimerBaseSeconds_${workout.id}`, timerSeconds);
            await config.set('runningWorkoutTimerWorkoutId', workout.id);
            feedbackService.buttonPress();
            systemNotificationService.showPersistentWorkout({
                elapsedSeconds: timerSeconds, completedSets, totalExercises: uniqueExercises, isPaused: false,
                workoutName: workout.name || 'Entrenamiento'
            });
            systemNotificationService.scheduleInactivityReminder(timerSeconds);
        } else {
            setIsPaused(true);
            if (intervalRef.current) clearInterval(intervalRef.current);
            await config.setGeneric(`runningWorkoutTimerStartTimestamp_${workout.id}`, null);
            await config.setGeneric(`runningWorkoutTimerBaseSeconds_${workout.id}`, timerSeconds);
            feedbackService.buttonPress();
            await workoutService.update(workout.id, { duration: timerSeconds });

            const focusedId = config.get('runningWorkoutTimerWorkoutId');
            if (focusedId === workout.id) {
                systemNotificationService.showPersistentWorkout({
                    elapsedSeconds: timerSeconds, completedSets, totalExercises: uniqueExercises, isPaused: true,
                    workoutName: workout.name || `Sesión ${sessionNumber}`
                });
                systemNotificationService.cancelInactivityReminder();
            }
        }
    };

    const handleEditTimer = () => {
        const h = Math.floor(timerSeconds / 3600);
        const m = Math.floor((timerSeconds % 3600) / 60);
        const s = timerSeconds % 60;
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
        setTimerSeconds(totalSec);
        setIsEditing(false);
        const now = Date.now();
        // Reset tick reference so the interval doesn't compute a huge delta
        lastTickRef.current = now;

        // Persist manual change globally if this is focusing the active timer
        await config.setGeneric(`runningWorkoutTimerBaseSeconds_${workout.id}`, totalSec);
        if (phase === 'active' && !isPaused) {
            await config.setGeneric(`runningWorkoutTimerStartTimestamp_${workout.id}`, now);
        }

        await workoutService.update(workout.id, { duration: totalSec });

        // Refresh notification with new timestamp base if we are active
        if (phase === 'active' && isTimerOwner()) {
            systemNotificationService.showPersistentWorkout({
                elapsedSeconds: totalSec,
                completedSets,
                totalExercises: uniqueExercises,
                isPaused,
                workoutName: workout.name || 'Entrenamiento'
            });
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
                        setPhase('idle');
                        setIsPaused(false);
                        setTimerSeconds(0);
                        if (intervalRef.current) clearInterval(intervalRef.current);
                        await workoutService.update(workout.id, { duration: 0, status: 'in_progress' });

                        await config.setGeneric(`runningWorkoutTimerStartTimestamp_${workout.id}`, null);
                        await config.setGeneric(`runningWorkoutTimerBaseSeconds_${workout.id}`, 0);

                        const focusedId = config.get('runningWorkoutTimerWorkoutId');
                        if (focusedId === workout.id) {
                            await config.set('runningWorkoutTimerWorkoutId', null);
                            systemNotificationService.dismissPersistentWorkout();
                            systemNotificationService.cancelInactivityReminder();
                        }
                        onStatusChange();
                    },
                    'Reiniciar'
                );
            } else if (newState === 'active') {
                if (phase === 'idle' || isPaused) {
                    await handleStart();
                } else if (phase === 'completed') {
                    await handleResume();
                }
            } else if (newState === 'paused') {
                if (phase === 'active' && !isPaused) {
                    await handleTogglePause();
                } else if (phase === 'idle') {
                    await config.set('runningWorkoutTimerWorkoutId', workout.id);
                    setPhase('active');
                    setIsPaused(true);
                    await workoutService.update(workout.id, { status: 'in_progress' });
                    onStatusChange();
                } else if (phase === 'completed') {
                    await handleResume();
                    await handleTogglePause();
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
            '¿Eliminar Sesión?',
            msg,
            async () => {
                try {
                    // Cleanup timers
                    await config.setGeneric(`runningWorkoutTimerStartTimestamp_${workout.id}`, null);
                    await config.setGeneric(`runningWorkoutTimerBaseSeconds_${workout.id}`, 0);

                    const focusedId = config.get('runningWorkoutTimerWorkoutId');
                    if (focusedId === workout.id) {
                        await config.set('runningWorkoutTimerWorkoutId', null);
                        systemNotificationService.dismissPersistentWorkout();
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
    // RENDER — Uses the same card / pill language as the rest of the app
    // ═══════════════════════════════════════════════════════════════════════════

    const renderPhase = () => {
        // ─── COMPLETED ───────────────────────────────────────────────────────────
        if (phase === 'completed') {
            return (
                <View style={st.wrapper}>
                    <View style={st.card}>
                        <View style={st.row}>
                            {/* Status pill */}
                            <Pressable style={[st.pill, st.pillComplete]} onPress={() => setShowStatePicker(true)}>
                                <Check size={10} color={colors.onPrimary} strokeWidth={3} />
                                <Text style={st.pillTextComplete}>Finalizado</Text>
                            </Pressable>

                            {/* Duration */}
                            <View style={st.centerBlock}>
                                <Text style={st.timerLabel}>Duración</Text>
                                <Text style={st.timerValue}>{formatTimer(timerSeconds)}</Text>
                            </View>

                            {/* Reopen */}
                            <Pressable onPress={handleResume} style={st.secondaryBtn} hitSlop={8}>
                                <Text style={st.secondaryBtnText}>Reabrir</Text>
                            </Pressable>
                        </View>

                        {/* Stats row */}
                        <View style={st.statsRow}>
                            <Text style={st.statText}>{completedSets} series</Text>
                            <View style={st.statDot} />
                            <Text style={st.statText}>{uniqueExercises} ejercicios</Text>
                        </View>
                    </View>
                </View>
            );
        }

        // ─── ACTIVE ──────────────────────────────────────────────────────────────
        if (phase === 'active') {
            return (
                <View style={st.wrapper}>
                    <View style={[st.card, st.cardActive]}>
                        <View style={st.row}>
                            {/* Status pill */}
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

                            {/* Timer (editable) */}
                            <View style={st.centerBlock}>
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
                                        <Text style={st.timerValue}>{formatTimer(timerSeconds)}</Text>
                                        <Pencil size={10} color={colors.textMuted} />
                                    </Pressable>
                                )}
                            </View>

                            {/* Controls */}
                            <View style={st.controlsRow}>
                                <Pressable onPress={handleTogglePause} style={st.ctrlBtn} hitSlop={4}>
                                    {isPaused ? (
                                        <Play size={13} color={colors.primary.DEFAULT} fill={colors.primary.DEFAULT} />
                                    ) : (
                                        <Timer size={13} color={colors.yellow} />
                                    )}
                                </Pressable>
                                <Pressable onPress={handleFinish} style={st.ctrlBtnFinish} hitSlop={4}>
                                    <Square size={11} color={colors.primary.DEFAULT} fill={colors.primary.DEFAULT} />
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </View>
            );
        }

        // ─── IDLE ────────────────────────────────────────────────────────────────
        return (
            <View style={st.wrapper}>
                <View style={st.card}>
                    <View style={st.row}>
                        {/* Status pill */}
                        <Pressable style={[st.pill, st.pillIdle]} onPress={() => setShowStatePicker(true)}>
                            <View style={[st.liveDot, st.liveDotIdle]} />
                            <Text style={st.pillTextIdle}>Sin iniciar</Text>
                        </Pressable>

                        {/* Actions */}
                        <View style={st.controlsRow}>
                            <Pressable onPress={handleStart} style={st.primaryBtn} hitSlop={6}>
                                <Play size={11} color={colors.onPrimary} fill={colors.onPrimary} />
                                <Text style={st.primaryBtnText}>Iniciar</Text>
                            </Pressable>
                            <Pressable onPress={handleFinish} style={st.secondaryBtn} hitSlop={6}>
                                <Check size={11} color={colors.textMuted} strokeWidth={3} />
                                <Text style={st.secondaryBtnText}>Finalizar</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <>
            {renderPhase()}

            <Modal visible={showStatePicker} transparent animationType="fade" onRequestClose={() => setShowStatePicker(false)}>
                <Pressable style={st.pickerOverlay} onPress={() => setShowStatePicker(false)}>
                    <View style={st.pickerSheet}>
                        <View style={st.pickerHeader}>
                            <Text style={st.pickerTitle}>Estado del entrenamiento</Text>
                        </View>

                        <Pressable onPress={() => handleSelectState('idle')} style={[st.pickerOption, phase === 'idle' && st.pickerOptionActive]}>
                            <View style={[st.pickerDot, st.pickerDotIdle]} />
                            <Text style={[st.pickerOptionText, phase === 'idle' && st.pickerOptionTextActive]}>Sin iniciar</Text>
                        </Pressable>

                        <Pressable onPress={() => handleSelectState('active')} style={[st.pickerOption, phase === 'active' && !isPaused && st.pickerOptionActive]}>
                            <View style={[st.pickerDot, st.pickerDotActive]} />
                            <Text style={[st.pickerOptionText, phase === 'active' && !isPaused && st.pickerOptionTextActive]}>En curso</Text>
                        </Pressable>

                        <Pressable onPress={() => handleSelectState('paused')} style={[st.pickerOption, phase === 'active' && isPaused && st.pickerOptionActive]}>
                            <View style={[st.pickerDot, st.pickerDotPaused]} />
                            <Text style={[st.pickerOptionText, phase === 'active' && isPaused && st.pickerOptionTextActive]}>En pausa</Text>
                        </Pressable>

                        <Pressable onPress={() => handleSelectState('completed')} style={[st.pickerOption, phase === 'completed' && st.pickerOptionActive]}>
                            <Check size={12} color={phase === 'completed' ? colors.primary.DEFAULT : colors.textMuted} strokeWidth={3} />
                            <Text style={[st.pickerOptionText, phase === 'completed' && st.pickerOptionTextActive]}>Finalizado</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>
        </>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

