import { IronButton } from '@/components/IronButton';
import { IronInput } from '@/components/IronInput';
import { Colors } from '@/src/theme';
import { Pencil, Plus, Trash2 } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Text, TouchableOpacity, View } from 'react-native';
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
            Alert.alert('Error', 'Failed to save category');
        }
    };

    const handleDelete = async (category: Category) => {
        if (category.is_system) {
            Alert.alert('Error', 'Cannot delete system categories');
            return;
        }

        Alert.alert(
            'Delete Category',
            `Are you sure you want to delete "${category.name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await CategoryService.delete(category.id);
                            loadData();
                        } catch (e: any) {
                            Alert.alert('Error', e.message || 'Failed to delete');
                        }
                    }
                }
            ]
        );
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
                                {!item.is_system && (
                                    <>
                                        <TouchableOpacity onPress={() => openModal(item)} className="p-2 bg-iron-200 rounded-lg active:opacity-50">
                                            <Pencil size={18} color={Colors.iron[500]} />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleDelete(item)} className="p-2 bg-red-100 rounded-lg active:opacity-50">
                                            <Trash2 size={18} color={Colors.red} />
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                        </View>
                    )}
                />
            )}

            <TouchableOpacity
                onPress={() => openModal()}
                className="absolute bottom-6 right-6 w-14 h-14 bg-primary rounded-full items-center justify-center elevation-3 border border-orange-400 active:scale-95"
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
                    <View className="flex-1 bg-black/50 justify-center items-center p-4">
                        <View className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-iron-700 elevation-2">
                            <Text className="text-xl font-bold text-iron-950 mb-6">
                                {editingCategory ? 'Edit Category' : 'New Category'}
                            </Text>

                            <IronInput
                                label="Name"
                                value={categoryName}
                                onChangeText={setCategoryName}
                                autoFocus
                            />

                            <Text className="text-iron-500 text-sm mb-2 font-bold uppercase tracking-wider">Color</Text>

                            <TouchableOpacity
                                onPress={() => setShowColorPicker(true)}
                                className="flex-row items-center bg-white p-4 rounded-xl border border-iron-500 mb-6 justify-between active:bg-iron-200"
                            >
                                <Text className="text-iron-950 font-semibold">Selected Color</Text>
                                <View className="flex-row items-center gap-3">
                                    <Text className="text-iron-500 uppercase font-mono">{selectedColor}</Text>
                                    <View className="w-8 h-8 rounded-full border border-iron-200 shadow-sm" style={{ backgroundColor: selectedColor }} />
                                </View>
                            </TouchableOpacity>

                            <View className="flex-row gap-3">
                                <View className="flex-1">
                                    <IronButton label="Cancel" variant="ghost" onPress={() => setModalVisible(false)} />
                                </View>
                                <View className="flex-1">
                                    <IronButton label="Save" onPress={handleSave} />
                                </View>
                            </View>
                        </View>
                    </View>
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
