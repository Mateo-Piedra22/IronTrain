import { useColors } from '@/src/hooks/useColors';
import { withAlpha } from '@/src/theme';
import { AlertCircle, RefreshCw, X } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SyncingOverlayProps {
    visible: boolean;
    error: string | null;
    onRetry: () => void;
    onCancel: () => void;
}

export const SyncingOverlay: React.FC<SyncingOverlayProps> = ({ visible, error, onRetry, onCancel }) => {
    const colors = useColors();

    if (!visible && !error) return null;

    return (
        <Modal transparent visible={visible || !!error} animationType="fade">
            <View style={[styles.container, { backgroundColor: withAlpha(colors.background, '80') }]}>
                <View style={[styles.content, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {error ? (
                        <>
                            <View style={[styles.iconContainer, { backgroundColor: withAlpha(colors.red, '10') }]}>
                                <AlertCircle size={32} color={colors.red} />
                            </View>
                            <Text style={[styles.title, { color: colors.text }]}>Error de Sincronización</Text>
                            <Text style={[styles.message, { color: colors.textMuted }]}>{error}</Text>

                            <View style={styles.buttonRow}>
                                <TouchableOpacity
                                    style={[styles.button, styles.cancelButton, { borderColor: colors.border }]}
                                    onPress={onCancel}
                                >
                                    <X size={16} color={colors.textMuted} />
                                    <Text style={[styles.buttonText, { color: colors.textMuted }]}>Omitir</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.button, styles.retryButton, { backgroundColor: colors.primary.DEFAULT }]}
                                    onPress={onRetry}
                                >
                                    <RefreshCw size={16} color={colors.onPrimary} />
                                    <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Reintentar</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        <>
                            <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
                            <Text style={[styles.title, { color: colors.text, marginTop: 16 }]}>Sincronizando...</Text>
                            <Text style={[styles.message, { color: colors.textMuted }]}>
                                Estamos preparando tu entrenamiento. Esto solo tomará unos segundos.
                            </Text>
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    content: {
        padding: 32,
        borderRadius: 24,
        borderWidth: 1.5,
        width: '100%',
        alignItems: 'center',
        shadowColor: "transparent", // No hardcoded black shadow, use border or theme if needed
        elevation: 0,
    },
    iconContainer: {
        padding: 16,
        borderRadius: 20,
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '900',
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    message: {
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 24,
        lineHeight: 20,
        fontWeight: '600',
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    button: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    cancelButton: {
        borderWidth: 1.5,
    },
    retryButton: {},
    buttonText: {
        fontWeight: '900',
        fontSize: 14,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
});
