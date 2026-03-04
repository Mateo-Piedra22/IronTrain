import { CategoryManager } from '@/components/CategoryManager';
import { CreateRoutineModal } from '@/components/CreateRoutineModal';
import { ExerciseList } from '@/components/ExerciseList';
import { RoutineDetailModal } from '@/components/RoutineDetailModal';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { routineService } from '@/src/services/RoutineService';
import { confirm } from '@/src/store/confirmStore';
import { Colors } from '@/src/theme';
import { Routine } from '@/src/types/db';
import { notify } from '@/src/utils/notify';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react-native';
import React, { useCallback, useContext, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SegmentMode = 'exercises' | 'categories' | 'routines';

export default function LibraryScreen() {
    const [mode, setMode] = useState<SegmentMode>('exercises');

    // Routines state
    const [routines, setRoutines] = useState<Routine[]>([]);
    const [routinesLoading, setRoutinesLoading] = useState(false);
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [editingRoutine, setEditingRoutine] = useState<{ id: string; name: string; description?: string | null } | null>(null);

    // Detail modal
    const [detailRoutineId, setDetailRoutineId] = useState<string | null>(null);
    const [detailVisible, setDetailVisible] = useState(false);

    const insets = useSafeAreaInsets();
    const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
    const bottomOffset = (tabBarHeight ? tabBarHeight : insets.bottom) + 12;

    const loadRoutines = useCallback(async () => {
        setRoutinesLoading(true);
        try {
            const data = await routineService.getAllRoutines();
            setRoutines(data);
        } catch (e: any) {
            notify.error('Error', e?.message || 'No se pudieron cargar las rutinas.');
        } finally {
            setRoutinesLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => {
        if (mode === 'routines') {
            loadRoutines();
        }
    }, [mode, loadRoutines]));

    const handleDeleteRoutine = (routine: Routine) => {
        confirm.destructive(
            '🗑 Eliminar Rutina',
            `¿Eliminar "${routine.name}" y todos sus días?`,
            async () => {
                try {
                    await routineService.deleteRoutine(routine.id);
                    notify.success('Eliminada', 'La rutina fue eliminada.');
                    loadRoutines();
                } catch (e: any) {
                    notify.error('Error', e?.message || 'No se pudo eliminar.');
                }
            },
            'Sí, Eliminar'
        );
    };

    const openRoutineDetail = (id: string) => {
        setDetailRoutineId(id);
        setDetailVisible(true);
    };

    // Card — exactly like ExerciseList and CategoryManager
    const renderRoutineItem = ({ item }: { item: Routine }) => (
        <TouchableOpacity
            onPress={() => openRoutineDetail(item.id)}
            style={s.exerciseCard}
            accessibilityRole="button"
            accessibilityLabel={`Abrir rutina ${item.name}`}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
                <View style={s.iconBox}>
                    <BookOpen size={16} color={Colors.primary.DEFAULT} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
                    {item.description ? (
                        <Text style={s.cardMeta} numberOfLines={1}>{item.description}</Text>
                    ) : (
                        <Text style={s.cardMeta}>RUTINA</Text>
                    )}
                </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TouchableOpacity
                    onPress={() => { setEditingRoutine(item); setCreateModalVisible(true); }}
                    style={s.editBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Editar rutina ${item.name}`}
                >
                    <Pencil size={14} color={Colors.iron[500]} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => handleDeleteRoutine(item)}
                    style={s.deleteBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Eliminar rutina ${item.name}`}
                >
                    <Trash2 size={14} color="#ef4444" />
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaWrapper style={{ backgroundColor: Colors.iron[900] }} edges={['top', 'left', 'right']}>
            {/* Header */}
            <View style={s.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', zIndex: 10 }}>
                    <Text style={s.headerTitle}>Biblioteca</Text>
                </View>
                <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <Image source={require('../../assets/images/icon.png')} style={{ width: 100, height: 100, resizeMode: 'contain' }} />
                </View>
                <View style={{ zIndex: 10, width: 24 }} />
            </View>

            {/* Segment Control */}
            <View style={s.segmentContainer}>
                <View style={s.segmentTrack}>
                    {([
                        { key: 'exercises', label: 'Ejercicios' },
                        { key: 'categories', label: 'Categorías' },
                        { key: 'routines', label: 'Rutinas' },
                    ] as const).map((seg) => (
                        <TouchableOpacity
                            key={seg.key}
                            onPress={() => setMode(seg.key)}
                            style={[s.segmentTab, mode === seg.key && s.segmentTabActive]}
                        >
                            <Text style={[s.segmentText, mode === seg.key && s.segmentTextActive]}>{seg.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {mode === 'exercises' ? (
                <View style={{ flex: 1, position: 'relative' }}>
                    <LinearGradient
                        colors={[Colors.iron[900], 'transparent']}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 16, zIndex: 10 }}
                        pointerEvents="none"
                    />
                    <ExerciseList />
                </View>
            ) : mode === 'categories' ? (
                <View style={{ flex: 1, position: 'relative' }}>
                    <LinearGradient
                        colors={[Colors.iron[900], 'transparent']}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 16, zIndex: 10 }}
                        pointerEvents="none"
                    />
                    <CategoryManager />
                </View>
            ) : (
                /* Routines */
                <View style={{ flex: 1, backgroundColor: Colors.iron[900] }}>
                    <LinearGradient
                        colors={[Colors.iron[900], 'transparent']}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 16, zIndex: 10 }}
                        pointerEvents="none"
                    />
                    {routinesLoading ? (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <ActivityIndicator color={Colors.primary.DEFAULT} />
                        </View>
                    ) : (
                        <FlatList
                            data={routines}
                            keyExtractor={(item) => item.id}
                            renderItem={renderRoutineItem}
                            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                            ListEmptyComponent={() => (
                                <View style={s.emptyState}>
                                    <View style={s.emptyIconCircle}>
                                        <BookOpen size={28} color={Colors.iron[400]} />
                                    </View>
                                    <Text style={s.emptyTitle}>Ninguna rutina</Text>
                                    <Text style={s.emptySub}>Creá rutinas divididas en días con ejercicios personalizados.</Text>
                                </View>
                            )}
                        />
                    )}

                    {/* FAB — same as ExerciseList */}
                    <TouchableOpacity
                        onPress={() => { setEditingRoutine(null); setCreateModalVisible(true); }}
                        style={[s.fab, { bottom: bottomOffset }]}
                        accessibilityRole="button"
                        accessibilityLabel="Crear rutina"
                    >
                        <Plus color="white" size={24} />
                    </TouchableOpacity>

                    <LinearGradient
                        colors={['transparent', Colors.iron[900]]}
                        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: bottomOffset + 60, zIndex: 1 }}
                        pointerEvents="none"
                    />
                </View>
            )}

            {/* Create/Edit Routine Modal */}
            <CreateRoutineModal
                visible={createModalVisible}
                onClose={() => { setCreateModalVisible(false); setEditingRoutine(null); }}
                onCreated={(id) => {
                    setCreateModalVisible(false);
                    setEditingRoutine(null);
                    loadRoutines();
                    if (!editingRoutine) {
                        openRoutineDetail(id);
                    }
                }}
                editRoutine={editingRoutine}
            />

            {/* Routine Detail Modal */}
            <RoutineDetailModal
                visible={detailVisible}
                routineId={detailRoutineId}
                onClose={() => { setDetailVisible(false); setDetailRoutineId(null); loadRoutines(); }}
                onDeleted={loadRoutines}
            />
        </SafeAreaWrapper>
    );
}

