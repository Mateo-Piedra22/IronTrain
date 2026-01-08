import { Exercise, ExerciseService } from '@/src/services/ExerciseService';
import { ExerciseType } from '@/src/types/db';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LucidePlus, LucideTrash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CategoryDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [categoryName, setCategoryName] = useState('Category');
    const [isAdding, setIsAdding] = useState(false);

    // New Exercise Form
    const [newName, setNewName] = useState('');
    const [newType, setNewType] = useState<ExerciseType>('weight_reps'); // default

    useEffect(() => {
        if (id) {
            loadData();
        }
    }, [id]);

    const loadData = async () => {
        try {
            // Sadly my CategoryService doesn't have getById. I should add it.
            // Or just filter from list effectively. 
            // I'll add getById to CategoryService for correctness.
            // For now, I'll fetch exercises.
            if (!id) return;
            const ex = await ExerciseService.getByCategory(id);
            setExercises(ex);

            // Hack to get name if service missing getById
            // const cats = await CategoryService.getAll();
            // const c = cats.find(c => c.id === id);
            // if (c) setCategoryName(c.name);
        } catch (e) {
            console.error(e);
        }
    };

    const handleCreate = async () => {
        if (!newName.trim() || !id) return;
        try {
            await ExerciseService.create({
                category_id: id,
                name: newName.trim(),
                type: newType,
                notes: ''
            });
            setNewName('');
            setIsAdding(false);
            loadData();
        } catch (e) {
            Alert.alert('Error', (e as Error).message);
        }
    };

    const handleDelete = async (exId: string, name: string) => {
        Alert.alert('Delete Exercise', `Delete "${name}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await ExerciseService.delete(exId);
                        loadData();
                    } catch (e) {
                        Alert.alert('Cannot delete', (e as Error).message);
                    }
                }
            }
        ]);
    };

    return (
        <SafeAreaView className="flex-1 bg-iron-900 px-4" edges={['top']}>
            <View className="flex-row justify-between items-center mb-6 pt-4">
                <Text className="text-2xl font-bold text-white">Exercises</Text>
                <Pressable
                    onPress={() => setIsAdding(!isAdding)}
                    className="bg-iron-800 p-2 rounded-lg border border-iron-600"
                >
                    <LucidePlus size={24} color="#ff5500" />
                </Pressable>
            </View>

            {isAdding && (
                <View className="bg-iron-800 p-4 rounded-xl border border-iron-600 mb-4">
                    <Text className="text-white font-bold mb-2">New Exercise</Text>
                    <TextInput
                        className="bg-iron-900 text-white p-3 rounded-lg border border-iron-700 mb-3"
                        placeholder="Exercise Name"
                        placeholderTextColor="#666"
                        value={newName}
                        onChangeText={setNewName}
                        autoFocus
                    />
                    <Pressable onPress={handleCreate} className="bg-primary p-3 rounded-lg items-center">
                        <Text className="text-white font-bold uppercase">Create</Text>
                    </Pressable>
                </View>
            )}

            <FlashList
                data={exercises}
                // @ts-ignore
                estimatedItemSize={70}
                renderItem={({ item }) => (
                    <View className="bg-iron-800 p-4 rounded-xl mb-3 border border-iron-700 flex-row justify-between items-center">
                        <View>
                            <Text className="text-white font-bold text-lg">{item.name}</Text>
                            <Text className="text-iron-500 text-xs">{item.type}</Text>
                        </View>
                        <Pressable onPress={() => handleDelete(item.id, item.name)} className="p-2">
                            <LucideTrash2 size={20} color="#a4a4a4" />
                        </Pressable>
                    </View>
                )}
                ListEmptyComponent={
                    <Text className="text-iron-500 text-center mt-10">No exercises in this category.</Text>
                }
            />
        </SafeAreaView>
    );
}
