import { workoutService } from '@/src/services/WorkoutService';
import { Colors } from '@/src/theme';
import { Workout } from '@/src/types/db';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Copy, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Calendar } from 'react-native-calendars';

interface CopyWorkoutModalProps {
    visible: boolean;
    onClose: () => void;
    targetDate: Date;
    targetWorkoutId: string;
    onCopyComplete: () => void;
    markedDates: Record<string, any>;
}

export function CopyWorkoutModal({ visible, onClose, targetDate, targetWorkoutId, onCopyComplete, markedDates }: CopyWorkoutModalProps) {
    const [selectedDateStr, setSelectedDateStr] = useState('');
    const [sourceWorkout, setSourceWorkout] = useState<Workout | null>(null);
    const [loading, setLoading] = useState(false);

    const handleDayPress = async (day: { dateString: string }) => {
        setSelectedDateStr(day.dateString);
        setLoading(true);
        try {
            // Fetch workout for this date
            // Parse date string to Date object (local noon)
            const parts = day.dateString.split('-');
            const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);

            const workout = await workoutService.getWorkoutWithSetsForDate(d);
            setSourceWorkout(workout);
        } catch (e) {
            console.log('No se encontró entrenamiento para esa fecha');
            setSourceWorkout(null);
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async () => {
        if (!sourceWorkout) return;
        if (!targetWorkoutId) {
            Alert.alert('Error', 'No se pudo identificar el entrenamiento destino.');
            return;
        }

        const doCopy = async (
            mode: 'replace' | 'append',
            content: 'full' | 'structure' | 'exercises_only',
            dedupeByExercise: boolean,
            resumeTargetIfCompleted: boolean
        ) => {
            try {
                setLoading(true);
                const result = await workoutService.copyWorkoutToWorkoutAdvanced(sourceWorkout.id, targetWorkoutId, {
                    mode,
                    content,
                    dedupeByExercise,
                    resumeTargetIfCompleted,
                    copyName: mode === 'replace' ? 'always' : 'if_empty',
                });
                onCopyComplete();
                onClose();
                const skipped = (result.skippedMissingExercises ?? 0) + (result.skippedExistingExercises ?? 0);
                Alert.alert(
                    'Copiado',
                    [
                        `Copiados: ${result.copied} set(s).`,
                        skipped ? `Omitidos: ${skipped} set(s).` : null,
                        result.skippedExistingExercises ? `- ${result.skippedExistingExercises} por ejercicios ya existentes en el destino.` : null,
                        result.skippedMissingExercises ? `- ${result.skippedMissingExercises} por ejercicios faltantes en la biblioteca.` : null,
                    ].filter(Boolean).join('\n')
                );
            } catch (e) {
                Alert.alert('Error', (e as Error).message);
            } finally {
                setLoading(false);
            }
        };

        const targetWorkout = await workoutService.getWorkout(targetWorkoutId);
        if (!targetWorkout) {
            Alert.alert('Error', 'No se encontró el entrenamiento destino.');
            return;
        }

        const targetSets = await workoutService.getSets(targetWorkoutId);
        const targetHasSets = targetSets.length > 0;

        const sourceLabel = format(new Date(selectedDateStr), 'd MMM');
        const targetLabel = format(targetDate, 'd MMM');

        const askContent = (mode: 'replace' | 'append', dedupeByExercise: boolean, resumeTargetIfCompleted: boolean) => {
            Alert.alert(
                '¿Qué querés copiar?',
                'Elegí el nivel de copiado:',
                [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Completo (valores)', onPress: () => doCopy(mode, 'full', dedupeByExercise, resumeTargetIfCompleted) },
                    { text: 'Estructura (vacío)', onPress: () => doCopy(mode, 'structure', dedupeByExercise, resumeTargetIfCompleted) },
                    { text: 'Solo ejercicios (1 set)', onPress: () => doCopy(mode, 'exercises_only', dedupeByExercise, resumeTargetIfCompleted) },
                ]
            );
        };

        const askMode = (resumeTargetIfCompleted: boolean) => {
            if (!targetHasSets) {
                Alert.alert(
                    'Copiar entrenamiento',
                    `¿Copiar el entrenamiento del ${sourceLabel} al ${targetLabel}?`,
                    [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Continuar', onPress: () => askContent('replace', false, resumeTargetIfCompleted) },
                    ]
                );
                return;
            }

            Alert.alert(
                'Este día ya tiene ejercicios',
                `El día ${targetLabel} tiene ${targetSets.length} set(s). ¿Qué querés hacer?`,
                [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Agregar al final', onPress: () => askContent('append', false, resumeTargetIfCompleted) },
                    { text: 'Agregar sin duplicar ejercicios', onPress: () => askContent('append', true, resumeTargetIfCompleted) },
                    {
                        text: 'Reemplazar todo',
                        style: 'destructive',
                        onPress: () => {
                            Alert.alert(
                                'Confirmar reemplazo',
                                `Esto eliminará ${targetSets.length} set(s) del ${targetLabel}.`,
                                [
                                    { text: 'Cancelar', style: 'cancel' },
                                    { text: 'Reemplazar', style: 'destructive', onPress: () => askContent('replace', false, resumeTargetIfCompleted) },
                                ]
                            );
                        }
                    },
                ]
            );
        };

        if (targetWorkout.status === 'completed') {
            Alert.alert(
                'Día finalizado',
                `El día ${targetLabel} está marcado como FINALIZADO. Para copiar, hay que reanudarlo.`,
                [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Reanudar y continuar', onPress: () => askMode(true) },
                ]
            );
            return;
        }

        askMode(false);
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View className="flex-1 bg-iron-900">
                <View className="flex-row justify-between items-center p-4 border-b border-iron-800 bg-iron-800">
                    <Text className="text-iron-950 font-bold text-lg">Copiar desde fecha</Text>
                    <TouchableOpacity onPress={onClose}>
                        <X color={Colors.iron[950]} size={24} />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                    <Calendar
                        onDayPress={handleDayPress}
                        markedDates={{
                            ...markedDates,
                            [selectedDateStr]: { selected: true, selectedColor: Colors.primary.dark }
                        }}
                        theme={{
                            backgroundColor: Colors.white,
                            calendarBackground: Colors.white,
                            textSectionTitleColor: Colors.iron[500],
                            dayTextColor: Colors.iron[950],
                            todayTextColor: Colors.primary.dark,
                            selectedDayBackgroundColor: Colors.primary.dark,
                            selectedDayTextColor: Colors.white,
                            monthTextColor: Colors.iron[950],
                            arrowColor: Colors.primary.dark,
                            dotColor: Colors.green,
                            selectedDotColor: Colors.white,
                            textDisabledColor: Colors.iron[400],
                        }}
                    />

                    <View className="p-4">
                        <Text className="text-iron-950 text-sm mb-2 uppercase font-bold">Entrenamiento seleccionado</Text>

                        {loading ? (
                            <Text className="text-iron-950 italic">Buscando en el historial...</Text>
                        ) : sourceWorkout ? (
                            <View className="bg-iron-800 p-4 rounded-xl border border-iron-700">
                                <Text className="text-iron-950 font-bold text-lg mb-1">{sourceWorkout.name || 'Entrenamiento'}</Text>
                                <Text className="text-iron-950 text-xs mb-4">
                                    {format(new Date(selectedDateStr), 'EEEE, d MMMM yyyy', { locale: es })}
                                </Text>

                                <TouchableOpacity
                                    onPress={handleCopy}
                                    className="bg-primary p-3 rounded-lg flex-row justify-center items-center active:opacity-90"
                                >
                                    <Copy color="white" size={18} />
                                    <Text className="text-white font-bold ml-2 uppercase">Copiar a este día</Text>
                                </TouchableOpacity>
                            </View>
                        ) : selectedDateStr ? (
                            <View className="bg-iron-800/50 p-4 rounded-xl border border-iron-800 border-dashed items-center">
                                <Text className="text-iron-950">No hay datos de entrenamiento para esa fecha.</Text>
                            </View>
                        ) : (
                            <Text className="text-iron-950">Selecciona una fecha para previsualizar.</Text>
                        )}
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );
}
