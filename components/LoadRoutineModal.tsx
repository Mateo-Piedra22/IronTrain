import { ThemeFx, withAlpha } from '@/src/theme';
import { notify } from '@/src/utils/notify';
import { BookOpen, ChevronDown, ChevronRight, Dumbbell, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '../src/hooks/useColors';
import { useSharedWorkspaceSummary } from '../src/hooks/useSharedWorkspaceSummary';
import { RoutineDayWithExercises, RoutineWithDays, routineService } from '../src/services/RoutineService';
import { sharedWorkspaceCopy } from '../src/social/sharedWorkspaceCopy';
import { ToastContainer } from './ui/ToastContainer';

interface LoadRoutineModalProps {
    visible: boolean;
    onClose: () => void;
    onLoadDay: (day: RoutineDayWithExercises) => void;
}

export function LoadRoutineModal({ visible, onClose, onLoadDay }: LoadRoutineModalProps) {
    const colors = useColors();
    const st = useMemo(() => StyleSheet.create({
        overlay: { flex: 1, backgroundColor: ThemeFx.backdrop, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 48 },
        sheet: {
            backgroundColor: colors.surfaceLighter,
            borderWidth: 1.5,
            borderColor: colors.border,
            borderRadius: 24,
            flex: 1,
            maxHeight: '90%',
            width: '100%',
            overflow: 'hidden',
            ...ThemeFx.shadowLg,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 18,
            borderBottomWidth: 1.5,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
        },
        headerTitle: { color: colors.text, fontWeight: '900', fontSize: 18, letterSpacing: -0.6 },
        headerSub: { color: colors.textMuted, fontSize: 11, marginTop: 2, fontWeight: '700' },
        closeBtn: {
            width: 36, height: 36, borderRadius: 12,
            backgroundColor: colors.surfaceLighter, justifyContent: 'center', alignItems: 'center',
            borderWidth: 1.5, borderColor: colors.border
        },

        contentArea: { padding: 16, backgroundColor: colors.surfaceLighter },
        sectionLabel: {
            color: colors.textMuted,
            fontSize: 10,
            marginBottom: 12,
            textTransform: 'uppercase',
            fontWeight: '800',
            letterSpacing: 1,
        },

        routineCard: {
            backgroundColor: colors.surface,
            borderRadius: 24,
            marginBottom: 12,
            borderWidth: 1.5,
            borderColor: colors.border,
            overflow: 'hidden',
            ...ThemeFx.shadowSm,
        },
        routineHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
        iconBox: {
            width: 44, height: 44, borderRadius: 12,
            backgroundColor: withAlpha(colors.primary.DEFAULT, '15'),
            borderWidth: 1.5, borderColor: withAlpha(colors.primary.DEFAULT, '30'),
            justifyContent: 'center', alignItems: 'center',
        },
        cardName: { color: colors.text, fontWeight: '900', fontSize: 16, letterSpacing: -0.4 },
        cardMeta: { color: colors.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 4 },

        daysContainer: {
            borderTopWidth: 1.5,
            borderTopColor: colors.border,
            backgroundColor: colors.surfaceLighter,
            padding: 12,
            gap: 10,
        },
        noDays: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 12, fontWeight: '700' },
        dayItem: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.surface,
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: colors.border,
            gap: 12,
        },
        dayIconBox: {
            width: 34, height: 34, borderRadius: 10,
            backgroundColor: withAlpha(colors.primary.DEFAULT, '12'),
            borderWidth: 1.5, borderColor: withAlpha(colors.primary.DEFAULT, '25'),
            justifyContent: 'center', alignItems: 'center',
        },
        dayName: { fontSize: 15, fontWeight: '900', color: colors.text, letterSpacing: -0.2 },
        dayMeta: { color: colors.textMuted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 },
        dayPressed: { transform: [{ scale: 0.98 }], borderColor: colors.primary.DEFAULT },
        loadPill: {
            backgroundColor: colors.primary.DEFAULT,
            paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
            ...ThemeFx.shadowSm,
            shadowColor: colors.primary.DEFAULT,
        },
        loadPillText: { color: colors.onPrimary, fontSize: 13, fontWeight: '900' },

        emptyBlock: {
            alignItems: 'center',
            paddingVertical: 40,
            backgroundColor: colors.surface,
            borderRadius: 24,
            borderWidth: 1.5,
            borderColor: colors.border,
            borderStyle: 'dashed',
            gap: 10,
        },
        emptyTitle: { fontSize: 16, fontWeight: '900', color: colors.text, letterSpacing: -0.3 },
        emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', fontWeight: '600' },
    }), [colors]);
    const [routines, setRoutines] = useState<RoutineWithDays[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedRoutineId, setExpandedRoutineId] = useState<string | null>(null);
    const { linkedRoutineIds, reload: reloadSharedSummary } = useSharedWorkspaceSummary();

    useEffect(() => {
        if (visible) {
            loadRoutines();
            void reloadSharedSummary();
        } else {
            setExpandedRoutineId(null);
        }
    }, [visible]);

    const loadRoutines = async () => {
        setLoading(true);
        try {
            const all = await routineService.getAllRoutines();
            const populated = await Promise.all(all.map(async (r) => {
                const detail = await routineService.getRoutineDetails(r.id);
                return detail as RoutineWithDays;
            }));
            setRoutines(populated);
        } catch (e: any) { notify.error('Error', e?.message || 'No se pudieron cargar.'); }
        finally { setLoading(false); }
    };

    const toggleExpand = (id: string) => setExpandedRoutineId(prev => prev === id ? null : id);

    const handleLoadDay = (day: RoutineDayWithExercises) => {
        if (!day.exercises || day.exercises.length === 0) {
            notify.error('Día Vacío', 'Este día no tiene ejercicios para cargar.');
            return;
        }
        onLoadDay(day);
        onClose();
    };

    return (
        <Modal visible={visible} animationType="fade" transparent>
            <View style={st.overlay}>
                <View style={st.sheet}>
                    {/* Header — CopyWorkoutModal pattern */}
                    <View style={st.header}>
                        <View>
                            <Text style={st.headerTitle}>Cargar rutina</Text>
                            <Text style={st.headerSub}>Seleccioná un día para cargarlo</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={st.closeBtn}>
                            <X size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    {/* Content — CopyWorkoutModal content area pattern */}
                    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                        <View style={st.contentArea}>
                            <Text style={st.sectionLabel}>Tus rutinas</Text>

                            {loading ? (
                                <View style={{ paddingVertical: 48, alignItems: 'center' }}>
                                    <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
                                </View>
                            ) : routines.length === 0 ? (
                                <View style={st.emptyBlock}>
                                    <BookOpen size={28} color={colors.textMuted} />
                                    <Text style={st.emptyTitle}>No tienes rutinas</Text>
                                    <Text style={st.emptyText}>Ve a Biblioteca → Rutinas para crear una.</Text>
                                </View>
                            ) : (
                                routines.map((routine) => {
                                    const isExpanded = expandedRoutineId === routine.id;
                                    return (
                                        <View key={routine.id} style={st.routineCard}>
                                            {/* Routine header — ExerciseList card pattern */}
                                            <TouchableOpacity
                                                onPress={() => toggleExpand(routine.id)}
                                                style={st.routineHeader}
                                                activeOpacity={0.7}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
                                                    <View style={st.iconBox}>
                                                        <BookOpen size={16} color={colors.primary.DEFAULT} />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={st.cardName} numberOfLines={1}>{routine.name}</Text>
                                                        <Text style={st.cardMeta}>
                                                            {routine.days.length} {routine.days.length === 1 ? 'DÍA' : 'DÍAS'}
                                                        </Text>
                                                        {linkedRoutineIds.includes(routine.id) && (
                                                            <View style={{ marginTop: 6, alignSelf: 'flex-start', backgroundColor: withAlpha(colors.primary.DEFAULT, '15'), borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: withAlpha(colors.primary.DEFAULT, '35') }}>
                                                                <Text style={{ color: colors.primary.DEFAULT, fontSize: 9, fontWeight: '900', letterSpacing: 0.4 }}>{sharedWorkspaceCopy.cardBadge}</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                </View>
                                                {isExpanded
                                                    ? <ChevronDown size={20} color={colors.textMuted} />
                                                    : <ChevronRight size={20} color={colors.textMuted} />
                                                }
                                            </TouchableOpacity>

                                            {/* Expanded days */}
                                            {isExpanded && (
                                                <View style={st.daysContainer}>
                                                    {routine.days.length === 0 ? (
                                                        <Text style={st.noDays}>Sin días definidos.</Text>
                                                    ) : routine.days.map((day) => (
                                                        <Pressable
                                                            key={day.id}
                                                            onPress={() => handleLoadDay(day)}
                                                            style={({ pressed }) => [st.dayItem, pressed && st.dayPressed]}
                                                        >
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                                                                <View style={st.dayIconBox}>
                                                                    <Dumbbell size={14} color={colors.primary.DEFAULT} />
                                                                </View>
                                                                <View style={{ flex: 1 }}>
                                                                    <Text style={st.dayName}>{day.name}</Text>
                                                                    <Text style={st.dayMeta}>
                                                                        {day.exercises.length} {day.exercises.length === 1 ? 'EJERCICIO' : 'EJERCICIOS'}
                                                                    </Text>
                                                                </View>
                                                            </View>
                                                            <View style={st.loadPill}>
                                                                <Text style={st.loadPillText}>Cargar</Text>
                                                            </View>
                                                        </Pressable>
                                                    ))}
                                                </View>
                                            )}
                                        </View>
                                    );
                                })
                            )}
                        </View>
                    </ScrollView>
                </View>
                <ToastContainer />
            </View>
        </Modal>
    );
}


