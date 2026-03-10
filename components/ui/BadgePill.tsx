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
            fontSize = 7.5;
            iconSize = 8;
            letterSpacing = 0;
            gap = 2;
        } else if (isSm) {
            borderRadius = 8;
            paddingH = 7;
            paddingV = 3;
            fontSize = 9;
            iconSize = 10;
            letterSpacing = 0.1;
            gap = 3;
        } else if (isLg) {
            borderRadius = 14;
            paddingH = 10;
            paddingV = 6;
            fontSize = 13;
            iconSize = 14;
            letterSpacing = 0.3;
            gap = 6;
        }

        const baseOpacity = variant === 'minimal' ? '14' : '20';
        const gradientColors = variant === 'vibrant'
            ? [color, color]
            : [withAlpha(color, baseOpacity), withAlpha(color, baseOpacity)];

        const textColor = variant === 'vibrant' ? colors.white : color;
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
