import { IronButton } from '@/components/IronButton';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { routineService } from '@/src/services/RoutineService';
import { Colors } from '@/src/theme';
import { notify } from '@/src/utils/notify';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertCircle, Calendar, ChevronLeft, Dumbbell, Info } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ShareRoutineScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const [payload, setPayload] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) {
            setError('ID de rutina inválido.');
            setLoading(false);
            return;
        }

        async function fetchRoutine() {
            try {
                const response = await fetch(`https://irontrain.motiona.xyz/api/share/routine/${id}`);

                if (!response.ok) {
                    if (response.status === 404) throw new Error('La rutina fue eliminada o no está disponible.');
                    throw new Error('No se pudo establecer conexión con IronTrain.');
                }

                const responseData = await response.json();
                if (!responseData.success) throw new Error(responseData.error || 'Error desconocido.');

                setPayload(responseData.data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchRoutine();
    }, [id]);

    const handleImport = async () => {
        if (!payload) return;
        setImporting(true);
        try {
            await routineService.importSharedRoutine(payload);
            notify.success('Rutina Importada', 'Se ha guardado en tus rutinas exitosamente.');
            router.dismissAll();
        } catch (err: any) {
            notify.error('Fallo de Importación', err.message);
        } finally {
            setImporting(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaWrapper style={styles.screen} edges={['top']}>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={Colors.primary.DEFAULT} />
                    <Text style={styles.loadingText}>Conectando con IronTrain...</Text>
                </View>
            </SafeAreaWrapper>
        );
    }

    if (error || !payload) {
        return (
            <SafeAreaWrapper style={styles.screen} edges={['top']}>
                <View style={styles.centered}>
                    <View style={styles.errorIconBox}>
                        <AlertCircle size={48} color={Colors.red} />
                    </View>
                    <Text style={styles.errorTitle}>Rutina Inaccesible</Text>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity onPress={() => router.back()} style={styles.errorBtn}>
                        <Text style={styles.errorBtnText}>Volver</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaWrapper>
        );
    }

    const { routine, routine_days, routine_exercises, exercises } = payload;

    return (
        <SafeAreaWrapper style={styles.screen} edges={['top', 'bottom']}>
            {/* Custom Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={24} color={Colors.iron[950]} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Vista Previa</Text>
                <View style={styles.headerActionSpace} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Hero Info Section */}
                <View style={styles.heroSection}>
                    <View style={styles.titleRow}>
                        <View style={styles.routineIconBox}>
                            <Dumbbell color={Colors.primary.DEFAULT} size={24} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.title}>{routine.name}</Text>
                            <Text style={styles.subtitle}>Rutina compartida vía IronTrain</Text>
                        </View>
                    </View>

                    {routine.description && (
                        <View style={styles.infoCard}>
                            <Info size={16} color={Colors.primary.DEFAULT} style={{ marginTop: 2 }} />
                            <Text style={styles.infoCardText}>{routine.description}</Text>
                        </View>
                    )}

                    <View style={styles.statsGrid}>
                        <View style={styles.statItem}>
                            <Calendar size={14} color={Colors.primary.DEFAULT} />
                            <Text style={styles.statValue}>{routine_days.length}</Text>
                            <Text style={styles.statLabel}>Días</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Dumbbell size={14} color={Colors.primary.DEFAULT} />
                            <Text style={styles.statValue}>{exercises.length}</Text>
                            <Text style={styles.statLabel}>Ejercicios</Text>
                        </View>
                    </View>
                </View>

                {/* Days Section */}
                <Text style={styles.sectionLabel}>Estructura de entrenamiento</Text>

                <View style={styles.dayList}>
                    {routine_days.map((day: any) => {
                        const dayExercises = routine_exercises.filter((re: any) => re.routine_day_id === day.id);
                        return (
                            <View key={day.id} style={styles.dayBlock}>
                                <View style={styles.dayHeader}>
                                    <View style={styles.dayIconBox}>
                                        <Calendar color={Colors.primary.DEFAULT} size={18} />
                                    </View>
                                    <Text style={styles.dayTitle}>{day.name}</Text>
                                    <View style={styles.dayBadge}>
                                        <Text style={styles.dayBadgeText}>{dayExercises.length} EJ.</Text>
                                    </View>
                                </View>
                                <View style={styles.dayInnerContent}>
                                    {dayExercises.length === 0 ? (
                                        <Text style={styles.emptyText}>Sin ejercicios definidos</Text>
                                    ) : (
                                        dayExercises.slice(0, 4).map((re: any, idx: number) => {
                                            const ex = exercises.find((e: any) => e.id === re.exercise_id);
                                            return (
                                                <View key={re.id} style={styles.exMiniRow}>
                                                    <Text style={styles.exNumber}>{idx + 1}.</Text>
                                                    <Text style={styles.exName} numberOfLines={1}>{ex?.name || 'Ejercicio'}</Text>
                                                </View>
                                            );
                                        })
                                    )}
                                    {dayExercises.length > 4 && (
                                        <Text style={styles.moreText}>+ {dayExercises.length - 4} ejercicios más...</Text>
                                    )}
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* Import Section */}
                <View style={styles.actionSection}>
                    <View style={styles.helperCard}>
                        <Info size={14} color={Colors.iron[400]} />
                        <Text style={styles.helperText}>
                            Los ejercicios se sincronizarán con tu biblioteca local automáticamente.
                        </Text>
                    </View>

                    <IronButton
                        label={importing ? "Importando..." : "Importar en mi librería"}
                        onPress={handleImport}
                        disabled={importing}
                        loading={importing}
                        style={{ marginTop: 8 }}
                    />

                    <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn}>
                        <Text style={styles.cancelBtnText}>Volver atrás</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaWrapper>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: Colors.iron[100],
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    loadingText: {
        marginTop: 16,
        color: Colors.iron[500],
        fontSize: 14,
        fontWeight: '600',
    },
    // Custom Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        height: 64,
        borderBottomWidth: 1,
        borderBottomColor: Colors.iron[200],
        backgroundColor: Colors.surface,
    },
    backBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 22,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: Colors.iron[950],
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    headerActionSpace: {
        width: 44,
    },
    errorIconBox: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.red + '10',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    errorTitle: {
        color: Colors.iron[950],
        fontSize: 22,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    errorText: {
        marginTop: 12,
        color: Colors.iron[500],
        textAlign: 'center',
        fontSize: 15,
        lineHeight: 22,
    },
    errorBtn: {
        marginTop: 32,
        paddingVertical: 14,
        paddingHorizontal: 32,
        backgroundColor: Colors.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    errorBtnText: {
        color: Colors.iron[950],
        fontWeight: '800',
        textTransform: 'uppercase',
        fontSize: 13,
        letterSpacing: 0.8,
    },

    // Hero Section
    heroSection: {
        backgroundColor: Colors.surface,
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: Colors.iron[300],
        marginBottom: 24,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginBottom: 16,
    },
    routineIconBox: {
        width: 52,
        height: 52,
        borderRadius: 16,
        backgroundColor: Colors.primary.DEFAULT + '10',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.primary.DEFAULT + '20',
    },
    title: {
        fontSize: 22,
        fontWeight: '900',
        color: Colors.iron[950],
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.iron[400],
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    infoCard: {
        backgroundColor: Colors.iron[100],
        padding: 14,
        borderRadius: 12,
        borderLeftWidth: 3,
        borderLeftColor: Colors.primary.DEFAULT,
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    infoCardText: {
        fontSize: 14,
        color: Colors.iron[600],
        lineHeight: 20,
        flex: 1,
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    statItem: {
        flex: 1,
        backgroundColor: Colors.iron[50],
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: Colors.iron[200],
        alignItems: 'center',
        gap: 2,
    },
    statValue: {
        fontSize: 18,
        fontWeight: '900',
        color: Colors.iron[950],
    },
    statLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: Colors.iron[400],
        textTransform: 'uppercase',
    },

    // Days list
    sectionLabel: {
        color: Colors.iron[400],
        fontSize: 11,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginBottom: 16,
        marginLeft: 4,
    },
    dayList: {
        gap: 16,
        marginBottom: 32,
    },
    dayBlock: {
        backgroundColor: Colors.white,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: Colors.iron[300],
        overflow: 'hidden',
    },
    dayHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        backgroundColor: Colors.iron[50],
        borderBottomWidth: 1,
        borderBottomColor: Colors.iron[200],
        gap: 12,
    },
    dayIconBox: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: Colors.primary.DEFAULT + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayTitle: {
        flex: 1,
        fontSize: 16,
        fontWeight: '900',
        color: Colors.iron[950],
    },
    dayBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: Colors.iron[200],
        borderRadius: 8,
    },
    dayBadgeText: {
        fontSize: 10,
        fontWeight: '900',
        color: Colors.iron[500],
    },
    dayInnerContent: {
        padding: 16,
    },
    exMiniRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 6,
    },
    exNumber: {
        fontSize: 12,
        fontWeight: '900',
        color: Colors.primary.DEFAULT,
        width: 18,
    },
    exName: {
        fontSize: 14,
        fontWeight: '800',
        color: Colors.iron[950],
        flex: 1,
    },
    moreText: {
        fontSize: 12,
        color: Colors.iron[400],
        fontStyle: 'italic',
        marginTop: 8,
    },
    emptyText: {
        fontSize: 13,
        color: Colors.iron[400],
        fontStyle: 'italic',
    },

    // Actions
    actionSection: {
        gap: 12,
    },
    helperCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: Colors.iron[200],
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
    },
    helperText: {
        flex: 1,
        fontSize: 11,
        color: Colors.iron[500],
        fontWeight: '600',
        lineHeight: 16,
    },
    cancelBtn: {
        alignItems: 'center',
        paddingVertical: 12,
        marginTop: 8,
    },
    cancelBtnText: {
        color: Colors.iron[400],
        fontWeight: '800',
        fontSize: 13,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
});
