import { workoutService } from '@/src/services/WorkoutService';
import { ThemeFx } from '@/src/theme';
import { ExerciseType, Workout, WorkoutSet } from '@/src/types/db';
import { notify } from '@/src/utils/notify';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronRight, Copy, Tag, X } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { DayProps } from 'react-native-calendars/src/calendar/day/index';
import { useColors } from '../src/hooks/useColors';
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
    const colors = useColors();
    const [selectedDateStr, setSelectedDateStr] = useState('');
    const [sourceWorkout, setSourceWorkout] = useState<Workout | null>(null);
    const [workoutsOnDate, setWorkoutsOnDate] = useState<(Workout & { set_count: number })[]>([]);
    const [sourceSets, setSourceSets] = useState<(WorkoutSet & { exercise_name: string; category_color: string; exercise_type: ExerciseType })[]>([]);
    const [loading, setLoading] = useState(false);

    const ss = useMemo(() => StyleSheet.create({
        overlay: { flex: 1, backgroundColor: ThemeFx.backdropStrong, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 48 },
        sheet: {
            backgroundColor: colors.background,
            borderWidth: 1.5,
            borderColor: colors.border,
            borderRadius: 24,
            flex: 1,
            maxHeight: '95%',
            width: '100%',
            overflow: 'hidden',
            ...ThemeFx.shadowLg,
        },
        header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1.5, borderBottomColor: colors.border, backgroundColor: colors.surface },
        headerTitle: { color: colors.text, fontWeight: '900', fontSize: 16, letterSpacing: -0.3 },
        headerSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
        closeBtn: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.primary.DEFAULT, justifyContent: 'center', alignItems: 'center' },

        calendarDay: {
            width: 45,
            height: 45,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 14,
            margin: 2,
        },
        bgPrimary: { backgroundColor: colors.primary.DEFAULT },
        bgIron800Completed: {
            backgroundColor: colors.surface,
            borderWidth: 1.5,
            borderColor: colors.primary.DEFAULT
        },
        calendarDayText: {
            fontSize: 16,
            fontWeight: '600',
        },
        textWhiteBold: { color: colors.onPrimary, fontWeight: 'bold' },
        textPrimaryBold: { color: colors.primary.DEFAULT, fontWeight: 'bold' },
        textIron400: { color: colors.textMuted },
        textIron950: { color: colors.text },

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
            backgroundColor: colors.green,
            borderRadius: 3,
        },

        // Consolidated History Detail Styles
        historyContentContainer: { padding: 16, backgroundColor: colors.background, minHeight: 400 },
        historyLabel: { color: colors.textMuted, fontSize: 10, marginBottom: 12, textTransform: 'uppercase', fontWeight: '800', letterSpacing: 1 },
        loadingText: { color: colors.textMuted, fontStyle: 'italic', marginTop: 10 },

        workoutCard: {
            backgroundColor: colors.surface,
            padding: 20,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: colors.border,
            ...ThemeFx.shadowSm,
        },
        workoutHeader: { marginBottom: 16 },
        workoutName: { color: colors.text, fontWeight: '900', fontSize: 20, marginBottom: 4 },
        workoutDate: { color: colors.primary.DEFAULT, fontWeight: '700', fontSize: 13 },

        exercisesSummaryBox: {
            marginBottom: 20,
            backgroundColor: colors.surfaceLighter,
            borderRadius: 16,
            padding: 14,
            borderWidth: 1.5,
            borderColor: colors.border
        },
        exercisesSummaryTitle: { color: colors.text, fontWeight: '800', marginBottom: 10, fontSize: 13 },
        exercisesList: { gap: 8 },
        exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        categoryIndicator: { width: 8, height: 8, borderRadius: 4 },
        exerciseNameText: { color: colors.text, fontWeight: '600', flex: 1, fontSize: 13 },
        setsBadge: {
            backgroundColor: colors.background,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: colors.border
        },
        setsBadgeText: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
        noExercisesText: { color: colors.textMuted, fontStyle: 'italic', marginBottom: 16 },

        copyButton: {
            backgroundColor: colors.primary.DEFAULT,
            paddingVertical: 14,
            borderRadius: 16,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 8,
            ...ThemeFx.shadowSm,
        },
        copyButtonText: { color: colors.onPrimary, fontWeight: '900', marginLeft: 8, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 14 },

        emptyStateContainer: {
            backgroundColor: colors.surface,
            padding: 24,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: colors.border,
            borderStyle: 'dashed',
            alignItems: 'center',
            marginTop: 8
        },
        emptyStateText: { color: colors.textMuted, fontWeight: '600', textAlign: 'center' },
        promptText: { color: colors.textMuted, fontStyle: 'italic' }
    }), [colors]);

    const handleDayPress = async (day: { dateString: string; year: number; month: number; day: number }) => {
        setSelectedDateStr(day.dateString);
        setSourceWorkout(null);
        setSourceSets([]);
        setLoading(true);
        try {
            const d = new Date(day.year, day.month - 1, day.day, 12, 0, 0);
            const workouts = await workoutService.getWorkoutsWithSetsForDate(d);
            setWorkoutsOnDate(workouts);

            if (workouts.length === 1) {
                // Auto-select if only one
                const w = workouts[0];
                setSourceWorkout(w);
                const fetchedSets = await workoutService.getSets(w.id);
                setSourceSets(fetchedSets as any);
            }
        } catch (e) {
            notify.warning('Sin entrenamiento', 'No se encontró un entrenamiento para esa fecha.');
            setWorkoutsOnDate([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectSourceWorkout = async (w: Workout) => {
        setLoading(true);
        try {
            setSourceWorkout(w);
            const fetchedSets = await workoutService.getSets(w.id);
            setSourceSets(fetchedSets as any);
        } catch (e) {
            notify.error('Error', 'No se pudieron cargar los sets de esta sesión.');
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
            ss.calendarDay,
            isSelected ? ss.bgPrimary :
                isCompleted ? ss.bgIron800Completed : {}
        ];

        const textStyle = [
            ss.calendarDayText,
            isSelected ? ss.textWhiteBold :
                isToday ? ss.textPrimaryBold :
                    isDisabled ? ss.textIron400 : ss.textIron950
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

                <View style={ss.calendarDotsContainer}>
                    {marks?.colors?.slice(0, 4).map((color: string, i: number) => (
                        <View
                            key={`${dateStr}-cal-dot-${i}`}
                            style={[ss.calDot, { backgroundColor: color }]}
                        />
                    ))}
                </View>

                {isCompleted && !isSelected && (
                    <View style={ss.calendarCompletedTick}>
                        <View style={ss.tickDot} />
                    </View>
                )}
            </TouchableOpacity>
        );
    }, [selectedDateStr, markedDates, ss]);

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
            <View style={ss.overlay}>
                <View style={ss.sheet}>
                    <View style={ss.header}>
                        <View>
                            <Text style={ss.headerTitle}>Copiar rutina</Text>
                            <Text style={ss.headerSub}>Buscar desde historial</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={ss.closeBtn} accessibilityRole="button" accessibilityLabel="Cerrar ventana">
                            <X size={18} color={colors.onPrimary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                        <Calendar
                            current={format(targetDate, 'yyyy-MM-dd')}
                            dayComponent={renderCalendarDay}
                            theme={{
                                backgroundColor: colors.surface,
                                calendarBackground: colors.surface,
                                textSectionTitleColor: colors.textMuted,
                                arrowColor: colors.primary.DEFAULT,
                                monthTextColor: colors.text,
                                textMonthFontWeight: 'bold',
                            }}
                        />

                        <View style={ss.historyContentContainer}>
                            <Text style={ss.historyLabel}>Entrenamiento seleccionado</Text>

                            {loading ? (
                                <Text style={ss.loadingText}>Buscando en el historial...</Text>
                            ) : sourceWorkout ? (
                                <View style={ss.workoutCard}>
                                    <View style={ss.workoutHeader}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={ss.workoutName}>{sourceWorkout.name || 'Entrenamiento'}</Text>
                                                <Text style={ss.workoutDate}>
                                                    {format(new Date(selectedDateStr), 'EEEE, d MMMM yyyy', { locale: es })}
                                                </Text>
                                            </View>
                                            {workoutsOnDate.length > 1 && (
                                                <TouchableOpacity
                                                    onPress={() => setSourceWorkout(null)}
                                                    style={{ backgroundColor: colors.surfaceLighter, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}
                                                >
                                                    <Text style={{ color: colors.primary.DEFAULT, fontSize: 10, fontWeight: '800' }}>CAMBIAR SESIÓN</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>

                                    {sourceSets.length > 0 ? (
                                        <View style={ss.exercisesSummaryBox}>
                                            <Text style={ss.exercisesSummaryTitle}>Ejercicios ({getGroupedSets().length})</Text>
                                            <View style={ss.exercisesList}>
                                                {getGroupedSets().map((grp, i) => (
                                                    <View key={i} style={ss.exerciseRow}>
                                                        <View style={[ss.categoryIndicator, { backgroundColor: grp.category_color || colors.primary.dark }]} />
                                                        <Text style={ss.exerciseNameText} numberOfLines={1}>{grp.exercise_name}</Text>
                                                        <View style={ss.setsBadge}>
                                                            <Text style={ss.setsBadgeText}>{grp.count} sets</Text>
                                                        </View>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                    ) : (
                                        <Text style={ss.noExercisesText}>Este entrenamiento no tiene ejercicios.</Text>
                                    )}

                                    <TouchableOpacity
                                        onPress={handleCopy}
                                        style={ss.copyButton}
                                        disabled={sourceSets.length === 0}
                                    >
                                        <Copy color={colors.onPrimary} size={18} />
                                        <Text style={ss.copyButtonText}>Copiar rutina</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : workoutsOnDate.length > 1 ? (
                                <View style={{ gap: 12 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                        <View style={{ width: 4, height: 16, backgroundColor: colors.primary.DEFAULT, borderRadius: 2, marginRight: 8 }} />
                                        <Text style={{ color: colors.text, fontWeight: '900', fontSize: 16 }}>Múltiples sesiones encontradas</Text>
                                    </View>
                                    {workoutsOnDate.map((w, i) => (
                                        <TouchableOpacity
                                            key={w.id}
                                            onPress={() => handleSelectSourceWorkout(w)}
                                            style={{
                                                backgroundColor: colors.surface,
                                                padding: 16,
                                                borderRadius: 20,
                                                borderWidth: 1.5,
                                                borderColor: colors.border,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                ...ThemeFx.shadowSm
                                            }}
                                        >
                                            <View>
                                                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>{w.name || `Sesión ${workoutsOnDate.length - i}`}</Text>
                                                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{w.set_count} ejercicios/sets registrados</Text>
                                            </View>
                                            <View style={{ backgroundColor: colors.surfaceLighter, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}>
                                                <ChevronRight size={18} color={colors.primary.DEFAULT} />
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ) : selectedDateStr ? (
                                <View style={ss.emptyStateContainer}>
                                    <Tag size={32} color={colors.textMuted} style={{ marginBottom: 12 }} />
                                    <Text style={ss.emptyStateText}>No hay entrenamiento registrado en esta fecha.</Text>
                                </View>
                            ) : (
                                <Text style={ss.promptText}>Seleccioná un día en el calendario para ver detalles.</Text>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}
