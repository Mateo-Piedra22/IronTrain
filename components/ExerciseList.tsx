import { useDataReload } from '@/src/hooks/useDataReload';
import { ThemeFx, withAlpha } from '@/src/theme';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { FlashList } from '@shopify/flash-list';
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
import { matchesKeywordAndQuery } from '../src/utils/text';
import { ExerciseFormModal } from './ExerciseFormModal';
import { BadgePill } from './ui/BadgePill';


interface ExerciseListProps {
    onSelect?: (exerciseId: string) => void;
    inModal?: boolean;
}

type ExerciseItem = Exercise & { category_name: string; category_color: string; badges: any[] };

type CategoryItem = Category | { id: string; name: string; color: string };

const ExerciseCard = React.memo(({ item, colors, st, onSelect, handleEdit, handleDelete, handlePress }: {
    item: ExerciseItem;
    colors: any;
    st: any;
    onSelect?: (id: string) => void;
    handleEdit: (ex: Exercise) => void;
    handleDelete: (ex: Exercise) => void;
    handlePress: (ex: Exercise) => void;
}) => (
    <TouchableOpacity
        onPress={() => handlePress(item)}
        style={st.card}
        accessibilityRole="button"
        accessibilityLabel={`Abrir ejercicio ${item.name}`}
    >
        <View style={st.cardInfo}>
            <View style={[st.cardIcon, {
                backgroundColor: withAlpha(item.category_color || colors.textMuted, '15'),
                borderColor: withAlpha(item.category_color || colors.textMuted, '30'),
            }]}>
                <View style={[st.cardDot, { backgroundColor: item.category_color || colors.textMuted }]} />
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
                    <Pencil size={15} color={colors.textMuted} />
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
));

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
        container: { flex: 1, backgroundColor: inModal ? colors.surfaceLighter : colors.background },
        header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
        searchBar: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            paddingHorizontal: 16,
            height: 52,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: colors.border,
            ...ThemeFx.shadowSm,
            gap: 12
        },
        searchInput: { flex: 1, fontSize: 16, color: colors.text, padding: 0, fontWeight: '700' },
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
            ...ThemeFx.shadowMd,
        },
        categoryText: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
        categoryTextActive: { color: colors.onPrimary },

        listContent: { paddingTop: 0, paddingHorizontal: 16, paddingBottom: inModal ? 40 : 100 },
        card: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
            marginBottom: 12,
            backgroundColor: colors.surface,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: colors.border,
            ...ThemeFx.shadowSm,
        },
        cardInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 14, overflow: 'hidden' },
        cardIcon: {
            width: 44, height: 44, borderRadius: 12,
            justifyContent: 'center', alignItems: 'center',
            borderWidth: 1.5,
        },
        cardDot: { width: 12, height: 12, borderRadius: 6 },
        cardText: { flex: 1, overflow: 'hidden' },
        cardTitle: { color: colors.text, fontWeight: '900', fontSize: 16, letterSpacing: -0.4 },
        cardMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8, flex: 1, overflow: 'hidden' },
        cardCategory: { color: colors.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, flexShrink: 0 },
        cardBadges: { flexDirection: 'row', gap: 4, flexShrink: 1, alignItems: 'center' },
        badgeMore: { backgroundColor: colors.surfaceLighter, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, justifyContent: 'center', flexShrink: 0 },
        badgeMoreText: { fontSize: 9, fontWeight: '900', color: colors.textMuted },

        actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 12 },
        actionBtn: { width: 34, height: 34, backgroundColor: colors.surfaceLighter, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
        deleteBtn: { width: 34, height: 34, backgroundColor: withAlpha(colors.red, '10'), borderRadius: 10, borderWidth: 1.5, borderColor: withAlpha(colors.red, '25'), justifyContent: 'center', alignItems: 'center' },

        fab: {
            position: 'absolute', right: 24, bottom: bottomOffset, zIndex: 10,
            width: 56, height: 56, borderRadius: 18,
            backgroundColor: colors.primary.DEFAULT, alignItems: 'center', justifyContent: 'center',
            ...ThemeFx.shadowLg,
        },
        gradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: bottomOffset + 60, zIndex: 1 },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' }
    }), [colors, inModal, bottomOffset]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [exs, cats] = await Promise.all([
                // Fetch a superset, then apply the full in-memory matcher for consistent semantics
                ExerciseService.search('', selectedCategory),
                CategoryService.getAll()
            ]);

            const filtered = exs.filter((e) => {
                const badgeNames = (e.badges ?? []).map((b: any) => b?.name).filter(Boolean);
                const badgeGroups = (e.badges ?? []).map((b: any) => b?.group_name).filter(Boolean);
                return matchesKeywordAndQuery(searchQuery, [e.name, e.category_name, ...badgeNames, ...badgeGroups]);
            });

            setExercises(filtered);
            setCategories(cats);
        } catch (e) {
            confirm.error('Error', (e as Error)?.message || 'No se pudieron cargar los ejercicios.');
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

    const handleCreate = useCallback(() => {
        setEditingExercise(null);
        setIsFormVisible(true);
    }, []);

    const handleEdit = useCallback((ex: Exercise) => {
        setEditingExercise(ex);
        setIsFormVisible(true);
    }, []);

    const handleDelete = useCallback((ex: Exercise) => {
        const run = async () => {
            try {
                await ExerciseService.delete(ex.id);
                await loadData();
            } catch (e: any) {
                confirm.error('No se pudo eliminar', e?.message ?? 'Error');
            }
        };

        (async () => {
            try {
                const impact = await ExerciseService.getDeleteImpact(ex.id);
                if (impact.routinesCount > 0 || impact.daysCount > 0) {
                    const sampleLines = impact.sample
                        .map((s) => `- ${s.routine_name} / ${s.day_name}`)
                        .join('\n');

                    const message = [
                        `¿Eliminar "${ex.name}"?`,
                        '',
                        `Este ejercicio está vinculado a ${impact.routinesCount} rutinas y ${impact.daysCount} días.`,
                        'Se des-vinculará automáticamente antes de eliminarlo.',
                        sampleLines ? '' : undefined,
                        sampleLines ? `Ejemplos:\n${sampleLines}` : undefined,
                    ].filter((x): x is string => Boolean(x)).join('\n');

                    confirm.destructive('Eliminar ejercicio', message, run, 'Eliminar');
                    return;
                }
            } catch {
                // fall back to basic confirm
            }

            confirm.destructive('Eliminar ejercicio', `¿Eliminar "${ex.name}"?`, run, 'Eliminar');
        })();
    }, [loadData]);

    const handlePress = useCallback((ex: Exercise) => {
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
    }, [onSelect, router]);

    const renderItem = useCallback(({ item }: { item: ExerciseItem }) => (
        <ExerciseCard
            item={item}
            colors={colors}
            st={st}
            onSelect={onSelect}
            handleEdit={handleEdit}
            handleDelete={handleDelete}
            handlePress={handlePress}
        />
    ), [colors, st, onSelect, handleEdit, handleDelete, handlePress]);

    return (
        <View style={st.container}>
            {/* Search Header */}
            <View style={st.header}>
                <View style={st.searchBar}>
                    <Search size={20} color={colors.textMuted} />
                    <TextInput
                        style={st.searchInput}
                        placeholder="Buscar ejercicio…"
                        placeholderTextColor={colors.textMuted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {/* Category Chips */}
                <View style={st.categoryList}>
                    <FlatList<CategoryItem>
                        horizontal
                        data={[{ id: 'all', name: 'Todos', color: colors.text }, ...categories]}
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
                <FlashList<ExerciseItem>
                    data={exercises}
                    contentContainerStyle={st.listContent}
                    onEndReachedThreshold={0.5}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
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
                    <Plus color={colors.onPrimary} size={28} />
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

