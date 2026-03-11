import { useColors } from '@/src/hooks/useColors';
import { ThemeFx, withAlpha } from '@/src/theme';
import { LinearGradient } from 'expo-linear-gradient';
import * as LucideIcons from 'lucide-react-native';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface BadgePillProps {
    name: string;
    color: string;
    icon?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    variant?: 'default' | 'vibrant' | 'minimal';
}

export function BadgePill({ name, color, icon, size = 'sm', variant = 'default' }: BadgePillProps) {
    const colors = useColors();
    const IconComponent = icon && (LucideIcons as any)[icon] ? (LucideIcons as any)[icon] : null;

    const config = useMemo(() => {
        const isXs = size === 'xs';
        const isSm = size === 'sm';
        const isMd = size === 'md';
        const isLg = size === 'lg';

        let borderRadius = 10;
        let paddingH = 8;
        let paddingV = 4;
        let fontSize = 11;
        let iconSize = 12;
        let letterSpacing = 0.2;
        let gap = 5;

        if (isXs) {
            borderRadius = 6;
            paddingH = 6;
            paddingV = 2;
            fontSize = 8.5;  // 7.5 -> 8.5
            iconSize = 9;   // 8 -> 9
            letterSpacing = 0;
            gap = 2;
        } else if (isSm) {
            borderRadius = 10; // 8 -> 10
            paddingH = 9;      // 7 -> 9
            paddingV = 4;      // 3 -> 4
            fontSize = 11;     // 9 -> 11
            iconSize = 12;     // 10 -> 12
            letterSpacing = 0.1;
            gap = 4;
        } else if (isLg) {
            borderRadius = 16; // 14 -> 16
            paddingH = 14;     // 10 -> 14
            paddingV = 8;      // 6 -> 8
            fontSize = 15;     // 13 -> 15
            iconSize = 16;     // 14 -> 16
            letterSpacing = 0.3;
            gap = 8;
        } else {
            // Default MD
            borderRadius = 12; // 10 -> 12
            paddingH = 11;      // 8 -> 11
            paddingV = 5;      // 4 -> 5
            fontSize = 13;     // 11 -> 13
            iconSize = 14;     // 12 -> 14
        }

        const baseOpacity = variant === 'minimal' ? '14' : '20';
        const gradientColors = variant === 'vibrant'
            ? [color, color]
            : [withAlpha(color, baseOpacity), withAlpha(color, baseOpacity)];

        // Intelligent contrast for vibrant
        const getContrastText = (hex: string) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
            return (yiq >= 128) ? colors.black : colors.white;
        };

        const textColor = variant === 'vibrant' ? getContrastText(color) : color;
        const borderColor = variant === 'minimal' ? 'transparent' : withAlpha(color, '40');

        const styles = StyleSheet.create({
            container: {
                borderRadius,
                borderWidth: 1,
                borderColor,
                overflow: 'hidden',
                alignSelf: 'flex-start',
                ...(variant === 'vibrant' ? ThemeFx.shadowSm : {})
            },
            content: {
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: paddingH,
                paddingVertical: paddingV,
            },
            icon: {
                marginRight: gap
            },
            text: {
                color: textColor,
                fontSize,
                fontWeight: '900',
                letterSpacing,
                textTransform: 'uppercase',
            }
        });

        return { styles, gradientColors, textColor, iconSize };
    }, [colors, color, size, variant]);

    return (
        <View style={config.styles.container}>
            <LinearGradient
                colors={config.gradientColors as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            <View style={config.styles.content}>
                {IconComponent && (
                    <IconComponent
                        size={config.iconSize}
                        color={config.textColor}
                        strokeWidth={2.5}
                        style={config.styles.icon}
                    />
                )}
                <Text
                    style={config.styles.text}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                >
                    {name}
                </Text>
            </View>
        </View>
    );
}
