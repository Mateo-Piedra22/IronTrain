import { IronButton } from '@/components/IronButton';
import { IronInput } from '@/components/IronInput';
import { ThemeFx, withAlpha } from '@/src/theme';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { Pencil, Plus, Trash2 } from 'lucide-react-native';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../src/hooks/useColors';
import { CategoryService } from '../src/services/CategoryService';
import { confirm } from '../src/store/confirmStore';
import { Category } from '../src/types/db';
import { buildDuplicateMessage, findNameDuplicates } from '../src/utils/duplicates';

import { ColorPicker } from './ui/ColorPicker';

export function CategoryManager() {
    const colors = useColors();
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [categoryName, setCategoryName] = useState('');
    const [selectedColor, setSelectedColor] = useState(colors.blue);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const insets = useSafeAreaInsets();
    const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
    const bottomOffset = (tabBarHeight ? tabBarHeight : insets.bottom) + 12;

    const ss = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        listContent: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 100 },
        categoryItem: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            padding: 16, marginBottom: 12, backgroundColor: colors.surface,
            borderRadius: 16, borderWidth: 1.5, borderColor: colors.border,
            borderLeftWidth: 4,
            elevation: 2, shadowColor: ThemeFx.shadowColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6,
        },
        categoryInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
        colorIndicator: {
            width: 36, height: 36, borderRadius: 12,
            justifyContent: 'center', alignItems: 'center',
        },
        colorDot: { width: 12, height: 12, borderRadius: 6 },
        categoryName: { color: colors.text, fontWeight: '900', fontSize: 16, letterSpacing: -0.3 },
        systemBadge: { backgroundColor: colors.surfaceLighter, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
        systemBadgeText: { fontSize: 9, color: colors.textMuted, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
        actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
        editBtn: { padding: 8, backgroundColor: colors.surfaceLighter, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border },
        deleteBtn: { padding: 8, backgroundColor: withAlpha(colors.red, '12'), borderRadius: 12, borderWidth: 1.5, borderColor: withAlpha(colors.red, '25') },
        fab: {
            position: 'absolute', right: 24, bottom: bottomOffset,
            width: 56, height: 56, borderRadius: 16,
            backgroundColor: colors.primary.DEFAULT, alignItems: 'center', justifyContent: 'center',
            shadowColor: colors.primary.DEFAULT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
        },
        modalOverlay: { flex: 1, backgroundColor: ThemeFx.backdrop },
        modalContent: {
            backgroundColor: colors.surface, width: '100%', maxWidth: 360,
            borderRadius: 20, padding: 24, borderWidth: 1.5, borderColor: colors.border,
            elevation: 8, shadowColor: ThemeFx.shadowColor, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 24,
        },
        modalTitle: { fontSize: 20, fontWeight: '900', color: colors.text, marginBottom: 20, letterSpacing: -0.3 },
        label: { color: colors.textMuted, fontSize: 10, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
        colorSelector: {
            flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceLighter,
            padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border,
            marginBottom: 20, justifyContent: 'space-between',
        },
        colorSelectorText: { color: colors.text, fontWeight: '700', fontSize: 14 },
        colorSelectorValue: { flexDirection: 'row', alignItems: 'center', gap: 10 },
        colorHex: { color: colors.textMuted, fontWeight: '600', fontSize: 11, textTransform: 'uppercase' },
        colorPreview: { width: 32, height: 32, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border },
        modalFooter: { flexDirection: 'row', gap: 12 }
    }), [colors, bottomOffset]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await CategoryService.getAll();
            setCategories(data);
        } catch (e) {
            confirm.error('Error', (e as Error)?.message || 'No se pudieron cargar las categorías.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSave = async () => {
        if (!categoryName.trim()) return;

        try {
            const all = await CategoryService.getAll();
            const duplicates = findNameDuplicates(
                { id: editingCategory?.id, name: categoryName },
                all,
                3
            );

            if (duplicates.length > 0) {
                confirm.custom({
                    title: 'Posible duplicado',
                    message: buildDuplicateMessage('Ya existe una categoría con un nombre muy similar. ¿Querés guardarla igual?', duplicates.map((d) => ({ title: d.name }))),
                    variant: 'warning',
                    buttons: [
                        { label: 'Cancelar', onPress: confirm.hide, variant: 'ghost' },
                        { label: 'Guardar igualmente', onPress: async () => { confirm.hide(); await doSave(); }, variant: 'solid' },
                    ]
                });
                return;
            }
        } catch {
            // If duplicate check fails, do not block save.
        }

        await doSave();
    };

    const doSave = async () => {

        try {
            if (editingCategory) {
                await CategoryService.update(editingCategory.id, categoryName.trim(), selectedColor);
            } else {
                await CategoryService.create(categoryName.trim(), selectedColor);
            }
            setModalVisible(false);
            setCategoryName('');
            loadData();
        } catch (e) {
            confirm.error('Error', (e as Error)?.message || 'No se pudo guardar la categoría');
        }
    };

    const handleDelete = async (category: Category) => {
        if (category.is_system) {
            confirm.error('Error', 'No se pueden eliminar categorías del sistema.');
            return;
        }

        try {
            const impact = await CategoryService.getDeletionImpact(category.id);
            const movedMsg = impact.exerciseCount > 0
                ? `\n\nEjercicios afectados: ${impact.exerciseCount}\nSe moverán a "${CategoryService.UNCATEGORIZED_NAME}".`
                : '';
            const examples = impact.sampleExerciseNames.length > 0
                ? `\n\nEjemplos:\n- ${impact.sampleExerciseNames.slice(0, 6).join('\n- ')}${impact.sampleExerciseNames.length > 6 ? '\n- ...' : ''}`
                : '';

            confirm.destructive(
                'Eliminar categoría',
                `¿Eliminar "${category.name}"?${movedMsg}${examples}`,
                async () => {
                    try {
                        await CategoryService.deleteAndReassignExercises(category.id);
                        loadData();
                    } catch (e: any) {
                        confirm.error('Error', e?.message || 'No se pudo eliminar.');
                    }
                },
                'Eliminar'
            );
        } catch (e: any) {
            confirm.error('Error', e?.message || 'No se pudo eliminar.');
        }
    };

    const openModal = (category?: Category) => {
        if (category) {
            setEditingCategory(category);
            setCategoryName(category.name);
            setSelectedColor(category.color || colors.blue);
        } else {
            setEditingCategory(null);
            setCategoryName('');
            setSelectedColor(colors.blue);
        }
        setModalVisible(true);
    };

    return (
        <View style={ss.container}>
            {loading ? (
                <View style={ss.loadingContainer}>
                    <ActivityIndicator color={colors.primary.DEFAULT} />
                </View>
            ) : (
                <FlatList
                    data={categories}
                    contentContainerStyle={ss.listContent}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }: any) => (
                        <View style={[ss.categoryItem, { borderLeftColor: item.color || colors.blue }]}>
                            <View style={ss.categoryInfo}>
                                <View style={[ss.colorIndicator, { backgroundColor: withAlpha(item.color || colors.blue, '20') }]}>
                                    <View style={[ss.colorDot, { backgroundColor: item.color || colors.blue }]} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                                        <Text style={ss.categoryName}>{item.name}</Text>
                                        {(item.is_system === 1 || item.is_system === true) && (
                                            <View style={ss.systemBadge}>
                                                <Text style={ss.systemBadgeText}>SISTEMA</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </View>

                            <View style={ss.actions}>
                                {item.id !== CategoryService.UNCATEGORIZED_ID && (
                                    <TouchableOpacity
                                        onPress={() => openModal(item)}
                                        style={ss.editBtn}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Editar categoría ${item.name}`}
                                    >
                                        <Pencil size={14} color={colors.textMuted} />
                                    </TouchableOpacity>
                                )}
                                {!item.is_system && (
                                    <TouchableOpacity
                                        onPress={() => handleDelete(item)}
                                        style={ss.deleteBtn}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Eliminar categoría ${item.name}`}
                                    >
                                        <Trash2 size={14} color={colors.red} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    )}
                />
            )}

            <TouchableOpacity
                onPress={() => openModal()}
                style={ss.fab}
                accessibilityRole="button"
                accessibilityLabel="Crear categoría"
            >
                <Plus color={colors.onPrimary} size={24} />
            </TouchableOpacity>

            {modalVisible && (
                <Modal transparent visible animationType="fade" onRequestClose={() => setModalVisible(false)} statusBarTranslucent>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        style={ss.modalOverlay}
                    >
                        <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
                            <ScrollView
                                contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}
                                keyboardShouldPersistTaps="handled"
                                bounces={false}
                                showsVerticalScrollIndicator={false}
                            >
                                <View style={ss.modalContent}>
                                    <Text style={ss.modalTitle}>
                                        {editingCategory ? 'Editar categoría' : 'Nueva categoría'}
                                    </Text>

                                    <IronInput label="Nombre" value={categoryName} onChangeText={setCategoryName} autoFocus />

                                    <Text style={ss.label}>Color</Text>
                                    <TouchableOpacity
                                        onPress={() => setShowColorPicker(true)}
                                        style={ss.colorSelector}
                                    >
                                        <Text style={ss.colorSelectorText}>Color seleccionado</Text>
                                        <View style={ss.colorSelectorValue}>
                                            <Text style={ss.colorHex}>{selectedColor}</Text>
                                            <View style={[ss.colorPreview, { backgroundColor: selectedColor }]} />
                                        </View>
                                    </TouchableOpacity>

                                    <View style={ss.modalFooter}>
                                        <View style={{ flex: 1 }}><IronButton label="Cancelar" variant="ghost" onPress={() => setModalVisible(false)} /></View>
                                        <View style={{ flex: 1 }}><IronButton label="Guardar" onPress={handleSave} /></View>
                                    </View>
                                </View>
                            </ScrollView>
                        </SafeAreaView>
                    </KeyboardAvoidingView>
                </Modal>
            )}

            <ColorPicker
                visible={showColorPicker}
                initialColor={selectedColor}
                onClose={() => setShowColorPicker(false)}
                onSelect={(color) => { setSelectedColor(color); setShowColorPicker(false); }}
            />
        </View>
    );
}
