import { Colors } from '@/src/theme';
import * as Haptics from 'expo-haptics';
import { ChevronDown, Minus, Pause, Play, Plus, RotateCcw, X, Zap } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

// ─── Types ───────────────────────────────────────────────────────────────────
interface IntervalTimerModalProps {
    visible: boolean;
    onClose: () => void;
}

type TimerPhase = 'idle' | 'prepare' | 'work' | 'rest' | 'finished';

interface TimerPreset {
    id: string;
    name: string;
    description: string;
    work: number;
    rest: number;
    rounds: number;
}

// ─── Presets ─────────────────────────────────────────────────────────────────
const PRESETS: TimerPreset[] = [
    { id: 'tabata', name: 'Tabata', description: '20s trabajo / 10s descanso × 8', work: 20, rest: 10, rounds: 8 },
    { id: 'emom', name: 'EMOM', description: '40s trabajo / 20s descanso × 10', work: 40, rest: 20, rounds: 10 },
    { id: 'hiit30', name: 'HIIT 30/30', description: '30s trabajo / 30s descanso × 10', work: 30, rest: 30, rounds: 10 },
    { id: 'hiit45', name: 'HIIT 45/15', description: '45s trabajo / 15s descanso × 8', work: 45, rest: 15, rounds: 8 },
    { id: 'boxing', name: 'Boxing', description: '3min rounds / 1min descanso × 6', work: 180, rest: 60, rounds: 6 },
];

