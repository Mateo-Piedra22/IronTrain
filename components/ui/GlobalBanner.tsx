import { useNotificationStore } from '@/src/store/notificationStore';
import { withAlpha } from '@/src/theme';
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
            backgroundColor: colors.iron[100],
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            borderWidth: 1.5,
            borderColor: colors.border,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.2,
            shadowRadius: 10,
            elevation: 8,
            minHeight: 64,
        },
        iconContainer: {
            marginRight: 16,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 10,
            borderRadius: 14,
            backgroundColor: withAlpha(colors.iron[200], '40'),
            borderWidth: 1,
            borderColor: colors.border
        },
        content: {
            flex: 1,
            justifyContent: 'center',
            paddingVertical: 4
        },
        message: {
            fontSize: 15,
            fontWeight: '700',
            color: colors.iron[950],
            lineHeight: 20
        },
        actionButton: {
            marginLeft: 12,
            paddingHorizontal: 14,
            paddingVertical: 8,
            backgroundColor: colors.primary.DEFAULT,
            borderRadius: 12,
        },
        actionText: {
            color: colors.white,
            fontWeight: '800',
            fontSize: 13
        },
        closeButton: {
            marginLeft: 8,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.iron[200],
            borderRadius: 10,
            width: 32,
            height: 32
        }
    }), [colors]);

    if (!banner) return null;

    const theme = (() => {
        switch (banner.type) {
            case 'error': return { icon: <XCircle color={colors.red} size={28} /> };
            case 'warning': return { icon: <AlertTriangle color={colors.yellow} size={28} /> };
            case 'success': return { icon: <CheckCircle color={colors.green} size={28} /> };
            case 'info':
            default: return { icon: <Info color={colors.primary.DEFAULT} size={28} /> };
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
            <View style={ss.iconContainer}>
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
                    <X color={colors.iron[900]} size={18} strokeWidth={3} />
                </TouchableOpacity>
            )}
        </Animated.View>
    );
};
