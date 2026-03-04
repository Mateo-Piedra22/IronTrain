import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { routineService } from '@/src/services/RoutineService';
import { Colors } from '@/src/theme';
import { notify } from '@/src/utils/notify';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertCircle, Download } from 'lucide-react-native';
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
                // We use our shared public endpoint to fetch the JSON contents of the routine
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
            const newRoutineId = await routineService.importSharedRoutine(payload);
            notify.success('Rutina Importada', 'Se ha guardado en tus rutinas exitosamente.');
            router.dismissAll(); // close modal natively
            // Optionally redirect to the newly imported routine: 
            // router.push(`/routine/${newRoutineId}`);
        } catch (err: any) {
            notify.error('Fallo de Importación', err.message);
        } finally {
            setImporting(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaWrapper style={styles.screen} centered contentClassName="items-center justify-center">
                <ActivityIndicator size="large" color={Colors.primary.DEFAULT} />
                <Text style={styles.loadingText}>Conectando con IronTrain...</Text>
            </SafeAreaWrapper>
        );
    }

    if (error || !payload) {
        return (
            <SafeAreaWrapper style={styles.screen} centered contentClassName="items-center justify-center">
                <AlertCircle size={48} color={Colors.primary.DEFAULT} />
                <Text style={styles.errorTitle}>Rutina Inaccesible</Text>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={() => router.back()} style={styles.errorBtn}>
                    <Text style={styles.errorBtnText}>Volver</Text>
                </TouchableOpacity>
            </SafeAreaWrapper>
        );
    }

    const { routine, routine_days, routine_exercises, exercises } = payload;

    return (
        <SafeAreaWrapper style={styles.screen}>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.card}>
                    <Text style={styles.title}>{routine.name}</Text>
                    {routine.description && <Text style={styles.description}>{routine.description}</Text>}

                    <View style={styles.summaryRow}>
                        <View>
                            <Text style={styles.summaryLabel}>DÍAS</Text>
                            <Text style={styles.summaryValue}>{routine_days.length}</Text>
                        </View>
                        <View>
                            <Text style={styles.summaryLabel}>EJERCICIOS DISTINTOS</Text>
                            <Text style={styles.summaryValue}>{exercises.length}</Text>
                        </View>
                    </View>

                    <View style={styles.dayList}>
                        {routine_days.map((day: any) => {
                            const dayExercises = routine_exercises.filter((re: any) => re.routine_day_id === day.id);
                            return (
                                <View key={day.id} style={styles.dayRow}>
                                    <Text style={styles.dayName}>{day.name}</Text>
                                    <Text style={styles.dayCount}>{dayExercises.length} ej.</Text>
                                </View>
                            );
                        })}
                    </View>
                </View>

                <TouchableOpacity onPress={handleImport} disabled={importing} style={[styles.importBtn, importing && styles.importBtnLoading]}>
                    {importing ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <>
                            <Download size={20} color="white" />
                            <Text style={styles.importBtnText}>Importar Rutina</Text>
                        </>
                    )}
                </TouchableOpacity>

                <Text style={styles.helperText}>
                    IronTrain revisará los ejercicios para evitar duplicados en tu base de datos local automáticamente.
                </Text>
            </ScrollView>
        </SafeAreaWrapper>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    content: {
        padding: 24,
        paddingBottom: 32,
    },
    loadingText: {
        marginTop: 16,
        color: Colors.iron[500],
        fontSize: 12,
        fontWeight: '600',
    },
    errorTitle: {
        marginTop: 16,
        color: Colors.iron[950],
        fontSize: 18,
        fontWeight: '800',
    },
    errorText: {
        marginTop: 8,
        color: Colors.iron[500],
        textAlign: 'center',
    },
    errorBtn: {
        marginTop: 24,
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: Colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    errorBtnText: {
        color: Colors.iron[950],
        fontWeight: '800',
        textTransform: 'uppercase',
        fontSize: 12,
        letterSpacing: 0.6,
    },
    card: {
        backgroundColor: Colors.surface,
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: Colors.iron[950],
        marginBottom: 8,
    },
    description: {
        fontSize: 14,
        color: Colors.iron[500],
        marginBottom: 16,
    },
    summaryRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 16,
    },
    summaryLabel: {
        fontSize: 10,
        color: Colors.iron[400],
        fontWeight: '800',
        letterSpacing: 0.6,
    },
    summaryValue: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.iron[800],
    },
    dayList: {
        gap: 8,
    },
    dayRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    dayName: {
        color: Colors.iron[800],
        fontWeight: '700',
    },
    dayCount: {
        color: Colors.iron[400],
        fontSize: 12,
    },
    importBtn: {
        backgroundColor: Colors.primary.DEFAULT,
        padding: 18,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    importBtnLoading: {
        opacity: 0.7,
    },
    importBtnText: {
        color: 'white',
        fontWeight: '800',
        fontSize: 14,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    helperText: {
        color: Colors.iron[400],
        fontSize: 12,
        textAlign: 'center',
        marginTop: 16,
        paddingHorizontal: 24,
    },
});
