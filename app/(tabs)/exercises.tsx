import { CategoryManager } from '@/components/CategoryManager';
import { CreateRoutineModal } from '@/components/CreateRoutineModal';
import { DuplicateResolutionModal } from '@/components/DuplicateResolutionModal';
import { ExerciseList } from '@/components/ExerciseList';
import { RoutineDetailModal } from '@/components/RoutineDetailModal';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { useDataReload } from '@/src/hooks/useDataReload';
import { configService } from '@/src/services/ConfigService';
import { DuplicateResolutionService } from '@/src/services/DuplicateResolutionService';
import { routineService } from '@/src/services/RoutineService';
import { confirm } from '@/src/store/confirmStore';
import { Routine } from '@/src/types/db';
import { notify } from '@/src/utils/notify';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { AlertTriangle, BookOpen, Pencil, Plus, Trash2 } from 'lucide-react-native';
import React, { useCallback, useContext, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IronTrainLogo } from '../../components/IronTrainLogo';
import { useColors } from '../../src/hooks/useColors';
import { ThemeFx, withAlpha } from '../../src/theme';

type SegmentMode = 'exercises' | 'categories' | 'routines';

// Optimized Card Component
const RoutineCard = React.memo(({ item, colors, ss, onPress, onEdit, onDelete }: {
    item: Routine;
    colors: any;
    ss: any;
    onPress: (id: string) => void;
    onEdit: (item: Routine) => void;
    onDelete: (item: Routine) => void;
}) => (
    <TouchableOpacity
        onPress={() => onPress(item.id)}
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
                onPress={() => onEdit(item)}
                style={ss.editBtn}
                accessibilityRole="button"
                accessibilityLabel={`Editar rutina ${item.name}`}
            >
                <Pencil size={14} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
                onPress={() => onDelete(item)}
                style={ss.deleteBtn}
                accessibilityRole="button"
                accessibilityLabel={`Eliminar rutina ${item.name}`}
            >
                <Trash2 size={14} color={colors.red} />
            </TouchableOpacity>
        </View>
    </TouchableOpacity>
));

