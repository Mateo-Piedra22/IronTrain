import { BadgePill } from '@/components/ui/BadgePill';
import { AnalysisService, PowerliftingPRs } from '@/src/services/AnalysisService';
import { Colors } from '@/src/theme';
import { AlertCircle, Crown, Info, Trophy } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export function PRCenter() {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showInfo, setShowInfo] = useState(false);
    const [data, setData] = useState<PowerliftingPRs>({
        squat: null, bench: null, deadlift: null, totalKg: 0,
        squatName: null, benchName: null, deadliftName: null,
    });

    useEffect(() => {
        loadPRs();
    }, []);

    const loadPRs = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const prs = await AnalysisService.getPowerliftingPRs();
            setData(prs);
        } catch (e: any) {
            setError(e?.message ?? 'No se pudieron cargar los PRs');
        } finally {
            setIsLoading(false);
        }
    };

    const liftData = [
        { label: 'SQUAT', value: data.squat?.weight ?? 0, color: '#ef4444', name: data.squatName },
        { label: 'BENCH', value: data.bench?.weight ?? 0, color: '#3b82f6', name: data.benchName },
        { label: 'DEADLIFT', value: data.deadlift?.weight ?? 0, color: '#f59e0b', name: data.deadliftName },
    ];

    const maxLift = Math.max(...liftData.map(l => l.value), 1);
    const allDetected = liftData.every(l => l.name != null);
    const noneDetected = liftData.every(l => l.name == null);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={styles.trophyCircle}>
                        <Trophy size={18} color="#f59e0b" />
                    </View>
                    <View>
                        <Text style={styles.title}>Sala de Trofeos</Text>
                        <Text style={styles.subtitle}>Powerlifting Total</Text>
                    </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity
                        onPress={() => setShowInfo(!showInfo)}
                        style={styles.infoButton}
                        accessibilityRole="button"
                        accessibilityLabel="Info sobre sala de trofeos"
                    >
                        <Info size={14} color={showInfo ? '#f59e0b' : Colors.iron[400]} />
                    </TouchableOpacity>
                    <View style={styles.totalBadge}>
                        <Crown size={12} color="#f59e0b" />
                        <Text style={styles.totalValue}>{data.totalKg}</Text>
                        <Text style={styles.totalUnit}>kg</Text>
                    </View>
                </View>
            </View>

            {/* Info Panel */}
            {showInfo && (
                <View style={styles.infoPanel}>
                    <View style={styles.infoPanelHeader}>
                        <AlertCircle size={14} color="#f59e0b" />
                        <Text style={styles.infoPanelTitle}>¿Cómo funciona?</Text>
                    </View>
                    <Text style={styles.infoPanelText}>
                        Esta sección detecta automáticamente tus ejercicios de Squat, Bench Press y Deadlift por nombre
                        y muestra tu mayor peso registrado en cada uno.
                    </Text>
                    <View style={styles.detectionList}>
                        {liftData.map((l) => (
                            <View key={l.label} style={styles.detectionRow}>
                                <View style={[styles.detectionDot, { backgroundColor: l.color }]} />
                                <Text style={styles.detectionLabel}>{l.label}:</Text>
                                <Text style={[
                                    styles.detectionValue,
                                    { color: l.name ? Colors.iron[950] : Colors.iron[400] }
                                ]}>
                                    {l.name ?? 'No detectado'}
                                </Text>
                            </View>
                        ))}
                    </View>
                    {!allDetected && (
                        <Text style={styles.infoPanelHint}>
                            💡 Tip: Para que funcione, tus ejercicios deben contener nombres como "Sentadilla", "Press Banca" o "Peso Muerto".
                        </Text>
                    )}
                </View>
            )}

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator color={Colors.primary.DEFAULT} />
                    <Text style={styles.loadingText}>Calculando PRs...</Text>
                </View>
            ) : error ? (
                <View style={{ paddingVertical: 24 }}>
                    <Text style={{ color: Colors.iron[500] }}>{error}</Text>
                </View>
            ) : noneDetected ? (
                <View style={styles.emptyState}>
                    <Trophy size={24} color={Colors.iron[300]} />
                    <Text style={styles.emptyTitle}>Sin ejercicios detectados</Text>
                    <Text style={styles.emptyMessage}>
                        Agrega ejercicios con nombres como "Sentadilla", "Press Banca" o "Peso Muerto" para ver tu total.
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
                                    <View>
                                        <Text style={styles.liftLabel}>{lift.label}</Text>
                                        {lift.name && (
                                            <Text style={styles.liftExName} numberOfLines={1}>{lift.name}</Text>
                                        )}
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginTop: 2 }}>
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#f59e0b30',
        padding: 20,
        marginBottom: 12,
        elevation: 3,
        shadowColor: '#f59e0b',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    trophyCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#f59e0b15',
        borderWidth: 1,
        borderColor: '#f59e0b30',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 16,
        fontWeight: '900',
        color: '#f59e0b',
        letterSpacing: -0.3,
    },
    subtitle: {
        fontSize: 10,
        fontWeight: '600',
        color: Colors.iron[400],
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    infoButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: Colors.iron[200],
        borderWidth: 1,
        borderColor: Colors.iron[300],
        justifyContent: 'center',
        alignItems: 'center',
    },
    totalBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#f59e0b15',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#f59e0b30',
    },
    totalValue: {
        fontSize: 18,
        fontWeight: '900',
        color: '#f59e0b',
    },
    totalUnit: {
        fontSize: 10,
        fontWeight: '700',
        color: '#b45309',
        textTransform: 'uppercase',
    },

    // Info Panel
    infoPanel: {
        backgroundColor: '#f59e0b08',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#f59e0b20',
        padding: 14,
        marginBottom: 16,
    },
    infoPanelHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    infoPanelTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#f59e0b',
    },
    infoPanelText: {
        fontSize: 12,
        color: Colors.iron[500],
        lineHeight: 18,
        marginBottom: 10,
    },
    detectionList: {
        gap: 6,
    },
    detectionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    detectionDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    detectionLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: Colors.iron[500],
        width: 70,
    },
    detectionValue: {
        fontSize: 12,
        fontWeight: '600',
        flex: 1,
    },
    infoPanelHint: {
        fontSize: 11,
        color: Colors.iron[400],
        marginTop: 10,
        fontStyle: 'italic',
        lineHeight: 16,
    },

    // Empty state
    emptyState: {
        alignItems: 'center',
        paddingVertical: 20,
        gap: 6,
    },
    emptyTitle: {
        color: Colors.iron[500],
        fontWeight: '800',
        fontSize: 13,
    },
    emptyMessage: {
        color: Colors.iron[400],
        fontSize: 11,
        textAlign: 'center',
        lineHeight: 16,
    },

    // Loading
    loadingContainer: {
        paddingVertical: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: Colors.iron[500],
        marginTop: 12,
        fontSize: 12,
    },

    // Lifts
    liftsContainer: {
        backgroundColor: Colors.iron[200],
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.iron[300],
        overflow: 'hidden',
    },
    liftRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 14,
    },
    liftRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: Colors.iron[300],
    },
    liftInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        width: 100,
        gap: 8,
    },
    liftDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    liftLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: Colors.iron[500],
        letterSpacing: 0.5,
    },
    liftExName: {
        fontSize: 9,
        fontWeight: '500',
        color: Colors.iron[400],
        marginTop: 1,
    },
    liftBarTrack: {
        flex: 1,
        height: 8,
        backgroundColor: Colors.iron[300],
        borderRadius: 4,
        overflow: 'hidden',
        marginHorizontal: 12,
    },
    liftBarFill: {
        height: '100%',
        borderRadius: 4,
        opacity: 0.75,
    },
    liftValueContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 2,
        width: 56,
        justifyContent: 'flex-end',
    },
    liftValue: {
        fontSize: 18,
        fontWeight: '900',
        color: Colors.iron[950],
    },
    liftUnit: {
        fontSize: 10,
        fontWeight: '600',
        color: Colors.iron[400],
    },
});
