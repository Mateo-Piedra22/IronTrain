import { Colors } from '@/src/theme';
import { notify } from '@/src/utils/notify';
import { BookOpen, ChevronDown, ChevronRight, Dumbbell, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RoutineDayWithExercises, RoutineWithDays, routineService } from '../src/services/RoutineService';

interface LoadRoutineModalProps {
    visible: boolean;
    onClose: () => void;
    onLoadDay: (day: RoutineDayWithExercises) => void;
}

export function LoadRoutineModal({ visible, onClose, onLoadDay }: LoadRoutineModalProps) {
    const [routines, setRoutines] = useState<RoutineWithDays[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedRoutineId, setExpandedRoutineId] = useState<string | null>(null);

    useEffect(() => {
        if (visible) { loadRoutines(); } else { setExpandedRoutineId(null); }
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
                            <X size={18} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    {/* Content — CopyWorkoutModal content area pattern */}
                    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                        <View style={st.contentArea}>
                            <Text style={st.sectionLabel}>Tus rutinas</Text>

                            {loading ? (
                                <View style={{ paddingVertical: 48, alignItems: 'center' }}>
                                    <ActivityIndicator size="large" color={Colors.primary.DEFAULT} />
                                </View>
                            ) : routines.length === 0 ? (
                                <View style={st.emptyBlock}>
                                    <BookOpen size={28} color={Colors.iron[400]} />
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
                                                        <BookOpen size={16} color={Colors.primary.DEFAULT} />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={st.cardName} numberOfLines={1}>{routine.name}</Text>
                                                        <Text style={st.cardMeta}>
                                                            {routine.days.length} {routine.days.length === 1 ? 'DÍA' : 'DÍAS'}
                                                        </Text>
                                                    </View>
                                                </View>
                                                {isExpanded
                                                    ? <ChevronDown size={20} color={Colors.iron[400]} />
                                                    : <ChevronRight size={20} color={Colors.iron[400]} />
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
                                                                    <Dumbbell size={14} color={Colors.primary.DEFAULT} />
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
            </View>
        </Modal>
    );
}

const st = StyleSheet.create({
    // Same overlay/sheet pattern as CopyWorkoutModal
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 48,
    },
    sheet: {
        backgroundColor: Colors.iron[900],
        borderWidth: 1,
        borderColor: Colors.iron[700],
        borderRadius: 20,
        flex: 1,
        maxHeight: '95%',
        width: '100%',
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.iron[200],
        backgroundColor: Colors.surface,
    },
    headerTitle: { color: Colors.iron[950], fontWeight: '900', fontSize: 16, letterSpacing: -0.3 },
    headerSub: { color: Colors.iron[400], fontSize: 11, marginTop: 2 },
    closeBtn: {
        width: 32, height: 32, borderRadius: 10,
        backgroundColor: Colors.primary.DEFAULT, justifyContent: 'center', alignItems: 'center',
    },

    // Content area — matches CopyWorkoutModal
    contentArea: {
        padding: 16,
        backgroundColor: Colors.iron[100],
        minHeight: '100%',
    },
    sectionLabel: {
        color: Colors.iron[400],
        fontSize: 10,
        marginBottom: 12,
        textTransform: 'uppercase',
        fontWeight: '800',
        letterSpacing: 1,
    },

    // Card — exactly ExerciseList pattern
    routineCard: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: Colors.iron[300],
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
    },
    routineHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    iconBox: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: Colors.primary.DEFAULT + '20',
        borderWidth: 1, borderColor: Colors.primary.DEFAULT + '40',
        justifyContent: 'center', alignItems: 'center',
    },
    cardName: { color: Colors.iron[950], fontWeight: '900', fontSize: 16, letterSpacing: -0.3 },
    cardMeta: { color: Colors.iron[500], fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },

    // Expanded days — inset card area
    daysContainer: {
        borderTopWidth: 1,
        borderTopColor: Colors.iron[200],
        backgroundColor: Colors.iron[100],
        padding: 12,
        gap: 10,
    },
    noDays: { fontSize: 13, color: Colors.iron[400], textAlign: 'center', paddingVertical: 12 },
    dayItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.surface,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: Colors.iron[300],
        gap: 12,
    },
    dayIconBox: {
        width: 34, height: 34, borderRadius: 10,
        backgroundColor: Colors.primary.DEFAULT + '15',
        borderWidth: 1, borderColor: Colors.primary.DEFAULT + '25',
        justifyContent: 'center', alignItems: 'center',
    },
    dayName: { fontSize: 15, fontWeight: '800', color: Colors.iron[950] },
    dayMeta: { color: Colors.iron[500], fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 },
    dayPressed: { opacity: 0.75, borderColor: Colors.primary.DEFAULT },
    loadPill: {
        backgroundColor: Colors.primary.DEFAULT,
        paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10,
        shadowColor: Colors.primary.DEFAULT,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    loadPillText: { color: '#fff', fontSize: 13, fontWeight: '800' },

    // Empty state
    emptyBlock: {
        alignItems: 'center',
        paddingVertical: 32,
        backgroundColor: Colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        borderStyle: 'dashed',
        gap: 10,
    },
    emptyTitle: { fontSize: 15, fontWeight: '800', color: Colors.iron[950] },
    emptyText: { fontSize: 13, color: Colors.iron[500], textAlign: 'center' },
});
