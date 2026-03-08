import { IronButton } from '@/components/IronButton';
import { IronInput } from '@/components/IronInput';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { CategoryService } from '@/src/services/CategoryService';
import { Exercise, ExerciseService } from '@/src/services/ExerciseService';
import { Colors } from '@/src/theme';
import { ExerciseType } from '@/src/types/db';
import { notify } from '@/src/utils/notify';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight, Dumbbell, Plus, Search, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { confirm } from '../../src/store/confirmStore';

export default function CategoryDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [categoryName, setCategoryName] = useState('Ejercicios');
    const [isAdding, setIsAdding] = useState(false);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<ExerciseType | 'all'>('all');
    const [newName, setNewName] = useState('');
    const [newType, setNewType] = useState<ExerciseType>('weight_reps');

    useEffect(() => { if (id) loadData(); }, [id, search, typeFilter]);

    const loadData = async () => {
        try {
            if (!id) return;
            const [ex, cat] = await Promise.all([ExerciseService.getByCategory(id), CategoryService.getById(id)]);
            setCategoryName(cat?.name ?? 'Ejercicios');
            const normalized = (search || '').trim().toLowerCase();
            const filtered = ex.filter((e) => {
                const matchesSearch = normalized.length === 0 ? true : (e.name || '').toLowerCase().includes(normalized);
                const matchesType = typeFilter === 'all' ? true : e.type === typeFilter;
                return matchesSearch && matchesType;
            });
            setExercises(filtered);
        } catch (e) {
            notify.error('Error', 'No se pudieron cargar los ejercicios.');
        }
    };

    const handleCreate = async () => {
        if (!newName.trim() || !id) { notify.error('Campo requerido', 'Escribe un nombre para el ejercicio.'); return; }
        try {
            await ExerciseService.create({ category_id: id, name: newName.trim(), type: newType, notes: '' });
            setNewName('');
            setIsAdding(false);
            loadData();
            notify.success('Creado', `"${newName.trim()}" fue añadido.`);
        } catch (e: any) { notify.error('Error al crear', e?.message || 'Error de base de datos.'); }
    };

    const handleDelete = async (exId: string, name: string) => {
        confirm.destructive(
            'Eliminar ejercicio',
            `¿Eliminar "${name}"?`,
            async () => {
                try { await ExerciseService.delete(exId); loadData(); notify.info('Eliminado', `"${name}" fue removido.`); }
                catch (e: any) { notify.error('Eliminación fallida', e?.message || 'No se pudo eliminar de la base de datos.'); }
            },
            'Eliminar'
        );
    };

    const typeLabel = (t: ExerciseType) => {
        if (t === 'weight_reps') return 'Peso + reps';
        if (t === 'distance_time') return 'Distancia + tiempo';
        if (t === 'weight_only') return 'Solo peso';
        return 'Solo reps';
    };

    const typeIcon = (t: ExerciseType) => {
        if (t === 'weight_reps') return '🏋️';
        if (t === 'distance_time') return '🏃';
        if (t === 'weight_only') return '⚖️';
        return '🔄';
    };

    const emptyText = useMemo(() => {
        if ((search || '').trim().length > 0 || typeFilter !== 'all') return 'No hay resultados con estos filtros.';
        return 'No hay ejercicios en esta categoría.';
    }, [search, typeFilter]);

    const filterChips: { id: ExerciseType | 'all'; label: string }[] = [
        { id: 'all', label: 'Todos' },
        { id: 'weight_reps', label: 'Peso+Reps' },
        { id: 'weight_only', label: 'Solo Peso' },
        { id: 'reps_only', label: 'Solo Reps' },
        { id: 'distance_time', label: 'Cardio' },
    ];

    return (
        <SafeAreaWrapper style={{ flex: 1, backgroundColor: Colors.iron[900] }} edges={['top', 'left', 'right']}>
            {/* Header */}
            <View style={ss.header}>
                <View style={{ flex: 1 }}>
                    <Text style={ss.headerTitle}>{categoryName}</Text>
                    <Text style={ss.headerSubtitle}>{exercises.length} ejercicio{exercises.length !== 1 ? 's' : ''}</Text>
                </View>
                <Pressable
                    onPress={() => setIsAdding(!isAdding)}
                    style={[ss.addBtn, isAdding && { backgroundColor: Colors.primary.DEFAULT }]}
                    accessibilityRole="button"
                    accessibilityLabel={isAdding ? 'Cerrar formulario' : 'Crear ejercicio'}
                >
                    <Plus size={20} color={isAdding ? Colors.white : Colors.primary.DEFAULT} />
                </Pressable>
            </View>

            {/* Search */}
            <View style={ss.searchContainer}>
                <View style={ss.searchBox}>
                    <Search size={16} color={Colors.iron[400]} />
                    <TextInput
                        style={ss.searchInput}
                        placeholder="Buscar ejercicio…"
                        placeholderTextColor={Colors.iron[400]}
                        value={search}
                        onChangeText={setSearch}
                        accessibilityLabel="Buscar ejercicio"
                    />
                </View>
            </View>

            {/* Type Filters */}
            <View style={ss.filterRow}>
                {filterChips.map((f) => (
                    <Pressable
                        key={f.id}
                        onPress={() => setTypeFilter(f.id as any)}
                        style={[ss.filterChip, typeFilter === f.id && ss.filterChipActive]}
                        accessibilityRole="button"
                    >
                        <Text style={[ss.filterChipText, typeFilter === f.id && ss.filterChipTextActive]}>{f.label}</Text>
                    </Pressable>
                ))}
            </View>

            {/* Create Form */}
            {isAdding && (
                <View style={ss.createForm}>
                    <View style={ss.createFormHeader}>
                        <View style={ss.createFormAccent} />
                        <Text style={ss.createFormTitle}>Nuevo ejercicio</Text>
                    </View>
                    <IronInput placeholder="Nombre del ejercicio" value={newName} onChangeText={setNewName} autoFocus />
                    <View style={ss.typeChipRow}>
                        {(['weight_reps', 'weight_only', 'reps_only', 'distance_time'] as const).map((t) => (
                            <Pressable
                                key={t}
                                onPress={() => setNewType(t)}
                                style={[ss.typeChip, newType === t && ss.typeChipActive]}
                                accessibilityRole="button"
                            >
                                <Text style={[ss.typeChipText, newType === t && ss.typeChipTextActive]}>{typeLabel(t)}</Text>
                            </Pressable>
                        ))}
                    </View>
                    <IronButton label="CREAR" onPress={handleCreate} variant="solid" />
                </View>
            )}

            {/* Exercise List */}
            <FlashList
                data={exercises}
                // @ts-ignore
                estimatedItemSize={80}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
                renderItem={({ item }) => (
                    <Pressable
                        onPress={() => router.push({ pathname: '/exercise/[id]' as any, params: { id: item.id, exerciseId: item.id, exerciseName: item.name } })}
                        style={ss.exerciseCard}
                        accessibilityRole="button"
                        accessibilityLabel={`Abrir ejercicio ${item.name}`}
                    >
                        <View style={ss.exerciseCardLeft}>
                            <View style={ss.exerciseIcon}>
                                <Text style={{ fontSize: 16 }}>{typeIcon(item.type)}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={ss.exerciseName} numberOfLines={1}>{item.name}</Text>
                                <Text style={ss.exerciseType}>{typeLabel(item.type)}</Text>
                            </View>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            {!item.is_system && (
                                <Pressable
                                    onPress={() => handleDelete(item.id, item.name)}
                                    style={ss.deleteBtn}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Eliminar ${item.name}`}
                                >
                                    <Trash2 size={16} color={Colors.iron[400]} />
                                </Pressable>
                            )}
                            <ChevronRight size={16} color={Colors.iron[400]} />
                        </View>
                    </Pressable>
                )}
                ListEmptyComponent={
                    <View style={ss.emptyState}>
                        <Dumbbell size={32} color={Colors.iron[300]} />
                        <Text style={ss.emptyText}>{emptyText}</Text>
                    </View>
                }
            />
        </SafeAreaWrapper>
    );
}

const ss = StyleSheet.create({
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
    headerTitle: { fontSize: 24, fontWeight: '900', color: Colors.iron[950], letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 12, fontWeight: '600', color: Colors.iron[400], marginTop: 2 },
    addBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primary.DEFAULT + '15', borderWidth: 1, borderColor: Colors.primary.DEFAULT + '30', justifyContent: 'center', alignItems: 'center' },
    searchContainer: { paddingHorizontal: 16, marginBottom: 8 },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: Colors.iron[700], gap: 10 },
    searchInput: { flex: 1, fontSize: 14, color: Colors.iron[950], padding: 0 },
    filterRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 6, marginBottom: 12, flexWrap: 'wrap' },
    filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: Colors.iron[700], backgroundColor: 'transparent' },
    filterChipActive: { backgroundColor: Colors.primary.DEFAULT + '15', borderColor: Colors.primary.DEFAULT },
    filterChipText: { fontWeight: '700', fontSize: 11, color: Colors.iron[500] },
    filterChipTextActive: { color: Colors.primary.DEFAULT },
    createForm: { backgroundColor: Colors.surface, marginHorizontal: 16, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: Colors.iron[700], marginBottom: 12, elevation: 3, shadowColor: Colors.black, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 },
    createFormHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    createFormAccent: { width: 3, height: 18, borderRadius: 2, backgroundColor: Colors.primary.DEFAULT },
    createFormTitle: { fontSize: 16, fontWeight: '900', color: Colors.iron[950] },
    typeChipRow: { flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' },
    typeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.iron[300], backgroundColor: Colors.iron[200] },
    typeChipActive: { backgroundColor: Colors.primary.DEFAULT, borderColor: Colors.primary.DEFAULT },
    typeChipText: { fontWeight: '700', fontSize: 12, color: Colors.iron[500] },
    typeChipTextActive: { color: Colors.white },
    exerciseCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surface, padding: 14, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.iron[700], elevation: 1 },
    exerciseCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12, paddingRight: 8 },
    exerciseIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.iron[200], borderWidth: 1, borderColor: Colors.iron[300], justifyContent: 'center', alignItems: 'center' },
    exerciseName: { fontSize: 15, fontWeight: '800', color: Colors.iron[950] },
    exerciseType: { fontSize: 11, fontWeight: '600', color: Colors.iron[400], textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
    deleteBtn: { padding: 10 },
    emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
    emptyText: { color: Colors.iron[400], fontSize: 13, textAlign: 'center' },
});
