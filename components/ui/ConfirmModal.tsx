import { IronButton } from '@/components/IronButton';
import { ThemeFx, withAlpha } from '@/src/theme';
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useColors } from '../../src/hooks/useColors';

type ModalVariant = 'info' | 'warning' | 'error' | 'success' | 'destructive';

interface ConfirmModalButton {
    label: string;
    onPress: () => void;
    variant?: 'solid' | 'outline' | 'ghost';
    /** If true, the button renders with a red destructive appearance */
    destructive?: boolean;
}

interface ConfirmModalProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    message?: string;
    variant?: ModalVariant;
    buttons?: ConfirmModalButton[];
}

export function ConfirmModal({ visible, onClose, title, message, variant = 'info', buttons }: ConfirmModalProps) {
    const colors = useColors();

    const VARIANT_CONFIG: Record<ModalVariant, { icon: React.ReactNode; accentColor: string }> = useMemo(() => ({
        info: { icon: <Info size={22} color={colors.primary.DEFAULT} />, accentColor: colors.primary.DEFAULT },
        warning: { icon: <AlertTriangle size={22} color={colors.yellow} />, accentColor: colors.yellow },
        error: { icon: <XCircle size={22} color={colors.red} />, accentColor: colors.red },
        success: { icon: <CheckCircle size={22} color={colors.green} />, accentColor: colors.green },
        destructive: { icon: <AlertTriangle size={22} color={colors.red} />, accentColor: colors.red },
    }), [colors]);

    const styles = useMemo(() => StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: ThemeFx.backdrop,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
        },
        card: {
            backgroundColor: colors.surface,
            width: '100%',
            maxWidth: 360,
            borderRadius: 20,
            padding: 24,
            borderWidth: 1,
            borderColor: colors.iron[700],
            elevation: 8,
            shadowColor: ThemeFx.shadowColor,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: ThemeFx.shadowOpacityStrong,
            shadowRadius: 24,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginBottom: 12,
        },
        iconCircle: {
            width: 40,
            height: 40,
            borderRadius: 12,
            justifyContent: 'center',
            alignItems: 'center',
        },
        title: {
            flex: 1,
            fontSize: 18,
            fontWeight: '900',
            color: colors.iron[950],
            letterSpacing: -0.3,
        },
        messageContainer: {
            maxHeight: 400,
            marginBottom: 20,
            backgroundColor: colors.iron[50] + '80',
            borderRadius: 12,
            padding: 4,
        },
        messageScroll: {
            flexGrow: 0,
        },
        messageContent: {
            paddingVertical: 12,
            paddingHorizontal: 16,
        },
        message: {
            fontSize: 14,
            lineHeight: 22,
            color: colors.iron[500],
        },
        bold: {
            fontWeight: '900',
            color: colors.iron[950],
        },
        buttonRow: {
            flexDirection: 'row',
            gap: 12,
        },
        buttonRowStacked: {
            flexDirection: 'column',
            gap: 12,
        },
        buttonFullWidth: {
            width: '100%',
        },
        destructiveBtn: {
            backgroundColor: withAlpha(colors.red, '12'),
            borderWidth: 1,
            borderColor: withAlpha(colors.red, '25'),
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 48,
        },
        destructiveBtnText: {
            fontWeight: '700',
            fontSize: 16,
            color: colors.red,
        },
    }), [colors]);

    const cfg = VARIANT_CONFIG[variant];
    const resolvedButtons: ConfirmModalButton[] = buttons ?? [
        { label: 'Entendido', onPress: onClose, variant: 'solid' },
    ];
    const isStacked = resolvedButtons.length >= 2;

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={styles.card} onPress={e => e.stopPropagation()}>
                    <View style={styles.header}>
                        <View style={[styles.iconCircle, { backgroundColor: cfg.accentColor + '14' }]}>
                            {cfg.icon}
                        </View>
                        <Text style={styles.title}>{title}</Text>
                    </View>

                    {message ? (
                        <View style={styles.messageContainer}>
                            <ScrollView
                                style={styles.messageScroll}
                                contentContainerStyle={styles.messageContent}
                                showsVerticalScrollIndicator={true}
                            >
                                <Text style={styles.message}>
                                    {message.split(/(\*\*.*?\*\*|\n)/g).map((part, i) => {
                                        if (part.startsWith('**') && part.endsWith('**')) {
                                            return <Text key={i} style={styles.bold}>{part.slice(2, -2)}</Text>;
                                        }
                                        return part;
                                    })}
                                </Text>
                            </ScrollView>
                        </View>
                    ) : null}

                    <View style={[styles.buttonRow, isStacked && styles.buttonRowStacked]}>
                        {resolvedButtons.map((btn, i) => {
                            if (btn.destructive) {
                                return (
                                    <View key={i} style={isStacked ? styles.buttonFullWidth : { flex: 1 }}>
                                        <Pressable
                                            onPress={btn.onPress}
                                            style={styles.destructiveBtn}
                                            android_ripple={{ color: withAlpha(colors.red, '26') }}
                                        >
                                            <Text style={styles.destructiveBtnText}>{btn.label}</Text>
                                        </Pressable>
                                    </View>
                                );
                            }
                            return (
                                <View key={i} style={isStacked ? styles.buttonFullWidth : { flex: 1 }}>
                                    <IronButton
                                        label={btn.label}
                                        variant={btn.variant ?? 'solid'}
                                        onPress={btn.onPress}
                                    />
                                </View>
                            );
                        })}
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}
