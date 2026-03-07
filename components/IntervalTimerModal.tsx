import { Colors, ThemeFx, withAlpha } from '@/src/theme';
import { ChevronDown, Minus, Pause, Play, Plus, RotateCcw, X, Zap } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { feedbackService } from '../src/services/FeedbackService';
import { systemNotificationService } from '../src/services/SystemNotificationService';

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
    { id: 'hiit30', name: 'HIIT 30/30', description: '30s trabajo / 30s descanso × 10', work: 30, rest: 30, rounds: 10 },
    { id: 'hiit45', name: 'HIIT 45/15', description: '45s trabajo / 15s descanso × 8', work: 45, rest: 15, rounds: 8 },
    { id: 'sprint', name: 'Sprints', description: '30s sprint / 90s recuperación × 5', work: 30, rest: 90, rounds: 5 },
    { id: 'emom_classic', name: 'EMOM', description: '60s intervalo (trabajo + descanso) × 10', work: 60, rest: 0, rounds: 10 },
    { id: 'emom_4020', name: 'Circuito 40/20', description: '40s trabajo / 20s transición × 10', work: 40, rest: 20, rounds: 10 },
    { id: 'circuit_6015', name: 'Circuito Largo', description: '60s trabajo / 15s transición × 8', work: 60, rest: 15, rounds: 8 },
    { id: 'boxing', name: 'Boxing', description: '3min asalto / 1min descanso × 6', work: 180, rest: 60, rounds: 6 },
    { id: 'mma', name: 'MMA', description: '5min asalto / 1min descanso × 3', work: 300, rest: 60, rounds: 3 },
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

    const [workSec, setWorkSec] = useState(20);
    const [restSec, setRestSec] = useState(10);
    const [rounds, setRounds] = useState(8);

    const [phase, setPhase] = useState<TimerPhase>('idle');
    const [currentRound, setCurrentRound] = useState(1);
    const [timeLeft, setTimeLeft] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [elapsedTotal, setElapsedTotal] = useState(0);

    const endAtMsRef = useRef<number | null>(null);
    const pausedTimeLeftRef = useRef<number>(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const progressAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const transitionPendingRef = useRef(false);

    const totalWorkoutTime = useMemo(() => (workSec + restSec) * rounds, [workSec, restSec, rounds]);

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

    const animateProgress = useCallback((duration: number, resume: boolean = false) => {
        if (!resume) {
            progressAnim.setValue(0);
        }
        Animated.timing(progressAnim, { toValue: 1, duration: duration * 1000, easing: Easing.linear, useNativeDriver: true }).start();
    }, [progressAnim]);

    const strokeDashoffset = progressAnim.interpolate({ inputRange: [0, 1], outputRange: [0, RING_CIRCUMFERENCE] });

    const triggerPulse = useCallback(() => {
        pulseAnim.setValue(1.15);
        Animated.spring(pulseAnim, { toValue: 1, friction: 4, tension: 100, useNativeDriver: true }).start();
    }, [pulseAnim]);

    const startPhaseTimer = useCallback((durationSec: number) => {
        endAtMsRef.current = Date.now() + durationSec * 1000;
        pausedTimeLeftRef.current = 0;
        setTimeLeft(durationSec);
        animateProgress(durationSec, false);
    }, [animateProgress]);

    const transitionToNextPhase = useCallback((currentPhase: TimerPhase, currentRound: number) => {
        if (transitionPendingRef.current) return;
        transitionPendingRef.current = true;
        if (currentPhase === 'prepare') {
            setPhase('work'); startPhaseTimer(workSec); feedbackService.phaseChange('work');
            systemNotificationService.showIntervalTimerNotification({ phase: 'work', currentRound, totalRounds: rounds, timeLeft: workSec, isPaused: false });
        } else if (currentPhase === 'work') {
            if (currentRound >= rounds) {
                setPhase('finished'); setTimeLeft(0); endAtMsRef.current = null; feedbackService.workoutFinished();
                systemNotificationService.dismissIntervalTimerNotification();
            } else if (restSec > 0) {
                setPhase('rest'); startPhaseTimer(restSec); feedbackService.phaseChange('rest');
                systemNotificationService.showIntervalTimerNotification({ phase: 'rest', currentRound, totalRounds: rounds, timeLeft: restSec, isPaused: false });
            } else {
                setCurrentRound(prev => prev + 1); startPhaseTimer(workSec); feedbackService.phaseChange('work');
                systemNotificationService.showIntervalTimerNotification({ phase: 'work', currentRound: currentRound + 1, totalRounds: rounds, timeLeft: workSec, isPaused: false });
            }
        } else if (currentPhase === 'rest') {
            if (currentRound >= rounds) {
                setPhase('finished'); setTimeLeft(0); endAtMsRef.current = null; feedbackService.workoutFinished();
                systemNotificationService.dismissIntervalTimerNotification();
            } else {
                setCurrentRound(prev => prev + 1); setPhase('work'); startPhaseTimer(workSec); feedbackService.phaseChange('work');
                systemNotificationService.showIntervalTimerNotification({ phase: 'work', currentRound: currentRound + 1, totalRounds: rounds, timeLeft: workSec, isPaused: false });
            }
        }
        requestAnimationFrame(() => { transitionPendingRef.current = false; });
    }, [workSec, restSec, rounds, startPhaseTimer]);

    const lastSecPulseRef = useRef<number | null>(null);

    useEffect(() => {
        if (phase === 'idle' || phase === 'finished' || isPaused) {
            if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
            if (isPaused) { progressAnim.stopAnimation(); }
            return;
        }
        const tick = () => {
            if (!endAtMsRef.current) return;
            const remaining = Math.max(0, Math.ceil((endAtMsRef.current - Date.now()) / 1000));
            setTimeLeft(remaining);
            setElapsedTotal(prev => prev + 1);
            if (remaining <= 3 && remaining > 0) {
                if (lastSecPulseRef.current !== remaining) { lastSecPulseRef.current = remaining; feedbackService.countdown(); triggerPulse(); }
            } else { lastSecPulseRef.current = null; }
            if (remaining <= 0) { endAtMsRef.current = null; }
        };
        tick();
        intervalRef.current = setInterval(tick, 1000);
        return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
    }, [phase, isPaused, triggerPulse, progressAnim]);

    useEffect(() => {
        if (timeLeft === 0 && phase !== 'idle' && phase !== 'finished' && !isPaused) {
            transitionToNextPhase(phase, currentRound);
        }
    }, [timeLeft, phase, currentRound, isPaused, transitionToNextPhase]);

    const handleStart = () => {
        setPhase('prepare'); setCurrentRound(1); setIsPaused(false); setElapsedTotal(0); transitionPendingRef.current = false;
        startPhaseTimer(PREPARE_DURATION); feedbackService.buttonPress();
        systemNotificationService.showIntervalTimerNotification({ phase: 'prepare', currentRound: 1, totalRounds: rounds, timeLeft: PREPARE_DURATION, isPaused: false });
    };

    const handlePause = () => {
        if (!isPaused) {
            if (endAtMsRef.current) { pausedTimeLeftRef.current = Math.max(0, Math.ceil((endAtMsRef.current - Date.now()) / 1000)); }
            endAtMsRef.current = null;
            progressAnim.stopAnimation((value) => {
                progressAnim.setValue(value);
            });
            setIsPaused(true);
            systemNotificationService.showIntervalTimerNotification({ phase, currentRound, totalRounds: rounds, timeLeft, isPaused: true });
        } else {
            const remaining = pausedTimeLeftRef.current > 0 ? pausedTimeLeftRef.current : timeLeft;
            if (remaining > 0) { endAtMsRef.current = Date.now() + remaining * 1000; animateProgress(remaining, true); }
            setIsPaused(false);
            systemNotificationService.showIntervalTimerNotification({ phase, currentRound, totalRounds: rounds, timeLeft: remaining, isPaused: false });
        }
        feedbackService.buttonPress();
    };

    const handleReset = useCallback(() => {
        setPhase('idle'); setIsPaused(false); setTimeLeft(0); setCurrentRound(1); setElapsedTotal(0);
        endAtMsRef.current = null; pausedTimeLeftRef.current = 0; transitionPendingRef.current = false; progressAnim.setValue(0);
        systemNotificationService.dismissIntervalTimerNotification();
    }, [progressAnim]);

    const handleClose = () => { handleReset(); onClose(); };
    const handleSkipPhase = () => { endAtMsRef.current = null; setTimeLeft(0); feedbackService.buttonPress(); };
    const applyPreset = (preset: TimerPreset) => { setWorkSec(preset.work); setRestSec(preset.rest); setRounds(preset.rounds); feedbackService.buttonPress(); };

    useEffect(() => { if (!visible) handleReset(); }, [visible, handleReset]);

    // ─── Stepper Component ────────────────────────────────────────────────────
    const Stepper = ({ value, onChange, min = 1, max = 999, step = 1, label, formatFn, accentColor }: {
        value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; label: string; formatFn?: (v: number) => string; accentColor?: string;
    }) => (
        <View style={ss.stepperCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <View style={[ss.stepperAccent, accentColor ? { backgroundColor: accentColor } : {}]} />
                <Text style={ss.stepperLabel}>{label}</Text>
            </View>
            <View style={ss.stepperRow}>
                <TouchableOpacity onPress={() => { onChange(Math.max(min, value - step)); feedbackService.buttonPress(); }} style={ss.stepperBtn} activeOpacity={0.8}>
                    <Minus size={16} color={Colors.iron[950]} />
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={ss.stepperValue}>{formatFn ? formatFn(value) : value}</Text>
                </View>
                <TouchableOpacity onPress={() => { onChange(Math.min(max, value + step)); feedbackService.buttonPress(); }} style={ss.stepperBtn} activeOpacity={0.8}>
                    <Plus size={16} color={Colors.iron[950]} />
                </TouchableOpacity>
            </View>
        </View>
    );

    const getPhaseConfig = () => {
        switch (phase) {
            case 'prepare': return { bg: '#92400e', label: 'PREPÁRATE', ringColor: '#fbbf24', accentBg: withAlpha(Colors.yellow, '26') };
            case 'work': return { bg: '#3e1c1c', label: '¡TRABAJO!', ringColor: '#d4a574', accentBg: withAlpha(Colors.primary.light, '1F') };
            case 'rest': return { bg: '#14532d', label: 'DESCANSO', ringColor: '#86efac', accentBg: withAlpha(Colors.green, '1F') };
            case 'finished': return { bg: '#3e1c1c', label: '¡COMPLETADO!', ringColor: '#d4a574', accentBg: withAlpha(Colors.primary.light, '1F') };
            default: return { bg: Colors.iron[900], label: '', ringColor: Colors.primary.DEFAULT, accentBg: 'transparent' };
        }
    };

    const phaseConfig = getPhaseConfig();

    // ═══════════════════════════════════════════════════════════════════════════
    // IDLE — Configuration Screen
    // ═══════════════════════════════════════════════════════════════════════════
    if (phase === 'idle') {
        return (
            <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView style={ss.container} edges={['top', 'bottom', 'left', 'right']}>
                    {/* Modern Header */}
                    <View style={ss.idleHeader}>
                        <TouchableOpacity onPress={handleClose} style={ss.backBtn} accessibilityRole="button" accessibilityLabel="Cerrar">
                            <ChevronDown size={20} color={Colors.iron[950]} />
                        </TouchableOpacity>
                        <View style={{ flex: 1 }}>
                            <Text style={ss.pageTitle}>Interval Timer</Text>
                            <Text style={ss.pageSub}>TOTAL: {formatDuration(totalWorkoutTime).toUpperCase()}</Text>
                        </View>
                    </View>

                    {/* Presets - Two Rows */}
                    <View style={ss.presetsSection}>
                        <Text style={ss.sectionLabel}>Presets rápidos</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'column', gap: 10, paddingRight: 20 }}>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                {PRESETS.slice(0, 5).map(preset => {
                                    const isActive = preset.work === workSec && preset.rest === restSec && preset.rounds === rounds;
                                    return (
                                        <Pressable key={preset.id} onPress={() => applyPreset(preset)} style={[ss.presetCard, isActive && ss.presetCardActive]}>
                                            <Text style={[ss.presetCardName, isActive && { color: Colors.white }]}>{preset.name}</Text>
                                            <Text style={[ss.presetCardDesc, isActive && { color: withAlpha(Colors.white, 'B3') }]}>{preset.description}</Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                {PRESETS.slice(5).map(preset => {
                                    const isActive = preset.work === workSec && preset.rest === restSec && preset.rounds === rounds;
                                    return (
                                        <Pressable key={preset.id} onPress={() => applyPreset(preset)} style={[ss.presetCard, isActive && ss.presetCardActive]}>
                                            <Text style={[ss.presetCardName, isActive && { color: Colors.white }]}>{preset.name}</Text>
                                            <Text style={[ss.presetCardDesc, isActive && { color: withAlpha(Colors.white, 'B3') }]}>{preset.description}</Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    </View>

                    {/* Steppers & Summary - Grid Layout */}
                    <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}>
                        <View style={ss.steppersTopRow}>
                            <Stepper value={workSec} onChange={setWorkSec} min={5} max={600} step={5} label="Trabajo" formatFn={formatTime} accentColor={Colors.red} />
                            <Stepper value={restSec} onChange={setRestSec} min={0} max={300} step={5} label="Descanso" formatFn={formatTime} accentColor={Colors.green} />
                        </View>

                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <View style={{ flex: 1.1 }}>
                                <Stepper value={rounds} onChange={setRounds} min={1} max={50} step={1} label="Rondas" accentColor={Colors.yellow} />
                            </View>

                            <View style={[ss.summaryCard, { flex: 0.9, marginBottom: 12 }]}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <Text style={[ss.sectionLabel, { marginBottom: 0 }]}>Estimado</Text>
                                    <Zap size={14} color={Colors.primary.DEFAULT} />
                                </View>

                                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                                    <Text style={{ fontSize: 24, fontWeight: '900', color: Colors.iron[950] }}>
                                        {formatDuration(totalWorkoutTime).split(' ')[0]}
                                    </Text>
                                    <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.iron[500] }}>
                                        {formatDuration(totalWorkoutTime).split(' ')[1] || 'min'}
                                    </Text>
                                </View>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.iron[400], marginTop: 2 }}>
                                    Duración total
                                </Text>
                            </View>
                        </View>

                        {/* Summary Detail */}
                        <View style={ss.detailBox}>
                            <View style={ss.detailRow}>
                                <Text style={ss.detailLabel}>Secuencia:</Text>
                                <Text style={ss.detailValue}>{formatTime(workSec)} WRK + {restSec > 0 ? `${formatTime(restSec)} RST` : 'SIN DESC.'}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Start Button */}
                    <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
                        <Pressable onPress={handleStart} style={ss.startBtn}>
                            <Text style={ss.startBtnText}>Iniciar entrenamiento</Text>
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
            <View style={[ss.activeContainer, { backgroundColor: phaseConfig.bg }]}>
                {/* Top Bar: phase + close */}
                <View style={[ss.activeTopBar, { top: insets.top }]}>
                    <View style={ss.activePhaseChip}>
                        <View style={[ss.activePhaseIndicator, { backgroundColor: phaseConfig.ringColor }]} />
                        <Text style={ss.activePhaseChipText}>
                            {phase === 'finished' ? 'FINALIZADO' : phase === 'prepare' ? 'PREPARACIÓN' : phase === 'work' ? 'TRABAJO' : 'DESCANSO'}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={handleClose} style={ss.activeCloseBtn} activeOpacity={0.8}>
                        <X color={Colors.white} size={18} />
                    </TouchableOpacity>
                </View>

                {/* Round indicator pills */}
                {phase !== 'finished' && (
                    <View style={[ss.pillsRow, { top: insets.top + 52 }]}>
                        {Array.from({ length: rounds }, (_, i) => (
                            <View key={i} style={[ss.pill, {
                                backgroundColor: i < currentRound - 1 ? withAlpha(Colors.white, 'D9') :
                                    i === currentRound - 1 ? phaseConfig.ringColor :
                                        withAlpha(Colors.white, '26'),
                            }]} />
                        ))}
                    </View>
                )}

                {/* Main Content */}
                <View style={{ alignItems: 'center' }}>
                    <Text style={ss.phaseLabel}>{phaseConfig.label}</Text>

                    {phase !== 'finished' ? (
                        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                            <View style={{ alignItems: 'center', justifyContent: 'center', width: RING_SIZE, height: RING_SIZE }}>
                                <Svg width={RING_SIZE} height={RING_SIZE} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
                                    <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} stroke={withAlpha(Colors.white, '14')} strokeWidth={RING_STROKE} fill="none" />
                                    <AnimatedCircle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} stroke={phaseConfig.ringColor} strokeWidth={RING_STROKE} fill="none" strokeLinecap="round" strokeDasharray={`${RING_CIRCUMFERENCE}`} strokeDashoffset={strokeDashoffset} />
                                </Svg>
                                <Text style={ss.timerBig}>{formatTime(timeLeft)}</Text>
                            </View>
                        </Animated.View>
                    ) : (
                        <View style={{ alignItems: 'center', marginVertical: 16 }}>
                            <Text style={[ss.timerBig, { fontSize: 56 }]}>¡LISTO!</Text>
                        </View>
                    )}

                    <Text style={ss.roundInfo}>
                        {phase === 'finished' ? `${rounds} rondas completadas` : phase === 'prepare' ? 'Comienza en...' : `Ronda ${currentRound} de ${rounds}`}
                    </Text>
                    {phase !== 'prepare' && (
                        <View style={ss.elapsedChip}>
                            <Zap size={12} color={withAlpha(Colors.white, '80')} />
                            <Text style={ss.elapsedInfo}>{formatDuration(elapsedTotal)}</Text>
                        </View>
                    )}
                </View>

                {/* Controls */}
                {phase !== 'finished' && phase !== 'prepare' && (
                    <View style={[ss.controlsRow, { bottom: insets.bottom + 32 }]}>
                        <View style={{ alignItems: 'center', gap: 6 }}>
                            <TouchableOpacity onPress={handleReset} style={ss.controlBtn} activeOpacity={0.8}>
                                <RotateCcw color={Colors.white} size={22} />
                            </TouchableOpacity>
                            <Text style={ss.controlLabel}>Reset</Text>
                        </View>
                        <TouchableOpacity onPress={handlePause} style={ss.pauseBtn} activeOpacity={0.9}>
                            {isPaused ? <Play color={Colors.black} size={28} fill={Colors.black} /> : <Pause color={Colors.black} size={28} fill={Colors.black} />}
                        </TouchableOpacity>
                        <View style={{ alignItems: 'center', gap: 6 }}>
                            <TouchableOpacity onPress={handleSkipPhase} style={ss.controlBtn} activeOpacity={0.8}>
                                <ChevronDown color={Colors.white} size={22} />
                            </TouchableOpacity>
                            <Text style={ss.controlLabel}>Saltar</Text>
                        </View>
                    </View>
                )}

                {/* Finished controls */}
                {phase === 'finished' && (
                    <View style={[ss.finishedControls, { bottom: insets.bottom + 24 }]}>
                        <View style={ss.finishedCard}>
                            <Text style={ss.finSectionLabel}>RESUMEN DE SESIÓN</Text>
                            <View style={ss.finishedRow}><Text style={ss.finishedLabel}>Rondas</Text><Text style={ss.finishedValue}>{rounds}</Text></View>
                            <View style={ss.finishedRow}><Text style={ss.finishedLabel}>Trabajo por ronda</Text><Text style={ss.finishedValue}>{formatTime(workSec)}</Text></View>
                            {restSec > 0 && <View style={ss.finishedRow}><Text style={ss.finishedLabel}>Descanso por ronda</Text><Text style={ss.finishedValue}>{formatTime(restSec)}</Text></View>}
                            <View style={ss.finishedTotalRow}>
                                <Text style={ss.finishedTotalLabel}>Tiempo total</Text>
                                <Text style={ss.finishedTotalValue}>{formatDuration(elapsedTotal)}</Text>
                            </View>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <Pressable onPress={handleReset} style={ss.repeatBtn}>
                                <RotateCcw color={Colors.white} size={16} />
                                <Text style={ss.repeatBtnText}>Repetir</Text>
                            </Pressable>
                            <Pressable onPress={handleClose} style={ss.doneBtn}>
                                <Text style={ss.doneBtnText}>Cerrar</Text>
                            </Pressable>
                        </View>
                    </View>
                )}
            </View>
        </Modal>
    );
}

