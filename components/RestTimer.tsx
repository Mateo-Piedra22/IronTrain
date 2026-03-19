import { withAlpha } from '@/src/theme';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../src/hooks/useColors';

export function RestTimer() {
    const colors = useColors();
    const [seconds, setSeconds] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const intervalRef = useRef<any | null>(null);
    const insets = useSafeAreaInsets();
    const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;

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
        })
        .onEnd(() => {
            // Optional: Add snap to edges if needed, but for now free dragging is requested
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
        ],
    }));

    const ss = useMemo(() => StyleSheet.create({
        fabIdle: {
            position: 'absolute',
            backgroundColor: colors.surface,
            borderRadius: 35,
            width: 70,
            height: 70,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.2,
            shadowRadius: 10,
            elevation: 8,
            borderWidth: 1.5,
            borderColor: withAlpha(colors.primary.DEFAULT, '40')
        },
        fabActive: {
            position: 'absolute',
            backgroundColor: colors.surface,
            borderRadius: 35,
            paddingHorizontal: 24,
            height: 70,
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.2,
            shadowRadius: 10,
            elevation: 8,
            borderWidth: 2,
            borderColor: colors.primary.DEFAULT
        },
        timerText: {
            color: colors.text,
            fontSize: 22,
            fontWeight: '900',
            marginRight: 16,
            fontVariant: ['tabular-nums']
        },
        pauseBtn: {
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: withAlpha(colors.red, '15'),
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1.5,
            borderColor: withAlpha(colors.red, '30')
        }
    }), [colors]);

    useEffect(() => {
        if (isActive) {
            intervalRef.current = setInterval(() => { setSeconds(prev => prev + 1); }, 1000);
        } else if (!isActive && intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [isActive]);

    const toggleTimer = () => {
        if (isActive) {
            setIsActive(false);
            setSeconds(0);
            // Reset position on close? Maybe not, usually users like it where they left it
            // but if it's annoying, we can reset.
        }
        else { setIsActive(true); }
    };

    const formatTime = (totalSeconds: number) => {
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    if (!isActive) {
        return (
            <GestureDetector gesture={gesture}>
                <Animated.View style={[ss.fabIdle, { left: 24, bottom: initialBottom }, animatedStyle]}>
                    <Pressable onPress={toggleTimer} style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="timer-outline" size={28} color={colors.primary.dark} />
                    </Pressable>
                </Animated.View>
            </GestureDetector>
        );
    }

    return (
        <GestureDetector gesture={gesture}>
            <Animated.View style={[ss.fabActive, { left: 24, bottom: initialBottom }, animatedStyle]}>
                <Text style={ss.timerText}>{formatTime(seconds)}</Text>
                <TouchableOpacity
                    onPress={() => { setIsActive(false); setSeconds(0); }}
                    hitSlop={12}
                    style={ss.pauseBtn}
                >
                    <Ionicons name="stop" size={16} color={colors.red} />
                </TouchableOpacity>
            </Animated.View>
        </GestureDetector>
    );
}
