import { Colors } from '@/src/theme';
import { ActivityIndicator, Pressable, PressableProps, Text } from 'react-native';

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
    ...props
}: IronButtonProps) {

    const baseClasses = "flex-row items-center justify-center rounded-lg active:opacity-80";

    const variants = {
        solid: "bg-primary",
        outline: "border-2 border-primary bg-transparent",
        ghost: "bg-transparent"
    };

    const sizes = {
        sm: "px-3 py-2 max-h-[40px]",
        md: "px-4 py-3 min-h-[48px] max-h-[56px]",
        lg: "px-6 py-4 min-h-[56px] max-h-[64px]"
    };

    const textVariants = {
        solid: "text-white font-bold",
        outline: "text-primary font-bold",
        ghost: "text-primary font-medium"
    };

    return (
        <Pressable
            className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${disabled ? 'opacity-50' : ''} ${className || ''}`}
            disabled={disabled || loading}
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
    );
}
