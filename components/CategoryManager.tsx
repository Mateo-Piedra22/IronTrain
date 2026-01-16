import { IronButton } from '@/components/IronButton';
import { IronInput } from '@/components/IronInput';
import { Colors } from '@/src/theme';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { Pencil, Plus, Trash2 } from 'lucide-react-native';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryService } from '../src/services/CategoryService';
import { Category } from '../src/types/db';

import { ColorPicker } from './ui/ColorPicker';

export function CategoryManager() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [categoryName, setCategoryName] = useState('');
    const [selectedColor, setSelectedColor] = useState('#3b82f6');
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
            Alert.alert('Error', (e as Error)?.message || 'No se pudo guardar la categoría');
        }
    };

    const handleDelete = async (category: Category) => {
        if (category.is_system) {
            Alert.alert('Error', 'Cannot delete system categories');
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

            Alert.alert(
                'Eliminar categoría',
                `¿Eliminar "${category.name}"?${movedMsg}${examples}`,
                [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                        text: 'Eliminar',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                await CategoryService.deleteAndReassignExercises(category.id);
                                loadData();
                            } catch (e: any) {
                                Alert.alert('Error', e?.message || 'No se pudo eliminar.');
                            }
                        }
                    }
                ]
            );
        } catch (e: any) {
            Alert.alert('Error', e?.message || 'No se pudo eliminar.');
        }
    };

    const openModal = (category?: Category) => {
        if (category) {
            setEditingCategory(category);
            setCategoryName(category.name);
            setSelectedColor(category.color || '#3b82f6');
        } else {
            setEditingCategory(null);
            setCategoryName('');
            setSelectedColor('#3b82f6');
        }
        setModalVisible(true);
    };

    return (
        <View className="flex-1 bg-iron-900">
            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator color={Colors.primary.DEFAULT} />
                </View>
            ) : (
                <FlatList
                    data={categories}
                    contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }: any) => (
                        <View className="flex-row items-center justify-between p-4 mb-3 bg-surface rounded-xl border border-iron-700 elevation-1">
                            <View className="flex-row items-center gap-3">
                                <View className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color || '#3b82f6' }} />
                                <Text className="text-iron-950 font-bold text-base">{item.name}</Text>
                                {item.is_system === 1 && (
                                    <Text className="text-xs text-iron-500 bg-iron-200 px-2 py-0.5 rounded">SYSTEM</Text>
                                )}
                            </View>

                            <View className="flex-row items-center gap-2">
                                {item.id !== CategoryService.UNCATEGORIZED_ID && (
                                    <TouchableOpacity
                                        onPress={() => openModal(item)}
                                        className="p-2 bg-iron-200 rounded-lg active:opacity-50"
                                        accessibilityRole="button"
                                        accessibilityLabel={`Editar categoría ${item.name}`}
                                    >
                                        <Pencil size={18} color={Colors.iron[500]} />
                                    </TouchableOpacity>
                                )}

                                {!item.is_system && (
                                    <TouchableOpacity
                                        onPress={() => handleDelete(item)}
                                        className="p-2 bg-red-100 rounded-lg active:opacity-50"
                                        accessibilityRole="button"
                                        accessibilityLabel={`Eliminar categoría ${item.name}`}
                                    >
                                        <Trash2 size={18} color={Colors.red} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    )}
                />
            )}

            <TouchableOpacity
                onPress={() => openModal()}
                className="absolute w-14 h-14 bg-primary rounded-full items-center justify-center elevation-3 border border-orange-400 active:scale-95"
                style={{ right: 24, bottom: bottomOffset }}
                accessibilityRole="button"
                accessibilityLabel="Crear categoría"
            >
                <Plus color="white" size={30} />
            </TouchableOpacity>

            {modalVisible && (
                <Modal
                    transparent
                    visible
                    animationType="fade"
                    onRequestClose={() => setModalVisible(false)}
                >
                    <SafeAreaView className="flex-1 bg-black/50 justify-center items-center p-4" edges={['top', 'bottom', 'left', 'right']}>
                        <View className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-iron-700 elevation-2">
                            <Text className="text-xl font-bold text-iron-950 mb-6">
                                {editingCategory ? 'Editar categoría' : 'Nueva categoría'}
                            </Text>

                            <IronInput
                                label="Nombre"
                                value={categoryName}
                                onChangeText={setCategoryName}
                                autoFocus
                            />

                            <Text className="text-iron-500 text-sm mb-2 font-bold uppercase tracking-wider">Color</Text>

                            <TouchableOpacity
                                onPress={() => setShowColorPicker(true)}
                                className="flex-row items-center bg-white p-4 rounded-xl border border-iron-500 mb-6 justify-between active:bg-iron-200"
                            >
                                <Text className="text-iron-950 font-semibold">Color seleccionado</Text>
                                <View className="flex-row items-center gap-3">
                                    <Text className="text-iron-500 uppercase font-mono">{selectedColor}</Text>
                                    <View className="w-8 h-8 rounded-full border border-iron-200 shadow-sm" style={{ backgroundColor: selectedColor }} />
                                </View>
                            </TouchableOpacity>

                            <View className="flex-row gap-3">
                                <View className="flex-1">
                                    <IronButton label="Cancelar" variant="ghost" onPress={() => setModalVisible(false)} />
                                </View>
                                <View className="flex-1">
                                    <IronButton label="Guardar" onPress={handleSave} />
                                </View>
                            </View>
                        </View>
                    </SafeAreaView>
                </Modal>
            )}

            <ColorPicker
                visible={showColorPicker}
                initialColor={selectedColor}
                onClose={() => setShowColorPicker(false)}
                onSelect={(color) => {
                    setSelectedColor(color);
                    setShowColorPicker(false);
                }}
            />
        </View>
    );
}
