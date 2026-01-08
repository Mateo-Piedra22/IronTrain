import { IronButton } from '@/components/IronButton';
import { IronInput } from '@/components/IronInput';
import { ExerciseService } from '@/src/services/ExerciseService';
import { ExerciseType } from '@/src/types/db';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';

export default function ExerciseModal() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const categoryId = params.categoryId as string;
    const exerciseId = params.exerciseId as string;

    const [name, setName] = useState('');
    const [type, setType] = useState<ExerciseType>('weight_reps');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (exerciseId) {
            loadExercise();
        }
    }, [exerciseId]);

    const loadExercise = async () => {
        try {
            const exercises = await ExerciseService.getAll(); // Imperfect but works for now. Better to have getById
            // In a real app we'd add getById to service. For now, filter local or fetch all.
            const ex = exercises.find(e => e.id === exerciseId);
            if (ex) {
                setName(ex.name);
                setType(ex.type);
                setNotes(ex.notes || '');
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert('Validation', 'Name is required');
            return;
        }

        setLoading(true);
        try {
            if (exerciseId) {
                await ExerciseService.update(exerciseId, { name, type, notes });
            } else {
                await ExerciseService.create({
                    category_id: categoryId,
                    name,
                    type,
                    notes
                });
            }
            router.back();
            //Ideally trigger refresh on previous screen
        } catch (e) {
            Alert.alert('Error', (e as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-iron-900 p-4">
            <Stack.Screen options={{
                title: exerciseId ? 'Edit Exercise' : 'New Exercise',
                presentation: 'modal'
            }} />

            <IronInput
                label="Exercise Name"
                placeholder="e.g. Bench Press"
                value={name}
                onChangeText={setName}
            />

            <View className="mb-4">
                <Text className="text-textMuted mb-2 text-sm font-medium">Type</Text>
                <View className="flex-row flex-wrap gap-2">
                    {(['weight_reps', 'distance_time', 'weight_only', 'reps_only'] as ExerciseType[]).map((t) => (
                        <IronButton
                            key={t}
                            label={t.replace('_', ' + ')}
                            variant={type === t ? 'solid' : 'outline'}
                            size="sm"
                            onPress={() => setType(t)}
                        />
                    ))}
                </View>
            </View>

            <IronInput
                label="Notes (Optional)"
                placeholder="e.g. Grip width..."
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
            />

            <IronButton
                label={exerciseId ? "Update Exercise" : "Create Exercise"}
                onPress={handleSave}
                loading={loading}
                className="mt-4"
            />
        </View>
    );
}