const ss = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.iron[900] },
    idleHeader: { marginBottom: 12, paddingHorizontal: 20, paddingTop: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
    backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.iron[300], elevation: 2, shadowColor: ThemeFx.shadowColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
    pageTitle: { color: Colors.iron[950], fontWeight: '900', fontSize: 24, letterSpacing: -1 },
    pageSub: { color: Colors.primary.DEFAULT, fontSize: 12, fontWeight: '800', marginTop: 2, letterSpacing: 0.5 },
    closeBtn: { padding: 8 },
    sectionLabel: { color: Colors.iron[400], fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 1 },
    presetsSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
    presetCard: { width: 140, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.iron[700], padding: 14, justifyContent: 'center' },
    presetCardActive: { backgroundColor: Colors.primary.DEFAULT, borderColor: Colors.primary.DEFAULT },
    presetCardName: { fontWeight: '900', fontSize: 14, color: Colors.iron[950], marginBottom: 4 },
    presetCardDesc: { fontSize: 11, color: Colors.iron[400], fontWeight: '600', lineHeight: 15 },
    steppersTopRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    stepperCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.iron[700], padding: 16, marginBottom: 12 },
    stepperAccent: { width: 4, height: 14, borderRadius: 2, backgroundColor: Colors.primary.DEFAULT },
    stepperLabel: { color: Colors.iron[500], fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    stepperBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.iron[800], borderWidth: 1, borderColor: Colors.iron[700], alignItems: 'center', justifyContent: 'center' },
    stepperValue: { color: Colors.iron[950], fontSize: 26, fontWeight: '900', fontVariant: ['tabular-nums'] },
    summaryCard: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.iron[700], padding: 16 },
    detailBox: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.iron[700] },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    detailLabel: { color: Colors.iron[500], fontSize: 12, fontWeight: '700' },
    detailValue: { color: Colors.iron[950], fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },
    summaryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    dot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
    summaryLabel: { color: Colors.iron[950], fontWeight: '700', flex: 1 },
    summaryValue: { color: Colors.iron[950], fontWeight: '800' },
    summaryTotal: { borderTopWidth: 1, borderTopColor: Colors.iron[700], marginTop: 4, paddingTop: 8, flexDirection: 'row', alignItems: 'center' },
    startBtn: { backgroundColor: Colors.primary.DEFAULT, borderRadius: 16, paddingVertical: 16, alignItems: 'center', elevation: 2, shadowColor: Colors.primary.DEFAULT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    startBtnText: { color: Colors.white, fontWeight: '900', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 },
    // ─── Active Screen ───────────────────────────────────────────────────────
    activeContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    activeTopBar: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, zIndex: 10 },
    activePhaseChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: withAlpha(Colors.white, '1F'), borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, gap: 8, borderWidth: 1, borderColor: withAlpha(Colors.white, '1A') },
    activePhaseIndicator: { width: 8, height: 8, borderRadius: 4 },
    activePhaseChipText: { color: withAlpha(Colors.white, 'D9'), fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
    activeCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: withAlpha(Colors.white, '1F'), alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: withAlpha(Colors.white, '1A') },
    pillsRow: { position: 'absolute', flexDirection: 'row', gap: 4, paddingHorizontal: 20, left: 0, right: 0 },
    pill: { height: 4, borderRadius: 2, flex: 1 },
    phaseLabel: { color: withAlpha(Colors.white, '99'), fontWeight: '900', fontSize: 14, marginBottom: 20, textTransform: 'uppercase', letterSpacing: 6 },
    timerBig: { color: Colors.white, fontWeight: '900', fontSize: 72, fontVariant: ['tabular-nums'], textShadowColor: withAlpha(Colors.black, '26'), textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
    roundInfo: { color: withAlpha(Colors.white, '73'), fontSize: 15, fontWeight: '700', marginTop: 16 },
    elapsedChip: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, backgroundColor: withAlpha(Colors.white, '14'), paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
    elapsedInfo: { color: withAlpha(Colors.white, '66'), fontSize: 12, fontWeight: '700' },
    controlsRow: { position: 'absolute', flexDirection: 'row', gap: 28, alignItems: 'flex-start' },
    controlBtn: { width: 54, height: 54, backgroundColor: withAlpha(Colors.white, '1A'), borderRadius: 27, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: withAlpha(Colors.white, '1F') },
    controlLabel: { color: withAlpha(Colors.white, '59'), fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    pauseBtn: { width: 72, height: 72, backgroundColor: Colors.white, borderRadius: 36, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: ThemeFx.shadowColor, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 },
    // ─── Finished Screen ─────────────────────────────────────────────────────
    finishedControls: { position: 'absolute', width: '100%', paddingHorizontal: 20 },
    finishedCard: { backgroundColor: withAlpha(Colors.white, '14'), borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: withAlpha(Colors.white, '14') },
    finSectionLabel: { color: withAlpha(Colors.white, '59'), fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 14 },
    finishedRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    finishedLabel: { color: withAlpha(Colors.white, '80'), fontWeight: '600', fontSize: 14 },
    finishedValue: { color: Colors.white, fontWeight: '800', fontSize: 14 },
    finishedTotalRow: { borderTopWidth: 1, borderTopColor: withAlpha(Colors.white, '1A'), marginTop: 6, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between' },
    finishedTotalLabel: { color: withAlpha(Colors.white, 'B3'), fontWeight: '800', fontSize: 14 },
    finishedTotalValue: { color: Colors.white, fontWeight: '900', fontSize: 16 },
    repeatBtn: { flex: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: withAlpha(Colors.white, '4D'), borderRadius: 16, paddingVertical: 15, backgroundColor: withAlpha(Colors.white, '0F') },
    repeatBtnText: { color: Colors.white, fontWeight: '800', fontSize: 15 },
    doneBtn: { flex: 1, backgroundColor: Colors.white, borderRadius: 16, paddingVertical: 15, alignItems: 'center', elevation: 4, shadowColor: ThemeFx.shadowColor, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 8 },
    doneBtnText: { color: Colors.black, fontWeight: '900', fontSize: 15 },
});