const PREPARE_DURATION = 5;
const RING_SIZE = 240;
const RING_STROKE = 10;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Component ───────────────────────────────────────────────────────────────
export function IntervalTimerModal({ visible, onClose }: IntervalTimerModalProps) {
    const insets = useSafeAreaInsets();

    // Config
    const [workSec, setWorkSec] = useState(20);
    const [restSec, setRestSec] = useState(10);
    const [rounds, setRounds] = useState(8);

    // Runtime
    const [phase, setPhase] = useState<TimerPhase>('idle');
    const [currentRound, setCurrentRound] = useState(1);
    const [timeLeft, setTimeLeft] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [elapsedTotal, setElapsedTotal] = useState(0);

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const progressAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const phaseRef = useRef<TimerPhase>('idle');
    const currentRoundRef = useRef(1);
    const isPausedRef = useRef(false);

    // Keep refs in sync
    useEffect(() => { phaseRef.current = phase; }, [phase]);
    useEffect(() => { currentRoundRef.current = currentRound; }, [currentRound]);
    useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

    // ─── Helpers ──────────────────────────────────────────────────────────────
    const phaseDuration = useCallback((p: TimerPhase): number => {
        switch (p) {
            case 'prepare': return PREPARE_DURATION;
            case 'work': return workSec;
            case 'rest': return restSec;
            default: return 0;
        }
    }, [workSec, restSec]);

    const totalWorkoutTime = useMemo(() => {
        return (workSec + restSec) * rounds;
    }, [workSec, restSec, rounds]);

    const formatTime = (sec: number): string => {
        const m = Math.floor(Math.abs(sec) / 60);
        const s = Math.abs(sec) % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const formatDuration = (sec: number): string => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        if (m === 0) return `${s}s`;
        if (s === 0) return `${m}min`;
        return `${m}min ${s}s`;
    };

    // ─── Progress ring animation ──────────────────────────────────────────────
    const animateProgress = useCallback((duration: number) => {
        progressAnim.setValue(0);
        Animated.timing(progressAnim, {
            toValue: 1,
            duration: duration * 1000,
            easing: Easing.linear,
            useNativeDriver: true,
        }).start();
    }, [progressAnim]);

    const strokeDashoffset = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, RING_CIRCUMFERENCE],
    });

    // ─── Pulse animation for countdown ────────────────────────────────────────
    const triggerPulse = useCallback(() => {
        pulseAnim.setValue(1.15);
        Animated.spring(pulseAnim, {
            toValue: 1,
            friction: 4,
            tension: 100,
            useNativeDriver: true,
        }).start();
    }, [pulseAnim]);

    // ─── Phase transitions ────────────────────────────────────────────────────
    const transitionPhase = useCallback(() => {
        const p = phaseRef.current;
        const r = currentRoundRef.current;

        if (p === 'prepare') {
            setPhase('work');
            setTimeLeft(workSec);
            animateProgress(workSec);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (p === 'work') {
            if (r >= rounds) {
                // Last round, no rest needed  — finish
                setPhase('finished');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else if (restSec > 0) {
                setPhase('rest');
                setTimeLeft(restSec);
                animateProgress(restSec);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } else {
                // No rest, go directly to next work round
                setCurrentRound(prev => prev + 1);
                setTimeLeft(workSec);
                animateProgress(workSec);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        } else if (p === 'rest') {
            if (r >= rounds) {
                setPhase('finished');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                setCurrentRound(prev => prev + 1);
                setPhase('work');
                setTimeLeft(workSec);
                animateProgress(workSec);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        }
    }, [workSec, restSec, rounds, animateProgress]);

    // ─── Main tick ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (phase === 'idle' || phase === 'finished' || isPaused) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            if (isPaused) {
                progressAnim.stopAnimation();
            }
            return;
        }

        intervalRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    transitionPhase();
                    return 0;
                }
                // Haptic on last 3 seconds
                if (prev <= 4 && prev > 1) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    triggerPulse();
                }
                return prev - 1;
            });
            setElapsedTotal(prev => prev + 1);
        }, 1000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [phase, isPaused, transitionPhase, triggerPulse, progressAnim]);

    // ─── Actions ──────────────────────────────────────────────────────────────
    const handleStart = () => {
        setPhase('prepare');
        setTimeLeft(PREPARE_DURATION);
        setCurrentRound(1);
        setIsPaused(false);
        setElapsedTotal(0);
        animateProgress(PREPARE_DURATION);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    const handlePause = () => {
        setIsPaused(prev => !prev);
        if (!isPaused) {
            progressAnim.stopAnimation();
        } else {
            // Resume animation with remaining time
            const remaining = timeLeft;
            animateProgress(remaining);
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleReset = useCallback(() => {
        setPhase('idle');
        setIsPaused(false);
        setTimeLeft(0);
        setCurrentRound(1);
        setElapsedTotal(0);
        progressAnim.setValue(0);
    }, [progressAnim]);

    const handleClose = () => {
        handleReset();
        onClose();
    };

    const applyPreset = (preset: TimerPreset) => {
        setWorkSec(preset.work);
        setRestSec(preset.rest);
        setRounds(preset.rounds);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    useEffect(() => {
        if (!visible) handleReset();
    }, [visible, handleReset]);

    // ─── Stepper Component ────────────────────────────────────────────────────
    const Stepper = ({ value, onChange, min = 1, max = 999, step = 1, label, formatFn }: {
        value: number;
        onChange: (v: number) => void;
        min?: number;
        max?: number;
        step?: number;
        label: string;
        formatFn?: (v: number) => string;
    }) => (
        <View className="items-center">
            <Text className="text-iron-400 text-xs font-bold uppercase mb-2 tracking-wider">{label}</Text>
            <View className="flex-row items-center gap-3">
                <TouchableOpacity
                    onPress={() => {
                        const next = Math.max(min, value - step);
                        onChange(next);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    className="w-11 h-11 rounded-xl bg-iron-800 border border-iron-700 items-center justify-center active:bg-iron-200"
                >
                    <Minus size={18} color={Colors.iron[950]} />
                </TouchableOpacity>
                <View className="min-w-[64px] items-center">
                    <Text className="text-iron-950 text-3xl font-black">
                        {formatFn ? formatFn(value) : value}
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={() => {
                        const next = Math.min(max, value + step);
                        onChange(next);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    className="w-11 h-11 rounded-xl bg-iron-800 border border-iron-700 items-center justify-center active:bg-iron-200"
                >
                    <Plus size={18} color={Colors.iron[950]} />
                </TouchableOpacity>
            </View>
        </View>
    );

    // ─── Phase Colors & Labels ────────────────────────────────────────────────
    const getPhaseConfig = () => {
        switch (phase) {
            case 'prepare':
                return { bg: '#d97706', label: 'PREPÁRATE', ringColor: '#f59e0b' };
            case 'work':
                return { bg: Colors.primary.DEFAULT, label: '¡TRABAJO!', ringColor: '#8d6e63' };
            case 'rest':
                return { bg: '#1e6b3a', label: 'DESCANSO', ringColor: '#4ade80' };
            case 'finished':
                return { bg: Colors.primary.DEFAULT, label: '¡COMPLETADO!', ringColor: Colors.primary.light };
            default:
                return { bg: Colors.iron[900], label: '', ringColor: Colors.primary.DEFAULT };
        }
    };

    const phaseConfig = getPhaseConfig();

    // ═══════════════════════════════════════════════════════════════════════════
    // IDLE — Configuration Screen
    // ═══════════════════════════════════════════════════════════════════════════
    if (phase === 'idle') {
        return (
            <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView className="flex-1 bg-iron-900" edges={['top', 'bottom', 'left', 'right']}>
                    {/* Header */}
                    <View className="flex-row justify-between items-center px-5 pt-2 pb-4 border-b border-iron-700">
                        <View>
                            <Text className="text-iron-950 font-bold text-xl">Interval Timer</Text>
                            <Text className="text-iron-400 text-xs font-bold mt-0.5">
                                Total: {formatDuration(totalWorkoutTime)}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={handleClose} className="p-2 -mr-2">
                            <X color={Colors.iron[950]} size={24} />
                        </TouchableOpacity>
                    </View>

                    {/* Presets */}
                    <View className="px-5 pt-4 pb-2">
                        <Text className="text-iron-400 text-xs font-bold uppercase mb-3 tracking-wider">
                            Presets rápidos
                        </Text>
                        <View className="flex-row flex-wrap gap-2">
                            {PRESETS.map(preset => {
                                const isActive = preset.work === workSec && preset.rest === restSec && preset.rounds === rounds;
                                return (
                                    <Pressable
                                        key={preset.id}
                                        onPress={() => applyPreset(preset)}
                                        className={`px-3 py-2 rounded-xl border ${isActive
                                            ? 'bg-primary border-primary'
                                            : 'bg-surface border-iron-700 active:bg-iron-200'
                                            }`}
                                    >
                                        <Text className={`font-bold text-xs ${isActive ? 'text-white' : 'text-iron-950'}`}>
                                            {preset.name}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>

                    {/* Steppers */}
                    <View className="flex-1 px-5 pt-6">
                        <View className="flex-row flex-wrap justify-between gap-y-6 mb-8">
                            <View className="w-[48%] items-center">
                                <Stepper
                                    value={workSec}
                                    onChange={setWorkSec}
                                    min={5}
                                    max={600}
                                    step={5}
                                    label="Trabajo"
                                    formatFn={formatTime}
                                />
                            </View>
                            <View className="w-[48%] items-center">
                                <Stepper
                                    value={restSec}
                                    onChange={setRestSec}
                                    min={0}
                                    max={300}
                                    step={5}
                                    label="Descanso"
                                    formatFn={formatTime}
                                />
                            </View>
                            <View className="w-full items-center">
                                <Stepper
                                    value={rounds}
                                    onChange={setRounds}
                                    min={1}
                                    max={50}
                                    step={1}
                                    label="Rondas"
                                />
                            </View>
                        </View>

                        {/* Work/Rest visualization */}
                        <View className="bg-surface rounded-2xl border border-iron-700 p-4 mb-4">
                            <Text className="text-iron-400 text-xs font-bold uppercase mb-3 tracking-wider">
                                Resumen del entrenamiento
                            </Text>
                            <View className="flex-row items-center mb-2">
                                <View className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: Colors.primary.DEFAULT }} />
                                <Text className="text-iron-950 font-bold flex-1">Trabajo</Text>
                                <Text className="text-iron-950 font-bold">{formatTime(workSec)} × {rounds}</Text>
                            </View>
                            {restSec > 0 && (
                                <View className="flex-row items-center mb-2">
                                    <View className="w-3 h-3 rounded-full bg-green-600 mr-2" />
                                    <Text className="text-iron-950 font-bold flex-1">Descanso</Text>
                                    <Text className="text-iron-950 font-bold">{formatTime(restSec)} × {rounds}</Text>
                                </View>
                            )}
                            <View className="border-t border-iron-700 mt-2 pt-2 flex-row items-center">
                                <Zap size={14} color={Colors.primary.DEFAULT} />
                                <Text className="text-primary font-bold ml-1">
                                    Duración total: {formatDuration(totalWorkoutTime)}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Start Button */}
                    <View className="px-5 pb-4">
                        <Pressable
                            onPress={handleStart}
                            className="bg-primary rounded-2xl py-4 items-center active:opacity-90 elevation-2"
                        >
                            <Text className="text-white font-bold text-lg uppercase tracking-wider">
                                Iniciar entrenamiento
                            </Text>
                        </Pressable>
                    </View>
                </SafeAreaView>
            </Modal>
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ACTIVE / FINISHED — Timer Screen
    // ═══════════════════════════════════════════════════════════════════════════
    return (
        <Modal visible={visible} animationType="fade">
            <View className="flex-1 justify-center items-center" style={{ backgroundColor: phaseConfig.bg }}>
                {/* Close button */}
                <TouchableOpacity
                    onPress={handleClose}
                    className="absolute right-5 p-2 bg-black/20 rounded-full z-10"
                    style={{ top: insets.top + 8 }}
                >
                    <X color="white" size={24} />
                </TouchableOpacity>

                {/* Round indicator pills */}
                {phase !== 'finished' && (
                    <View
                        className="absolute flex-row gap-1.5 px-6"
                        style={{ top: insets.top + 16 }}
                    >
                        {Array.from({ length: rounds }, (_, i) => (
                            <View
                                key={i}
                                className="h-1.5 rounded-full flex-1"
                                style={{
                                    backgroundColor: i < currentRound
                                        ? 'rgba(255,255,255,0.9)'
                                        : i === currentRound - 1
                                            ? 'rgba(255,255,255,0.6)'
                                            : 'rgba(255,255,255,0.2)',
                                    maxWidth: 40,
                                }}
                            />
                        ))}
                    </View>
                )}

                {/* Main Content */}
                <View className="items-center">
                    {/* Phase label */}
                    <Text className="text-white/70 font-bold text-lg mb-6 uppercase tracking-[4px]">
                        {phaseConfig.label}
                    </Text>

                    {/* Progress Ring + Timer */}
                    {phase !== 'finished' ? (
                        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                            <View className="items-center justify-center" style={{ width: RING_SIZE, height: RING_SIZE }}>
                                <Svg
                                    width={RING_SIZE}
                                    height={RING_SIZE}
                                    style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}
                                >
                                    {/* Background ring */}
                                    <Circle
                                        cx={RING_SIZE / 2}
                                        cy={RING_SIZE / 2}
                                        r={RING_RADIUS}
                                        stroke="rgba(255,255,255,0.15)"
                                        strokeWidth={RING_STROKE}
                                        fill="none"
                                    />
                                    {/* Progress ring */}
                                    <AnimatedCircle
                                        cx={RING_SIZE / 2}
                                        cy={RING_SIZE / 2}
                                        r={RING_RADIUS}
                                        stroke={phaseConfig.ringColor}
                                        strokeWidth={RING_STROKE}
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeDasharray={`${RING_CIRCUMFERENCE}`}
                                        strokeDashoffset={strokeDashoffset}
                                    />
                                </Svg>
                                <Text className="text-white font-black" style={{ fontSize: 72 }}>
                                    {formatTime(timeLeft)}
                                </Text>
                            </View>
                        </Animated.View>
                    ) : (
                        <View className="items-center">
                            <Text className="text-white font-black" style={{ fontSize: 64 }}>
                                ¡LISTO!
                            </Text>
                        </View>
                    )}

                    {/* Round info */}
                    <Text className="text-white/50 text-lg font-bold mt-5">
                        {phase === 'finished'
                            ? `${rounds} rondas completadas`
                            : phase === 'prepare'
                                ? 'Comienza en...'
                                : `Ronda ${currentRound} de ${rounds}`
                        }
                    </Text>

                    {/* Elapsed time */}
                    {phase !== 'prepare' && (
                        <Text className="text-white/30 text-sm font-bold mt-1">
                            Tiempo total: {formatDuration(elapsedTotal)}
                        </Text>
                    )}
                </View>

                {/* Controls */}
                {phase !== 'finished' && phase !== 'prepare' && (
                    <View
                        className="absolute flex-row gap-5 items-center"
                        style={{ bottom: insets.bottom + 24 }}
                    >
                        <TouchableOpacity
                            onPress={handleReset}
                            className="w-14 h-14 bg-white/15 rounded-full items-center justify-center active:bg-white/25"
                        >
                            <RotateCcw color="white" size={26} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handlePause}
                            className="w-18 h-18 bg-white rounded-full items-center justify-center active:opacity-90"
                            style={{ width: 72, height: 72 }}
                        >
                            {isPaused
                                ? <Play color="black" size={32} fill="black" />
                                : <Pause color="black" size={32} fill="black" />
                            }
                        </TouchableOpacity>

                        {/* Skip phase button */}
                        <TouchableOpacity
                            onPress={() => {
                                transitionPhase();
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            }}
                            className="w-14 h-14 bg-white/15 rounded-full items-center justify-center active:bg-white/25"
                        >
                            <ChevronDown color="white" size={26} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Finished controls */}
                {phase === 'finished' && (
                    <View
                        className="absolute w-full px-6"
                        style={{ bottom: insets.bottom + 24 }}
                    >
                        {/* Summary card */}
                        <View className="bg-white/10 rounded-2xl p-5 mb-4">
                            <View className="flex-row justify-between mb-2">
                                <Text className="text-white/60 font-bold">Rondas</Text>
                                <Text className="text-white font-bold">{rounds}</Text>
                            </View>
                            <View className="flex-row justify-between mb-2">
                                <Text className="text-white/60 font-bold">Trabajo por ronda</Text>
                                <Text className="text-white font-bold">{formatTime(workSec)}</Text>
                            </View>
                            {restSec > 0 && (
                                <View className="flex-row justify-between mb-2">
                                    <Text className="text-white/60 font-bold">Descanso por ronda</Text>
                                    <Text className="text-white font-bold">{formatTime(restSec)}</Text>
                                </View>
                            )}
                            <View className="border-t border-white/20 mt-1 pt-2 flex-row justify-between">
                                <Text className="text-white/80 font-bold">Tiempo total</Text>
                                <Text className="text-white font-bold">{formatDuration(elapsedTotal)}</Text>
                            </View>
                        </View>

                        <View className="flex-row gap-3">
                            <Pressable
                                onPress={handleReset}
                                className="flex-1 border-2 border-white/40 rounded-2xl py-3.5 items-center active:bg-white/10"
                            >
                                <Text className="text-white font-bold text-base">Repetir</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleClose}
                                className="flex-1 bg-white rounded-2xl py-3.5 items-center active:opacity-90"
                            >
                                <Text className="text-iron-950 font-bold text-base">Cerrar</Text>
                            </Pressable>
                        </View>
                    </View>
                )}
            </View>
        </Modal>
    );
}
