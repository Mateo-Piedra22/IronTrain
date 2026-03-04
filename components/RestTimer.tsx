import { Colors } from '@/src/theme';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useContext, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function RestTimer() {
    const [seconds, setSeconds] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const intervalRef = useRef<any | null>(null);
    const insets = useSafeAreaInsets();
    const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
    const bottomOffset = (tabBarHeight ? tabBarHeight : insets.bottom) + 12;

    useEffect(() => {
        if (isActive) {
            intervalRef.current = setInterval(() => { setSeconds(prev => prev + 1); }, 1000);
        } else if (!isActive && intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [isActive]);

    const toggleTimer = () => {
        if (isActive) { setIsActive(false); setSeconds(0); }
        else { setIsActive(true); }
    };

    const formatTime = (totalSeconds: number) => {
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    if (!isActive) {
        return (
            <Pressable onPress={toggleTimer} style={[ss.fabIdle, { left: 24, bottom: bottomOffset }]}>
                <Ionicons name="timer-outline" size={22} color={Colors.primary.dark} />
            </Pressable>
        );
    }

    return (
        <View style={[ss.fabActive, { left: 24, bottom: bottomOffset }]}>
            <Text style={ss.timerText}>{formatTime(seconds)}</Text>
            <Pressable onPress={() => { setIsActive(false); setSeconds(0); }} hitSlop={8}>
                <Ionicons name="stop" size={18} color={Colors.red} />
            </Pressable>
        </View>
    );
}

const ss = StyleSheet.create({
    fabIdle: { position: 'absolute', backgroundColor: Colors.surface, borderRadius: 28, width: 56, height: 56, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6, borderWidth: 1, borderColor: Colors.primary.DEFAULT + '30' },
    fabActive: { position: 'absolute', backgroundColor: Colors.surface, borderRadius: 28, paddingHorizontal: 20, height: 56, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6, borderWidth: 1, borderColor: Colors.primary.DEFAULT },
    timerText: { color: Colors.iron[950], fontSize: 18, fontWeight: '900', marginRight: 14, fontVariant: ['tabular-nums'] },
});
