import { routineService } from '@/src/services/RoutineService';
import { Colors } from '@/src/theme';
import { notify } from '@/src/utils/notify';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertCircle, Download } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';

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
                    throw new Error('No se pudo establecer conexión con IronHub.');
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
            <View style={{ flex: 1, backgroundColor: Colors.iron[900], justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={Colors.primary.DEFAULT} />
                <Text style={{ marginTop: 16, color: Colors.iron[500], fontFamily: 'mono' }}>Conectando con IronHub...</Text>
            </View>
        );
    }

    if (error || !payload) {
        return (
            <View style={{ flex: 1, backgroundColor: Colors.iron[900], padding: 24, justifyContent: 'center', alignItems: 'center' }}>
                <AlertCircle size={48} color={Colors.primary.DEFAULT} />
                <Text style={{ marginTop: 16, color: Colors.iron[950], fontSize: 18, fontWeight: 'bold' }}>Rutina Inaccesible</Text>
                <Text style={{ marginTop: 8, color: Colors.iron[500], textAlign: 'center' }}>{error}</Text>
                <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 32, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: Colors.iron[200], borderRadius: 8 }}>
                    <Text style={{ color: Colors.iron[950], fontWeight: 'bold' }}>Volver</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const { routine, routine_days, routine_exercises, exercises } = payload;

    return (
        <ScrollView style={{ flex: 1, backgroundColor: Colors.iron[900] }} contentContainerStyle={{ padding: 24 }}>
            <View style={{ backgroundColor: Colors.iron[50], padding: 24, borderRadius: 16, borderWidth: 1, borderColor: Colors.iron[200], marginBottom: 24 }}>
                <Text style={{ fontSize: 24, fontWeight: 'bold', color: Colors.iron[950], marginBottom: 8 }}>{routine.name}</Text>
                {routine.description && <Text style={{ fontSize: 14, color: Colors.iron[500], marginBottom: 16 }}>{routine.description}</Text>}

                <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
                    <View>
                        <Text style={{ fontSize: 10, color: Colors.iron[400], fontWeight: 'bold' }}>DÍAS</Text>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: Colors.iron[800] }}>{routine_days.length}</Text>
                    </View>
                    <View>
                        <Text style={{ fontSize: 10, color: Colors.iron[400], fontWeight: 'bold' }}>EJERCICIOS DISTINTOS</Text>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: Colors.iron[800] }}>{exercises.length}</Text>
                    </View>
                </View>

                {/* Day Previews */}
                <View style={{ gap: 8 }}>
                    {routine_days.map((day: any) => {
                        const dayExercises = routine_exercises.filter((re: any) => re.routine_day_id === day.id);
                        return (
                            <View key={day.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.iron[200] }}>
                                <Text style={{ color: Colors.iron[800], fontWeight: '600' }}>{day.name}</Text>
                                <Text style={{ color: Colors.iron[400], fontSize: 12 }}>{dayExercises.length} ej.</Text>
                            </View>
                        );
                    })}
                </View>
            </View>

            <TouchableOpacity
                onPress={handleImport}
                disabled={importing}
                style={{
                    backgroundColor: Colors.primary.DEFAULT,
                    padding: 18,
                    borderRadius: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    opacity: importing ? 0.7 : 1
                }}
            >
                {importing ? (
                    <ActivityIndicator color="white" />
                ) : (
                    <>
                        <Download size={20} color="white" />
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Importar Rutina</Text>
                    </>
                )}
            </TouchableOpacity>

            <Text style={{ color: Colors.iron[400], fontSize: 12, textAlign: 'center', marginTop: 16, paddingHorizontal: 24 }}>
                IronTrain revisará los ejercicios para evitar duplicados en tu base de datos local automáticamente.
            </Text>
        </ScrollView>
    );
}
