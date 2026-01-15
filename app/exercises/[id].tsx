import { IronButton } from '@/components/IronButton';
import { IronInput } from '@/components/IronInput';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { Exercise, ExerciseService } from '@/src/services/ExerciseService';
import { Colors } from '@/src/theme';
import { ExerciseType } from '@/src/types/db';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LucidePlus, LucideTrash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

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
        <SafeAreaWrapper className="flex-1 bg-iron-900" edges={['top', 'left', 'right']}>
            <View className="flex-row justify-between items-center mb-6 px-4 pt-4">
                <Text className="text-2xl font-bold text-iron-950">Exercises</Text>
                <Pressable
                    onPress={() => setIsAdding(!isAdding)}
                    className="bg-surface p-2 rounded-lg border border-iron-700 elevation-1 active:bg-iron-200"
                >
                    <LucidePlus size={24} color={Colors.primary.DEFAULT} />
                </Pressable>
            </View>

            {isAdding && (
                <View className="bg-surface mx-4 p-4 rounded-xl border border-iron-700 elevation-2 mb-4">
                    <Text className="text-iron-950 font-bold mb-4 text-lg">New Exercise</Text>
                    <IronInput
                        placeholder="Exercise Name"
                        value={newName}
                        onChangeText={setNewName}
                        autoFocus
                    />
                    <IronButton
                        label="CREATE"
                        onPress={handleCreate}
                        variant="solid"
                    />
                </View>
            )}

            <FlashList
                data={exercises}
                // @ts-ignore
                estimatedItemSize={70}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
                renderItem={({ item }) => (
                    <View className="bg-surface p-4 rounded-xl mb-3 border border-iron-700 elevation-1 flex-row justify-between items-center">
                        <View>
                            <Text className="text-iron-950 font-bold text-lg">{item.name}</Text>
                            <Text className="text-iron-500 text-xs font-bold uppercase tracking-wider">{item.type}</Text>
                        </View>
                        <Pressable onPress={() => handleDelete(item.id, item.name)} className="p-3 -mr-2 active:opacity-50">
                            <LucideTrash2 size={20} color={Colors.iron[400]} />
                        </Pressable>
                    </View>
                )}
                ListEmptyComponent={
                    <Text className="text-iron-500 text-center mt-10">No exercises in this category.</Text>
                }
            />
        </SafeAreaWrapper>
    );
}
