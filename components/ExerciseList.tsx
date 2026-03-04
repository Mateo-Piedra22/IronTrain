// @ts-nocheck
import { Colors } from '@/src/theme';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react-native';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryService } from '../src/services/CategoryService';
import { ExerciseService } from '../src/services/ExerciseService';
import { confirm } from '../src/store/confirmStore';
import { Category, Exercise } from '../src/types/db';
import { ExerciseFormModal } from './ExerciseFormModal';

interface ExerciseListProps {
    onSelect?: (exerciseId: string) => void;
    inModal?: boolean;
}

type ExerciseItem = Exercise & { category_name: string; category_color: string };
type CategoryItem = Category | { id: string; name: string; color: string };

export function ExerciseList({ onSelect, inModal }: ExerciseListProps) {
    const [exercises, setExercises] = useState<ExerciseItem[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [loading, setLoading] = useState(true);

    // Form Modal
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
    const insets = useSafeAreaInsets();
    const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
    const bottomOffset = (tabBarHeight ? tabBarHeight : insets.bottom) + 12;

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [exs, cats] = await Promise.all([
                ExerciseService.search(searchQuery, selectedCategory),
                CategoryService.getAll()
            ]);
            setExercises(exs);
            setCategories(cats);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [searchQuery, selectedCategory]);

    // Optimized Search with Debounce
    useEffect(() => {
        const timeout = setTimeout(loadData, 300);
        return () => clearTimeout(timeout);
    }, [loadData]);


    const router = useRouter(); // Required

    const handleCreate = () => {
        setEditingExercise(null);
        setIsFormVisible(true);
    };

    const handleEdit = (ex: Exercise) => {
        setEditingExercise(ex);
        setIsFormVisible(true);
    };

    const handleDelete = (ex: Exercise) => {
        confirm.destructive(
            'Eliminar ejercicio',
            `¿Eliminar "${ex.name}"?`,
            async () => {
                try {
                    await ExerciseService.delete(ex.id);
                    await loadData();
                } catch (e: any) {
                    confirm.error('No se pudo eliminar', e?.message ?? 'Error');
                }
            },
            'Eliminar'
        );
    };

    const handlePress = (ex: Exercise) => {
        if (onSelect) {
            onSelect(ex.id);
        } else {
            // Updated Navigation to Detail Screen
            router.push({
                pathname: '/exercise/[id]' as any,
                params: {
                    id: ex.id,
                    exerciseId: ex.id,
                    exerciseName: ex.name
                    // NO workoutId passed -> View Mode
                }
            });
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: inModal ? Colors.iron[100] : Colors.iron[900] }}>
            {/* Search Header */}
            <View style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: Colors.iron[300], elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, gap: 10 }}>
                    <Search size={20} color={Colors.iron[400]} />
                    <TextInput
                        style={{ flex: 1, fontSize: 16, color: Colors.iron[950], padding: 0, fontWeight: '500' }}
                        placeholder="Buscar ejercicio…"
                        placeholderTextColor={Colors.iron[400]}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {/* Category Chips */}
                <View style={{ marginTop: 12 }}>
                    <FlatList<CategoryItem>
                        horizontal
                        data={[{ id: 'all', name: 'Todos', color: Colors.iron[950] }, ...categories]}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingRight: 20 }}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => setSelectedCategory(item.id)}
                                style={{
                                    marginRight: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100,
                                    borderWidth: 1,
                                    backgroundColor: selectedCategory === item.id ? Colors.primary.DEFAULT : Colors.surface,
                                    borderColor: selectedCategory === item.id ? Colors.primary.DEFAULT : Colors.iron[300],
                                    elevation: selectedCategory === item.id ? 2 : 1,
                                    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2,
                                }}
                            >
                                <Text style={{
                                    fontSize: 13, fontWeight: '800',
                                    color: selectedCategory === item.id ? '#fff' : Colors.iron[500]
                                }}>
                                    {item.name}
                                </Text>
                            </TouchableOpacity>
                        )}
                    />
                </View>
            </View>

            {/* List */}
            {loading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator color={Colors.primary.dark} />
                </View>
            ) : (
                <FlatList<ExerciseItem>
                    data={exercises}
                    contentContainerStyle={{ padding: 16, paddingBottom: inModal ? 40 : 100 }}
                    onEndReachedThreshold={0.5}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            onPress={() => handlePress(item)}
                            style={{
                                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                padding: 16, marginBottom: 12, backgroundColor: Colors.surface,
                                borderRadius: 16, borderWidth: 1, borderColor: Colors.iron[300], elevation: 2,
                                shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6,
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Abrir ejercicio ${item.name}`}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
                                <View style={{
                                    width: 40, height: 40, borderRadius: 12,
                                    backgroundColor: (item.category_color || Colors.iron[400]) + '20',
                                    borderWidth: 1, borderColor: (item.category_color || Colors.iron[400]) + '40',
                                    justifyContent: 'center', alignItems: 'center',
                                }}>
                                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.category_color || Colors.iron[400] }} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: Colors.iron[950], fontWeight: '900', fontSize: 16, letterSpacing: -0.3 }} numberOfLines={1}>{item.name}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                        <Text style={{ color: Colors.iron[500], fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.category_name}</Text>
                                    </View>
                                </View>
                            </View>
                            {!onSelect && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <TouchableOpacity
                                        onPress={() => handleEdit(item)}
                                        style={{ padding: 8, backgroundColor: Colors.iron[200], borderRadius: 10, borderWidth: 1, borderColor: Colors.iron[300] }}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Editar ejercicio ${item.name}`}
                                    >
                                        <Pencil size={14} color={Colors.iron[500]} />
                                    </TouchableOpacity>
                                    {!item.is_system && (
                                        <TouchableOpacity
                                            onPress={() => handleDelete(item)}
                                            style={{ padding: 8, backgroundColor: '#ef444412', borderRadius: 10, borderWidth: 1, borderColor: '#ef444425' }}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Eliminar ejercicio ${item.name}`}
                                        >
                                            <Trash2 size={14} color="#ef4444" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </TouchableOpacity>
                    )}
                />
            )}

            {/* FAB */}
            {!onSelect && (
                <TouchableOpacity
                    onPress={handleCreate}
                    style={{
                        position: 'absolute', right: 24, bottom: bottomOffset, zIndex: 10,
                        width: 56, height: 56, borderRadius: 16,
                        backgroundColor: Colors.primary.DEFAULT, alignItems: 'center', justifyContent: 'center',
                        shadowColor: Colors.primary.DEFAULT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Crear ejercicio"
                >
                    <Plus color="white" size={24} />
                </TouchableOpacity>
            )}

            {!inModal && (
                <LinearGradient
                    colors={['transparent', Colors.iron[900]]}
                    style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: bottomOffset + 60, zIndex: 1 }}
                    pointerEvents="none"
                />
            )}

            <ExerciseFormModal
                visible={isFormVisible}
                onClose={() => setIsFormVisible(false)}
                onSave={loadData}
                initialData={editingExercise}
            />
        </View>
    );
}

