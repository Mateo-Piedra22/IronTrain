import { IronButton } from '@/components/IronButton';
import { BadgePill } from '@/components/ui/BadgePill';
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

    const { routine, routine_days, routine_exercises, exercises, badges, exercise_badges } = payload;

    return (
        <SafeAreaWrapper style={styles.screen} edges={['top', 'bottom']}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Custom Floating Header Style (Matching Changelog) */}
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <ChevronLeft size={20} color={Colors.iron[950]} />
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.pageTitle}>Vista Previa</Text>
                        <Text style={styles.pageSub}>IMPORTAR RUTINA</Text>
                    </View>
                </View>

                {/* Hero Info Section */}
                <View style={styles.heroSection}>
                    <View style={styles.titleRow}>
                        <View style={styles.routineIconBox}>
                            <Dumbbell color={Colors.primary.DEFAULT} size={24} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.title}>{routine.name}</Text>
                            <Text style={styles.subtitle}>IronTrain Share</Text>
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
                <Text style={styles.sectionLabel}>Plan de Entrenamiento</Text>

                <View style={styles.dayList}>
                    {routine_days.sort((a: any, b: any) => a.order_index - b.order_index).map((day: any) => {
                        const dayExercises = routine_exercises.filter((re: any) => re.routine_day_id === day.id);
                        return (
                            <View key={day.id} style={styles.dayBlock}>
                                <View style={styles.dayHeader}>
                                    <View style={styles.dayIconBox}>
                                        <Calendar color={Colors.primary.DEFAULT} size={18} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.dayTitle}>{day.name}</Text>
                                        <Text style={styles.daySubLabel}>{dayExercises.length} EJERCICIOS</Text>
                                    </View>
                                </View>
                                <View style={styles.dayInnerContent}>
                                    {dayExercises.length === 0 ? (
                                        <Text style={styles.emptyText}>Sin ejercicios definidos</Text>
                                    ) : (
                                        dayExercises.sort((a: any, b: any) => a.order_index - b.order_index).map((re: any, idx: number) => {
                                            const ex = exercises.find((e: any) => e.id === re.exercise_id);
                                            // Get relevant badges for this exercise
                                            const relBadges = (exercise_badges || [])
                                                .filter((eb: any) => eb.exercise_id === ex?.id)
                                                .map((eb: any) => badges?.find((b: any) => b.id === eb.badge_id))
                                                .filter(Boolean);

                                            return (
                                                <View key={re.id} style={styles.exCard}>
                                                    <View style={styles.exInfo}>
                                                        <Text style={styles.exNumber}>{idx + 1}</Text>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={styles.exName} numberOfLines={1}>{ex?.name || 'Ejercicio'}</Text>
                                                            {relBadges.length > 0 && (
                                                                <View style={styles.badgeRow}>
                                                                    {relBadges.map((b: any) => (
                                                                        <BadgePill key={b.id} name={b.name} color={b.color} icon={b.icon} size="sm" variant="minimal" />
                                                                    ))}
                                                                </View>
                                                            )}
                                                        </View>
                                                    </View>
                                                    {re.notes && (
                                                        <View style={styles.exNotesHeader}>
                                                            <Text style={styles.exNotesText} numberOfLines={1}>
                                                                {re.notes}
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                            );
                                        })
                                    )}
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* Import Section */}
                <View style={styles.actionSection}>
                    <View style={styles.helperCard}>
                        <Info size={14} color={Colors.primary.DEFAULT} />
                        <Text style={styles.helperText}>
                            La rutina y sus ejercicios personalizados se importarán a tu biblioteca local.
                        </Text>
                    </View>

                    <IronButton
                        label={importing ? "Importando..." : "Confirmar Importación"}
                        onPress={handleImport}
                        disabled={importing}
                        loading={importing}
                        style={{ height: 60 }}
                    />

                    <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn}>
                        <Text style={styles.cancelBtnText}>Volver a la app</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaWrapper>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: Colors.iron[900],
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    content: {
        padding: 20,
        paddingBottom: 60,
    },
    loadingText: {
        marginTop: 16,
        color: Colors.iron[500],
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    // Floating Header Style
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginBottom: 24,
        paddingHorizontal: 4,
    },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: Colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.iron[300],
        elevation: 2,
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    pageTitle: {
        color: Colors.iron[950],
        fontWeight: '900',
        fontSize: 24,
        letterSpacing: -1,
    },
    pageSub: {
        color: Colors.primary.DEFAULT,
        fontSize: 10,
        fontWeight: '900',
        marginTop: 2,
        letterSpacing: 1.2,
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
        borderColor: Colors.iron[300],
    },
    errorBtnText: {
        color: Colors.iron[950],
        fontWeight: '900',
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
        shadowColor: Colors.black,
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
        backgroundColor: Colors.surface,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.iron[300],
        overflow: 'hidden',
    },
    dayHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        backgroundColor: Colors.iron[100],
        borderBottomWidth: 1,
        borderBottomColor: Colors.iron[300],
        gap: 12,
    },
    dayIconBox: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: Colors.primary.DEFAULT + '10',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: Colors.iron[950],
    },
    daySubLabel: {
        fontSize: 9,
        fontWeight: '800',
        color: Colors.iron[400],
        letterSpacing: 0.5,
        marginTop: -1,
    },
    dayInnerContent: {
        padding: 12,
        gap: 10,
    },
    exCard: {
        backgroundColor: Colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.iron[200],
        padding: 12,
    },
    exInfo: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    exNumber: {
        fontSize: 10,
        fontWeight: '900',
        color: Colors.primary.DEFAULT,
        backgroundColor: Colors.primary.DEFAULT + '15',
        width: 20,
        height: 20,
        borderRadius: 6,
        textAlign: 'center',
        lineHeight: 20,
        overflow: 'hidden',
    },
    exName: {
        fontSize: 14,
        fontWeight: '900',
        color: Colors.iron[950],
        marginBottom: 4,
    },
    badgeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        marginTop: 2,
    },
    exNotesHeader: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: Colors.iron[100],
    },
    exNotesText: {
        fontSize: 12,
        color: Colors.iron[400],
        fontStyle: 'italic',
    },
    emptyText: {
        fontSize: 13,
        color: Colors.iron[400],
        fontStyle: 'italic',
        textAlign: 'center',
        paddingVertical: 10,
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
        padding: 14,
        borderRadius: 14,
        marginBottom: 8,
    },
    helperText: {
        flex: 1,
        fontSize: 12,
        color: Colors.iron[600],
        fontWeight: '700',
        lineHeight: 18,
    },
    cancelBtn: {
        alignItems: 'center',
        paddingVertical: 12,
        marginTop: 8,
    },
    cancelBtnText: {
        color: Colors.iron[500],
        fontWeight: '800',
        fontSize: 13,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
});
