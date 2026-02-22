import { useNotificationStore } from '@/src/store/notificationStore';
import { Colors } from '@/src/theme';
import { AlertTriangle, CheckCircle, Info, X, XCircle } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const GlobalBanner = () => {
    const banner = useNotificationStore(state => state.globalBanner);
    const clearBanner = useNotificationStore(state => state.clearGlobalBanner);
    const insets = useSafeAreaInsets();

    if (!banner) return null;

    const getColors = () => {
        switch (banner.type) {
            case 'error': return { bg: 'bg-red-100', text: 'text-red-800', icon: <XCircle color={Colors.red} size={18} /> };
            case 'warning': return { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <AlertTriangle color={Colors.yellow} size={18} /> };
            case 'success': return { bg: 'bg-green-100', text: 'text-green-800', icon: <CheckCircle color={Colors.green} size={18} /> };
            case 'info':
            default: return { bg: 'bg-primary-light/20', text: 'text-primary-dark', icon: <Info color={Colors.primary.DEFAULT} size={18} /> };
        }
    };

    const { bg, text, icon } = getColors();

    return (
        <Animated.View
            layout={Layout.springify().damping(15)}
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(200)}
            className="absolute left-0 right-0 z-40"
            style={{ top: Math.max(insets.top, 30) }}
        >
            <View className={`${bg} border-b border-black/5 flex-row items-center px-4 py-3 elevation-2`}>
                <View className="mr-3">
                    {icon}
                </View>
                <Text className={`flex-1 text-sm font-medium ${text}`}>
                    {banner.message}
                </Text>

                {banner.actionLabel && banner.onAction && (
                    <TouchableOpacity
                        onPress={() => {
                            banner.onAction!();
                            if (banner.dismissible) clearBanner();
                        }}
                        className="ml-3 px-3 py-1.5 bg-black/5 rounded-md active:bg-black/10"
                    >
                        <Text className={`text-xs font-bold ${text}`}>
                            {banner.actionLabel}
                        </Text>
                    </TouchableOpacity>
                )}

                {banner.dismissible && (
                    <TouchableOpacity onPress={clearBanner} className="ml-2 p-1 active:opacity-50">
                        <X color={Colors.iron[500]} size={16} />
                    </TouchableOpacity>
                )}
            </View>
        </Animated.View>
    );
};
