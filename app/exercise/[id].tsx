import { IronButton } from '@/components/IronButton';
import { IronCard } from '@/components/IronCard';
import { SetRow } from '@/components/SetRow';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { WarmupCalculatorModal } from '@/components/WarmupCalculatorModal';
import { workoutService } from '@/src/services/WorkoutService';
import { WorkoutSet } from '@/src/types/db';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Info, Zap } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Dimensions, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';

type Tab = 'track' | 'history' | 'analysis';

export default function ExerciseDetailScreen() {
    const { workoutId, exerciseId, exerciseName } = useLocalSearchParams<{ workoutId: string, exerciseId: string, exerciseName: string }>();
    const [sets, setSets] = useState<WorkoutSet[]>([]);
    const [history, setHistory] = useState<{ date: number; sets: WorkoutSet[] }[]>([]);
    const [activeTab, setActiveTab] = useState<Tab>('track');
    const [loading, setLoading] = useState(true);
    const [warmupVisible, setWarmupVisible] = useState(false);
    const [exerciseNotes, setExerciseNotes] = useState<string | null>(null);

    const screenWidth = Dimensions.get('window').width;

    useEffect(() => {
        loadData();
    }, [workoutId, exerciseId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const allSets = await workoutService.getSets(workoutId);
            const exSets = allSets.filter(s => s.exercise_id === exerciseId);
            setSets(exSets);

            const hist = await workoutService.getExerciseHistory(exerciseId, 20); // More history for graphs
            setHistory(hist);

            const exerciseDetails = await workoutService.getExercise(exerciseId);
            setExerciseNotes(exerciseDetails?.notes || null);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateSet = async (setId: string, updates: Partial<WorkoutSet>) => {
        setSets(prev => prev.map(s => s.id === setId ? { ...s, ...updates } : s)); // Optimistic
        await workoutService.updateSet(setId, updates);
    };

    const handleDeleteSet = async (setId: string) => {
        setSets(prev => prev.filter(s => s.id !== setId));
        await workoutService.deleteSet(setId);
    };

    const handleAddSet = async () => {
        const nextIndex = sets.length;
        const newSetId = await workoutService.addSet(workoutId, exerciseId, 'normal', nextIndex);
        if (newSetId) {
            // Reload to get properly formed set with ghost values
            const all = await workoutService.getSets(workoutId);
            setSets(all.filter(s => s.exercise_id === exerciseId));
        }
    };

    const copyFromHistory = async (histSets: WorkoutSet[]) => {
        for (const s of histSets) {
            await workoutService.addSet(workoutId, exerciseId, s.type as any, sets.length + 1, {
                weight: s.weight,
                reps: s.reps,
                notes: s.notes
            } as any); // overload manual fix
        }
        loadData();
        setActiveTab('track');
    };

    const handleAddWarmupSets = async (newSets: Partial<WorkoutSet>[]) => {
        for (const s of newSets) {
            await workoutService.addSet(workoutId, exerciseId, 'warmup', sets.length + 1, {
                weight: s.weight,
                reps: s.reps,
                notes: s.notes
            });
        }
        loadData();
    };


    // --- GRAPHS DATA ---
    const maxWeightData = useMemo(() => {
        return [...history].reverse().map(h => {
            const max = Math.max(...h.sets.map(s => s.weight || 0));
            return { value: max, label: new Date(h.date).getDate().toString(), dataPointText: max.toString() };
        });
    }, [history]);

    const volumeData = useMemo(() => {
        return [...history].reverse().map(h => {
            const vol = h.sets.reduce((acc, s) => acc + ((s.weight || 0) * (s.reps || 0)), 0);
            return { value: vol, label: new Date(h.date).getDate().toString() };
        });
    }, [history]);

    const maxRepsData = useMemo(() => {
        return [...history].reverse().map(h => {
            const max = Math.max(...h.sets.map(s => s.reps || 0));
            return { value: max, label: new Date(h.date).getDate().toString() };
        });
    }, [history]);

    // --- RENDER CONTENT ---
    const renderTrack = () => (
        <IronCard className="mb-4">
            <View className="flex-row items-center justify-between py-1 px-2 border-b border-iron-800 bg-iron-900/50 mb-2">
                <Text className="w-8 text-center text-xs text-iron-500">SET</Text>
                <Text className="w-16 text-center text-xs text-iron-500">PREV</Text>
                <Text className="flex-1 text-center text-xs text-iron-500">KG</Text>
                <Text className="flex-1 text-center text-xs text-iron-500">REPS</Text>
                <View className="w-10" />
                <View className="ml-2 w-5" />
            </View>

            {sets.map((set, idx) => (
                <SetRow
                    key={set.id}
                    set={set}
                    index={idx}
                    onUpdate={handleUpdateSet}
                    onDelete={handleDeleteSet}
                />
            ))}

            <View className="mt-4">
                <IronButton label="ADD SET" onPress={handleAddSet} variant="outline" />
            </View>

            <WarmupCalculatorModal
                visible={warmupVisible}
                onClose={() => setWarmupVisible(false)}
                onAddSets={handleAddWarmupSets}
                defaultWeight={Math.max(...sets.map(s => s.weight || 0), 0) || 100}
            />
        </IronCard>
    );

    const renderHistory = () => (
        <View>
            {history.map((h, i) => (
                <IronCard key={i} className="mb-3">
                    <View className="flex-row justify-between items-center mb-2 border-b border-iron-800 pb-2">
                        <Text className="text-iron-300 font-bold">{new Date(h.date).toLocaleDateString()}</Text>
                        <TouchableOpacity onPress={() => copyFromHistory(h.sets)} className="bg-iron-800 px-2 py-1 rounded">
                            <Text className="text-primary text-xs font-bold">COPY</Text>
                        </TouchableOpacity>
                    </View>
                    {h.sets.map((s, idx) => (
                        <Text key={idx} className="text-white mb-1">
                            <Text className="text-iron-500 text-xs">#{idx + 1}</Text>  <Text className="font-bold">{s.weight}kg</Text> x {s.reps} {s.rpe ? `@${s.rpe}` : ''}
                        </Text>
                    ))}
                </IronCard>
            ))}
        </View>
    );

    const renderAnalysis = () => (
        <View className="gap-6 pb-8">
            <IronCard>
                <Text className="text-white font-bold mb-4 text-center">Estimated 1RM History</Text>
                <LineChart
                    data={maxWeightData}
                    color="#f97316"
                    thickness={3}
                    dataPointsColor="#f97316"
                    hideRules
                    height={200}
                    width={screenWidth - 80}
                    curved
                    isAnimated
                    yAxisTextStyle={{ color: '#94a3b8' }}
                />
            </IronCard>

            <IronCard>
                <Text className="text-white font-bold mb-4 text-center">Volume (kg)</Text>
                <BarChart
                    data={volumeData}
                    frontColor="#3b82f6"
                    barWidth={12}
                    spacing={14}
                    roundedTop
                    hideRules
                    height={200}
                    width={screenWidth - 80}
                    yAxisTextStyle={{ color: '#94a3b8' }}
                />
            </IronCard>

            <IronCard>
                <Text className="text-white font-bold mb-4 text-center">Max Reps</Text>
                <LineChart
                    data={maxRepsData}
                    color="#22c55e"
                    thickness={3}
                    dataPointsColor="#22c55e"
                    hideRules
                    height={150}
                    width={screenWidth - 80}
                    curved
                    isAnimated
                    yAxisTextStyle={{ color: '#94a3b8' }}
                />
            </IronCard>
        </View>
    );

    /* ... */
    return (
        <SafeAreaWrapper className="flex-1 bg-iron-950" edges={['bottom', 'left', 'right']}>
            <Stack.Screen options={{
                title: exerciseName || 'Exercise',
                headerBackTitle: 'Log',
                headerRight: () => (
                    <TouchableOpacity onPress={() => setWarmupVisible(true)} className="bg-iron-800 p-2 rounded-full">
                        <Zap size={20} color="#fbbf24" fill="#fbbf24" />
                    </TouchableOpacity>
                )
            }} />

            {exerciseNotes && (
                <View className="bg-yellow-900/20 border-b border-yellow-700/50 p-3 flex-row items-start">
                    <Info size={16} color="#fbbf24" style={{ marginTop: 2, marginRight: 8 }} />
                    <Text className="text-yellow-500 font-bold flex-1 text-sm">{exerciseNotes}</Text>
                </View>
            )}

            <View className="flex-row pt-2 bg-iron-900 border-b border-iron-800">
                {(['track', 'history', 'analysis'] as Tab[]).map(tab => (
                    <TouchableOpacity
                        key={tab}
                        onPress={() => setActiveTab(tab)}
                        className={`flex-1 py-4 items-center border-b-2 ${activeTab === tab ? 'border-primary' : 'border-transparent'}`}
                    >
                        <Text className={`font-bold uppercase ${activeTab === tab ? 'text-white' : 'text-iron-500'}`}>
                            {tab}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 40 }}>
                {activeTab === 'track' && renderTrack()}
                {activeTab === 'history' && renderHistory()}
                {activeTab === 'analysis' && renderAnalysis()}
            </ScrollView>
        </SafeAreaWrapper>
    );
}
