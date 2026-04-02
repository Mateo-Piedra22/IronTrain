import { ThemeFx, withAlpha } from '@/src/theme';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, PressableProps, StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useColors } from '../src/hooks/useColors';
import { triggerSensoryFeedback } from '../src/utils/sensoryFeedback';

interface IronButtonProps extends PressableProps {
    variant?: 'solid' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    label: string;
    loading?: boolean;
}

export function IronButton({
    label,
    variant = 'solid',
    size = 'md',
    loading = false,
    disabled,
    onPress,
    onPressIn,
    onPressOut,
    ...props
}: IronButtonProps) {
    const colors = useColors();
    const pressScale = useSharedValue(1);

    const ss = useMemo(() => {
        const variants = {
            solid: {
                backgroundColor: colors.primary.DEFAULT,
                borderColor: colors.primary.DEFAULT,
                elevation: 1,
                shadowColor: ThemeFx.shadowColor,
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
            },
            outline: {
                backgroundColor: 'transparent',
                borderWidth: 1.5,
                borderColor: colors.primary.DEFAULT,
                elevation: 0,
            },
            ghost: {
                backgroundColor: 'transparent',
                borderColor: 'transparent',
                elevation: 0,
            }
        };

        const sizes = {
            sm: { paddingHorizontal: 16, height: 36 },
            md: { paddingHorizontal: 20, height: 48 },
            lg: { paddingHorizontal: 24, height: 56 }
        };

        const textVariants: Record<string, { color: string; fontWeight: "800" | "700" }> = {
            solid: { color: colors.onPrimary, fontWeight: '800' },
            outline: { color: colors.primary.DEFAULT, fontWeight: '800' },
            ghost: { color: colors.text, fontWeight: '700' }
        };

        return StyleSheet.create({
            container: {
                borderRadius: 14,
                overflow: 'hidden',
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: variant === 'outline' ? 1.5 : 0,
                ...variants[variant],
                ...sizes[size],
            },
            disabled: {
                opacity: 0.5,
                elevation: 0,
                // @ts-ignore
                shadowOpacity: 0,
            },
            pressable: {
                width: '100%',
                height: '100%',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
            },
            text: {
                fontSize: 15,
                textAlign: 'center',
                ...textVariants[variant],
            }
        });
    }, [colors, variant, size]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pressScale.value }],
    }));

    const handlePress = (e: any) => {
        if (!disabled && !loading) {
            void triggerSensoryFeedback('tapLight');
            onPress?.(e);
        }
    };

    const handlePressIn: NonNullable<PressableProps['onPressIn']> = (e) => {
        pressScale.value = withSpring(0.97, { damping: 18, stiffness: 320, mass: 0.3 });
        onPressIn?.(e);
    };

    const handlePressOut: NonNullable<PressableProps['onPressOut']> = (e) => {
        pressScale.value = withSpring(1, { damping: 18, stiffness: 260, mass: 0.3 });
        onPressOut?.(e);
    };

    const rippleColor = useMemo(() => {
        if (variant === 'solid') return withAlpha(colors.onPrimary, '20');
        return withAlpha(colors.primary.DEFAULT, '15');
    }, [colors, variant]);

    return (
        <Animated.View style={[ss.container, disabled && ss.disabled, animatedStyle]}>
            <Pressable
                style={ss.pressable}
                android_ripple={{ color: rippleColor }}
                onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
                disabled={disabled || loading}
                accessibilityRole="button"
                accessibilityLabel={props.accessibilityLabel || label}
                {...props}
            // Custom active state for iOS would go here via style function if needed, 
            // but we rely on ripple for Android and standard opacity for iOS in simple setups.
            >
                {loading ? (
                    <ActivityIndicator color={variant === 'solid' ? colors.onPrimary : colors.primary.DEFAULT} />
                ) : (
                    <Text style={ss.text}>
                        {label}
                    </Text>
                )}
            </Pressable>
        </Animated.View>
    );
}
