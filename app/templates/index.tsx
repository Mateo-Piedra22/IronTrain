import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';

import { IronButton } from '@/components/IronButton';
import { IronCard } from '@/components/IronCard';
import { workoutService } from '@/src/services/WorkoutService';
import { Workout } from '@/src/types/db';

export default function TemplatesScreen() {
    const router = useRouter();
    const [templates, setTemplates] = useState<Workout[]>([]);
    const [loading, setLoading] = useState(true);

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

    const handleLoad = (templateId: string) => {
        Alert.alert('Load Template', 'Load this workout to Today?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Load',
                onPress: async () => {
                    try {
                        const today = format(new Date(), 'yyyy-MM-dd');
                        await workoutService.loadTemplate(templateId, today);
                        Alert.alert('Success', 'Template loaded!');
                        router.push('/(tabs)');
                    } catch (e) {
                        Alert.alert('Error', (e as Error).message);
                    }
                }
            }
        ]);
    };

    const handleDelete = (id: string) => {
        Alert.alert('Delete', 'Delete this template?', [
            { text: 'Cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    await workoutService.delete(id);
                    loadTemplates();
                }
            }
        ]);
    };

    return (
        <View className="flex-1 bg-background p-4 pt-12">
            <View className="flex-row items-center mb-6">
                <Pressable onPress={() => router.back()} className="mr-4">
                    <Ionicons name="arrow-back" size={24} color="white" />
                </Pressable>
                <Text className="text-2xl font-bold text-white">Templates</Text>
            </View>

            <FlatList
                data={templates}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <IronCard className="mb-4 flex-row justify-between items-center">
                        <View>
                            <Text className="text-white text-lg font-bold">{item.name}</Text>
                            <Text className="text-textMuted text-xs">ID: {item.id.slice(0, 8)}...</Text>
                        </View>
                        <View className="flex-row gap-2">
                            <IronButton
                                label="Load"
                                size="sm"
                                onPress={() => handleLoad(item.id)}
                            />
                            <Pressable onPress={() => handleDelete(item.id)} className="justify-center px-2">
                                <Ionicons name="trash-outline" size={20} color="#94a3b8" />
                            </Pressable>
                        </View>
                    </IronCard>
                )}
                ListEmptyComponent={
                    <Text className="text-textMuted text-center mt-10">No templates saved.</Text>
                }
            />
        </View>
    );
}
