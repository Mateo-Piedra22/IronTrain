import { useNotificationStore } from '@/src/store/notificationStore';
import { ThemeFx, withAlpha } from '@/src/theme';
import { AlertTriangle, CheckCircle, Info, X, XCircle } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../../src/hooks/useColors';

export const GlobalBanner = () => {
    const colors = useColors();
    const banner = useNotificationStore(state => state.globalBanner);
    const clearBanner = useNotificationStore(state => state.clearGlobalBanner);
    const insets = useSafeAreaInsets();

    const ss = useMemo(() => StyleSheet.create({
        container: {
            position: 'absolute',
            left: 16,
            right: 16,
            zIndex: 100,
            backgroundColor: colors.surface, // Better depth
            borderRadius: 24,
            flexDirection: 'row',
            alignItems: 'center',
            padding: 14,
            borderWidth: 1.5,
            borderColor: colors.border,
            ...ThemeFx.shadowLg,
            minHeight: 68,
        },
        iconContainer: {
            marginRight: 16,
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: 16,
            backgroundColor: colors.surfaceLighter,
            borderWidth: 1,
            borderColor: withAlpha(colors.border, '50'),
        },
        content: {
            flex: 1,
            justifyContent: 'center',
        },
        message: {
            fontSize: 15,
            fontWeight: '900',
            color: colors.text,
            lineHeight: 20,
            letterSpacing: -0.3,
        },
        actionButton: {
            marginLeft: 12,
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: colors.primary.DEFAULT,
            borderRadius: 12,
            ...ThemeFx.shadowSm,
        },
        actionText: {
            color: colors.onPrimary,
            fontWeight: '900',
            fontSize: 13,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        closeButton: {
            marginLeft: 8,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceLighter,
            borderRadius: 12,
            width: 36,
            height: 36,
            borderWidth: 1,
            borderColor: withAlpha(colors.border, '30'),
        }
    }), [colors]);

    if (!banner) return null;

    const theme = (() => {
        switch (banner.type) {
            case 'error': return { icon: <XCircle color={colors.red} size={24} /> };
            case 'warning': return { icon: <AlertTriangle color={colors.yellow} size={24} /> };
            case 'success': return { icon: <CheckCircle color={colors.green} size={24} /> };
            case 'info':
            default: return { icon: <Info color={colors.primary.DEFAULT} size={24} /> };
        }
    })();

    const topOffset = Math.max(insets.top, 10) + 10;

    return (
        <Animated.View
            pointerEvents="auto"
            entering={FadeInDown.springify().damping(14).stiffness(150).mass(0.8)}
            exiting={FadeOutUp.duration(200)}
            style={[ss.container, { top: topOffset }]}
        >
            <View style={[ss.iconContainer, { backgroundColor: withAlpha(banner.type === 'error' ? colors.red : banner.type === 'warning' ? colors.yellow : banner.type === 'success' ? colors.green : colors.primary.DEFAULT, '12') }]}>
                {theme.icon}
            </View>

            <View style={ss.content}>
                <Text style={ss.message}>
                    {banner.message}
                </Text>
            </View>

            {banner.actionLabel && banner.onAction && (
                <TouchableOpacity
                    onPress={() => {
                        banner.onAction!();
                        if (banner.dismissible) clearBanner();
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={ss.actionButton}
                    activeOpacity={0.7}
                >
                    <Text style={ss.actionText}>
                        {banner.actionLabel}
                    </Text>
                </TouchableOpacity>
            )}

            {banner.dismissible && (
                <TouchableOpacity
                    onPress={clearBanner}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={ss.closeButton}
                    activeOpacity={0.5}
                >
                    <X color={colors.textMuted} size={18} strokeWidth={3} />
                </TouchableOpacity>
            )}
        </Animated.View>
    );
};

