import { IronButton } from '@/components/IronButton';
import { ThemeFx, withAlpha } from '@/src/theme';
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
            backgroundColor: ThemeFx.backdropStrong,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
        },
        card: {
            backgroundColor: colors.surface,
            width: '100%',
            maxWidth: 400,
            borderRadius: 20,
            padding: 28,
            borderWidth: 1.5,
            borderColor: colors.border,
            ...ThemeFx.shadowLg,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
            marginBottom: 20,
        },
        iconCircle: {
            width: 52,
            height: 52,
            borderRadius: 16,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.surfaceLighter,
            borderWidth: 1,
            borderColor: withAlpha(colors.border, '50'),
        },
        title: {
            flex: 1,
            fontSize: 20,
            fontWeight: '900',
            color: colors.text,
            letterSpacing: -0.5,
        },
        messageContainer: {
            maxHeight: 400,
            marginBottom: 28,
            backgroundColor: colors.surfaceLighter,
            borderRadius: 16,
            padding: 4,
            borderWidth: 1,
            borderColor: colors.border,
        },
        messageScroll: {
            flexGrow: 0,
        },
        messageContent: {
            paddingVertical: 14,
            paddingHorizontal: 16,
        },
        message: {
            fontSize: 15,
            lineHeight: 22,
            color: colors.textMuted,
            fontWeight: '500',
        },
        bold: {
            fontWeight: '900',
            color: colors.text,
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
            borderWidth: 1.5,
            borderColor: withAlpha(colors.red, '25'),
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 52,
        },
        destructiveBtnText: {
            fontWeight: '900',
            fontSize: 16,
            color: colors.red,
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
    }), [colors]);

    const cfg = VARIANT_CONFIG[variant];
    const resolvedButtons: ConfirmModalButton[] = buttons ?? [
        { label: 'Entendido', onPress: onClose, variant: 'solid' },
    ];
    const isStacked = resolvedButtons.length >= 2;

    if (!visible) return null;

    return (
        <View style={[StyleSheet.absoluteFill, { zIndex: 1000, elevation: 1000 }]} pointerEvents="auto">
            <View style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View pointerEvents="box-none" style={[StyleSheet.absoluteFillObject, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
                    <View style={styles.card} pointerEvents="auto">
                        <View style={styles.header}>
                            <View style={[styles.iconCircle, { backgroundColor: withAlpha(cfg.accentColor, '15'), borderColor: withAlpha(cfg.accentColor, '25') }]}>
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
                                    nestedScrollEnabled={true}
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
                    </View>
                </View>
            </View>
        </View>
    );
}

