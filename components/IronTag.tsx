import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '../src/hooks/useColors';
import { withAlpha } from '../src/theme';

interface IronTagProps {
    label: string;
    variant?: 'default' | 'highlight' | 'failure' | 'warmup';
    style?: any;
}

export function IronTag({ label, variant = 'default', style }: IronTagProps) {
    const colors = useColors();

    const ss = useMemo(() => {
        const variants = {
            default: {
                backgroundColor: colors.surfaceLighter,
                borderWidth: 1,
                borderColor: colors.border,
            },
            highlight: {
                backgroundColor: colors.primary.DEFAULT,
                borderWidth: 0,
            },
            failure: {
                backgroundColor: withAlpha(colors.red, '10'),
                borderWidth: 1,
                borderColor: withAlpha(colors.red, '25'),
            },
            warmup: {
                backgroundColor: withAlpha(colors.yellow, '10'),
                borderWidth: 1,
                borderColor: withAlpha(colors.yellow, '25'),
            }
        };

        const textVariants = {
            default: { color: colors.textMuted },
            highlight: { color: colors.onPrimary, fontWeight: '900' as const },
            failure: { color: colors.red },
            warmup: { color: colors.yellow }
        };

        return StyleSheet.create({
            container: {
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 10,
                alignSelf: 'flex-start',
                ...variants[variant],
            },
            text: {
                fontSize: 10,
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                ...(textVariants[variant] as object),
            }
        });
    }, [colors, variant]);

    return (
        <View style={[ss.container, style]}>
            <Text style={ss.text}>
                {label}
            </Text>
        </View>
    );
}
