// @ts-nocheck
import { Colors } from '@/src/theme';
import { useRouter } from 'expo-router';
import { Plus, Search } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CategoryService } from '../src/services/CategoryService';
import { ExerciseService } from '../src/services/ExerciseService';
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
        <View className="flex-1 bg-iron-900">
            {/* Search Header */}
            <View className="p-4 border-b border-iron-800">
                <View className="flex-row items-center bg-iron-800 px-4 py-3 rounded-xl border border-iron-700">
                    <Search size={20} color={Colors.iron[950]} />
                    <TextInput
                        className="flex-1 ml-3 text-iron-950 text-base"
                        placeholder="Search exercises..."
                        placeholderTextColor={Colors.iron[500]}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {/* Category Tabs */}
                <View className="mt-4">
                    <FlatList<CategoryItem>
                        horizontal
                        data={[{ id: 'all', name: 'All', color: Colors.iron[950] }, ...categories]}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingRight: 20 }}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => setSelectedCategory(item.id)}
                                className={`mr-2 px-4 py-2 rounded-full border ${selectedCategory === item.id
                                    ? 'bg-iron-800 border-primary'
                                    : 'bg-transparent border-iron-700'
                                    }`}
                            >
                                <Text className={`text-sm font-semibold ${selectedCategory === item.id ? 'text-primary' : 'text-iron-950'
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
                <FlatList<ExerciseItem>
                    data={exercises}
                    contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                    // Lazy Loading Optimization
                    onEndReachedThreshold={0.5} // Preload when halfway down
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            onPress={() => handlePress(item)}
                            className="flex-row items-center justify-between p-4 mb-3 bg-surface rounded-xl border border-iron-700 elevation-1 active:opacity-70"
                        >
                            <View className="flex-1">
                                <Text className="text-iron-950 font-bold text-base">{item.name}</Text>
                                <View className="flex-row items-center mt-1">
                                    <View className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: item.category_color || '#fff' }} />
                                    <Text className="text-iron-950/60 text-xs uppercase">{item.category_name}</Text>
                                </View>
                            </View>
                            {/* Visual indicator for edit mode could go here */}
                        </TouchableOpacity>
                    )}
                />
            )}

            {/* FAB for creation (Only visible in Management Mode) */}
            {!onSelect && (
                <TouchableOpacity
                    onPress={handleCreate}
                    className="absolute bottom-6 right-6 w-14 h-14 bg-primary rounded-full items-center justify-center shadow-lg border border-iron-700 active:opacity-90"
                >
                    <Plus color="white" />
                </TouchableOpacity>
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
