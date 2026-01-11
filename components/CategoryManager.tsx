import { IronButton } from '@/components/IronButton';
import { Colors } from '@/src/theme';
import { FlashList } from '@shopify/flash-list';
import { Pencil, Plus, Trash2 } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CategoryService } from '../src/services/CategoryService';
import { Category } from '../src/types/db';

// @ts-ignore
const FlashListAny = FlashList as any;

export function CategoryManager() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [categoryName, setCategoryName] = useState('');
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
                await CategoryService.update(editingCategory.id, categoryName.trim());
            } else {
                await CategoryService.create(categoryName.trim());
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
        } else {
            setEditingCategory(null);
            setCategoryName('');
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
                <FlashListAny
                    data={categories}
                    estimatedItemSize={60}
                    contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                    renderItem={({ item }: any) => (
                        <View className="flex-row items-center justify-between p-4 mb-3 bg-iron-800 rounded-xl border border-iron-700">
                            <View className="flex-row items-center gap-3">
                                <View className="w-3 h-3 rounded-full bg-primary" />
                                <Text className="text-white font-bold text-base">{item.name}</Text>
                                {item.is_system === 1 && (
                                    <Text className="text-xs text-iron-500 bg-iron-900 px-2 py-0.5 rounded">SYSTEM</Text>
                                )}
                            </View>

                            <View className="flex-row items-center gap-2">
                                {!item.is_system && (
                                    <>
                                        <TouchableOpacity onPress={() => openModal(item)} className="p-2 bg-iron-900 rounded-lg">
                                            <Pencil size={18} color={Colors.iron[400]} />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleDelete(item)} className="p-2 bg-red-900/20 rounded-lg">
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
                className="absolute bottom-6 right-6 w-14 h-14 bg-primary rounded-full items-center justify-center shadow-lg border border-orange-400"
            >
                <Plus color="white" size={30} />
            </TouchableOpacity>

            <Modal
                transparent
                visible={modalVisible}
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <View className="flex-1 bg-black/80 justify-center items-center p-4">
                    <View className="bg-iron-900 w-full max-w-sm rounded-2xl p-6 border border-iron-700">
                        <Text className="text-xl font-bold text-white mb-6">
                            {editingCategory ? 'Edit Category' : 'New Category'}
                        </Text>

                        <Text className="text-iron-400 text-sm mb-2 uppercase font-bold">Name</Text>
                        <TextInput
                            className="bg-iron-950 text-white p-4 rounded-xl border border-iron-800 mb-6 font-semibold"
                            value={categoryName}
                            onChangeText={setCategoryName}
                            returnKeyType="done"
                            onSubmitEditing={handleSave}
                            autoFocus
                        />

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
        </View>
    );
} 
