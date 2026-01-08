import { useTimerStore } from '@/src/store/timerStore';
import { Colors } from '@/src/theme';
import { Plus, X } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export function TimerOverlay() {
    const { timeLeft, isRunning, stopTimer, addTime, tick } = useTimerStore();

    useEffect(() => {
        let interval: any;
        if (isRunning) {
            interval = setInterval(tick, 1000);
        }
        return () => clearInterval(interval);
    }, [isRunning, tick]);

    if (!isRunning && timeLeft <= 0) return null;

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <View className="absolute bottom-24 right-4 bg-iron-800 border border-primary rounded-full flex-row items-center p-2 shadow-xl z-50">
            {/* Time Display */}
            <View className="px-3">
                <Text className="text-white font-bold text-xl font-mono">{formatTime(timeLeft)}</Text>
            </View>

            {/* Controls */}
            <View className="flex-row items-center border-l border-iron-600 pl-2 gap-2">
                <TouchableOpacity onPress={() => addTime(30)} className="p-1">
                    <Plus size={20} color={Colors.iron[400]} />
                </TouchableOpacity>
                <TouchableOpacity onPress={stopTimer} className="p-1 bg-iron-700 rounded-full">
                    <X size={16} color={Colors.white} />
                </TouchableOpacity>
            </View>
        </View>
    );
}
