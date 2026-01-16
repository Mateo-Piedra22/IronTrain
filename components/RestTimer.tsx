import { Colors } from '@/src/theme';
import { Ionicons } from '@expo/vector-icons';
import { useContext, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';

export function RestTimer() {
    const [seconds, setSeconds] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const intervalRef = useRef<any | null>(null);
    const insets = useSafeAreaInsets();
    const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
    const bottomOffset = (tabBarHeight ? tabBarHeight : insets.bottom) + 12;

    useEffect(() => {
        if (isActive) {
            intervalRef.current = setInterval(() => {
                setSeconds(prev => prev + 1);
            }, 1000);
        } else if (!isActive && intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isActive]);

    const toggleTimer = () => {
        if (isActive) {
            setIsActive(false);
            setSeconds(0);
        } else {
            setIsActive(true);
        }
    };

    const formatTime = (totalSeconds: number) => {
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    if (!isActive) {
        return (
            <Pressable
                onPress={toggleTimer}
                className="absolute bg-surface rounded-full w-14 h-14 items-center justify-center shadow-lg border border-primary/20"
                style={{ left: 24, bottom: bottomOffset }}
            >
                <Ionicons name="timer-outline" size={24} color={Colors.primary.dark} />
            </Pressable>
        );
    }

    return (
        <View
            className="absolute bg-surface rounded-full px-6 h-14 flex-row items-center shadow-lg border border-primary"
            style={{ left: 24, bottom: bottomOffset }}
        >
            <Text className="text-iron-950 font-mono text-lg font-bold mr-4">
                {formatTime(seconds)}
            </Text>
            <Pressable onPress={() => { setIsActive(false); setSeconds(0); }}>
                <Ionicons name="stop" size={20} color={Colors.red} />
            </Pressable>
        </View>
    );
}
