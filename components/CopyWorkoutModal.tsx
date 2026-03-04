import { workoutService } from '@/src/services/WorkoutService';
import { Colors } from '@/src/theme';
import { ExerciseType, Workout, WorkoutSet } from '@/src/types/db';
import { notify } from '@/src/utils/notify';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Copy, Tag, X } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { DayProps } from 'react-native-calendars/src/calendar/day/index';
import { confirm, useConfirmStore } from '../src/store/confirmStore';

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
            notify.error('Datos incompletos', 'No se pudo identificar el entrenamiento destino.');
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

                if (skipped > 0) {
                    notify.warning('Copiado parcial', `Se copiaron ${result.copied} series. Se omitieron ${skipped}.`);
                } else {
                    notify.success('Rutina pegada', `Se copiaron las ${result.copied} series sin problemas.`);
                }
            } catch (e: any) {
                notify.error('Error de copiado', e?.message || 'Fallo general al intentar migrar.');
            } finally {
                setLoading(false);
            }
        };

        const targetWorkout = await workoutService.getWorkout(targetWorkoutId);
        if (!targetWorkout) {
            notify.error('Destino inválido', 'No se encontró el entrenamiento destino.');
            return;
        }

        const targetSets = await workoutService.getSets(targetWorkoutId);
        const targetHasSets = targetSets.length > 0;

        const sourceLabel = format(new Date(selectedDateStr), 'd MMM');
        const targetLabel = format(targetDate, 'd MMM');

        const askContent = (mode: 'replace' | 'append', dedupeByExercise: boolean, resumeTargetIfCompleted: boolean) => {
            const hide = useConfirmStore.getState().hide;
            confirm.custom({
                title: '¿Qué querés copiar?',
                message: 'Elegí el nivel de copiado:',
                variant: 'info',
                buttons: [
                    { label: 'Cancelar', onPress: hide, variant: 'ghost' },
                    { label: 'Completo', onPress: () => { hide(); doCopy(mode, 'full', dedupeByExercise, resumeTargetIfCompleted); }, variant: 'solid' },
                    { label: 'Estructura', onPress: () => { hide(); doCopy(mode, 'structure', dedupeByExercise, resumeTargetIfCompleted); }, variant: 'outline' },
                    { label: 'Solo ejercicios', onPress: () => { hide(); doCopy(mode, 'exercises_only', dedupeByExercise, resumeTargetIfCompleted); }, variant: 'outline' },
                ],
            });
        };

        const askMode = (resumeTargetIfCompleted: boolean) => {
            const hide = useConfirmStore.getState().hide;
            if (!targetHasSets) {
                confirm.ask(
                    'Copiar entrenamiento',
                    `¿Copiar el entrenamiento del ${sourceLabel} al ${targetLabel}?`,
                    () => askContent('replace', false, resumeTargetIfCompleted),
                    'Continuar'
                );
                return;
            }

            confirm.custom({
                title: 'Este día ya tiene ejercicios',
                message: `El día ${targetLabel} tiene ${targetSets.length} set(s). ¿Qué querés hacer?`,
                variant: 'warning',
                buttons: [
                    { label: 'Cancelar', onPress: hide, variant: 'ghost' },
                    { label: 'Agregar', onPress: () => { hide(); askContent('append', false, resumeTargetIfCompleted); }, variant: 'solid' },
                    { label: 'Sin duplicar', onPress: () => { hide(); askContent('append', true, resumeTargetIfCompleted); }, variant: 'outline' },
                    {
                        label: 'Reemplazar',
                        destructive: true,
                        onPress: () => {
                            hide();
                            confirm.destructive(
                                'Confirmar reemplazo',
                                `Esto eliminará ${targetSets.length} set(s) del ${targetLabel}.`,
                                () => askContent('replace', false, resumeTargetIfCompleted),
                                'Reemplazar'
                            );
                        }
                    },
                ],
            });
        };

        if (targetWorkout.status === 'completed') {
            confirm.ask(
                'Día finalizado',
                `El día ${targetLabel} está marcado como FINALIZADO. Para copiar, hay que reanudarlo.`,
                () => askMode(true),
                'Reanudar y continuar'
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
        <Modal visible={visible} animationType="fade" transparent>
            <View style={styles.overlay}>
                <View style={styles.sheet}>
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.headerTitle}>Copiar rutina</Text>
                            <Text style={styles.headerSub}>Buscar desde historial</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Cerrar ventana">
                            <X size={18} color="#fff" />
                        </TouchableOpacity>
                    </View>

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

                        <View style={{ padding: 16, backgroundColor: Colors.iron[100], minHeight: '100%' }}>
                            <Text style={{ color: Colors.iron[400], fontSize: 10, marginBottom: 12, textTransform: 'uppercase', fontWeight: '800', letterSpacing: 1 }}>Entrenamiento seleccionado</Text>

                            {loading ? (
                                <Text style={{ color: Colors.iron[400], fontStyle: 'italic' }}>Buscando en el historial...</Text>
                            ) : sourceWorkout ? (
                                <View style={{ backgroundColor: Colors.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: Colors.iron[700], elevation: 1 }}>
                                    <View style={{ marginBottom: 16 }}>
                                        <Text style={{ color: Colors.iron[950], fontWeight: '900', fontSize: 20, marginBottom: 4 }}>{sourceWorkout.name || 'Entrenamiento'}</Text>
                                        <Text style={{ color: Colors.primary.DEFAULT, fontWeight: '700', fontSize: 13 }}>
                                            {format(new Date(selectedDateStr), 'EEEE, d MMMM yyyy', { locale: es })}
                                        </Text>
                                    </View>

                                    {sourceSets.length > 0 ? (
                                        <View style={{ marginBottom: 20, backgroundColor: Colors.iron[100], borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.iron[200] }}>
                                            <Text style={{ color: Colors.iron[950], fontWeight: '800', marginBottom: 10, fontSize: 13 }}>Ejercicios ({getGroupedSets().length})</Text>
                                            <View style={{ gap: 8 }}>
                                                {getGroupedSets().map((grp, i) => (
                                                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: grp.category_color || Colors.primary.dark }} />
                                                        <Text style={{ color: Colors.iron[700], fontWeight: '600', flex: 1, fontSize: 13 }} numberOfLines={1}>{grp.exercise_name}</Text>
                                                        <View style={{ backgroundColor: Colors.surface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: Colors.iron[200] }}>
                                                            <Text style={{ color: Colors.iron[400], fontSize: 11, fontWeight: '800' }}>{grp.count} sets</Text>
                                                        </View>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                    ) : (
                                        <Text style={{ color: Colors.iron[400], fontStyle: 'italic', marginBottom: 16 }}>Este entrenamiento no tiene ejercicios.</Text>
                                    )}

                                    <TouchableOpacity
                                        onPress={handleCopy}
                                        style={{ backgroundColor: Colors.primary.DEFAULT, paddingVertical: 14, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8, shadowColor: Colors.primary.DEFAULT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 }}
                                        disabled={sourceSets.length === 0}
                                    >
                                        <Copy color="white" size={18} />
                                        <Text style={{ color: '#fff', fontWeight: '900', marginLeft: 8, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 14 }}>Copiar rutina</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : selectedDateStr ? (
                                <View style={{ backgroundColor: Colors.surface, padding: 24, borderRadius: 16, borderWidth: 1, borderColor: Colors.iron[700], borderStyle: 'dashed', alignItems: 'center', marginTop: 8 }}>
                                    <Tag size={32} color={Colors.iron[300]} style={{ marginBottom: 12 }} />
                                    <Text style={{ color: Colors.iron[500], fontWeight: '600', textAlign: 'center' }}>No hay entrenamiento registrado en esta fecha.</Text>
                                </View>
                            ) : (
                                <Text style={{ color: Colors.iron[400], fontStyle: 'italic' }}>Seleccioná un día en el calendario para ver detalles.</Text>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 48 },
    sheet: { backgroundColor: Colors.iron[900], borderWidth: 1, borderColor: Colors.iron[700], borderRadius: 20, flex: 1, maxHeight: '95%', width: '100%', overflow: 'hidden' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.iron[200], backgroundColor: Colors.surface },
    headerTitle: { color: Colors.iron[950], fontWeight: '900', fontSize: 16, letterSpacing: -0.3 },
    headerSub: { color: Colors.iron[400], fontSize: 11, marginTop: 2 },
    closeBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.primary.DEFAULT, justifyContent: 'center', alignItems: 'center' },

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
