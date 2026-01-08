// @ts-nocheck
import { Colors } from '@/src/theme';
import { FlashList } from '@shopify/flash-list';
import { Plus, Search } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { dbService } from '../src/services/DatabaseService';
import { Category, Exercise } from '../src/types/db';
import { ExerciseFormModal } from './ExerciseFormModal';

interface ExerciseListProps {
    onSelect?: (exerciseId: string) => void;
}

type ExerciseItem = Exercise & { category_name: string; category_color: string };
type CategoryItem = Category | { id: string; name: string; color: string };

export function ExerciseList({ onSelect }: ExerciseListProps) {
    const [exercises, setExercises] = useState<ExerciseItem[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [loading, setLoading] = useState(true);

    // Form Modal
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [exs, cats] = await Promise.all([
                dbService.searchExercises(searchQuery, selectedCategory),
                dbService.getCategories()
            ]);
            setExercises(exs);
            setCategories(cats);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [searchQuery, selectedCategory]);

    useEffect(() => {
        const timeout = setTimeout(loadData, 300); // Debounce search
        return () => clearTimeout(timeout);
    }, [loadData]);


    const handleCreate = () => {
        setEditingExercise(null);
        setIsFormVisible(true);
    };

    const handleEdit = (ex: Exercise) => {
        if (onSelect) return; // Don't edit in picker mode
        setEditingExercise(ex);
        setIsFormVisible(true);
    };

    return (
        <View className="flex-1 bg-iron-900">
            {/* Search Header */}
            <View className="p-4 border-b border-iron-800">
                <View className="flex-row items-center bg-iron-800 px-4 py-3 rounded-xl border border-iron-700">
                    <Search size={20} color={Colors.iron[400]} />
                    <TextInput
                        className="flex-1 ml-3 text-white text-base"
                        placeholder="Search exercises..."
                        placeholderTextColor={Colors.iron[400]}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {/* Category Tabs */}
                <View className="mt-4">
                    {/* @ts-ignore */}
                    <FlashList<CategoryItem>
                        horizontal
                        data={[{ id: 'all', name: 'All', color: Colors.iron[400] }, ...categories]}
                        estimatedItemSize={80}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingRight: 20 }}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => setSelectedCategory(item.id)}
                                className={`mr-2 px-4 py-2 rounded-full border ${selectedCategory === item.id
                                    ? 'bg-iron-800 border-primary'
                                    : 'bg-transparent border-iron-700'
                                    }`}
                            >
                                <Text className={`text-sm font-semibold ${selectedCategory === item.id ? 'text-primary' : 'text-iron-400'
                                    }`}>
                                    {item.name}
                                </Text>
                            </TouchableOpacity>
                        )}
                    />
                </View>
            </View>

            {/* List */}
            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator color={Colors.primary.dark} />
                </View>
            ) : (
                // @ts-ignore
                <FlashList<ExerciseItem>
                    data={exercises}
                    estimatedItemSize={70}
                    contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            onPress={() => onSelect ? onSelect(item.id) : handleEdit(item)}
                            className="flex-row items-center justify-between p-4 mb-3 bg-iron-800/40 rounded-xl border border-iron-800"
                        >
                            <View className="flex-1">
                                <Text className="text-white font-bold text-base">{item.name}</Text>
                                <View className="flex-row items-center mt-1">
                                    <View className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: item.category_color || '#fff' }} />
                                    <Text className="text-iron-400 text-xs uppercase">{item.category_name}</Text>
                                </View>
                            </View>
                            {/* If in management mode, show edit icon? Or simple tap to edit */}
                        </TouchableOpacity>
                    )}
                />
            )}

            {/* FAB for creation (Always visible) */}
            <TouchableOpacity
                onPress={handleCreate}
                className="absolute bottom-6 right-6 w-14 h-14 bg-iron-700 rounded-full items-center justify-center shadow-lg border border-iron-600"
            >
                <Plus color="white" />
            </TouchableOpacity>

            <ExerciseFormModal
                visible={isFormVisible}
                onClose={() => setIsFormVisible(false)}
                onSave={loadData}
                initialData={editingExercise}
            />
        </View>
    );
}
