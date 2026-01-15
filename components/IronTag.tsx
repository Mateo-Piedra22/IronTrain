import { Text, View } from 'react-native';

interface IronTagProps {
    label: string;
    variant?: 'default' | 'highlight' | 'failure' | 'warmup';
    className?: string;
}

export function IronTag({ label, variant = 'default', className }: IronTagProps) {
    const variants = {
        default: "bg-iron-700",
        highlight: "bg-primary",
        failure: "bg-red-900 border border-red-700",
        warmup: "bg-yellow-900 border border-yellow-700"
    };

    const textVariants = {
        default: "text-iron-500",
        highlight: "text-iron-950 font-bold",
        failure: "text-red-200",
        warmup: "text-yellow-200"
    };

    return (
        <View className={`${variants[variant]} px-2 py-1 rounded-full self-start ${className || ''}`}>
            <Text className={`${textVariants[variant]} text-xs uppercase tracking-wider`}>
                {label}
            </Text>
        </View>
    );
}
