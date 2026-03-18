import { ExerciseList } from '@/components/ExerciseList';
import { BadgePill } from '@/components/ui/BadgePill';
import { AnalysisService, PowerliftingPRs } from '@/src/services/AnalysisService';
import { configService } from '@/src/services/ConfigService';
import { ThemeFx, withAlpha } from '@/src/theme';
import { AlertCircle, Crown, Info, Plus, Settings2, Trophy, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '../src/hooks/useColors';

export function PRCenter() {
    const colors = useColors();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showInfo, setShowInfo] = useState(false);
    const [isConfiguring, setIsConfiguring] = useState(false);
    const [selectingSlot, setSelectingSlot] = useState<number | null>(null);

    const [data, setData] = useState<PowerliftingPRs>({
        squat: null, bench: null, deadlift: null, totalKg: 0,
        squatName: null, benchName: null, deadliftName: null,
    });

    const manualIds = (configService.get('trophyExerciseIds') || [null, null, null]) as (string | null)[];

    useEffect(() => {
        loadPRs();
    }, []);

    const loadPRs = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const currentManualIds = configService.get('trophyExerciseIds');
            const prs = await AnalysisService.getPowerliftingPRs(currentManualIds);
            setData(prs);
        } catch (e: any) {
            setError(e?.message ?? 'No se pudieron cargar los PRs');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectExercise = async (id: string) => {
        if (selectingSlot === null) return;

        const newIds = [...manualIds];
        // Ensure we have 3 slots
        while (newIds.length < 3) newIds.push(null);
        newIds[selectingSlot] = id;

        await configService.set('trophyExerciseIds', newIds);
        setSelectingSlot(null);
        loadPRs();
    };

    const handleClearSlot = async (index: number) => {
        const newIds = [...manualIds];
        while (newIds.length < 3) newIds.push(null);
        newIds[index] = null;
        await configService.set('trophyExerciseIds', newIds);
        loadPRs();
    };

    const liftData = useMemo(() => [
        { label: manualIds[0] ? (data.squatName?.toUpperCase() || 'SLOT 1') : 'SQUAT', value: data.squat?.weight ?? 0, color: colors.red, name: manualIds[0] ? null : data.squatName },
        { label: manualIds[1] ? (data.benchName?.toUpperCase() || 'SLOT 2') : 'BENCH', value: data.bench?.weight ?? 0, color: colors.blue, name: manualIds[1] ? null : data.benchName },
        { label: manualIds[2] ? (data.deadliftName?.toUpperCase() || 'SLOT 3') : 'DEADLIFT', value: data.deadlift?.weight ?? 0, color: colors.yellow, name: manualIds[2] ? null : data.deadliftName },
    ], [data, colors, manualIds]);

    const maxLift = Math.max(...liftData.map(l => l.value), 1);
    const someDetected = liftData.some(l => l.value > 0 || l.name != null);
    const noneDetected = !someDetected;

    const styles = useMemo(() => StyleSheet.create({
        container: {
            backgroundColor: colors.surface,
            borderRadius: 24,
            borderWidth: 1.5,
            borderColor: withAlpha(colors.yellow, '30'),
            padding: 20,
            marginBottom: 16,
            ...ThemeFx.shadowSm,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
        },
        headerRight: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10
        },
        headerLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        trophyCircle: {
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: withAlpha(colors.yellow, '15'),
            borderWidth: 1.5,
            borderColor: withAlpha(colors.yellow, '30'),
            justifyContent: 'center',
            alignItems: 'center',
        },
        title: {
            fontSize: 18,
            fontWeight: '900',
            color: colors.yellow,
            letterSpacing: -0.3,
        },
        subtitle: {
            fontSize: 11,
            fontWeight: '700',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            marginTop: 2,
        },
        iconButton: {
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.surfaceLighter,
            borderWidth: 1.5,
            borderColor: colors.border,
            justifyContent: 'center',
            alignItems: 'center',
        },
        totalBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: withAlpha(colors.yellow, '15'),
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: withAlpha(colors.yellow, '30'),
            // Fix: In light theme, the shadow creates a weird inner effect
            ...(colors.isDark ? ThemeFx.shadowSm : {}),
        },
        totalValue: {
            fontSize: 18,
            fontWeight: '900',
            color: colors.yellow,
        },
        totalUnit: {
            fontSize: 11,
            fontWeight: '800',
            color: colors.textMuted,
            textTransform: 'uppercase',
        },
        infoPanel: {
            backgroundColor: withAlpha(colors.yellow, '08'),
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: withAlpha(colors.yellow, '20'),
            padding: 16,
            marginBottom: 16,
        },
        infoPanelHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 10,
        },
        infoPanelTitle: {
            fontSize: 14,
            fontWeight: '900',
            color: colors.yellow,
        },
        infoPanelText: {
            fontSize: 12,
            color: colors.textMuted,
            lineHeight: 18,
            fontWeight: '600',
            marginBottom: 12,
        },
        detectionList: {
            gap: 8,
        },
        detectionRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: colors.surface,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: withAlpha(colors.yellow, '10'),
        },
        detectionDot: {
            width: 10,
            height: 10,
            borderRadius: 5,
        },
        detectionLabel: {
            fontSize: 11,
            fontWeight: '900',
            color: colors.textMuted,
            width: 75,
        },
        detectionValue: {
            fontSize: 12,
            fontWeight: '700',
            flex: 1,
        },
        infoPanelHint: {
            fontSize: 11,
            color: colors.textMuted,
            marginTop: 12,
            fontStyle: 'italic',
            lineHeight: 16,
            fontWeight: '600',
        },
        emptyState: {
            alignItems: 'center',
            paddingVertical: 24,
            gap: 8,
            backgroundColor: colors.surfaceLighter,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        emptyTitle: {
            color: colors.textMuted,
            fontWeight: '900',
            fontSize: 14,
        },
        emptyMessage: {
            color: colors.textMuted,
            fontSize: 12,
            textAlign: 'center',
            lineHeight: 18,
            paddingHorizontal: 20,
            fontWeight: '600'
        },
        loadingContainer: {
            paddingVertical: 40,
            alignItems: 'center',
            justifyContent: 'center',
        },
        loadingText: {
            color: colors.textMuted,
            marginTop: 12,
            fontSize: 13,
            fontWeight: '700',
        },
        errorContainer: {
            paddingVertical: 24,
            alignItems: 'center'
        },
        errorText: {
            color: colors.red,
            fontWeight: '700'
        },
        liftsContainer: {
            backgroundColor: colors.surfaceLighter,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: colors.border,
            overflow: 'hidden',
        },
        liftRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 18,
        },
        liftRowBorder: {
            borderBottomWidth: 1.5,
            borderBottomColor: colors.border,
        },
        liftInfo: {
            flexDirection: 'row',
            alignItems: 'center',
            width: 110,
            gap: 10,
        },
        liftDot: {
            width: 10,
            height: 10,
            borderRadius: 5,
        },
        liftLabel: {
            fontSize: 12,
            fontWeight: '900',
            color: colors.text,
            letterSpacing: 0.5,
        },
        liftExName: {
            fontSize: 10,
            fontWeight: '600',
            color: colors.textMuted,
            marginTop: 2,
        },
        liftBadges: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 4,
            marginTop: 6
        },
        liftBarTrack: {
            flex: 1,
            height: 10,
            backgroundColor: colors.border,
            borderRadius: 5,
            overflow: 'hidden',
            marginHorizontal: 16,
        },
        liftBarFill: {
            height: '100%',
            borderRadius: 5,
        },
        liftValueContainer: {
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: 2,
            width: 65,
            justifyContent: 'flex-end',
        },
        liftValue: {
            fontSize: 20,
            fontWeight: '900',
            color: colors.text,
        },
        liftUnit: {
            fontSize: 11,
            fontWeight: '800',
            color: colors.textMuted,
        },
        configSlot: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.surface,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: colors.border,
            marginBottom: 8,
        },
        configLabel: {
            fontSize: 12,
            fontWeight: '900',
            color: colors.textMuted,
        },
        configValue: {
            fontSize: 13,
            fontWeight: '700',
            color: colors.text,
            flex: 1,
            marginHorizontal: 10,
        },
        // Modal Sheet Styles
        modalSheet: {
            flex: 1,
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            overflow: 'hidden',
        },
        modalHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderBottomWidth: 1.5,
            borderBottomColor: colors.border,
        },
        modalHeaderContent: {
            flex: 1,
        },
        modalTitle: {
            fontSize: 18,
            fontWeight: '900',
            color: colors.text,
        },
        modalSub: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.textMuted,
            marginTop: 2,
        },
        closeBtn: {
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.surfaceLighter,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1.5,
            borderColor: colors.border,
        },
    }), [colors]);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={styles.trophyCircle}>
                        <Trophy size={20} color={colors.yellow} />
                    </View>
                    <View>
                        <Text style={styles.title}>Sala de Trofeos</Text>
                        <Text style={styles.subtitle}>{isConfiguring ? 'Configurar Trofeos' : 'Powerlifting Total'}</Text>
                    </View>
                </View>
                <View style={styles.headerRight}>
                    <TouchableOpacity
                        onPress={() => setIsConfiguring(!isConfiguring)}
                        style={[styles.iconButton, isConfiguring && { borderColor: colors.yellow }]}
                    >
                        <Settings2 size={16} color={isConfiguring ? colors.yellow : colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setShowInfo(!showInfo)}
                        style={styles.iconButton}
                        accessibilityRole="button"
                        accessibilityLabel="Info sobre sala de trofeos"
                    >
                        <Info size={16} color={showInfo ? colors.yellow : colors.textMuted} />
                    </TouchableOpacity>
                    <View style={styles.totalBadge}>
                        <Crown size={14} color={colors.yellow} />
                        <Text style={styles.totalValue}>{data.totalKg}</Text>
                        <Text style={styles.totalUnit}>kg</Text>
                    </View>
                </View>
            </View>

            {/* Config Mode */}
            {isConfiguring && (
                <View style={{ marginBottom: 16 }}>
                    <Text style={[styles.infoPanelText, { marginBottom: 8 }]}>
                        Selecciona hasta 3 ejercicios para mostrar. Si dejas alguno vacío, se usará la detección automática.
                    </Text>
                    {[0, 1, 2].map((i) => {
                        const exName = manualIds[i] ? data[(['squatName', 'benchName', 'deadliftName'] as const)[i]] : null;
                        return (
                            <View key={i} style={styles.configSlot}>
                                <Text style={styles.configLabel}>Trof. {i + 1}</Text>
                                <Text style={styles.configValue} numberOfLines={1}>
                                    {exName || 'Automático'}
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 6 }}>
                                    {manualIds[i] && (
                                        <TouchableOpacity onPress={() => handleClearSlot(i)} style={styles.iconButton}>
                                            <X size={14} color={colors.red} />
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity onPress={() => setSelectingSlot(i)} style={styles.iconButton}>
                                        <Plus size={14} color={colors.primary.DEFAULT} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}

            {/* Info Panel */}
            {showInfo && (
                <View style={styles.infoPanel}>
                    <View style={styles.infoPanelHeader}>
                        <AlertCircle size={16} color={colors.yellow} />
                        <Text style={styles.infoPanelTitle}>¿Cómo funciona?</Text>
                    </View>
                    <Text style={styles.infoPanelText}>
                        Detecta automáticamente tus ejercicios de Squat, Bench Press y Deadlift, mostrará tu mayor récord histórico.
                        Puedes cambiar estos ejercicios desde el icono de configuración.
                    </Text>
                    <View style={styles.detectionList}>
                        {liftData.map((l) => (
                            <View key={l.label} style={styles.detectionRow}>
                                <View style={[styles.detectionDot, { backgroundColor: l.color }]} />
                                <Text style={styles.detectionLabel}>{l.label}:</Text>
                                <Text style={[
                                    styles.detectionValue,
                                    { color: l.name ? colors.text : colors.textMuted }
                                ]}>
                                    {l.name ?? 'No detectado'}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator color={colors.primary.DEFAULT} />
                    <Text style={styles.loadingText}>Calculando PRs...</Text>
                </View>
            ) : error ? (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : noneDetected ? (
                <View style={styles.emptyState}>
                    <Trophy size={32} color={colors.textMuted} />
                    <Text style={styles.emptyTitle}>Sin ejercicios detectados</Text>
                    <Text style={styles.emptyMessage}>
                        Agrega ejercicios descriptivos o selecciónalos manualmente desde configuración.
                    </Text>
                </View>
            ) : (
                <View style={styles.liftsContainer}>
                    {liftData.map((lift, idx) => {
                        const pct = Math.round((lift.value / maxLift) * 100);
                        return (
                            <View key={lift.label} style={[styles.liftRow, idx < liftData.length - 1 && styles.liftRowBorder]}>
                                <View style={styles.liftInfo}>
                                    <View style={[styles.liftDot, { backgroundColor: lift.color }]} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.liftLabel}>{lift.label}</Text>
                                        {lift.name && (
                                            <Text style={styles.liftExName} numberOfLines={1}>{lift.name}</Text>
                                        )}
                                        <View style={styles.liftBadges}>
                                            {(data[lift.label.toLowerCase() as keyof typeof data] as any)?.badges?.map((b: any, i: number) => (
                                                <BadgePill key={i} name={b.name} color={b.color} icon={b.icon} size="xs" />
                                            ))}
                                        </View>
                                    </View>
                                </View>
                                <View style={styles.liftBarTrack}>
                                    <View
                                        style={[styles.liftBarFill, {
                                            width: `${pct}%`,
                                            backgroundColor: lift.color,
                                            opacity: 0.8,
                                        }]}
                                    />
                                </View>
                                <View style={styles.liftValueContainer}>
                                    <Text style={styles.liftValue}>{lift.value}</Text>
                                    <Text style={styles.liftUnit}>kg</Text>
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}

            {/* Exercise Picker Modal */}
            {selectingSlot !== null && (
                <Modal visible transparent animationType="slide" onRequestClose={() => setSelectingSlot(null)}>
                    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: ThemeFx.backdropStrong }}>
                        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                            <GestureHandlerRootView style={{ flex: 1 }}>
                                <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                                    <View style={styles.modalSheet}>
                                        <View style={styles.modalHeader}>
                                            <View style={styles.modalHeaderContent}>
                                                <Text style={styles.modalTitle}>Trof. {selectingSlot + 1}: Seleccionar</Text>
                                                <Text style={styles.modalSub}>Elegí el ejercicio que querés trackear en este espacio.</Text>
                                            </View>
                                            <TouchableOpacity onPress={() => setSelectingSlot(null)} style={styles.closeBtn}>
                                                <X size={18} color={colors.text} />
                                            </TouchableOpacity>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <ExerciseList onSelect={handleSelectExercise} inModal />
                                        </View>
                                    </View>
                                </View>
                            </GestureHandlerRootView>
                        </KeyboardAvoidingView>
                    </SafeAreaView>
                </Modal>
            )}
        </View>
    );
}
