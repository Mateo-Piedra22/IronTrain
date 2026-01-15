import { Colors } from '@/src/theme';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, PressableProps, Text, View } from 'react-native';

interface IronButtonProps extends PressableProps {
    variant?: 'solid' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    label: string;
    loading?: boolean;
}

export function IronButton({
    label,
    variant = 'solid',
    size = 'md',
    loading = false,
    className,
    disabled,
    onPress,
    ...props
}: IronButtonProps) {

    const baseClasses = "flex-row items-center justify-center rounded-xl overflow-hidden";

    const variants = {
        solid: "bg-primary elevation-1 active:bg-primary-dark",
        outline: "border border-primary bg-transparent active:bg-primary/5",
        ghost: "bg-transparent active:bg-iron-200"
    };

    const sizes = {
        sm: "px-3 py-2 min-h-[36px]",
        md: "px-4 py-3 min-h-[48px]",
        lg: "px-6 py-4 min-h-[56px]"
    };

    const textVariants = {
        solid: "text-white font-bold",
        outline: "text-primary font-bold",
        ghost: "text-iron-950 font-medium"
    };

    const handlePress = (e: any) => {
        if (!disabled && !loading) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPress?.(e);
        }
    };

    return (
        <View className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${disabled ? 'opacity-50 elevation-none' : ''} ${className || ''}`}>
             <Pressable
                className="w-full h-full flex-row items-center justify-center"
                android_ripple={{ color: variant === 'solid' ? 'rgba(255,255,255,0.2)' : 'rgba(92, 46, 46, 0.1)' }}
                onPress={handlePress}
                disabled={disabled || loading}
                accessibilityRole="button"
                accessibilityLabel={props.accessibilityLabel || label}
                {...props}
            >
                {loading ? (
                    <ActivityIndicator color={variant === 'solid' ? 'white' : Colors.primary.dark} />
                ) : (
                    <Text className={`${textVariants[variant]} text-center text-base`}>
                        {label}
                    </Text>
                )}
            </Pressable>
        </View>
    );
}
