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
            Alert.alert('Validación', 'El nombre es obligatorio.');
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
                title: exerciseId ? 'Editar ejercicio' : 'Nuevo ejercicio',
                presentation: 'modal'
            }} />

            <IronInput
                label="Nombre del ejercicio"
                placeholder="Ej: Press de banca"
                value={name}
                onChangeText={setName}
            />

            <View className="mb-4">
                <Text className="text-textMuted mb-2 text-sm font-medium">Tipo</Text>
                <View className="flex-row flex-wrap gap-2">
                    {(['weight_reps', 'distance_time', 'weight_only', 'reps_only'] as ExerciseType[]).map((t) => (
                        <IronButton
                            key={t}
                            label={
                                t === 'weight_reps'
                                    ? 'Peso + reps'
                                    : t === 'distance_time'
                                        ? 'Distancia + tiempo'
                                        : t === 'weight_only'
                                            ? 'Solo peso'
                                            : 'Solo reps'
                            }
                            variant={type === t ? 'solid' : 'outline'}
                            size="sm"
                            onPress={() => setType(t)}
                        />
                    ))}
                </View>
            </View>

            <IronInput
                label="Notas (opcional)"
                placeholder="Ej: ancho de agarre..."
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
            />

            <IronButton
                label={exerciseId ? "Actualizar ejercicio" : "Crear ejercicio"}
                onPress={handleSave}
                loading={loading}
                className="mt-4"
            />
        </View>
    );
}