const s = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 60,
        backgroundColor: Colors.iron[900],
        zIndex: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 4,
    },
    headerTitle: {
        color: Colors.iron[950],
        fontWeight: '900',
        fontSize: 20,
        letterSpacing: -0.5,
    },
    segmentContainer: {
        paddingHorizontal: 16,
        marginVertical: 12,
    },
    segmentTrack: {
        flexDirection: 'row',
        backgroundColor: Colors.iron[200],
        padding: 4,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: Colors.iron[300],
    },
    segmentTab: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
    },
    segmentTabActive: {
        backgroundColor: Colors.surface,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    segmentText: {
        fontWeight: '700',
        fontSize: 13,
        color: Colors.iron[500],
    },
    segmentTextActive: {
        fontWeight: '900',
        color: Colors.iron[950],
    },
    // Cards — EXACTLY matching ExerciseList
    exerciseCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        marginBottom: 12,
        backgroundColor: Colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.iron[300],
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: Colors.primary.DEFAULT + '20',
        borderWidth: 1,
        borderColor: Colors.primary.DEFAULT + '40',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardName: {
        color: Colors.iron[950],
        fontWeight: '900',
        fontSize: 16,
        letterSpacing: -0.3,
    },
    cardMeta: {
        color: Colors.iron[500],
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: 4,
    },
    editBtn: {
        padding: 8,
        backgroundColor: Colors.iron[200],
        borderRadius: 10,
        borderWidth: 1,
        borderColor: Colors.iron[300],
    },
    deleteBtn: {
        padding: 8,
        backgroundColor: '#ef444412',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#ef444425',
    },
    fab: {
        position: 'absolute',
        right: 24,
        zIndex: 10,
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: Colors.primary.DEFAULT,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: Colors.primary.DEFAULT,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 48,
        paddingHorizontal: 32,
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.iron[100],
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: Colors.iron[950],
        marginBottom: 8,
    },
    emptySub: {
        fontSize: 15,
        color: Colors.iron[600],
        textAlign: 'center',
        lineHeight: 22,
    },
});
