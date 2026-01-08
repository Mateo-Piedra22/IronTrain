import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Dimensions, Pressable, ScrollView, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { IronButton } from '@/components/IronButton';
import { IronCard } from '@/components/IronCard';
import { IronInput } from '@/components/IronInput';
import { BodyMetric, bodyService } from '@/src/services/BodyService';

const screenWidth = Dimensions.get('window').width;

export default function BodyTrackerScreen() {
    const [metrics, setMetrics] = useState<BodyMetric[]>([]);
    const [weight, setWeight] = useState('');
    const [fat, setFat] = useState('');
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        try {
            const data = await bodyService.getAll();
            setMetrics(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const handleLog = async () => {
        if (!weight) {
            Alert.alert('Error', 'Please enter weight');
            return;
        }
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            await bodyService.add(today, parseFloat(weight), parseFloat(fat));
            setWeight('');
            setFat('');
            loadData();
        } catch (e) {
            Alert.alert('Error', 'Failed to save');
        }
    };

    const handleDelete = async (id: string) => {
        Alert.alert('Delete', 'Delete entries for this day?', [
            { text: 'Cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    await bodyService.delete(id);
                    loadData();
                }
            }
        ]);
    };

    // Prepare chart data (reverse to show chronological)
    const chartData = [...metrics].reverse()
        .filter(m => m.weight !== null)
        .map(m => ({
            value: m.weight!,
            label: format(new Date(m.date), 'dd/MM'),
            dataPointText: m.weight?.toString()
        }));

    return (
        <ScrollView className="flex-1 bg-background p-4">
            <Stack.Screen options={{ title: 'Body Tracker', headerBackTitle: 'Analysis' }} />

            <View className="mb-6">
                <Text className="text-white text-lg font-bold mb-4">Log Today</Text>
                <View className="flex-row gap-4">
                    <View className="flex-1">
                        <IronInput
                            placeholder="Weight (kg)"
                            keyboardType="numeric"
                            value={weight}
                            onChangeText={setWeight}
                        />
                    </View>
                    <View className="flex-1">
                        <IronInput
                            placeholder="Body Fat %"
                            keyboardType="numeric"
                            value={fat}
                            onChangeText={setFat}
                        />
                    </View>
                </View>
                <View className="mt-4">
                    <IronButton label="Log Entry" onPress={handleLog} />
                </View>
            </View>

            {chartData.length > 1 && (
                <View className="mb-8 items-center">
                    <IronCard className="p-2 w-full">
                        <Text className="text-primary font-bold mb-4">Weight Trend</Text>
                        <LineChart
                            data={chartData}
                            color="#f97316"
                            thickness={3}
                            dataPointsColor="#f97316"
                            textColor="white"
                            yAxisTextStyle={{ color: '#94a3b8' }}
                            width={screenWidth - 80}
                            height={200}
                            isAnimated
                            curved
                            hideRules
                        />
                    </IronCard>
                </View>
            )}

            <Text className="text-white text-lg font-bold mb-4">History</Text>
            {metrics.map(m => (
                <IronCard key={m.id} className="mb-3 flex-row justify-between items-center">
                    <View>
                        <Text className="text-textMuted text-xs">{m.date}</Text>
                        <View className="flex-row gap-4 mt-1">
                            {m.weight && <Text className="text-white font-bold text-lg">{m.weight} kg</Text>}
                            {m.body_fat && <Text className="text-primary font-bold text-lg">{m.body_fat}%</Text>}
                        </View>
                    </View>
                    <Pressable onPress={() => handleDelete(m.id)} className="p-2">
                        <Ionicons name="trash-outline" size={20} color="#94a3b8" />
                    </Pressable>
                </IronCard>
            ))}
        </ScrollView>
    );
}
