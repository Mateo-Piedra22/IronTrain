import { CategoryManager } from '@/components/CategoryManager';
import { CreateRoutineModal } from '@/components/CreateRoutineModal';
import { ExerciseList } from '@/components/ExerciseList';
import { RoutineDetailModal } from '@/components/RoutineDetailModal';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { useDataReload } from '@/src/hooks/useDataReload';
import { routineService } from '@/src/services/RoutineService';
import { confirm } from '@/src/store/confirmStore';
import { Routine } from '@/src/types/db';
import { notify } from '@/src/utils/notify';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react-native';
import React, { useCallback, useContext, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../../src/hooks/useColors';

type SegmentMode = 'exercises' | 'categories' | 'routines';

export default function LibraryScreen() {
    const colors = useColors();
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

    const ss = useMemo(() => StyleSheet.create({
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 16,
            height: 60,
            backgroundColor: colors.iron[900],
            zIndex: 10,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 3,
            elevation: 4,
        },
        headerTitle: {
            color: colors.iron[950],
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
            backgroundColor: colors.iron[200],
            padding: 4,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: colors.iron[300],
        },
        segmentTab: {
            flex: 1,
            paddingVertical: 10,
            borderRadius: 10,
            alignItems: 'center',
        },
        segmentTabActive: {
            backgroundColor: colors.surface,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
        },
        segmentText: {
            fontWeight: '700',
            fontSize: 13,
            color: colors.iron[500],
        },
        segmentTextActive: {
            fontWeight: '900',
            color: colors.iron[950],
        },
        // Cards — EXACTLY matching ExerciseList
        exerciseCard: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
            marginBottom: 12,
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: colors.iron[300],
            elevation: 2,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 6,
        },
        iconBox: {
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: colors.primary.DEFAULT + '20',
            borderWidth: 1.5,
            borderColor: colors.primary.DEFAULT + '40',
            justifyContent: 'center',
            alignItems: 'center',
        },
        cardName: {
            color: colors.iron[950],
            fontWeight: '900',
            fontSize: 16,
            letterSpacing: -0.3,
        },
        cardMeta: {
            color: colors.iron[500],
            fontSize: 11,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginTop: 4,
        },
        editBtn: {
            padding: 8,
            backgroundColor: colors.iron[200],
            borderRadius: 10,
            borderWidth: 1.5,
            borderColor: colors.iron[300],
        },
        deleteBtn: {
            padding: 8,
            backgroundColor: colors.red + '12',
            borderRadius: 10,
            borderWidth: 1.5,
            borderColor: colors.red + '25',
        },
        fab: {
            position: 'absolute',
            right: 24,
            zIndex: 10,
            width: 56,
            height: 56,
            borderRadius: 16,
            backgroundColor: colors.primary.DEFAULT,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: colors.primary.DEFAULT,
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
            backgroundColor: colors.iron[100],
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
        },
        emptyTitle: {
            fontSize: 20,
            fontWeight: '900',
            color: colors.iron[950],
            marginBottom: 8,
        },
        emptySub: {
            fontSize: 15,
            color: colors.iron[600],
            textAlign: 'center',
            lineHeight: 22,
        },
    }), [colors]);

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

    useDataReload(() => {
        if (mode === 'routines') {
            loadRoutines();
        }
    });

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
            style={ss.exerciseCard}
            accessibilityRole="button"
            accessibilityLabel={`Abrir rutina ${item.name}`}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
                <View style={ss.iconBox}>
                    <BookOpen size={16} color={colors.primary.DEFAULT} />
                </View>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={ss.cardName} numberOfLines={1}>{item.name}</Text>
                        {item.is_moderated === 1 && (
                            <View style={{ backgroundColor: colors.yellow + '20', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, borderWidth: 1.5, borderColor: colors.yellow + '40' }}>
                                <Text style={{ color: colors.yellow, fontSize: 8, fontWeight: '900' }}>OCULTA</Text>
                            </View>
                        )}
                    </View>
                    {item.description ? (
                        <Text style={ss.cardMeta} numberOfLines={1}>{item.description}</Text>
                    ) : (
                        <Text style={ss.cardMeta}>RUTINA</Text>
                    )}
                </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TouchableOpacity
                    onPress={() => { setEditingRoutine(item); setCreateModalVisible(true); }}
                    style={ss.editBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Editar rutina ${item.name}`}
                >
                    <Pencil size={14} color={colors.iron[500]} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => handleDeleteRoutine(item)}
                    style={ss.deleteBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Eliminar rutina ${item.name}`}
                >
                    <Trash2 size={14} color={colors.red} />
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaWrapper style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
            {/* Header */}
            <View style={ss.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', zIndex: 10 }}>
                    <Text style={ss.headerTitle}>Biblioteca</Text>
                </View>
                <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <Image source={require('../../assets/images/icon.png')} style={{ width: 100, height: 100, resizeMode: 'contain' }} />
                </View>
                <View style={{ zIndex: 10, width: 24 }} />
            </View>

            {/* Segment Control */}
            <View style={ss.segmentContainer}>
                <View style={ss.segmentTrack}>
                    {([
                        { key: 'exercises', label: 'Ejercicios' },
                        { key: 'categories', label: 'Categorías' },
                        { key: 'routines', label: 'Rutinas' },
                    ] as const).map((seg) => (
                        <TouchableOpacity
                            key={seg.key}
                            onPress={() => setMode(seg.key)}
                            style={[ss.segmentTab, mode === seg.key && ss.segmentTabActive]}
                        >
                            <Text style={[ss.segmentText, mode === seg.key && ss.segmentTextActive]}>{seg.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {mode === 'exercises' ? (
                <View style={{ flex: 1, position: 'relative' }}>
                    <LinearGradient
                        colors={[colors.iron[900], 'transparent']}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 16, zIndex: 10 }}
                        pointerEvents="none"
                    />
                    <ExerciseList />
                </View>
            ) : mode === 'categories' ? (
                <View style={{ flex: 1, position: 'relative' }}>
                    <LinearGradient
                        colors={[colors.iron[900], 'transparent']}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 16, zIndex: 10 }}
                        pointerEvents="none"
                    />
                    <CategoryManager />
                </View>
            ) : (
                /* Routines */
                <View style={{ flex: 1, backgroundColor: colors.background }}>
                    <LinearGradient
                        colors={[colors.iron[900], 'transparent']}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 16, zIndex: 10 }}
                        pointerEvents="none"
                    />
                    {routinesLoading ? (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <ActivityIndicator color={colors.primary.DEFAULT} />
                        </View>
                    ) : (
                        <FlatList
                            data={routines}
                            keyExtractor={(item) => item.id}
                            renderItem={renderRoutineItem}
                            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                            ListEmptyComponent={() => (
                                <View style={ss.emptyState}>
                                    <View style={ss.emptyIconCircle}>
                                        <BookOpen size={28} color={colors.iron[400]} />
                                    </View>
                                    <Text style={ss.emptyTitle}>Ninguna rutina</Text>
                                    <Text style={ss.emptySub}>Creá rutinas divididas en días con ejercicios personalizados.</Text>
                                </View>
                            )}
                        />
                    )}

                    {/* FAB — same as ExerciseList */}
                    <TouchableOpacity
                        onPress={() => { setEditingRoutine(null); setCreateModalVisible(true); }}
                        style={[ss.fab, { bottom: bottomOffset }]}
                        accessibilityRole="button"
                        accessibilityLabel="Crear rutina"
                    >
                        <Plus color="white" size={24} />
                    </TouchableOpacity>

                    <LinearGradient
                        colors={['transparent', colors.background]}
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
