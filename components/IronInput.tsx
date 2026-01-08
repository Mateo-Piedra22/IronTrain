import { Colors } from '@/src/theme';
import { useState } from 'react';
import { Text, TextInput, TextInputProps, View } from 'react-native';

interface IronInputProps extends TextInputProps {
    label?: string;
    error?: string;
}

export function IronInput({ label, error, className, ...props }: IronInputProps) {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <View className="w-full mb-4">
            {label && (
                <Text className="text-textMuted mb-2 text-sm font-medium">
                    {label}
                </Text>
            )}
            <TextInput
                placeholderTextColor={Colors.iron[400]}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                className={`bg-background text-textMain p-4 rounded-lg border ${isFocused ? 'border-primary' : 'border-iron-700'} ${error ? 'border-red-500' : ''} ${className || ''}`}
                {...props}
            />
            {error && (
                <Text className="text-red-500 text-xs mt-1">
                    {error}
                </Text>
            )}
        </View>
    );
}
