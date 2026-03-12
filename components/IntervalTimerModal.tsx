import { ThemeFx, withAlpha } from '@/src/theme';
import { ChevronDown, Minus, Pause, Play, Plus, RotateCcw, X, Zap } from 'lucide-react-native';

import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useColors } from '../src/hooks/useColors';
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
const KEEP_AWAKE_TAG = 'irontrain-interval-timer';

// ─── Component ───────────────────────────────────────────────────────────────
export function IntervalTimerModal({ visible, onClose }: IntervalTimerModalProps) {
    const colors = useColors();
    const insets = useSafeAreaInsets();


    const ss = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.surface },
        idleHeader: {
            flexDirection: 'row', alignItems: 'center', gap: 16,
            paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20,
            backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border
        },
        backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceLighter, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.border },
        pageTitle: { fontSize: 24, fontWeight: '900', color: colors.text, letterSpacing: -0.5 },
        pageSub: { fontSize: 11, fontWeight: '800', color: colors.primary.DEFAULT, marginTop: 2, letterSpacing: 0.8, textTransform: 'uppercase' },

        scrollContent: { padding: 20, paddingBottom: 100 },
        sectionLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },

        presetsSection: { paddingVertical: 20 },
        presetCard: {
            width: 140, backgroundColor: colors.surface, borderRadius: 16,
            borderWidth: 1.5, borderColor: colors.border, padding: 14, justifyContent: 'center',
            marginRight: 10, ...ThemeFx.shadowSm,
        },
        presetCardActive: { backgroundColor: colors.primary.DEFAULT, borderColor: colors.primary.DEFAULT, ...ThemeFx.shadowMd },
        presetCardName: { fontWeight: '900', fontSize: 14, color: colors.text, marginBottom: 4 },
        presetCardDesc: { fontSize: 11, color: colors.textMuted, fontWeight: '600', lineHeight: 15 },

        steppersTopRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
        stepperCard: {
            flex: 1, backgroundColor: colors.surface, borderRadius: 18,
            borderWidth: 1.5, borderColor: colors.border, padding: 16, marginBottom: 12,
            ...ThemeFx.shadowSm,
        },
        stepperAccent: { width: 4, height: 14, borderRadius: 2, backgroundColor: colors.primary.DEFAULT },
        stepperLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
        stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        stepperBtn: {
            width: 40, height: 40, borderRadius: 12,
            backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
            alignItems: 'center', justifyContent: 'center'
        },
        stepperValue: { color: colors.text, fontSize: 26, fontWeight: '900', fontVariant: ['tabular-nums'] },

        summaryCard: {
            backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1.5, borderColor: colors.border,
            padding: 16, ...ThemeFx.shadowSm,
        },
        detailBox: {
            backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: colors.border
        },
        detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        detailLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
        detailValue: { color: colors.text, fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },

        summaryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
        dot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
        summaryLabel: { color: colors.text, fontWeight: '700', flex: 1 },
        summaryValue: { color: colors.text, fontWeight: '800' },
        summaryTotal: { borderTopWidth: 1.5, borderTopColor: colors.border, marginTop: 4, paddingTop: 8, flexDirection: 'row', alignItems: 'center' },

        startBtn: {
            backgroundColor: colors.primary.DEFAULT, borderRadius: 16, paddingVertical: 18, alignItems: 'center',
            ...ThemeFx.shadowMd,
        },
        startBtnText: { color: colors.onPrimary, fontWeight: '900', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 },

        activeContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
        activeTopBar: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, zIndex: 10 },
        activePhaseChip: {
            flexDirection: 'row', alignItems: 'center', backgroundColor: withAlpha(colors.surface, '33'),
            borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, gap: 8, borderWidth: 1.5, borderColor: withAlpha(colors.border, '33')
        },
        activePhaseIndicator: { width: 8, height: 8, borderRadius: 4 },
        activePhaseChipText: { color: colors.text, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
        activeCloseBtn: {
            width: 40, height: 40, borderRadius: 20, backgroundColor: withAlpha(colors.surface, '33'),
            alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: withAlpha(colors.border, '33')
        },
        pillsRow: { position: 'absolute', flexDirection: 'row', gap: 4, paddingHorizontal: 20, left: 0, right: 0 },
        pill: { height: 4, borderRadius: 2, flex: 1 },

        timerBig: {
            fontSize: 110, fontWeight: '900', color: colors.text,
            letterSpacing: -4, includeFontPadding: false, textAlignVertical: 'center',
        },
        phaseLabel: {
            fontSize: 28, fontWeight: '800', color: colors.text,
            marginTop: -10, letterSpacing: -0.5,
        },
        roundInfo: { color: colors.textMuted, fontSize: 14, fontWeight: '700', marginTop: 12 },
        elapsedChip: {
            flexDirection: 'row', alignItems: 'center', gap: 6,
            backgroundColor: withAlpha(colors.surface, '33'), paddingHorizontal: 12, paddingVertical: 6,
            borderRadius: 20, marginTop: 16
        },
        elapsedInfo: { color: colors.text, fontSize: 12, fontWeight: '800' },

        controlsRow: { position: 'absolute', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 32, left: 0, right: 0 },
        controlBtn: {
            width: 56, height: 56, borderRadius: 28, backgroundColor: withAlpha(colors.surface, '33'),
            alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: withAlpha(colors.border, '33')
        },
        controlLabel: {
            color: colors.textMuted, fontSize: 10, fontWeight: '900',
            marginTop: 8, letterSpacing: 1, textTransform: 'uppercase',
        },
        pauseBtn: {
            width: 84, height: 84, backgroundColor: colors.surface, borderRadius: 42,
            justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.border,
            ...ThemeFx.shadowLg,
        },

        finishedControls: { position: 'absolute', width: '100%', paddingHorizontal: 24 },
        finishedCard: {
            backgroundColor: withAlpha(colors.surface, 'CC'), borderRadius: 24, padding: 24,
            borderWidth: 1.5, borderColor: colors.border, marginBottom: 24,
            ...ThemeFx.shadowLg
        },
        finSectionLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 16 },
        finishedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
        finishedLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
        finishedValue: { color: colors.text, fontSize: 14, fontWeight: '900' },
        finishedTotalRow: {
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            marginTop: 4, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border
        },
        finishedTotalLabel: { color: colors.text, fontSize: 16, fontWeight: '900' },
        finishedTotalValue: { color: colors.primary.DEFAULT, fontSize: 20, fontWeight: '900' },

        repeatBtn: {
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 10, paddingVertical: 18, borderRadius: 20,
            borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface,
        },
        repeatBtnText: {
            color: colors.text, fontWeight: '900', letterSpacing: 1,
            fontSize: 14, textTransform: 'uppercase',
        },
        doneBtn: {
            flex: 1, backgroundColor: colors.primary.DEFAULT, flexDirection: 'row',
            alignItems: 'center', justifyContent: 'center', gap: 10,
            paddingVertical: 18, borderRadius: 20, ...ThemeFx.shadowSm,
        },
        doneBtnText: {
            color: colors.onPrimary, fontWeight: '900', letterSpacing: 1,
            fontSize: 14, textTransform: 'uppercase',
        },

        flex1: { flex: 1 },
        rowGap10: { flexDirection: 'row', gap: 10 },
        alignCenter: { alignItems: 'center' },
        justifyCenter: { justifyContent: 'center' },
        mt16: { marginTop: 16 },
        mb12: { marginBottom: 12 },
    }), [colors]);

    const [workSec, setWorkSec] = useState(20);
    const [restSec, setRestSec] = useState(10);
    const [rounds, setRounds] = useState(8);

    const [phase, setPhase] = useState<TimerPhase>('idle');
    const [currentRound, setCurrentRound] = useState(1);
    const [timeLeft, setTimeLeft] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [elapsedTotal, setElapsedTotal] = useState(0);

    useEffect(() => {
        if (visible && phase !== 'idle' && phase !== 'finished' && !isPaused) {
            activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => { });
        } else {
            deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => { });
        }
    }, [visible, phase, isPaused]);

    useEffect(() => {
        return () => {
            deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => { });
        };
    }, []);


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
        Animated.timing(progressAnim, { toValue: 1, duration: duration * 1000, easing: Easing.linear, useNativeDriver: false }).start();
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
            <View style={[ss.rowGap10, ss.alignCenter, { marginBottom: 12, paddingHorizontal: 2 }]}>
                <View style={[ss.stepperAccent, accentColor ? { backgroundColor: accentColor } : {}]} />
                <Text style={ss.stepperLabel}>{label}</Text>
            </View>
            <View style={ss.stepperRow}>
                <TouchableOpacity onPress={() => { onChange(Math.max(min, value - step)); feedbackService.buttonPress(); }} style={ss.stepperBtn} activeOpacity={0.8}>
                    <Minus size={16} color={colors.text} />
                </TouchableOpacity>
                <View style={ss.flex1}>
                    <Text style={[ss.stepperValue, { textAlign: 'center' }]}>{formatFn ? formatFn(value) : value}</Text>
                </View>
                <TouchableOpacity onPress={() => { onChange(Math.min(max, value + step)); feedbackService.buttonPress(); }} style={ss.stepperBtn} activeOpacity={0.8}>
                    <Plus size={16} color={colors.text} />
                </TouchableOpacity>
            </View>
        </View>
    );

    const getPhaseConfig = () => {
        const isDark = colors.isDark;
        switch (phase) {
            case 'prepare':
                return {
                    bg: isDark ? colors.iron[100] : colors.yellow,
                    label: 'PREPÁRATE',
                    ringColor: isDark ? colors.yellow : colors.white,
                    accentBg: withAlpha(colors.yellow, '26'),
                    textColor: isDark ? colors.text : colors.white,
                };
            case 'work':
                return {
                    bg: isDark ? colors.iron[100] : colors.primary.DEFAULT,
                    label: '¡TRABAJO!',
                    ringColor: colors.primary.DEFAULT,
                    accentBg: withAlpha(colors.primary.DEFAULT, '26'),
                    textColor: isDark ? colors.primary.DEFAULT : colors.onPrimary,
                };
            case 'rest':
                return {
                    bg: isDark ? colors.iron[100] : colors.green,
                    label: 'DESCANSO',
                    ringColor: colors.green,
                    accentBg: withAlpha(colors.green, '26'),
                    textColor: isDark ? colors.green : colors.white,
                };
            case 'finished':
                return {
                    bg: isDark ? colors.iron[100] : colors.primary.dark,
                    label: '¡COMPLETADO!',
                    ringColor: colors.primary.DEFAULT,
                    accentBg: withAlpha(colors.primary.DEFAULT, '26'),
                    textColor: isDark ? colors.text : colors.onPrimary,
                };
            default:
                return {
                    bg: colors.background,
                    label: '',
                    ringColor: colors.primary.DEFAULT,
                    accentBg: 'transparent',
                    textColor: colors.text,
                };
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
                            <ChevronDown size={20} color={colors.text} />
                        </TouchableOpacity>
                        <View style={ss.flex1}>
                            <Text style={ss.pageTitle}>Interval Timer</Text>
                            <Text style={ss.pageSub}>TOTAL: {formatDuration(totalWorkoutTime)}</Text>
                        </View>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                        {/* Presets - Two Rows */}
                        <View style={ss.presetsSection}>
                            <Text style={ss.sectionLabel}>Presets rápidos</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'column', gap: 12, paddingHorizontal: 20 }}>
                                <View style={ss.rowGap10}>
                                    {PRESETS.slice(0, 5).map(preset => {
                                        const isActive = preset.work === workSec && preset.rest === restSec && preset.rounds === rounds;
                                        return (
                                            <Pressable key={preset.id} onPress={() => applyPreset(preset)} style={[ss.presetCard, isActive && ss.presetCardActive]}>
                                                <Text style={[ss.presetCardName, isActive && { color: colors.onPrimary }]}>{preset.name}</Text>
                                                <Text style={[ss.presetCardDesc, isActive && { color: withAlpha(colors.onPrimary, 'B3') }]}>{preset.description}</Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                                <View style={ss.rowGap10}>
                                    {PRESETS.slice(5).map(preset => {
                                        const isActive = preset.work === workSec && preset.rest === restSec && preset.rounds === rounds;
                                        return (
                                            <Pressable key={preset.id} onPress={() => applyPreset(preset)} style={[ss.presetCard, isActive && ss.presetCardActive]}>
                                                <Text style={[ss.presetCardName, isActive && { color: colors.onPrimary }]}>{preset.name}</Text>
                                                <Text style={[ss.presetCardDesc, isActive && { color: withAlpha(colors.onPrimary, 'B3') }]}>{preset.description}</Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </ScrollView>
                        </View>

                        {/* Steppers & Summary - Grid Layout */}
                        <View style={{ paddingHorizontal: 20 }}>
                            <View style={ss.steppersTopRow}>
                                <Stepper value={workSec} onChange={setWorkSec} min={5} max={600} step={5} label="Trabajo" formatFn={formatTime} accentColor={colors.primary.light} />
                                <Stepper value={restSec} onChange={setRestSec} min={0} max={300} step={5} label="Descanso" formatFn={formatTime} accentColor={colors.green} />
                            </View>

                            <View style={ss.rowGap10}>
                                <View style={{ flex: 1.1 }}>
                                    <Stepper value={rounds} onChange={setRounds} min={1} max={50} step={1} label="Rondas" accentColor={colors.yellow} />
                                </View>

                                <View style={[ss.summaryCard, { flex: 0.9, marginBottom: 12 }]}>
                                    <View style={[ss.rowGap10, ss.alignCenter, { justifyContent: 'space-between', marginBottom: 10 }]}>
                                        <Text style={[ss.sectionLabel, { marginBottom: 0, marginLeft: 0 }]}>Estimado</Text>
                                        <Zap size={14} color={colors.primary.DEFAULT} />
                                    </View>

                                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                                        <Text style={{ fontSize: 26, fontWeight: '900', color: colors.text }}>
                                            {formatDuration(totalWorkoutTime).split(' ')[0]}
                                        </Text>
                                        <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textMuted }}>
                                            {formatDuration(totalWorkoutTime).split(' ')[1] || 'min'}
                                        </Text>
                                    </View>
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, marginTop: 2 }}>
                                        Duración total
                                    </Text>
                                </View>
                            </View>

                            {/* Summary Detail */}
                            <View style={ss.detailBox}>
                                <View style={ss.detailRow}>
                                    <Text style={ss.detailLabel}>Secuencia:</Text>
                                    <Text style={ss.detailValue}>{formatTime(workSec)} Trabajo + {restSec > 0 ? `${formatTime(restSec)} Rest` : 'Sin Desc.'}</Text>
                                </View>
                            </View>
                        </View>
                    </ScrollView>

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
                    <View style={[ss.activePhaseChip, { backgroundColor: withAlpha(phaseConfig.textColor, '12') }]}>
                        <View style={[ss.activePhaseIndicator, { backgroundColor: phaseConfig.ringColor }]} />
                        <Text style={[ss.activePhaseChipText, { color: phaseConfig.textColor }]}>
                            {phase === 'finished' ? 'FINALIZADO' : phase === 'prepare' ? 'PREPARACIÓN' : phase === 'work' ? 'TRABAJO' : 'DESCANSO'}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={handleClose} style={[ss.activeCloseBtn, { backgroundColor: withAlpha(phaseConfig.textColor, '12') }]} activeOpacity={0.8}>
                        <X color={phaseConfig.textColor} size={18} />
                    </TouchableOpacity>
                </View>

                {/* Round indicator pills */}
                {phase !== 'finished' && (
                    <View style={[ss.pillsRow, { top: insets.top + 56 }]}>
                        {Array.from({ length: rounds }, (_, i) => (
                            <View key={i} style={[ss.pill, {
                                backgroundColor: i < currentRound - 1 ? withAlpha(colors.white, 'D9') :
                                    i === currentRound - 1 ? phaseConfig.ringColor :
                                        withAlpha(colors.white, '26'),
                            }]} />
                        ))}
                    </View>
                )}

                {/* Main Content */}
                <View style={{ alignItems: 'center' }}>
                    <Text style={[ss.phaseLabel, { color: phaseConfig.textColor }]}>{phaseConfig.label}</Text>

                    {phase !== 'finished' ? (
                        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                            <View style={{ alignItems: 'center', justifyContent: 'center', width: RING_SIZE, height: RING_SIZE }}>
                                <Svg width={RING_SIZE} height={RING_SIZE} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
                                    <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} stroke={withAlpha(phaseConfig.textColor, '14')} strokeWidth={RING_STROKE} fill="none" />
                                    <AnimatedCircle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} stroke={phaseConfig.ringColor} strokeWidth={RING_STROKE} fill="none" strokeLinecap="round" strokeDasharray={`${RING_CIRCUMFERENCE}`} strokeDashoffset={strokeDashoffset} />
                                </Svg>
                                <Text style={[ss.timerBig, { color: phaseConfig.textColor }]}>{formatTime(timeLeft)}</Text>
                            </View>
                        </Animated.View>
                    ) : (
                        <View style={{ alignItems: 'center', marginVertical: 16 }}>
                            <Text style={[ss.timerBig, { fontSize: 56, color: phaseConfig.textColor }]}>¡LISTO!</Text>
                        </View>
                    )}

                    <Text style={[ss.roundInfo, { color: withAlpha(phaseConfig.textColor, '80') }]}>
                        {phase === 'finished' ? `${rounds} rondas completadas` : phase === 'prepare' ? 'Comienza en...' : `Ronda ${currentRound} de ${rounds}`}
                    </Text>
                    {phase !== 'prepare' && (
                        <View style={[ss.elapsedChip, { backgroundColor: withAlpha(phaseConfig.textColor, '10') }]}>
                            <RotateCcw size={12} color={withAlpha(phaseConfig.textColor, '80')} />
                            <Text style={[ss.elapsedInfo, { color: withAlpha(phaseConfig.textColor, '80') }]}>{formatDuration(elapsedTotal)}</Text>
                        </View>
                    )}
                </View>

                {/* Controls */}
                {phase !== 'finished' && phase !== 'prepare' && (
                    <View style={[ss.controlsRow, { bottom: insets.bottom + 48 }]}>
                        <View style={ss.alignCenter}>
                            <TouchableOpacity onPress={handleReset} style={[ss.controlBtn, { backgroundColor: withAlpha(phaseConfig.textColor, '10') }]} activeOpacity={0.8}>
                                <RotateCcw color={phaseConfig.textColor} size={22} />
                            </TouchableOpacity>
                            <Text style={[ss.controlLabel, { color: withAlpha(phaseConfig.textColor, '80') }]}>Reset</Text>
                        </View>
                        <TouchableOpacity onPress={handlePause} style={[ss.pauseBtn, { backgroundColor: phaseConfig.textColor }]} activeOpacity={0.9}>
                            {isPaused ? <Play color={phaseConfig.bg} size={32} fill={phaseConfig.bg} /> : <Pause color={phaseConfig.bg} size={32} fill={phaseConfig.bg} />}
                        </TouchableOpacity>
                        <View style={ss.alignCenter}>
                            <TouchableOpacity onPress={handleSkipPhase} style={[ss.controlBtn, { backgroundColor: withAlpha(phaseConfig.textColor, '10') }]} activeOpacity={0.8}>
                                <ChevronDown color={phaseConfig.textColor} size={22} style={{ transform: [{ rotate: '-90deg' }] }} />
                            </TouchableOpacity>
                            <Text style={[ss.controlLabel, { color: withAlpha(phaseConfig.textColor, '80') }]}>Saltar</Text>
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
                                <RotateCcw color={colors.text} size={16} />
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

