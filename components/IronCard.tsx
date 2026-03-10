import { useMemo } from 'react';
import { Pressable, PressableProps, StyleSheet, View, ViewProps } from 'react-native';
import { useColors } from '../src/hooks/useColors';
import { ThemeFx } from '../src/theme';

interface IronCardProps extends ViewProps {
    onPress?: PressableProps['onPress'];
    variant?: 'default' | 'outline';
}

export function IronCard({ children, style, onPress, variant = 'default', ...props }: IronCardProps) {
    const colors = useColors();

    const ss = useMemo(() => StyleSheet.create({
        container: {
            borderRadius: 16,
            padding: 16,
            backgroundColor: variant === 'outline' ? 'transparent' : colors.surface,
            borderWidth: 1.5,
            borderColor: variant === 'outline' ? colors.border : colors.border,
            ... (variant === 'default' ? ThemeFx.shadowSm : {}),
        },
        pressed: {
            opacity: 0.85,
            transform: [{ scale: 0.99 }],
        }
    }), [colors, variant]);

    if (onPress) {
        return (
            <Pressable
                onPress={onPress}
                style={({ pressed }) => [
                    ss.container,
                    style,
                    pressed && ss.pressed
                ]}
                {...props as any}
            >
                {children}
            </Pressable>
        );
    }

    return (
        <View style={[ss.container, style]} {...props}>
            {children}
        </View>
    );
}

