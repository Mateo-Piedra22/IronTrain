import { IronButton } from '@/components/IronButton';
import { IronInput } from '@/components/IronInput';
import { Colors, ThemeFx, withAlpha } from '@/src/theme';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { Pencil, Plus, Trash2 } from 'lucide-react-native';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryService } from '../src/services/CategoryService';
import { confirm } from '../src/store/confirmStore';
import { Category } from '../src/types/db';

import { ColorPicker } from './ui/ColorPicker';

export function CategoryManager() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [categoryName, setCategoryName] = useState('');
    const [selectedColor, setSelectedColor] = useState(Colors.blue);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const insets = useSafeAreaInsets();
    const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
    const bottomOffset = (tabBarHeight ? tabBarHeight : insets.bottom) + 12;

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await CategoryService.getAll();
            setCategories(data);
        } catch (e) {
            console.error(e);
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
            setSelectedColor(category.color || Colors.blue);
        } else {
            setEditingCategory(null);
            setCategoryName('');
            setSelectedColor(Colors.blue);
        }
        setModalVisible(true);
    };

    return (
        <View style={{ flex: 1, backgroundColor: Colors.iron[900] }}>
            {loading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator color={Colors.primary.DEFAULT} />
                </View>
            ) : (
                <FlatList
                    data={categories}
                    contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }: any) => (
                        <View style={{
                            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                            padding: 16, marginBottom: 12, backgroundColor: Colors.surface,
                            borderRadius: 16, borderWidth: 1, borderColor: Colors.iron[300],
                            borderLeftWidth: 4, borderLeftColor: item.color || Colors.blue,
                            elevation: 2, shadowColor: ThemeFx.shadowColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6,
                        }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                                <View style={{
                                    width: 36, height: 36, borderRadius: 10,
                                    backgroundColor: withAlpha(item.color || Colors.blue, '20'),
                                    justifyContent: 'center', alignItems: 'center',
                                }}>
                                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: item.color || Colors.blue }} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                                        <Text style={{ color: Colors.iron[950], fontWeight: '900', fontSize: 16, letterSpacing: -0.3 }}>{item.name}</Text>
                                        {item.is_system === 1 && (
                                            <View style={{ backgroundColor: Colors.iron[200], paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                                <Text style={{ fontSize: 9, color: Colors.iron[600], fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>SISTEMA</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                {item.id !== CategoryService.UNCATEGORIZED_ID && (
                                    <TouchableOpacity
                                        onPress={() => openModal(item)}
                                        style={{ padding: 8, backgroundColor: Colors.iron[200], borderRadius: 10, borderWidth: 1, borderColor: Colors.iron[300] }}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Editar categoría ${item.name}`}
                                    >
                                        <Pencil size={14} color={Colors.iron[500]} />
                                    </TouchableOpacity>
                                )}
                                {!item.is_system && (
                                    <TouchableOpacity
                                        onPress={() => handleDelete(item)}
                                        style={{ padding: 8, backgroundColor: withAlpha(Colors.red, '12'), borderRadius: 10, borderWidth: 1, borderColor: withAlpha(Colors.red, '25') }}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Eliminar categoría ${item.name}`}
                                    >
                                        <Trash2 size={14} color={Colors.red} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    )}
                />
            )}

            <TouchableOpacity
                onPress={() => openModal()}
                style={{
                    position: 'absolute', right: 24, bottom: bottomOffset,
                    width: 56, height: 56, borderRadius: 16,
                    backgroundColor: Colors.primary.DEFAULT, alignItems: 'center', justifyContent: 'center',
                    shadowColor: Colors.primary.DEFAULT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
                }}
                accessibilityRole="button"
                accessibilityLabel="Crear categoría"
            >
                <Plus color={Colors.white} size={24} />
            </TouchableOpacity>

            {modalVisible && (
                <Modal transparent visible animationType="fade" onRequestClose={() => setModalVisible(false)}>
                    <SafeAreaView style={{ flex: 1, backgroundColor: ThemeFx.backdrop, justifyContent: 'center', alignItems: 'center', padding: 16 }} edges={['top', 'bottom', 'left', 'right']}>
                        <View style={{
                            backgroundColor: Colors.surface, width: '100%', maxWidth: 360,
                            borderRadius: 20, padding: 24, borderWidth: 1, borderColor: Colors.iron[700],
                            elevation: 8, shadowColor: ThemeFx.shadowColor, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 24,
                        }}>
                            <Text style={{ fontSize: 20, fontWeight: '900', color: Colors.iron[950], marginBottom: 20, letterSpacing: -0.3 }}>
                                {editingCategory ? 'Editar categoría' : 'Nueva categoría'}
                            </Text>

                            <IronInput label="Nombre" value={categoryName} onChangeText={setCategoryName} autoFocus />

                            <Text style={{ color: Colors.iron[500], fontSize: 10, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Color</Text>
                            <TouchableOpacity
                                onPress={() => setShowColorPicker(true)}
                                style={{
                                    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.iron[200],
                                    padding: 14, borderRadius: 14, borderWidth: 1, borderColor: Colors.iron[300],
                                    marginBottom: 20, justifyContent: 'space-between',
                                }}
                            >
                                <Text style={{ color: Colors.iron[950], fontWeight: '700', fontSize: 14 }}>Color seleccionado</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <Text style={{ color: Colors.iron[400], fontWeight: '600', fontSize: 11, textTransform: 'uppercase' }}>{selectedColor}</Text>
                                    <View style={{ width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: Colors.iron[300], backgroundColor: selectedColor }} />
                                </View>
                            </TouchableOpacity>

                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <View style={{ flex: 1 }}><IronButton label="Cancelar" variant="ghost" onPress={() => setModalVisible(false)} /></View>
                                <View style={{ flex: 1 }}><IronButton label="Guardar" onPress={handleSave} /></View>
                            </View>
                        </View>
                    </SafeAreaView>
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
