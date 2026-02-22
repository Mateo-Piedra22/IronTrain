import { ToastMessage, useNotificationStore } from '@/src/store/notificationStore';
import { Colors } from '@/src/theme';
import { AlertTriangle, CheckCircle, Info, X, XCircle } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { Layout, SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ToastItem = ({ toast, onDismiss }: { toast: ToastMessage, onDismiss: (id: string) => void }) => {

    const getIcon = () => {
        switch (toast.type) {
            case 'success': return <CheckCircle color={Colors.green} size={20} />;
            case 'error': return <XCircle color={Colors.red} size={20} />;
            case 'warning': return <AlertTriangle color={Colors.yellow} size={20} />;
            case 'info':
            default: return <Info color={Colors.primary.DEFAULT} size={20} />;
        }
    };

    const getBorderColor = () => {
        switch (toast.type) {
            case 'success': return Colors.green;
            case 'error': return Colors.red;
            case 'warning': return Colors.yellow;
            case 'info':
            default: return Colors.primary.DEFAULT;
        }
    };

    return (
        <Animated.View
            layout={Layout.springify().damping(15)}
            entering={SlideInUp.duration(300).springify().damping(15)}
            exiting={SlideOutUp.duration(200)}
            className="w-11/12 self-center bg-iron-800 rounded-xl flex-row items-center p-4 mb-3"
            style={[styles.toastShadow, { borderLeftWidth: 4, borderLeftColor: getBorderColor() }]}
        >
            <View className="mr-3">
                {getIcon()}
            </View>
            <View className="flex-1 justify-center">
                <Text className="text-iron-950 font-bold text-sm">{toast.title}</Text>
                {!!toast.message && <Text className="text-iron-600 text-xs mt-1">{toast.message}</Text>}
            </View>
            <TouchableOpacity onPress={() => onDismiss(toast.id)} className="p-2 ml-2 active:opacity-50">
                <X color={Colors.iron[400]} size={16} />
            </TouchableOpacity>
        </Animated.View>
    );
};

export const ToastContainer = () => {
    const toasts = useNotificationStore(state => state.toasts);
    const removeToast = useNotificationStore(state => state.removeToast);
    const insets = useSafeAreaInsets();

    if (toasts.length === 0) return null;

    return (
        <View
            className="absolute left-0 right-0 z-50 pointer-events-none items-center"
            style={{ top: Math.max(insets.top + 10, 50) }}
        >
            <View className="pointer-events-auto w-full">
                {toasts.map(toast => (
                    <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    toastShadow: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
    }
});
