import { useColors } from '@/src/hooks/useColors';
import { useTimerStore } from '@/src/store/timerStore';
import { withAlpha } from '@/src/theme';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { Pause, Play, RotateCcw, X } from 'lucide-react-native';
import React, { useContext, useEffect, useMemo } from 'react';
import { AppState, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function TimerOverlay() {
    const colors = useColors();
    const { timeLeft, isRunning, duration, stopTimer, pauseTimer, resumeTimer, restartTimer, addTime, tick } = useTimerStore();
    const insets = useSafeAreaInsets();
    const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;

    // Default starting position (higher up as requested)
    const initialBottom = (tabBarHeight ? tabBarHeight : insets.bottom) + 80;

    // Draggability state
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const context = useSharedValue({ x: 0, y: 0 });

    const gesture = Gesture.Pan()
        .onStart(() => {
            context.value = { x: translateX.value, y: translateY.value };
        })
        .onUpdate((event) => {
            translateX.value = event.translationX + context.value.x;
            translateY.value = event.translationY + context.value.y;
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
        ],
    }));

    const ss = useMemo(() => StyleSheet.create({
        container: {
            position: 'absolute',
            backgroundColor: colors.surface,
            borderWidth: 2,
            borderColor: colors.primary.DEFAULT, // More prominent border
            borderRadius: 20, // More rounded (was 16)
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16, // More padding (was 12)
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.35,
            shadowRadius: 16,
            elevation: 12,
            zIndex: 100
        },
        label: { color: colors.textMuted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
        time: { color: colors.text, fontWeight: '900', fontSize: 26, fontVariant: ['tabular-nums'] }, // Larger text (was 22)
        controls: { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 1.5, borderLeftColor: colors.border, paddingLeft: 16, gap: 10 },
        addBtn: { paddingHorizontal: 10, paddingVertical: 10, backgroundColor: withAlpha(colors.primary.DEFAULT, '10'), borderRadius: 12 },
        addBtnText: { color: colors.text, fontWeight: '800', fontSize: 13 },
        actionBtn: {
            width: 40,
            height: 40,
            backgroundColor: withAlpha(colors.primary.DEFAULT, '15'),
            borderRadius: 12,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: withAlpha(colors.primary.DEFAULT, '30')
        },
        actionBtnPrimary: {
            width: 40,
            height: 40,
            backgroundColor: colors.primary.DEFAULT,
            borderRadius: 12,
            justifyContent: 'center',
            alignItems: 'center'
        },
        stopBtn: {
            width: 40,
            height: 40,
            backgroundColor: withAlpha(colors.red, '15'),
            borderRadius: 12,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1.5,
            borderColor: withAlpha(colors.red, '40')
        },
    }), [colors]);

    useEffect(() => {
        let interval: any;
        if (isRunning) { tick(); interval = setInterval(tick, 1000); }
        return () => clearInterval(interval);
    }, [isRunning, tick]);

    useEffect(() => {
        const sub = AppState.addEventListener('change', (s) => { if (s === 'active') tick(); });
        return () => sub.remove();
    }, [tick]);

    if (!isRunning && timeLeft <= 0 && duration <= 0) return null;

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const addTimeBtn = (secs: number) => (
        <TouchableOpacity
            onPress={() => addTime(secs)}
            style={ss.addBtn}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Agregar ${secs} segundos`}
        >
            <Text style={ss.addBtnText}>+{secs}</Text>
        </TouchableOpacity>
    );

    return (
        <GestureDetector gesture={gesture}>
            <Animated.View style={[ss.container, { right: 16, bottom: initialBottom }, animatedStyle]}>
                <View style={{ paddingRight: 16 }}>
                    <Text style={ss.label}>Descanso</Text>
                    <Text style={ss.time}>{formatTime(Math.max(0, timeLeft))}</Text>
                </View>

                <View style={ss.controls}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                        {addTimeBtn(30)}
                        {addTimeBtn(60)}
                    </View>

                    {timeLeft <= 0 && duration > 0 ? (
                        <TouchableOpacity onPress={restartTimer} style={ss.actionBtnPrimary} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Reiniciar descanso">
                            <RotateCcw size={20} color={colors.onPrimary} />
                        </TouchableOpacity>
                    ) : isRunning ? (
                        <TouchableOpacity onPress={pauseTimer} style={ss.actionBtn} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Pausar descanso">
                            <Pause size={20} color={colors.primary.DEFAULT} fill={colors.primary.DEFAULT} />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity onPress={resumeTimer} style={ss.actionBtn} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Reanudar descanso">
                            <Play size={20} color={colors.primary.DEFAULT} fill={colors.primary.DEFAULT} />
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity onPress={stopTimer} style={ss.stopBtn} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Cancelar descanso">
                        <X size={20} color={colors.red} />
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </GestureDetector>
    );
}

