import { CloudDownload, CloudUpload, Merge, X } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '../src/hooks/useColors';
import { SyncDiagnostics, syncService } from '../src/services/SyncService';
import { ThemeFx, withAlpha } from '../src/theme';
import { logger } from '../src/utils/logger';
import { notify } from '../src/utils/notify';
import { SyncingOverlay } from './ui/SyncingOverlay';

interface SyncConflictModalProps {
    visible: boolean;
    onClose: () => void;
    diagnostics: SyncDiagnostics | null;
    onComplete: () => void;
}

export function SyncConflictModal({ visible, onClose, diagnostics, onComplete }: SyncConflictModalProps) {
    const colors = useColors();
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);

    const styles = useMemo(() => StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: ThemeFx.backdropStrong,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
        },
        container: {
            backgroundColor: colors.background,
            borderRadius: 24,
            width: '100%',
            maxHeight: '80%',
            borderWidth: 1.5,
            borderColor: colors.border,
            overflow: 'hidden',
        },
        header: {
            padding: 20,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: colors.surface,
        },
        title: {
            fontSize: 18,
            fontWeight: '900',
            color: colors.text,
        },
        content: {
            padding: 20,
        },
        summaryText: {
            fontSize: 14,
            color: colors.textMuted,
            lineHeight: 20,
            marginBottom: 20,
        },
        statsContainer: {
            flexDirection: 'row',
            gap: 12,
            marginBottom: 24,
        },
        statBox: {
            flex: 1,
            padding: 12,
            borderRadius: 16,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
        },
        statLabel: {
            fontSize: 11,
            fontWeight: '800',
            color: colors.textMuted,
            textTransform: 'uppercase',
            marginBottom: 4,
        },
        statValue: {
            fontSize: 18,
            fontWeight: '900',
            color: colors.text,
        },
        optionsContainer: {
            gap: 12,
        },
        optionCard: {
            padding: 16,
            borderRadius: 16,
            backgroundColor: colors.surface,
            borderWidth: 1.5,
            borderColor: colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
        },
        optionIcon: {
            width: 44,
            height: 44,
            borderRadius: 12,
            justifyContent: 'center',
            alignItems: 'center',
        },
        optionInfo: {
            flex: 1,
        },
        optionTitle: {
            fontSize: 15,
            fontWeight: '800',
            color: colors.text,
        },
        optionSub: {
            fontSize: 12,
            color: colors.textMuted,
            marginTop: 2,
        },
    }), [colors]);

    const handleSync = async (mode: 'pull' | 'push' | 'merge') => {
        setSyncError(null);
        setIsSyncing(true);
        try {
            if (mode === 'pull') {
                await syncService.pullCloudSnapshot();
            } else if (mode === 'push') {
                await syncService.pushLocalSnapshot();
            } else {
                await syncService.syncBidirectional({ verify: true });
            }
            notify.success('Sincronización completa', 'Tus datos están actualizados.');
            setIsSyncing(false);
            onComplete();
        } catch (e: any) {
            logger.captureException(e, { scope: 'SyncConflictModal.handleSync', mode });
            setSyncError(e?.message || 'No se pudo completar la operación.');
            setIsSyncing(false);
        }
    };

    if (!diagnostics) return null;

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Conflicto de Sincronización</Text>
                        <TouchableOpacity onPress={onClose}>
                            <X size={20} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content}>
                        <Text style={styles.summaryText}>
                            Hemos detectado que tienes datos diferentes en la nube y en este dispositivo.
                            ¿Cómo deseas proceder?
                        </Text>

                        <View style={styles.statsContainer}>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>Local</Text>
                                <Text style={styles.statValue}>{diagnostics.local.recordCount}</Text>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>Nube</Text>
                                <Text style={styles.statValue}>{diagnostics.remote.recordCount}</Text>
                            </View>
                        </View>

                        <View style={styles.optionsContainer}>
                            <TouchableOpacity
                                style={styles.optionCard}
                                onPress={() => handleSync('pull')}
                            >
                                <View style={[styles.optionIcon, { backgroundColor: withAlpha(colors.primary.DEFAULT, '10') }]}>
                                    <CloudDownload size={22} color={colors.primary.DEFAULT} />
                                </View>
                                <View style={styles.optionInfo}>
                                    <Text style={styles.optionTitle}>Usar datos de la Nube</Text>
                                    <Text style={styles.optionSub}>Sobrescribe lo local con lo que hay en tu cuenta.</Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.optionCard}
                                onPress={() => handleSync('push')}
                            >
                                <View style={[styles.optionIcon, { backgroundColor: withAlpha('#f97316', '10') }]}>
                                    <CloudUpload size={22} color="#f97316" />
                                </View>
                                <View style={styles.optionInfo}>
                                    <Text style={styles.optionTitle}>Usar datos del Dispositivo</Text>
                                    <Text style={styles.optionSub}>Sube lo que tienes aquí a la nube (Sobrescribe nube).</Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.optionCard}
                                onPress={() => handleSync('merge')}
                            >
                                <View style={[styles.optionIcon, { backgroundColor: withAlpha(colors.green, '10') }]}>
                                    <Merge size={22} color={colors.green} />
                                </View>
                                <View style={styles.optionInfo}>
                                    <Text style={styles.optionTitle}>Combinar ambos (Merge)</Text>
                                    <Text style={styles.optionSub}>Intenta mezclar los datos de ambos sitios.</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </View>

            <SyncingOverlay
                visible={isSyncing}
                error={syncError}
                onRetry={() => {
                    setSyncError(null);
                    // mode is lost here, but we can't easily retry without knowing which button was pressed
                    // however, the overlay will stay open with the error so user can just dismiss and press button again
                }}
                onCancel={() => {
                    setIsSyncing(false);
                    setSyncError(null);
                }}
            />
        </Modal>
    );
}
