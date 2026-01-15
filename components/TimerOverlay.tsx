import { useTimerStore } from '@/src/store/timerStore';
import { Colors } from '@/src/theme';
import { Pause, Play, RotateCcw, X } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { AppState, Text, TouchableOpacity, View } from 'react-native';

export function TimerOverlay() {
    const { timeLeft, isRunning, duration, stopTimer, pauseTimer, resumeTimer, restartTimer, addTime, tick } = useTimerStore();

    useEffect(() => {
        let interval: any;
        if (isRunning) {
            tick();
            interval = setInterval(tick, 1000);
        }
        return () => clearInterval(interval);
    }, [isRunning, tick]);

    useEffect(() => {
        const sub = AppState.addEventListener('change', (s) => {
            if (s === 'active') tick();
        });
        return () => sub.remove();
    }, [tick]);

    if (!isRunning && timeLeft <= 0 && duration <= 0) return null;

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <View className="absolute bottom-24 right-4 bg-iron-950 border border-iron-600 rounded-2xl flex-row items-center p-3 shadow-xl z-50">
            <View className="pr-3">
                <Text className="text-iron-300 text-[10px] font-bold uppercase">Descanso</Text>
                <Text className="text-iron-100 font-black text-2xl">{formatTime(Math.max(0, timeLeft))}</Text>
            </View>

            <View className="flex-row items-center border-l border-iron-600 pl-3 gap-2">
                <TouchableOpacity
                    onPress={() => addTime(15)}
                    className="px-2 py-2 bg-iron-600 rounded-xl active:opacity-80"
                    accessibilityRole="button"
                    accessibilityLabel="Agregar 15 segundos"
                >
                    <Text className="text-iron-100 font-bold">+15</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => addTime(30)}
                    className="px-2 py-2 bg-iron-600 rounded-xl active:opacity-80"
                    accessibilityRole="button"
                    accessibilityLabel="Agregar 30 segundos"
                >
                    <Text className="text-iron-100 font-bold">+30</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => addTime(60)}
                    className="px-2 py-2 bg-iron-600 rounded-xl active:opacity-80"
                    accessibilityRole="button"
                    accessibilityLabel="Agregar 60 segundos"
                >
                    <Text className="text-iron-100 font-bold">+60</Text>
                </TouchableOpacity>

                {timeLeft <= 0 && duration > 0 ? (
                    <TouchableOpacity
                        onPress={restartTimer}
                        className="p-2 bg-primary rounded-xl active:opacity-80"
                        accessibilityRole="button"
                        accessibilityLabel="Reiniciar descanso"
                    >
                        <RotateCcw size={18} color={Colors.white} />
                    </TouchableOpacity>
                ) : isRunning ? (
                    <TouchableOpacity
                        onPress={pauseTimer}
                        className="p-2 bg-iron-600 rounded-xl active:opacity-80"
                        accessibilityRole="button"
                        accessibilityLabel="Pausar descanso"
                    >
                        <Pause size={18} color={Colors.white} />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        onPress={resumeTimer}
                        className="p-2 bg-iron-600 rounded-xl active:opacity-80"
                        accessibilityRole="button"
                        accessibilityLabel="Reanudar descanso"
                    >
                        <Play size={18} color={Colors.white} />
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    onPress={stopTimer}
                    className="p-2 bg-red-600 rounded-xl active:opacity-80"
                    accessibilityRole="button"
                    accessibilityLabel="Cancelar descanso"
                >
                    <X size={18} color={Colors.white} />
                </TouchableOpacity>
            </View>
        </View>
    );
}
