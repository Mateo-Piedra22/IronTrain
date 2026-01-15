import { ExerciseFormModal } from '@/components/ExerciseFormModal';
import { IronButton } from '@/components/IronButton';
import { IronCard } from '@/components/IronCard';
import { SetRow } from '@/components/SetRow';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { WarmupCalculatorModal } from '@/components/WarmupCalculatorModal';
import { workoutService } from '@/src/services/WorkoutService';
import { Colors } from '@/src/theme';
import { Exercise, WorkoutSet } from '@/src/types/db';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Info, Pencil, Zap } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Dimensions, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';

type Tab = 'track' | 'history' | 'analysis';

export default function ExerciseDetailScreen() {
    const { workoutId, exerciseId, exerciseName } = useLocalSearchParams<{ workoutId: string, exerciseId: string, exerciseName: string }>();
    const router = useRouter();
    const [sets, setSets] = useState<WorkoutSet[]>([]);
    const [history, setHistory] = useState<{ date: number; sets: WorkoutSet[] }[]>([]);
    const [activeTab, setActiveTab] = useState<Tab>(workoutId ? 'track' : 'history');


    const [loading, setLoading] = useState(true);
    const [warmupVisible, setWarmupVisible] = useState(false);
    const [notes, setNotes] = useState<string | null>(null);

    // Config Modal
    const [isConfigVisible, setIsConfigVisible] = useState(false);
    const [currentExercise, setCurrentExercise] = useState<Exercise | null>(null);

    const screenWidth = Dimensions.get('window').width;

    useEffect(() => {
        loadTrackData();
        loadHistoryData();
    }, [workoutId, exerciseId]);

    // Added specific effect to refresh history when entering the tab
    useEffect(() => {
        if (activeTab === 'history') {
            loadHistoryData();
        }
    }, [activeTab]);

    const loadTrackData = async () => {
        if (!workoutId) return;
        try {
            const allSets = await workoutService.getSets(workoutId);
            const exSets = allSets.filter(s => s.exercise_id === exerciseId);
            setSets(exSets);
        } catch (e) {
            console.error(e);
        }
    };

    const loadHistoryData = async () => {
        try {
            const hist = await workoutService.getExerciseHistory(exerciseId, 20);
            setHistory(hist);
            // Also load exercise details if needed
            const exerciseDetails = await workoutService.getExercise(exerciseId);
            setNotes(exerciseDetails?.notes || null);
            setCurrentExercise(exerciseDetails || null);
        } catch (e) {
            console.error(e);
        }
    };

    const loadData = async () => {
        setLoading(true);
        await Promise.all([loadTrackData(), loadHistoryData()]);
        setLoading(false);
    };

    const handleUpdateSet = async (setId: string, updates: Partial<WorkoutSet>) => {
        // Optimistic update for UI
        setSets(prev => prev.map(s => s.id === setId ? { ...s, ...updates } : s));

        await workoutService.updateSet(setId, updates);

        // Refresh history in background to check for completion status changes
        loadHistoryData();
    };

    const handleDeleteSet = async (setId: string) => {
        setSets(prev => prev.filter(s => s.id !== setId));
        await workoutService.deleteSet(setId);
        loadHistoryData();
    };

    const handleAddSet = async () => {
        if (!workoutId) return;
        const nextIndex = sets.length;
        const newSetId = await workoutService.addSet(workoutId, exerciseId, 'normal', { order_index: nextIndex });
        if (newSetId) {
            loadTrackData();
        }
    };

    const copyFromHistory = async (histSets: WorkoutSet[]) => {
        if (!workoutId) return;
        for (const s of histSets) {
            await workoutService.addSet(workoutId, exerciseId, s.type as any, {
                weight: s.weight,
                reps: s.reps,
                notes: s.notes,
                order_index: sets.length + 1
            });
        }
        loadTrackData();
        setActiveTab('track');
    };

    const handleAddWarmupSets = async (newSets: Partial<WorkoutSet>[]) => {
        if (!workoutId) return;
        for (const s of newSets) {
            await workoutService.addSet(workoutId, exerciseId, 'warmup', {
                weight: s.weight,
                reps: s.reps,
                notes: s.notes,
                order_index: sets.length + 1
            });
        }
        loadTrackData();
    };

    // --- GRAPHS DATA ---
    const maxWeightData = useMemo(() => {
        return [...history].reverse().map(h => {
            // Safe aggregation
            const validSets = h.sets.filter(s => (s.weight || 0) > 0);
            const max = validSets.length > 0 ? Math.max(...validSets.map(s => s.weight || 0)) : 0;
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
            const validSets = h.sets.filter(s => (s.reps || 0) > 0);
            const max = validSets.length > 0 ? Math.max(...validSets.map(s => s.reps || 0)) : 0;
            return { value: max, label: new Date(h.date).getDate().toString() };
        });
    }, [history]);

    // --- RENDER CONTENT ---
    const renderTrack = () => {
        if (!workoutId) return <View><Text className="text-iron-950 text-center mt-10">No active workout</Text></View>;

        return (
            <IronCard className="mb-4">
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
        )
    };

    const renderHistory = () => (
        <View className="pb-8 px-1">
            {(!history || history.length === 0) ? (
                <View className="items-center justify-center py-10 bg-surface rounded-xl border border-iron-700 elevation-1 mt-4">
                    <Info size={40} color={Colors.iron[300]} />
                    <Text className="text-iron-950 text-center font-bold mt-2">No completed history available</Text>
                    <Text className="text-iron-500 text-center text-xs mt-1 px-4">Detailed history will appear here once you complete sets for this exercise.</Text>
                </View>
            ) : history.map((h, i) => {
                // Defensive Date Handling
                let dateDisplay = { day: '?', month: '???' };
                try {
                    const d = new Date(h.date || Date.now());
                    dateDisplay = {
                        day: d.getDate().toString(),
                        month: d.toLocaleString('default', { month: 'short' })
                    };
                } catch (e) { }

                return (
                    <View key={i} className="flex-row mb-4">
                        {/* Left Date Column */}
                        <View className="w-14 items-center mr-2 pt-1">
                            <View className="bg-surface rounded-lg px-2 py-1 items-center w-full border border-iron-700 elevation-1">
                                <Text className="font-black text-iron-950 text-lg">{dateDisplay.day}</Text>
                                <Text className="text-iron-500 text-[10px] uppercase font-bold">{dateDisplay.month}</Text>
                            </View>
                            {/* Vertical Line */}
                            <View className="flex-1 w-[2px] bg-iron-300 my-1 rounded-full opacity-30" />
                        </View>

                        {/* Right Content Card (Explicit View for styles) */}
                        <View className="flex-1">
                            <View className="p-3 bg-surface rounded-xl border border-iron-700 elevation-1">
                                <View className="flex-row justify-between items-center mb-3 border-b border-iron-200 pb-2">
                                    <Text className="text-xs text-iron-500 font-bold uppercase tracking-wider">Completed Workout</Text>
                                    {workoutId && (
                                        <TouchableOpacity
                                            onPress={() => copyFromHistory(h.sets)}
                                            className="bg-primary px-3 py-1.5 rounded-full shadow-sm active:bg-primary/80"
                                        >
                                            <Text className="text-white text-[10px] font-black tracking-wide">COPY SETS</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                <View className="gap-2">
                                    {(h.sets && h.sets.length > 0) ? h.sets.map((s, idx) => (
                                        <View key={idx} className="flex-row items-center justify-between bg-white p-2 rounded-lg border border-primary/40">
                                            <View className="flex-row items-center gap-3">
                                                <View className="w-6 h-6 rounded-full bg-white items-center justify-center border border-primary/50">
                                                    <Text className="text-[10px] font-bold text-iron-950">{idx + 1}</Text>
                                                </View>
                                                <View className="items-start">
                                                    <Text className="font-black text-iron-950 text-lg leading-tight">
                                                        {s.weight !== undefined && s.weight !== null ? s.weight : 0}
                                                        <Text className="text-xs font-bold text-iron-600">kg</Text>
                                                    </Text>
                                                </View>
                                            </View>

                                            <View className="flex-row items-center">
                                                <Text className="font-black text-iron-950 text-lg leading-tight">
                                                    {s.reps !== undefined && s.reps !== null ? s.reps : 0}
                                                    <Text className="text-xs font-bold text-iron-600">reps</Text>
                                                </Text>
                                                {s.rpe ? <View className="bg-white px-1.5 py-0.5 rounded ml-2 border border-primary/40"><Text className="text-[10px] font-bold text-iron-950">@{s.rpe}</Text></View> : null}
                                            </View>
                                        </View>
                                    )) : (
                                        <View className="p-2 bg-red-50 rounded border border-red-100">
                                            <Text className="text-red-500 font-bold text-xs text-center">No Data found in this session</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>
                    </View>
                )
            })}
        </View>
    );

    const renderAnalysis = () => (
        <View className="gap-6 pb-8">
            <View className="rounded-xl overflow-hidden bg-surface border border-iron-700 elevation-1">
                <View className="px-4 py-3 bg-iron-100 flex-row items-center gap-2 border-b border-iron-200">
                    <View className="w-1.5 h-4 bg-primary rounded-full" />
                    <Text className="text-iron-950 font-black tracking-tight text-sm uppercase">1RM Estimation</Text>
                </View>
                <View className="py-6 items-center bg-surface">
                    <LineChart
                        data={maxWeightData}
                        color={Colors.primary.DEFAULT}
                        thickness={3}
                        dataPointsColor={Colors.primary.DEFAULT}
                        hideRules
                        height={200}
                        width={screenWidth - 64}
                        curved
                        isAnimated
                        startFillColor={Colors.primary.DEFAULT}
                        endFillColor={Colors.primary.DEFAULT}
                        startOpacity={0.2}
                        endOpacity={0}
                        areaChart
                        yAxisTextStyle={{ color: Colors.iron[400], fontSize: 10 }}
                        xAxisLabelTextStyle={{ color: Colors.iron[400], fontSize: 10 }}
                        initialSpacing={0}
                        endSpacing={0}
                    />
                </View>
            </View>

            <View className="rounded-xl overflow-hidden bg-surface border border-iron-700 elevation-1">
                <View className="px-4 py-3 bg-iron-100 flex-row items-center gap-2 border-b border-iron-200">
                    <View className="w-1.5 h-4 bg-iron-600 rounded-full" />
                    <Text className="text-iron-950 font-black tracking-tight text-sm uppercase">Total Volume</Text>
                </View>
                <View className="py-6 items-center bg-surface">
                    <BarChart
                        data={volumeData}
                        frontColor={Colors.primary.dark}
                        barWidth={16}
                        spacing={28}
                        roundedTop
                        hideRules
                        height={200}
                        width={screenWidth - 64}
                        yAxisTextStyle={{ color: Colors.iron[400], fontSize: 10 }}
                        xAxisLabelTextStyle={{ color: Colors.iron[400], fontSize: 10 }}
                        initialSpacing={0}
                        endSpacing={0}
                    />
                </View>
            </View>
        </View>
    );

    const availableTabs: Tab[] = workoutId
        ? ['track', 'history', 'analysis']
        : ['history', 'analysis'];

    return (
        <SafeAreaWrapper className="flex-1 bg-iron-900" edges={['bottom', 'left', 'right']}>
            <Stack.Screen options={{
                title: currentExercise?.name || exerciseName || 'Exercise',
                headerBackTitle: 'Back',
                headerRight: () => (
                    <View className="flex-row gap-2">
                        {/* Edit Button (Library Mode) */}
                        {!workoutId && (
                            <TouchableOpacity onPress={() => setIsConfigVisible(true)} className="bg-iron-800 p-2 rounded-full border border-iron-700">
                                <Pencil size={20} color={Colors.iron[400]} />
                            </TouchableOpacity>
                        )}

                        {/* Warmup Calc (Workout Mode) */}
                        {workoutId && (
                            <TouchableOpacity onPress={() => setWarmupVisible(true)} className="bg-iron-800 p-2 rounded-full border border-iron-700">
                                <Zap size={20} color="#fbbf24" fill="#fbbf24" />
                            </TouchableOpacity>
                        )}
                    </View>
                )
            }} />

            {notes && (
                <View className="bg-yellow-900/20 border-b border-yellow-700/50 p-3 flex-row items-start">
                    <Info size={16} color={Colors.yellow} style={{ marginTop: 2, marginRight: 8 }} />
                    <Text className="text-yellow-500 font-bold flex-1 text-sm">{notes}</Text>
                </View>
            )}

            <View className="flex-row pt-2 bg-iron-900 border-b border-iron-700">
                {availableTabs.map(tab => (
                    <TouchableOpacity
                        key={tab}
                        onPress={() => setActiveTab(tab)}
                        className={`flex-1 py-4 items-center border-b-4 ${activeTab === tab ? 'border-primary' : 'border-transparent'}`}
                    >
                        <Text className={`font-bold uppercase tracking-wider text-sm ${activeTab === tab ? 'text-primary' : 'text-iron-500'}`}>
                            {tab}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 100 }}>
                {activeTab === 'track' && renderTrack()}
                {activeTab === 'history' && renderHistory()}
                {activeTab === 'analysis' && renderAnalysis()}
            </ScrollView>

            <ExerciseFormModal
                visible={isConfigVisible}
                onClose={() => setIsConfigVisible(false)}
                onSave={() => {
                    loadData();
                    if (currentExercise) {
                        router.setParams({ exerciseName: currentExercise.name });
                    }
                }}
                initialData={currentExercise}
            />
        </SafeAreaWrapper>
    );
}
