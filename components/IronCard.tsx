import { Pressable, PressableProps, View, ViewProps } from 'react-native';

interface IronCardProps extends ViewProps {
    onPress?: PressableProps['onPress'];
    variant?: 'default' | 'outline';
}

export function IronCard({ children, style, onPress, className, variant = 'default', ...props }: IronCardProps) {
    const baseClasses = "bg-surface rounded-xl p-4 shadow-sm";
    const outlineClasses = "border border-iron-700 bg-transparent";

    const finalClass = `${variant === 'outline' ? outlineClasses : baseClasses} ${className || ''}`;

    if (onPress) {
        return (
            <Pressable
                onPress={onPress}
                className={`active:opacity-80 ${finalClass}`}
                {...props as any}
            >
                {children}
            </Pressable>
        );
    }

    return (
        <View className={finalClass} {...props}>
            {children}
        </View>
    );
}
