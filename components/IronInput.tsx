import { Colors } from '@/src/theme';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';

interface IronInputProps extends TextInputProps {
    label?: string;
    error?: string;
}

export function IronInput({ label, error, className, value, onChangeText, ...props }: IronInputProps) {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <View className="w-full mb-4">
            {label && (
                <Text className="text-iron-500 mb-2 text-sm font-bold uppercase tracking-wider">
                    {label}
                </Text>
            )}
            <View className={`flex-row items-center bg-surface rounded-xl border ${isFocused ? 'border-primary' : 'border-iron-700'} ${error ? 'border-red-500' : ''} overflow-hidden`}>
                <TextInput
                    value={value}
                    onChangeText={onChangeText}
                    placeholderTextColor={Colors.iron[400]}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    accessibilityLabel={props.accessibilityLabel || label}
                    className={`flex-1 p-4 text-iron-950 text-base ${className || ''}`}
                    {...props}
                />
                {value && value.length > 0 && onChangeText && (
                    <TouchableOpacity onPress={() => onChangeText('')} className="p-4 active:opacity-50">
                        <X size={18} color={Colors.iron[400]} />
                    </TouchableOpacity>
                )}
            </View>
            {error && (
                <Text className="text-red-500 text-xs mt-1 font-medium ml-1">
                    {error}
                </Text>
            )}
        </View>
    );
}
