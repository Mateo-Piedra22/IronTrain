import { X } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import { useColors } from '../src/hooks/useColors';

interface IronInputProps extends TextInputProps {
    label?: string;
    error?: string;
}

export function IronInput({ label, error, className, value, onChangeText, ...props }: IronInputProps) {
    const colors = useColors();
    const [isFocused, setIsFocused] = useState(false);

    const ss = useMemo(() => StyleSheet.create({
        container: { width: '100%', marginBottom: 16 },
        label: {
            color: colors.textMuted,
            marginBottom: 8,
            fontSize: 12,
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginLeft: 4,
        },
        inputWrapper: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: error ? colors.red : (isFocused ? colors.primary.DEFAULT : colors.border),
            overflow: 'hidden'
        },
        input: {
            flex: 1,
            paddingHorizontal: 16,
            paddingVertical: 14,
            color: colors.text,
            fontSize: 16,
            fontWeight: '600'
        },
        clearBtn: { padding: 14 },
        errorText: { color: colors.red, fontSize: 11, marginTop: 6, fontWeight: '700', marginLeft: 6 }
    }), [colors, isFocused, error]);

    return (
        <View style={ss.container}>
            {label && (
                <Text style={ss.label}>
                    {label}
                </Text>
            )}
            <View style={ss.inputWrapper}>
                <TextInput
                    value={value}
                    onChangeText={onChangeText}
                    placeholderTextColor={colors.textMuted}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    accessibilityLabel={props.accessibilityLabel || label}
                    style={[ss.input, { textAlignVertical: props.multiline ? 'top' : 'center' }]}
                    {...props}
                />
                {value && value.length > 0 && onChangeText && (
                    <TouchableOpacity
                        onPress={() => onChangeText('')}
                        activeOpacity={0.5}
                        style={ss.clearBtn}
                    >
                        <X size={18} color={colors.textMuted} strokeWidth={2.5} />
                    </TouchableOpacity>
                )}
            </View>
            {error && (
                <Text style={ss.errorText}>
                    {error}
                </Text>
            )}
        </View>
    );
}
