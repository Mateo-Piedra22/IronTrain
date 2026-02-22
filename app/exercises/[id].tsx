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
import { LucidePlus, LucideSearch, LucideTrash2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

export default function CategoryDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [categoryName, setCategoryName] = useState('Ejercicios');
    const [isAdding, setIsAdding] = useState(false);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<ExerciseType | 'all'>('all');

    // New Exercise Form
    const [newName, setNewName] = useState('');
    const [newType, setNewType] = useState<ExerciseType>('weight_reps'); // default

    useEffect(() => {
        if (id) {
            loadData();
        }
    }, [id, search, typeFilter]);

    const loadData = async () => {
        try {
            if (!id) return;
            const [ex, cat] = await Promise.all([
                ExerciseService.getByCategory(id),
                CategoryService.getById(id)
            ]);
            setCategoryName(cat?.name ?? 'Ejercicios');

            const normalized = (search || '').trim().toLowerCase();
            const filtered = ex.filter((e) => {
                const matchesSearch = normalized.length === 0 ? true : (e.name || '').toLowerCase().includes(normalized);
                const matchesType = typeFilter === 'all' ? true : e.type === typeFilter;
                return matchesSearch && matchesType;
            });

            setExercises(filtered);
        } catch (e) {
            console.error(e);
        }
    };

    const handleCreate = async () => {
        if (!newName.trim() || !id) {
            notify.error('Escribe un nombre para el ejercicio.');
            return;
        }
        try {
            await ExerciseService.create({
                category_id: id,
                name: newName.trim(),
                type: newType,
                notes: ''
            });
            setNewName('');
            setIsAdding(false);
            loadData();
        } catch (e) {
            notify.error((e as Error).message);
        }
    };

    const handleDelete = async (exId: string, name: string) => {
        Alert.alert('Eliminar ejercicio', `¿Eliminar "${name}"?`, [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Eliminar',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await ExerciseService.delete(exId);
                        loadData();
                    } catch (e) {
                        notify.error((e as Error).message);
                    }
                }
            }
        ]);
    };

    const typeLabel = (t: ExerciseType) => {
        if (t === 'weight_reps') return 'Peso + reps';
        if (t === 'distance_time') return 'Distancia + tiempo';
        if (t === 'weight_only') return 'Solo peso';
        return 'Solo reps';
    };

    const emptyText = useMemo(() => {
        if ((search || '').trim().length > 0 || typeFilter !== 'all') return 'No hay resultados con estos filtros.';
        return 'No hay ejercicios en esta categoría.';
    }, [search, typeFilter]);

    return (
        <SafeAreaWrapper className="flex-1 bg-iron-900" edges={['top', 'left', 'right']}>
            <View className="flex-row justify-between items-center mb-6 px-4 pt-4">
                <View>
                    <Text className="text-2xl font-bold text-iron-950">{categoryName}</Text>
                    <Text className="text-iron-500 text-xs font-bold mt-1">Gestiona y abre el historial de tus ejercicios</Text>
                </View>
                <Pressable
                    onPress={() => setIsAdding(!isAdding)}
                    className="bg-surface p-2 rounded-lg border border-iron-700 elevation-1 active:bg-iron-200"
                    accessibilityRole="button"
                    accessibilityLabel={isAdding ? 'Cerrar formulario' : 'Crear ejercicio'}
                >
                    <LucidePlus size={24} color={Colors.primary.DEFAULT} />
                </Pressable>
            </View>

            <View className="px-4 mb-4">
                <View className="flex-row items-center bg-surface px-4 py-3 rounded-xl border border-iron-700">
                    <LucideSearch size={18} color={Colors.iron[500]} />
                    <TextInput
                        className="flex-1 ml-3 text-iron-950"
                        placeholder="Buscar ejercicio…"
                        placeholderTextColor={Colors.iron[400]}
                        value={search}
                        onChangeText={setSearch}
                        accessibilityLabel="Buscar ejercicio"
                    />
                </View>

                <View className="flex-row gap-2 mt-3 flex-wrap">
                    {(['all', 'weight_reps', 'weight_only', 'reps_only', 'distance_time'] as const).map((t) => (
                        <Pressable
                            key={t}
                            onPress={() => setTypeFilter(t as any)}
                            className={`px-3 py-2 rounded-full border ${typeFilter === t ? 'bg-surface border-primary' : 'bg-transparent border-iron-700'}`}
                            accessibilityRole="button"
                            accessibilityLabel={`Filtrar por ${t === 'all' ? 'todo' : typeLabel(t as any)}`}
                        >
                            <Text className={`font-bold text-xs ${typeFilter === t ? 'text-primary' : 'text-iron-950'}`}>
                                {t === 'all' ? 'Todos' : typeLabel(t as any)}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            </View>

            {isAdding && (
                <View className="bg-surface mx-4 p-4 rounded-xl border border-iron-700 elevation-2 mb-4">
                    <Text className="text-iron-950 font-bold mb-4 text-lg">Nuevo ejercicio</Text>
                    <IronInput
                        placeholder="Nombre del ejercicio"
                        value={newName}
                        onChangeText={setNewName}
                        autoFocus
                    />
                    <View className="flex-row gap-2 mb-4 flex-wrap">
                        {(['weight_reps', 'weight_only', 'reps_only', 'distance_time'] as const).map((t) => (
                            <Pressable
                                key={t}
                                onPress={() => setNewType(t)}
                                className={`px-3 py-2 rounded-full border ${newType === t ? 'bg-primary border-primary' : 'bg-white border-iron-200'}`}
                                accessibilityRole="button"
                                accessibilityLabel={`Seleccionar tipo ${typeLabel(t)}`}
                            >
                                <Text className={`font-bold text-xs ${newType === t ? 'text-white' : 'text-iron-950'}`}>{typeLabel(t)}</Text>
                            </Pressable>
                        ))}
                    </View>
                    <IronButton
                        label="CREAR"
                        onPress={handleCreate}
                        variant="solid"
                    />
                </View>
            )}

            <FlashList
                data={exercises}
                // @ts-ignore
                estimatedItemSize={70}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
                renderItem={({ item }) => (
                    <Pressable
                        onPress={() =>
                            router.push({
                                pathname: '/exercise/[id]' as any,
                                params: { id: item.id, exerciseId: item.id, exerciseName: item.name }
                            })
                        }
                        className="bg-surface p-4 rounded-xl mb-3 border border-iron-700 elevation-1 flex-row justify-between items-center active:bg-iron-200"
                        accessibilityRole="button"
                        accessibilityLabel={`Abrir ejercicio ${item.name}`}
                    >
                        <View className="flex-1 pr-3">
                            <Text className="text-iron-950 font-bold text-lg">{item.name}</Text>
                            <Text className="text-iron-500 text-xs font-bold uppercase tracking-wider">{typeLabel(item.type)}</Text>
                        </View>
                        <View className="flex-row items-center">
                            {!item.is_system && (
                                <Pressable
                                    onPress={() => handleDelete(item.id, item.name)}
                                    className="p-3 -mr-2 active:opacity-50"
                                    accessibilityRole="button"
                                    accessibilityLabel={`Eliminar ejercicio ${item.name}`}
                                >
                                    <LucideTrash2 size={20} color={Colors.iron[400]} />
                                </Pressable>
                            )}
                        </View>
                    </Pressable>
                )}
                ListEmptyComponent={
                    <Text className="text-iron-500 text-center mt-10">{emptyText}</Text>
                }
            />
        </SafeAreaWrapper>
    );
}
