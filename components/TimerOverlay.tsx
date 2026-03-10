import { useColors } from '@/src/hooks/useColors';
import { useTimerStore } from '@/src/store/timerStore';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { Pause, Play, RotateCcw, X } from 'lucide-react-native';
import React, { useContext, useEffect, useMemo } from 'react';
import { AppState, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function TimerOverlay() {
    const colors = useColors();
    const { timeLeft, isRunning, duration, stopTimer, pauseTimer, resumeTimer, restartTimer, addTime, tick } = useTimerStore();
    const insets = useSafeAreaInsets();
    const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
    const bottomOffset = (tabBarHeight ? tabBarHeight : insets.bottom) + 12;

    const ss = useMemo(() => StyleSheet.create({
        container: {
            position: 'absolute',
            backgroundColor: colors.surface,
            borderWidth: 1.5,
            borderColor: colors.border,
            borderRadius: 16,
            flexDirection: 'row',
            alignItems: 'center',
            padding: 12,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 10,
            zIndex: 50
        },
        label: { color: colors.textMuted, fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
        time: { color: colors.text, fontWeight: '900', fontSize: 22, fontVariant: ['tabular-nums'] },
        controls: { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 12, gap: 6 },
        addBtn: { paddingHorizontal: 8, paddingVertical: 8, backgroundColor: colors.surfaceLighter, borderRadius: 10 },
        addBtnText: { color: colors.text, fontWeight: '800', fontSize: 12 },
        actionBtn: { padding: 8, backgroundColor: colors.surfaceLighter, borderRadius: 10 },
        actionBtnPrimary: { padding: 8, backgroundColor: colors.primary.DEFAULT, borderRadius: 10 },
        stopBtn: { padding: 8, backgroundColor: colors.red, borderRadius: 10 },
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
        <View style={[ss.container, { right: 16, bottom: bottomOffset }]}>
            <View style={{ paddingRight: 12 }}>
                <Text style={ss.label}>Descanso</Text>
                <Text style={ss.time}>{formatTime(Math.max(0, timeLeft))}</Text>
            </View>

            <View style={ss.controls}>
                {addTimeBtn(15)}
                {addTimeBtn(30)}
                {addTimeBtn(60)}

                {timeLeft <= 0 && duration > 0 ? (
                    <TouchableOpacity onPress={restartTimer} style={ss.actionBtnPrimary} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Reiniciar descanso">
                        <RotateCcw size={16} color={colors.onPrimary} />
                    </TouchableOpacity>
                ) : isRunning ? (
                    <TouchableOpacity onPress={pauseTimer} style={ss.actionBtn} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Pausar descanso">
                        <Pause size={16} color={colors.white} />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity onPress={resumeTimer} style={ss.actionBtn} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Reanudar descanso">
                        <Play size={16} color={colors.white} />
                    </TouchableOpacity>
                )}

                <TouchableOpacity onPress={stopTimer} style={ss.stopBtn} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Cancelar descanso">
                    <X size={16} color={colors.white} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

