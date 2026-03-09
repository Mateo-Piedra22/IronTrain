import { useDataReload } from '@/src/hooks/useDataReload';
import { withAlpha } from '@/src/theme';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react-native';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../src/hooks/useColors';
import { CategoryService } from '../src/services/CategoryService';
import { ExerciseService } from '../src/services/ExerciseService';
import { confirm } from '../src/store/confirmStore';
import { Category, Exercise } from '../src/types/db';
import { ExerciseFormModal } from './ExerciseFormModal';
import { BadgePill } from './ui/BadgePill';


interface ExerciseListProps {
    onSelect?: (exerciseId: string) => void;
    inModal?: boolean;
}

type ExerciseItem = Exercise & { category_name: string; category_color: string; badges: any[] };

type CategoryItem = Category | { id: string; name: string; color: string };

export function ExerciseList({ onSelect, inModal }: ExerciseListProps) {
    const colors = useColors();
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

    const st = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: inModal ? colors.iron[100] : colors.background },
        header: { padding: 18, paddingBottom: 12 },
        searchBar: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            paddingHorizontal: 16,
            height: 52,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: colors.border,
            elevation: 2,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.05,
            shadowRadius: 10,
            gap: 12
        },
        searchInput: { flex: 1, fontSize: 16, color: colors.iron[950], padding: 0, fontWeight: '700' },
        categoryList: { marginTop: 14 },
        categoryChip: {
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 12,
            marginRight: 10,
            borderWidth: 1.5,
            backgroundColor: colors.surface,
            borderColor: colors.border,
        },
        categoryChipActive: {
            backgroundColor: colors.primary.DEFAULT,
            borderColor: colors.primary.DEFAULT,
            elevation: 4,
            shadowColor: colors.primary.DEFAULT,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
        },
        categoryText: { fontSize: 13, fontWeight: '800', color: colors.iron[500] },
        categoryTextActive: { color: colors.white },

        listContent: { padding: 16, paddingBottom: inModal ? 40 : 100 },
        card: {
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
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.04,
            shadowRadius: 10,
        },
        cardInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 14, overflow: 'hidden' },
        cardIcon: {
            width: 44, height: 44, borderRadius: 12,
            justifyContent: 'center', alignItems: 'center',
            borderWidth: 1.5,
        },
        cardDot: { width: 12, height: 12, borderRadius: 6 },
        cardText: { flex: 1, overflow: 'hidden' },
        cardTitle: { color: colors.iron[950], fontWeight: '900', fontSize: 16, letterSpacing: -0.4 },
        cardMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8, flex: 1, overflow: 'hidden' },
        cardCategory: { color: colors.iron[500], fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, flexShrink: 0 },
        cardBadges: { flexDirection: 'row', gap: 4, flexShrink: 1, alignItems: 'center' },
        badgeMore: { backgroundColor: colors.iron[100], paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, justifyContent: 'center', flexShrink: 0 },
        badgeMoreText: { fontSize: 9, fontWeight: '900', color: colors.iron[500] },

        actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 12 },
        actionBtn: { width: 34, height: 34, backgroundColor: colors.iron[100], borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
        deleteBtn: { width: 34, height: 34, backgroundColor: withAlpha(colors.red, '10'), borderRadius: 10, borderWidth: 1.5, borderColor: withAlpha(colors.red, '25'), justifyContent: 'center', alignItems: 'center' },

        fab: {
            position: 'absolute', right: 24, bottom: bottomOffset, zIndex: 10,
            width: 56, height: 56, borderRadius: 18,
            backgroundColor: colors.primary.DEFAULT, alignItems: 'center', justifyContent: 'center',
            shadowColor: colors.primary.DEFAULT, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
        },
        gradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: bottomOffset + 60, zIndex: 1 },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' }
    }), [colors, inModal, bottomOffset]);

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

    useDataReload(() => {
        loadData();
    });


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
        <View style={st.container}>
            {/* Search Header */}
            <View style={st.header}>
                <View style={st.searchBar}>
                    <Search size={20} color={colors.iron[400]} />
                    <TextInput
                        style={st.searchInput}
                        placeholder="Buscar ejercicio…"
                        placeholderTextColor={colors.iron[400]}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {/* Category Chips */}
                <View style={st.categoryList}>
                    <FlatList<CategoryItem>
                        horizontal
                        data={[{ id: 'all', name: 'Todos', color: colors.iron[950] }, ...categories]}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingRight: 20 }}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => setSelectedCategory(item.id)}
                                style={[st.categoryChip, selectedCategory === item.id && st.categoryChipActive]}
                            >
                                <Text style={[st.categoryText, selectedCategory === item.id && st.categoryTextActive]}>
                                    {item.name}
                                </Text>
                            </TouchableOpacity>
                        )}
                    />
                </View>
            </View>

            {/* List */}
            {loading ? (
                <View style={st.centered}>
                    <ActivityIndicator color={colors.primary.DEFAULT} />
                </View>
            ) : (
                <FlatList<ExerciseItem>
                    data={exercises}
                    contentContainerStyle={st.listContent}
                    onEndReachedThreshold={0.5}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            onPress={() => handlePress(item)}
                            style={st.card}
                            accessibilityRole="button"
                            accessibilityLabel={`Abrir ejercicio ${item.name}`}
                        >
                            <View style={st.cardInfo}>
                                <View style={[st.cardIcon, {
                                    backgroundColor: (item.category_color || colors.iron[400]) + '15',
                                    borderColor: (item.category_color || colors.iron[400]) + '30',
                                }]}>
                                    <View style={[st.cardDot, { backgroundColor: item.category_color || colors.iron[400] }]} />
                                </View>
                                <View style={st.cardText}>
                                    <Text style={st.cardTitle} numberOfLines={1}>{item.name}</Text>
                                    <View style={st.cardMeta}>
                                        <Text style={st.cardCategory} numberOfLines={1}>{item.category_name}</Text>

                                        {/* Badges Preview */}
                                        {item.badges && item.badges.length > 0 && (
                                            <View style={st.cardBadges}>
                                                {item.badges.slice(0, 3).map((badge, idx) => (
                                                    <View key={`${item.id}-badge-${idx}`} style={{ flexShrink: 1 }}>
                                                        <BadgePill
                                                            name={badge.name}
                                                            color={badge.color}
                                                            icon={badge.icon}
                                                            size="xs"
                                                        />
                                                    </View>
                                                ))}
                                                {item.badges.length > 3 && (
                                                    <View style={st.badgeMore}>
                                                        <Text style={st.badgeMoreText}>+{item.badges.length - 3}</Text>
                                                    </View>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </View>
                            {!onSelect && (
                                <View style={st.actions}>
                                    <TouchableOpacity
                                        onPress={() => handleEdit(item)}
                                        style={st.actionBtn}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Editar ejercicio ${item.name}`}
                                    >
                                        <Pencil size={15} color={colors.iron[600]} />
                                    </TouchableOpacity>
                                    {!item.is_system && (
                                        <TouchableOpacity
                                            onPress={() => handleDelete(item)}
                                            style={st.deleteBtn}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Eliminar ejercicio ${item.name}`}
                                        >
                                            <Trash2 size={15} color={colors.red} />
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
                    style={st.fab}
                    accessibilityRole="button"
                    accessibilityLabel="Crear ejercicio"
                >
                    <Plus color={colors.white} size={28} />
                </TouchableOpacity>
            )}

            {!inModal && (
                <LinearGradient
                    colors={['transparent', colors.background]}
                    style={st.gradient}
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

