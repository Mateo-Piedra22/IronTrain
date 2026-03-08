import { useNotificationStore } from '@/src/store/notificationStore';
import { Colors } from '@/src/theme';
import { AlertTriangle, CheckCircle, Info, X, XCircle } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const GlobalBanner = () => {
    const banner = useNotificationStore(state => state.globalBanner);
    const clearBanner = useNotificationStore(state => state.clearGlobalBanner);
    const insets = useSafeAreaInsets();

    if (!banner) return null;

    const getTheme = () => {
        switch (banner.type) {
            case 'error': return { color: Colors.red, icon: <XCircle color={Colors.red} size={28} /> };
            case 'warning': return { color: Colors.yellow, icon: <AlertTriangle color={Colors.yellow} size={28} /> };
            case 'success': return { color: Colors.green, icon: <CheckCircle color={Colors.green} size={28} /> };
            case 'info':
            default: return { color: Colors.primary.DEFAULT, icon: <Info color={Colors.primary.DEFAULT} size={28} /> };
        }
    };

    const theme = getTheme();

    return (
        <Animated.View
            pointerEvents="auto"
            entering={FadeInDown.springify().damping(14).stiffness(150).mass(0.8)}
            exiting={FadeOutUp.duration(200)}
            className="absolute left-4 right-4 z-[100] bg-iron-900 rounded-2xl flex-row items-center p-4 border-[1.5px] border-iron-950 shadow-xl"
            style={{
                top: Math.max(insets.top, 10) + 10,
                shadowColor: Colors.black,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.4,
                shadowRadius: 8,
                elevation: 10,
                minHeight: 64,
            }}
        >
            <View className="mr-4 items-center justify-center p-2 rounded-full bg-iron-800 border-[1.5px] border-iron-950">
                {theme.icon}
            </View>

            <View className="flex-1 justify-center py-1">
                <Text className="text-base font-bold text-iron-950 leading-tight">
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
                    className="ml-4 px-4 py-2.5 bg-iron-950 rounded-xl active:bg-iron-700"
                >
                    <Text style={{ color: Colors.iron[900], fontWeight: 'bold', fontSize: 14 }}>
                        {banner.actionLabel}
                    </Text>
                </TouchableOpacity>
            )}

            {banner.dismissible && (
                <TouchableOpacity
                    onPress={clearBanner}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    className="ml-3 active:opacity-50 items-center justify-center bg-iron-950 rounded-full w-8 h-8"
                >
                    <X color={Colors.iron[900]} size={18} strokeWidth={3} />
                </TouchableOpacity>
            )}
        </Animated.View>
    );
};
