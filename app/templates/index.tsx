import { IronButton } from '@/components/IronButton';
import { IronInput } from '@/components/IronInput';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { workoutService } from '@/src/services/WorkoutService';
import { Colors } from '@/src/theme';
import { Workout } from '@/src/types/db';
import { FlashList } from '@shopify/flash-list';
import { format } from 'date-fns';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Dumbbell, Play, Plus, Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';

const FlashListAny = FlashList as any;

export default function TemplatesScreen() {
    const router = useRouter();
    const [templates, setTemplates] = useState<Workout[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');

    const loadTemplates = useCallback(async () => {
        setLoading(true);
        try {
            const data = await workoutService.getTemplates();
            setTemplates(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadTemplates();
        }, [loadTemplates])
    );

    const handleCreate = async () => {
        if (!newTemplateName.trim()) return;
        try {
            const id = await workoutService.createTemplate(newTemplateName);
            setNewTemplateName('');
            setIsCreating(false);
            router.push({ pathname: '/workout/[id]', params: { id } });
        } catch (e) {
            Alert.alert('Error', 'No se pudo crear la plantilla.');
        }
    };

    const handleLoad = (templateId: string) => {
        Alert.alert('Iniciar entrenamiento', '¿Usar esta plantilla para la sesión de hoy?', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Iniciar',
                onPress: async () => {
                    try {
                        const today = format(new Date(), 'yyyy-MM-dd');
                        const newId = await workoutService.loadTemplate(templateId, today);
                        router.push({ pathname: '/workout/[id]', params: { id: newId } });
                    } catch (e) {
                        Alert.alert('Error', (e as Error).message);
                    }
                }
            }
        ]);
    };

    const handleDelete = (id: string) => {
        Alert.alert('Eliminar', '¿Eliminar esta plantilla permanentemente?', [
            { text: 'Cancelar' },
            {
                text: 'Eliminar',
                style: 'destructive',
                onPress: async () => {
                    await workoutService.delete(id);
                    loadTemplates();
                }
            }
        ]);
    };

    return (
        <SafeAreaWrapper className="bg-iron-900" edges={['left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />
            
            <View className="pt-4 px-4 pb-4 border-b border-iron-200 flex-row justify-between items-center bg-iron-900">
                <Text className="text-3xl font-bold text-iron-950">Plantillas</Text>
                <TouchableOpacity 
                    onPress={() => setIsCreating(true)}
                    className="bg-surface p-2 rounded-lg border border-iron-700 elevation-1 active:bg-iron-200"
                >
                    <Plus size={24} color={Colors.primary.DEFAULT} />
                </TouchableOpacity>
            </View>

            <FlashListAny
                data={templates}
                estimatedItemSize={100}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }: { item: Workout }) => (
                    <View className="bg-surface p-4 rounded-xl mb-4 border border-iron-700 elevation-1 flex-row items-center justify-between">
                        <Pressable 
                            className="flex-1 flex-row items-center gap-4"
                            onPress={() => router.push({ pathname: '/workout/[id]', params: { id: item.id } })}
                        >
                            <View className="w-12 h-12 bg-iron-100 rounded-lg items-center justify-center border border-iron-200">
                                <Dumbbell size={24} color={Colors.primary.DEFAULT} />
                            </View>
                            <View>
                                <Text className="text-iron-950 font-bold text-lg">{item.name}</Text>
                                <Text className="text-iron-500 text-xs">Toca para editar</Text>
                            </View>
                        </Pressable>

                        <View className="flex-row items-center gap-2">
                            <TouchableOpacity 
                                onPress={() => handleLoad(item.id)}
                                className="w-10 h-10 bg-primary rounded-full items-center justify-center shadow-sm active:opacity-80"
                            >
                                <Play size={20} color="white" fill="white" />
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => handleDelete(item.id)}
                                className="w-10 h-10 bg-iron-200 rounded-full items-center justify-center active:bg-red-100"
                            >
                                <Trash2 size={20} color={Colors.red} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
                ListEmptyComponent={
                    <View className="items-center justify-center mt-20">
                        <Text className="text-iron-500 text-center mb-4">Todavía no hay plantillas.</Text>
                        <IronButton label="Crear primera plantilla" onPress={() => setIsCreating(true)} />
                    </View>
                }
            />

            <Modal
                transparent
                visible={isCreating}
                animationType="fade"
                onRequestClose={() => setIsCreating(false)}
            >
                <View className="flex-1 bg-black/50 justify-center items-center p-4">
                    <View className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-iron-700 elevation-2">
                        <Text className="text-xl font-bold text-iron-950 mb-6">Nueva plantilla</Text>
                        <IronInput
                            placeholder="Nombre de plantilla (ej: Piernas)"
                            value={newTemplateName}
                            onChangeText={setNewTemplateName}
                            autoFocus
                        />
                        <View className="flex-row gap-3 mt-4">
                            <View className="flex-1">
                                <IronButton label="Cancelar" variant="ghost" onPress={() => setIsCreating(false)} />
                            </View>
                            <View className="flex-1">
                                <IronButton label="Crear" onPress={handleCreate} />
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaWrapper>
    );
}
