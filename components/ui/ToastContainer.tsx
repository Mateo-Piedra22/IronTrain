import { ToastMessage, useNotificationStore } from '@/src/store/notificationStore';
import { AlertTriangle, CheckCircle, Info, X, XCircle } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../../src/hooks/useColors';

const ToastItem = ({ toast, onDismiss, styles, colors }: { toast: ToastMessage, onDismiss: (id: string) => void, styles: any, colors: any }) => {
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

    return (
        <Animated.View
            pointerEvents="auto"
            layout={LinearTransition.springify().damping(14).stiffness(150)}
            entering={FadeInDown.springify().damping(14).stiffness(150).mass(0.8)}
            exiting={SlideOutUp.duration(200)}
            className="w-[95%] self-center bg-iron-900 rounded-2xl flex-row items-center p-4 mb-3 border-[1.5px] border-iron-950 shadow-xl"
            style={[styles.toastShadow]}
        >
            <View className="mr-4 items-center justify-center p-2 rounded-full bg-iron-800 border-[1.5px] border-iron-950">
                {theme.icon}
            </View>
            <View className="flex-1 justify-center pr-2">
                <Text className="text-iron-950 font-bold text-base leading-tight mb-1">{toast.title}</Text>
                {!!toast.message && <Text className="text-iron-950 opacity-80 text-sm font-medium leading-tight">{toast.message}</Text>}
            </View>
            <TouchableOpacity
                onPress={() => onDismiss(toast.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                className="ml-1 active:opacity-50 items-center justify-center bg-iron-950 rounded-full w-8 h-8"
            >
                <X color={colors.iron[900]} size={18} strokeWidth={3} />
            </TouchableOpacity>
        </Animated.View>
    );
};

export const ToastContainer = () => {
    const colors = useColors();
    const styles = useMemo(() => StyleSheet.create({
        container: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
        },
        inner: {
            paddingHorizontal: 16,
        },
        toastShadow: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 8,
        }
    }), [colors]);

    const toasts = useNotificationStore(state => state.toasts);
    const removeToast = useNotificationStore(state => state.removeToast);
    const insets = useSafeAreaInsets();

    const hasToasts = toasts.length > 0;

    return (
        <View
            pointerEvents="box-none"
            style={[
                styles.container,
                {
                    paddingTop: Math.max(insets.top + 10, 50),
                    zIndex: 9999,
                    display: hasToasts ? 'flex' : 'none'
                }
            ]}
        >
            <View pointerEvents="box-none" style={styles.inner}>
                {toasts.map(toast => (
                    <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} styles={styles} colors={colors} />
                ))}
            </View>
        </View>
    );
};
