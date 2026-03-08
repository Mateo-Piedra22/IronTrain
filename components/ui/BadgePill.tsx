import { Colors } from '@/src/theme';
import { LinearGradient } from 'expo-linear-gradient';
import * as LucideIcons from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface BadgePillProps {
    name: string;
    color: string;
    icon?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    variant?: 'default' | 'vibrant' | 'minimal';
}

export function BadgePill({ name, color, icon, size = 'sm', variant = 'default' }: BadgePillProps) {
    const IconComponent = icon && (LucideIcons as any)[icon] ? (LucideIcons as any)[icon] : null;

    const isXs = size === 'xs';
    const isSm = size === 'sm';
    const isMd = size === 'md';
    const isLg = size === 'lg';

    // Premium HSL-based translucency logic
    const baseOpacity = variant === 'minimal' ? '10' : '15';
    const gradientColors = variant === 'vibrant'
        ? [color, color + 'cc']
        : [color + baseOpacity, color + baseOpacity];

    const textColor = variant === 'vibrant' ? Colors.white : color;
    const iconSize = isXs ? 8 : isSm ? 10 : isMd ? 12 : 14;

    return (
        <View style={[
            styles.container,
            { borderColor: variant === 'minimal' ? 'transparent' : color + '40' },
            isXs && styles.xsContainer,
            isSm && styles.smContainer,
            isMd && styles.mdContainer,
            isLg && styles.lgContainer,
            variant === 'vibrant' && styles.shadow
        ]}>
            <LinearGradient
                colors={gradientColors as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            <View style={styles.content}>
                {IconComponent && (
                    <IconComponent
                        size={iconSize}
                        color={textColor}
                        strokeWidth={2.5}
                        style={{ marginRight: isXs ? 2 : isSm ? 3 : 5 }}
                    />
                )}
                <Text
                    style={[
                        styles.text,
                        { color: textColor },
                        isXs && styles.xsText,
                        isSm && styles.smText,
                        isMd && styles.mdText,
                        isLg && styles.lgText
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                >
                    {name}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 8,
        borderWidth: 1,
        overflow: 'hidden',
        alignSelf: 'flex-start',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    xsContainer: {
        borderRadius: 4,
    },
    smContainer: {
        borderRadius: 6,
    },
    mdContainer: {
        borderRadius: 8,
    },
    lgContainer: {
        borderRadius: 10,
    },
    xsText: {
        fontSize: 7.5,
        fontWeight: '900',
        letterSpacing: 0,
    },
    smText: {
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.1,
    },
    mdText: {
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.2,
    },
    lgText: {
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.3,
    },
    text: {
        textTransform: 'uppercase',
    },
    shadow: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    }
});