export default function LibraryScreen() {
    const colors = useColors();
    const [mode, setMode] = useState<SegmentMode>('exercises');

    const [duplicatesVisible, setDuplicatesVisible] = useState(false);
    const [duplicateCount, setDuplicateCount] = useState(0);

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
            height: 64,
            backgroundColor: colors.background,
            zIndex: 10,
            borderBottomWidth: 1.5,
            borderBottomColor: colors.border,
            ...ThemeFx.shadowSm,
        },
        headerTitle: {
            color: colors.text,
            fontWeight: '900',
            fontSize: 20,
            letterSpacing: -0.5,
        },
        segmentContainer: {
            paddingHorizontal: 16,
            marginTop: 8,
            marginBottom: 0,
        },
        segmentTrack: {
            flexDirection: 'row',
            backgroundColor: colors.surface,
            padding: 4,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        segmentTab: {
            flex: 1,
            paddingVertical: 10,
            borderRadius: 10,
            alignItems: 'center',
        },
        segmentTabActive: {
            backgroundColor: colors.primary.DEFAULT,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
        },
        segmentText: {
            fontWeight: '700',
            fontSize: 13,
            color: colors.textMuted,
        },
        segmentTextActive: {
            fontWeight: '900',
            color: colors.onPrimary,
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
            borderColor: colors.border,
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
            backgroundColor: withAlpha(colors.primary.DEFAULT, '20'),
            borderWidth: 1.5,
            borderColor: withAlpha(colors.primary.DEFAULT, '40'),
            justifyContent: 'center',
            alignItems: 'center',
        },
        cardName: {
            color: colors.text,
            fontWeight: '900',
            fontSize: 16,
            letterSpacing: -0.3,
        },
        cardMeta: {
            color: colors.textMuted,
            fontSize: 11,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginTop: 4,
        },
        editBtn: {
            padding: 8,
            backgroundColor: colors.surfaceLighter,
            borderRadius: 10,
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        deleteBtn: {
            padding: 8,
            backgroundColor: withAlpha(colors.red, '12'),
            borderRadius: 10,
            borderWidth: 1.5,
            borderColor: withAlpha(colors.red, '25'),
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
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        emptyTitle: {
            fontSize: 20,
            fontWeight: '900',
            color: colors.text,
            marginBottom: 8,
        },
        emptySub: {
            fontSize: 15,
            color: colors.textMuted,
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

    const loadDuplicateCount = useCallback(async () => {
        try {
            const scan = await DuplicateResolutionService.scanAllDuplicates();
            const ignored = new Set(configService.get('ignoredDuplicateKeys') ?? []);
            const hard = (scan.hard ?? []).filter((g) => !ignored.has(g.key));
            const soft = (scan.soft ?? []).filter((g) => !ignored.has(g.key));
            setDuplicateCount(hard.length + soft.length);
        } catch {
            setDuplicateCount(0);
        }
    }, []);

    useFocusEffect(useCallback(() => {
        loadDuplicateCount();
        if (mode === 'routines') {
            loadRoutines();
        }
    }, [mode, loadRoutines, loadDuplicateCount]));

    useDataReload(() => {
        loadDuplicateCount();
        if (mode === 'routines') {
            loadRoutines();
        }
    });

    const handleDeleteRoutine = useCallback((routine: Routine) => {
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
    }, [loadRoutines]);

    const openRoutineDetail = useCallback((id: string) => {
        setDetailRoutineId(id);
        setDetailVisible(true);
    }, []);

    const handleEditRoutine = useCallback((item: Routine) => {
        setEditingRoutine(item);
        setCreateModalVisible(true);
    }, []);

    const renderRoutineItem = useCallback(({ item }: { item: Routine }) => (
        <RoutineCard
            item={item}
            colors={colors}
            ss={ss}
            onPress={openRoutineDetail}
            onEdit={handleEditRoutine}
            onDelete={handleDeleteRoutine}
        />
    ), [colors, ss, openRoutineDetail, handleEditRoutine, handleDeleteRoutine]);

    const handleCreateRoutine = useCallback(() => {
        setEditingRoutine(null);
        setCreateModalVisible(true);
    }, []);

    return (
        <SafeAreaWrapper style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
            {/* Header */}
            <View style={ss.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', zIndex: 10 }}>
                    <Text style={ss.headerTitle}>Biblioteca</Text>
                </View>
                <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <IronTrainLogo size={60} />
                </View>
                <View style={{ zIndex: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TouchableOpacity
                        onPress={() => setDuplicatesVisible(true)}
                        disabled={duplicateCount <= 0}
                        style={{
                            opacity: duplicateCount > 0 ? 1 : 0.35,
                            width: 42,
                            height: 42,
                            borderRadius: 21,
                            backgroundColor: colors.surface,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1.5,
                            borderColor: duplicateCount > 0 ? withAlpha(colors.yellow, '66') : colors.border,
                            ...ThemeFx.shadowSm,
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Resolver duplicados"
                    >
                        <AlertTriangle size={18} color={duplicateCount > 0 ? colors.yellow : colors.textMuted} />
                        {duplicateCount > 0 && (
                            <View
                                style={{
                                    position: 'absolute',
                                    top: -2,
                                    right: -2,
                                    minWidth: 18,
                                    height: 18,
                                    paddingHorizontal: 5,
                                    borderRadius: 9,
                                    backgroundColor: colors.yellow,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderWidth: 1.5,
                                    borderColor: colors.background,
                                }}
                            >
                                <Text style={{ color: colors.black, fontSize: 10, fontWeight: '900' }}>{duplicateCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
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
                        colors={[colors.background, 'transparent']}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 16, zIndex: 10 }}
                        pointerEvents="none"
                    />
                    <ExerciseList />
                </View>
            ) : mode === 'categories' ? (
                <View style={{ flex: 1, position: 'relative' }}>
                    <LinearGradient
                        colors={[colors.background, 'transparent']}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 16, zIndex: 10 }}
                        pointerEvents="none"
                    />
                    <CategoryManager />
                </View>
            ) : (
                /* Routines */
                <View style={{ flex: 1, backgroundColor: colors.background }}>
                    <LinearGradient
                        colors={[colors.background, 'transparent']}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 16, zIndex: 10 }}
                        pointerEvents="none"
                    />
                    {routinesLoading ? (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <ActivityIndicator color={colors.primary.DEFAULT} />
                        </View>
                    ) : (
                        <FlashList
                            data={routines}
                            keyExtractor={(item) => item.id}
                            renderItem={renderRoutineItem}
                            contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 16, paddingBottom: 100 }}
                            ListEmptyComponent={() => (
                                <View style={ss.emptyState}>
                                    <View style={ss.emptyIconCircle}>
                                        <BookOpen size={28} color={colors.textMuted} />
                                    </View>
                                    <Text style={ss.emptyTitle}>Ninguna rutina</Text>
                                    <Text style={ss.emptySub}>Creá rutinas divididas en días con ejercicios personalizados.</Text>
                                </View>
                            )}
                        />
                    )}

                    {/* FAB — same as ExerciseList */}
                    <TouchableOpacity
                        onPress={handleCreateRoutine}
                        style={[ss.fab, { bottom: bottomOffset }]}
                        accessibilityRole="button"
                        accessibilityLabel="Crear rutina"
                    >
                        <Plus color={colors.onPrimary} size={24} />
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

            <DuplicateResolutionModal
                visible={duplicatesVisible}
                onClose={() => {
                    setDuplicatesVisible(false);
                    loadDuplicateCount();
                }}
            />
        </SafeAreaWrapper>
    );
}
