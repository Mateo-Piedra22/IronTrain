import { workoutService } from '@/src/services/WorkoutService';
import { Colors } from '@/src/theme';
import { ExerciseType, Workout, WorkoutSet } from '@/src/types/db';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Copy, Tag, X } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { DayProps } from 'react-native-calendars/src/calendar/day/index';
import { SafeAreaView } from 'react-native-safe-area-context';

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
    const [sourceSets, setSourceSets] = useState<(WorkoutSet & { exercise_name: string; category_color: string; exercise_type: ExerciseType })[]>([]);
    const [loading, setLoading] = useState(false);

    const handleDayPress = async (day: { dateString: string; year: number; month: number; day: number }) => {
        setSelectedDateStr(day.dateString);
        setLoading(true);
        try {
            // Fetch workout for this date
            const d = new Date(day.year, day.month - 1, day.day, 12, 0, 0);

            const workout = await workoutService.getWorkoutWithSetsForDate(d);
            setSourceWorkout(workout);

            if (workout) {
                const fetchedSets = await workoutService.getSets(workout.id);
                setSourceSets(fetchedSets as any);
            } else {
                setSourceSets([]);
            }
        } catch (e) {
            console.log('No se encontró entrenamiento para esa fecha', e);
            setSourceWorkout(null);
            setSourceSets([]);
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

    const renderCalendarDay = useCallback(({ date, state }: DayProps & { date?: DateData }) => {
        if (!date) return <View />;

        const d = new Date(date.year, date.month - 1, date.day, 12);
        const dateStr = date.dateString;
        const isSelected = selectedDateStr === dateStr;
        const isToday = isSameDay(d, new Date());
        const marks = markedDates[dateStr];
        const isCompleted = marks?.status === 'completed';
        const isDisabled = state === 'disabled';

        // Styles
        const containerStyle = [
            styles.calendarDay,
            isSelected ? styles.bgPrimary :
                isCompleted ? styles.bgIron800Completed : {}
        ];

        const textStyle = [
            styles.calendarDayText,
            isSelected ? styles.textWhiteBold :
                isToday ? styles.textPrimaryBold :
                    isDisabled ? styles.textIron400 : styles.textIron950
        ];

        return (
            <TouchableOpacity
                onPress={() => handleDayPress(date)}
                style={containerStyle}
                disabled={isDisabled}
            >
                <Text style={textStyle}>
                    {date.day}
                </Text>

                <View style={styles.calendarDotsContainer}>
                    {marks?.colors?.slice(0, 4).map((color: string, i: number) => (
                        <View
                            key={`${dateStr}-cal-dot-${i}`}
                            style={[styles.calDot, { backgroundColor: color }]}
                        />
                    ))}
                </View>

                {isCompleted && !isSelected && (
                    <View style={styles.calendarCompletedTick}>
                        <View style={styles.tickDot} />
                    </View>
                )}
            </TouchableOpacity>
        );
    }, [selectedDateStr, markedDates]);

    // Group sets by exercise 
    const getGroupedSets = () => {
        const grouped: Record<string, { exercise_name: string; count: number; category_color: string }> = {};
        sourceSets.forEach(s => {
            if (!grouped[s.exercise_id]) {
                grouped[s.exercise_id] = { exercise_name: s.exercise_name, count: 0, category_color: s.category_color };
            }
            grouped[s.exercise_id].count++;
        });
        return Object.values(grouped);
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View className="flex-1 bg-surface">
                <SafeAreaView edges={['top']} className="bg-white border-b border-iron-200">
                    <View className="flex-row justify-between items-center p-4">
                        <Text className="text-iron-950 font-bold text-lg">Copiar desde fecha</Text>
                        <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar copiar entrenamiento">
                            <X color={Colors.iron[950]} size={24} />
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>

                <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                    <Calendar
                        current={format(targetDate, 'yyyy-MM-dd')}
                        dayComponent={renderCalendarDay}
                        theme={{
                            backgroundColor: Colors.surface,
                            calendarBackground: Colors.surface,
                            textSectionTitleColor: Colors.iron[500],
                            arrowColor: Colors.primary.DEFAULT,
                            monthTextColor: Colors.iron[950],
                            textMonthFontWeight: 'bold',
                        }}
                    />

                    <View className="p-4 bg-iron-100 min-h-full">
                        <Text className="text-iron-500 text-xs mb-3 uppercase font-bold tracking-wider">Entrenamiento seleccionado</Text>

                        {loading ? (
                            <Text className="text-iron-500 italic">Buscando en el historial...</Text>
                        ) : sourceWorkout ? (
                            <View className="bg-white p-5 rounded-2xl shadow-sm border border-iron-200 elevation-1">
                                <View className="mb-4">
                                    <Text className="text-iron-950 font-black text-xl mb-1">{sourceWorkout.name || 'Entrenamiento'}</Text>
                                    <Text className="text-primary font-bold">
                                        {format(new Date(selectedDateStr), 'EEEE, d MMMM yyyy', { locale: es })}
                                    </Text>
                                </View>

                                {sourceSets.length > 0 ? (
                                    <View className="mb-5 bg-iron-50 rounded-xl p-3 border border-iron-200">
                                        <Text className="text-iron-950 font-bold mb-2">Ejercicios ({getGroupedSets().length})</Text>
                                        <View className="gap-2">
                                            {getGroupedSets().map((grp, i) => (
                                                <View key={i} className="flex-row items-center gap-2">
                                                    <View
                                                        className="w-2 h-2 rounded-full"
                                                        style={{ backgroundColor: grp.category_color || Colors.primary.dark }}
                                                    />
                                                    <Text className="text-iron-700 font-medium flex-1" numberOfLines={1}>{grp.exercise_name}</Text>
                                                    <Text className="text-iron-500 text-xs font-bold bg-white px-2 py-0.5 rounded-full border border-iron-200">{grp.count} sets</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                ) : (
                                    <Text className="text-iron-500 italic mb-4">Este entrenamiento no tiene ejercicios.</Text>
                                )}

                                <TouchableOpacity
                                    onPress={handleCopy}
                                    className="bg-primary p-4 rounded-xl flex-row justify-center items-center active:opacity-90 mt-2"
                                    disabled={sourceSets.length === 0}
                                >
                                    <Copy color="white" size={20} />
                                    <Text className="text-white font-bold ml-2 uppercase tracking-wide">Copiar rutina</Text>
                                </TouchableOpacity>
                            </View>
                        ) : selectedDateStr ? (
                            <View className="bg-white p-6 rounded-2xl border border-iron-200 border-dashed items-center mt-2">
                                <Tag size={32} color={Colors.iron[300]} className="mb-3" />
                                <Text className="text-iron-700 font-medium text-center">No hay entrenamiento registrado en esta fecha.</Text>
                            </View>
                        ) : (
                            <Text className="text-iron-500 italic">Selecciona un día en el calendario para ver detalles.</Text>
                        )}
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    calendarDay: {
        width: 45,
        height: 45,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        margin: 2,
    },
    bgPrimary: { backgroundColor: Colors.primary.DEFAULT },
    bgIron800Completed: {
        backgroundColor: Colors.white,
        borderWidth: 2,
        borderColor: 'rgba(34, 197, 94, 0.4)'
    },
    calendarDayText: {
        fontSize: 16,
        fontWeight: '500',
    },
    textWhiteBold: { color: Colors.white, fontWeight: 'bold' },
    textPrimaryBold: { color: Colors.primary.DEFAULT, fontWeight: 'bold' },
    textIron400: { color: Colors.iron[400] },
    textIron950: { color: Colors.iron[950] },

    calendarDotsContainer: {
        flexDirection: 'row',
        gap: 2,
        marginTop: 4,
        position: 'absolute',
        bottom: 6,
        justifyContent: 'center',
        width: '100%',
    },
    calDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    calendarCompletedTick: {
        position: 'absolute',
        top: 2,
        right: 2,
    },
    tickDot: {
        width: 6,
        height: 6,
        backgroundColor: Colors.green,
        borderRadius: 3,
    }
});
