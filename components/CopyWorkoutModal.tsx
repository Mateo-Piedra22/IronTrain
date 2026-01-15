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
    onCopyComplete: () => void;
    markedDates: Record<string, any>;
}

export function CopyWorkoutModal({ visible, onClose, targetDate, onCopyComplete, markedDates }: CopyWorkoutModalProps) {
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

            const workout = await workoutService.getActiveWorkout(d);
            // Check if it's a real workout (has sets?)
            const sets = await workoutService.getSets(workout.id);
            if (sets.length > 0) {
                setSourceWorkout(workout);
            } else {
                setSourceWorkout(null);
            }
        } catch (e) {
            console.log('No se encontró entrenamiento para esa fecha');
            setSourceWorkout(null);
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async () => {
        if (!sourceWorkout) return;

        Alert.alert(
            "Copiar entrenamiento",
            `¿Copiar el entrenamiento del ${format(new Date(selectedDateStr), 'd MMM')} al ${format(targetDate, 'd MMM')}?`,
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Copiar",
                    onPress: async () => {
                        try {
                            setLoading(true);
                            // Use loadTemplate logic to copy workout
                            await workoutService.loadTemplate(sourceWorkout.id, format(targetDate, 'yyyy-MM-dd'));
                            onCopyComplete();
                            onClose();
                        } catch (e) {
                            Alert.alert("Error", (e as Error).message);
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
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
