import { CalculatorsModal } from '@/components/CalculatorsModal';
import { ConsistencyHeatmap } from '@/components/ConsistencyHeatmap';
import { GoalsWidget } from '@/components/GoalsWidget';
import { PRCenter } from '@/components/PRCenter';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { AnalysisService, OneRepMax } from '@/src/services/AnalysisService';
import { backupService } from '@/src/services/BackupService';
import { workoutService } from '@/src/services/WorkoutService';
import { Colors } from '@/src/theme';
import { useFocusEffect, useRouter } from 'expo-router';
import { LucideCalculator, LucideDatabase, LucideSettings } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Dimensions, Pressable, ScrollView, Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

const screenWidth = Dimensions.get('window').width;

export default function AnalysisScreen() {
    const router = useRouter();
    const [volumeData, setVolumeData] = useState<{ value: number, label: string, frontColor: string }[]>([]);
    const [oneRepMaxes, setOneRepMaxes] = useState<OneRepMax[]>([]);
    const [heatmapData, setHeatmapData] = useState<number[]>([]);
    const [calcVisible, setCalcVisible] = useState(false);

    const loadStats = useCallback(async () => {
        try {
            // 1. Heatmap (Last 365 days)
            const dates = await workoutService.getCompletedWorkoutsLastYear();
            setHeatmapData(dates);

            // 2. Volume
            const vol = await AnalysisService.getWeeklyVolume();
            const chartData = vol.map((v, i) => ({
                value: v.volume,
                label: v.date,
                frontColor: Colors.primary.dark // primary
            }));
            setVolumeData(chartData);

            // 3. 1RM
            const maxes = await AnalysisService.getTop1RMs();
            setOneRepMaxes(maxes);
        } catch (e) {
            console.error('Failed to load stats', e);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadStats();
        }, [loadStats])
    );

    return (
        <SafeAreaWrapper className="flex-1 bg-iron-900" edges={['top']}>
            <ScrollView className=" px-4 pt-4">
                <Text className="text-3xl font-bold text-white mb-6">Deep Analytics</Text>

                {/* --- NEW: PR Center --- */}
                <PRCenter />

                {/* --- NEW: Goals --- */}
                <GoalsWidget />

                {/* Consistency Heatmap */}
                <View className="mb-8">
                    <Text className="text-lg text-primary font-bold mb-4">Consistency</Text>
                    <ConsistencyHeatmap timestamps={heatmapData} />
                </View>

                {/* Volume Chart */}
                <View className="mb-8">
                    <Text className="text-lg text-primary font-bold mb-4">Volume (Last 7 Workouts)</Text>
                    <View className="bg-iron-800 p-4 rounded-xl border border-iron-700 items-center">
                        {volumeData.length > 0 ? (
                            <BarChart
                                data={volumeData}
                                barWidth={30}
                                noOfSections={3}
                                barBorderRadius={4}
                                frontColor={Colors.primary.dark}
                                yAxisThickness={0}
                                xAxisThickness={0}
                                yAxisTextStyle={{ color: Colors.iron[400] }}
                                xAxisLabelTextStyle={{ color: Colors.iron[400] }}
                                width={screenWidth - 80}
                                height={200}
                                isAnimated
                            />
                        ) : (
                            <Text className="text-iron-500 py-8">No volume data available.</Text>
                        )}
                    </View>
                </View>

                {/* 1RM Estimates */}
                <View className="mb-8">
                    <Text className="text-lg text-primary font-bold mb-4">Est. 1RM Records</Text>
                    {oneRepMaxes.length > 0 ? (
                        <View className="gap-3">
                            {oneRepMaxes.map((orm, idx) => (
                                <View key={idx} className="bg-iron-800 p-4 rounded-xl border border-iron-700 flex-row justify-between items-center">
                                    <View>
                                        <Text className="text-white font-bold text-base">{orm.exerciseName}</Text>
                                        <Text className="text-iron-400 text-xs">{orm.weight}kg x {orm.reps}</Text>
                                    </View>
                                    <View>
                                        <Text className="text-primary text-xl font-bold">{orm.estimated1RM}</Text>
                                        <Text className="text-iron-500 text-[10px] text-right">KG</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <Text className="text-iron-500">Log heavy sets to see estimates.</Text>
                    )}
                </View>

                <Text className="text-lg text-primary font-bold mb-4">Tools & Settings</Text>
                <View className="gap-4 mb-20">

                    {/* --- NEW: Calculators --- */}
                    <Pressable
                        onPress={() => setCalcVisible(true)}
                        className="bg-iron-800 p-4 rounded-xl border border-iron-700 flex-row items-center gap-3"
                    >
                        <LucideCalculator size={24} color={Colors.primary.dark} />
                        <Text className="text-white font-bold flex-1">1RM & Power Calculators</Text>
                    </Pressable>

                    <Pressable
                        onPress={() => router.push('/tools/plate-calculator' as any)}
                        className="bg-iron-800 p-4 rounded-xl border border-iron-700 flex-row items-center gap-3"
                    >
                        <LucideCalculator size={24} color={Colors.primary.dark} />
                        <Text className="text-white font-bold flex-1">Plate Calculator</Text>
                    </Pressable>

                    <Pressable
                        onPress={() => {
                            import('react-native').then(({ Alert }) => {
                                Alert.alert(
                                    'Data Sovereignty',
                                    'Manage your data',
                                    [
                                        {
                                            text: 'Export Backup (JSON)',
                                            onPress: async () => {
                                                try {
                                                    await backupService.exportData();
                                                } catch (e) {
                                                    Alert.alert('Error', 'Export Failed');
                                                }
                                            }
                                        },
                                        {
                                            text: 'Restore Backup (JSON)',
                                            style: 'destructive',
                                            onPress: async () => {
                                                try {
                                                    const success = await backupService.importData();
                                                    if (success) Alert.alert('Success', 'Data restored! Restart app.');
                                                } catch (e) {
                                                    Alert.alert('Error', 'Import Failed');
                                                }
                                            }
                                        },
                                        { text: 'Cancel', style: 'cancel' }
                                    ]
                                );
                            });
                        }}
                        className="bg-iron-800 p-4 rounded-xl border border-iron-700 flex-row items-center gap-3 active:bg-iron-700"
                    >
                        <LucideDatabase size={24} color={Colors.primary.dark} />
                        <Text className="text-white font-bold flex-1">Data Management</Text>
                    </Pressable>

                    <Pressable
                        onPress={() => router.push('/settings' as any)}
                        className="bg-iron-800 p-4 rounded-xl border border-iron-700 flex-row items-center gap-3"
                    >
                        <LucideSettings size={24} color={Colors.primary.dark} />
                        <Text className="text-white font-bold flex-1">Settings</Text>
                    </Pressable>
                </View>
            </ScrollView>

            <CalculatorsModal visible={calcVisible} onClose={() => setCalcVisible(false)} />
        </SafeAreaWrapper>
    );
}
