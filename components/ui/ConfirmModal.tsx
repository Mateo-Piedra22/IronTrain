import { IronButton } from '@/components/IronButton';
import { Colors } from '@/src/theme';
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react-native';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

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

const VARIANT_CONFIG: Record<ModalVariant, { icon: React.ReactNode; accentColor: string }> = {
    info: { icon: <Info size={22} color={Colors.primary.DEFAULT} />, accentColor: Colors.primary.DEFAULT },
    warning: { icon: <AlertTriangle size={22} color="#d97706" />, accentColor: '#d97706' },
    error: { icon: <XCircle size={22} color="#ef4444" />, accentColor: '#ef4444' },
    success: { icon: <CheckCircle size={22} color="#16a34a" />, accentColor: '#16a34a' },
    destructive: { icon: <AlertTriangle size={22} color="#ef4444" />, accentColor: '#ef4444' },
};

/**
 * In-app confirmation/info modal matching the IronTrain design system.
 *
 * Replaces all `Alert.alert` calls with a styled modal that uses
 * the same visual language as category/exercise modals.
 */
export function ConfirmModal({ visible, onClose, title, message, variant = 'info', buttons }: ConfirmModalProps) {
    const cfg = VARIANT_CONFIG[variant];

    const resolvedButtons: ConfirmModalButton[] = buttons ?? [
        { label: 'Entendido', onPress: onClose, variant: 'solid' },
    ];

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
            <Pressable style={st.overlay} onPress={onClose}>
                <Pressable style={st.card} onPress={e => e.stopPropagation()}>
                    {/* Icon + Title */}
                    <View style={st.header}>
                        <View style={[st.iconCircle, { backgroundColor: cfg.accentColor + '14' }]}>
                            {cfg.icon}
                        </View>
                        <Text style={st.title}>{title}</Text>
                    </View>

                    {/* Message */}
                    {message ? <Text style={st.message}>{message}</Text> : null}

                    {/* Buttons */}
                    <View style={st.buttonRow}>
                        {resolvedButtons.map((btn, i) => {
                            if (btn.destructive) {
                                return (
                                    <View key={i} style={{ flex: 1 }}>
                                        <Pressable
                                            onPress={btn.onPress}
                                            style={st.destructiveBtn}
                                            android_ripple={{ color: 'rgba(239,68,68,0.15)' }}
                                        >
                                            <Text style={st.destructiveBtnText}>{btn.label}</Text>
                                        </Pressable>
                                    </View>
                                );
                            }
                            return (
                                <View key={i} style={{ flex: 1 }}>
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

// ─── Styles ──────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        backgroundColor: Colors.surface,
        width: '100%',
        maxWidth: 360,
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
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
        color: Colors.iron[950],
        letterSpacing: -0.3,
    },
    message: {
        fontSize: 14,
        lineHeight: 20,
        color: Colors.iron[500],
        marginBottom: 20,
        paddingLeft: 52,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
    },
    destructiveBtn: {
        backgroundColor: '#ef444412',
        borderWidth: 1,
        borderColor: '#ef444425',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
    },
    destructiveBtnText: {
        fontWeight: '700',
        fontSize: 16,
        color: '#ef4444',
    },
});
