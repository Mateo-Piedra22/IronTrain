import { IronButton } from '@/components/IronButton';
import { IronInput } from '@/components/IronInput';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { BodyMetric, bodyService } from '@/src/services/BodyService';
import { Colors } from '@/src/theme';
import { format } from 'date-fns';
import { Stack, useFocusEffect } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, Dimensions, Pressable, ScrollView, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

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
        <SafeAreaWrapper className="bg-iron-900" edges={['left', 'right']}>
            <ScrollView className="flex-1 px-4 pt-4">
                <Stack.Screen options={{
                    title: 'Body Tracker',
                    headerStyle: { backgroundColor: Colors.iron[900] },
                    headerTintColor: Colors.primary.DEFAULT,
                    headerShadowVisible: false
                }} />

                <View className="mb-6">
                    <Text className="text-iron-950 text-lg font-bold mb-4">Log Today</Text>
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
                    <View className="mt-2">
                        <IronButton label="Log Entry" onPress={handleLog} />
                    </View>
                </View>

                {chartData.length > 1 && (
                    <View className="mb-8 items-center">
                        <View className="p-4 w-full bg-surface rounded-xl border border-iron-700 elevation-1">
                            <Text className="text-primary font-bold mb-4">Weight Trend</Text>
                            <LineChart
                                data={chartData}
                                color={Colors.primary.DEFAULT}
                                thickness={3}
                                dataPointsColor={Colors.primary.DEFAULT}
                                textColor={Colors.iron[500]}
                                yAxisTextStyle={{ color: Colors.iron[400] }}
                                width={screenWidth - 80}
                                height={200}
                                isAnimated
                                curved
                                hideRules
                            />
                        </View>
                    </View>
                )}

                <Text className="text-iron-950 text-lg font-bold mb-4">History</Text>
                {metrics.map(m => (
                    <View key={m.id} className="mb-3 flex-row justify-between items-center bg-surface p-4 rounded-xl border border-iron-700 elevation-1">
                        <View>
                            <Text className="text-iron-500 text-xs font-bold uppercase tracking-wider">{m.date}</Text>
                            <View className="flex-row gap-4 mt-1">
                                {m.weight && <Text className="text-iron-950 font-bold text-lg">{m.weight} kg</Text>}
                                {m.body_fat && <Text className="text-primary font-bold text-lg">{m.body_fat}%</Text>}
                            </View>
                        </View>
                        <Pressable onPress={() => handleDelete(m.id)} className="p-2 active:opacity-50">
                            <Trash2 size={20} color={Colors.iron[400]} />
                        </Pressable>
                    </View>
                ))}
            </ScrollView>
        </SafeAreaWrapper>
    );
}
