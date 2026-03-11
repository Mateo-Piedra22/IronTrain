import { ToastMessage, useNotificationStore } from '@/src/store/notificationStore';
import { ThemeFx, withAlpha } from '@/src/theme';
import { AlertTriangle, CheckCircle, Info, X, XCircle } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, LinearTransition, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../../src/hooks/useColors';

export type ToastStackStyle = {
    opacity: number;
    marginTop: number;
    transform: [{ scale: number }, { translateY: number }];
};

export function computeToastStackStyle(index: number): ToastStackStyle {
    const clampedIndex = Math.max(0, index);
    const scale = Math.max(0.88, 1 - clampedIndex * 0.04);
    const opacity = Math.max(0.72, 1 - clampedIndex * 0.08);
    const overlap = clampedIndex === 0 ? 0 : -12;
    const translateY = clampedIndex * 6;

    return {
        opacity,
        marginTop: overlap,
        transform: [{ scale }, { translateY }],
    };
}

type ToastItemStyles = {
    toast: ViewStyle;
    iconContainer: ViewStyle;
    textContainer: ViewStyle;
    closeBtn: ViewStyle;
    title: TextStyle;
    message: TextStyle;
};

type ToastContainerStyles = ToastItemStyles & {
    container: ViewStyle;
    inner: ViewStyle;
};

type ToastItemProps = {
    toast: ToastMessage;
    index: number;
    onDismiss: (id: string) => void;
    styles: ToastItemStyles;
    colors: ReturnType<typeof useColors>;
};

const ToastItem = ({ toast, index, onDismiss, styles, colors }: ToastItemProps) => {
    const getTheme = () => {
        switch (toast.type) {
            case 'success': return { color: colors.green, icon: <CheckCircle color={colors.green} size={28} /> };
            case 'error': return { color: colors.red, icon: <XCircle color={colors.red} size={28} /> };
            case 'warning': return { color: colors.yellow, icon: <AlertTriangle color={colors.yellow} size={28} /> };
            case 'info':
            default: return { color: colors.primary.DEFAULT, icon: <Info color={colors.primary.DEFAULT} size={28} /> };
        }
    };

    const theme = getTheme();
    const stackStyle = computeToastStackStyle(index);

    return (
        <Animated.View
            pointerEvents="auto"
            layout={LinearTransition.springify().damping(14).stiffness(150)}
            entering={FadeInDown.springify().damping(14).stiffness(150).mass(0.8)}
            exiting={SlideOutUp.duration(200)}
            style={[styles.toast, stackStyle as unknown as ViewStyle, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
            <Pressable
                accessibilityRole={toast.onPress ? 'button' : undefined}
                accessibilityLabel={toast.onPress ? toast.title : undefined}
                onPress={toast.onPress}
                disabled={!toast.onPress}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
            >
                <View
                    style={[styles.iconContainer, { backgroundColor: colors.isDark ? withAlpha(colors.primary.DEFAULT, '20') : colors.surfaceLighter, borderColor: colors.border }]}
                >
                    {theme.icon}
                </View>
                <View style={styles.textContainer}>
                    <Text style={[styles.title, { color: colors.text }]}>{toast.title}</Text>
                    {!!toast.message && <Text style={[styles.message, { color: colors.textMuted }]}>{toast.message}</Text>}
                </View>
            </Pressable>
            <TouchableOpacity
                onPress={() => onDismiss(toast.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={[styles.closeBtn, { backgroundColor: colors.isDark ? withAlpha(colors.text, '10') : colors.surfaceLighter }]}
                accessibilityRole="button"
                accessibilityLabel="Cerrar notificación"
            >
                <X color={colors.text} size={18} strokeWidth={3} />
            </TouchableOpacity>
        </Animated.View>
    );
};

export const ToastContainer = () => {
    const colors = useColors();
    const styles = useMemo(() => StyleSheet.create<ToastContainerStyles>({
        container: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            elevation: 9999,
        },
        inner: {
            paddingHorizontal: 16,
        },
        toast: {
            width: '95%',
            alignSelf: 'center',
            borderRadius: 16,
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            marginBottom: 12,
            borderWidth: 1.5,
            ...ThemeFx.shadowLg,
        },
        iconContainer: {
            marginRight: 16,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 8,
            borderRadius: 9999,
            borderWidth: 1.5,
        },
        textContainer: {
            flex: 1,
            justifyContent: 'center',
            paddingRight: 8,
        },
        title: {
            fontWeight: '900',
            fontSize: 16,
            lineHeight: 20,
            marginBottom: 4,
        },
        message: {
            opacity: 0.8,
            fontSize: 14,
            fontWeight: '500',
            lineHeight: 18,
        },
        closeBtn: {
            marginLeft: 4,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 9999,
            width: 32,
            height: 32,
        }
    }), [colors]);

    const toasts = useNotificationStore(state => state.toasts);
    const removeToast = useNotificationStore(state => state.removeToast);
    const insets = useSafeAreaInsets();

    const hasToasts = toasts.length > 0;
    const visibleToasts = useMemo(() => [...toasts].reverse(), [toasts]);

    if (!hasToasts) return null;

    return (
        <View
            pointerEvents="box-none"
            style={[
                styles.container,
                {
                    paddingTop: Math.max(insets.top + 10, 50),
                    zIndex: 9999,
                }
            ]}
        >
            <View pointerEvents="box-none" style={styles.inner}>
                {visibleToasts.map((toast, index) => (
                    <ToastItem key={toast.id} toast={toast} index={index} onDismiss={removeToast} styles={styles} colors={colors} />
                ))}
            </View>
        </View>
    );
};
