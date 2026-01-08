import { dbService } from '@/src/services/DatabaseService';
import { statsService } from '@/src/services/StatsService';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { IronCard } from './IronCard';

export function PRCenter() {
    const [stats, setStats] = useState<{
        squat: number,
        bench: number,
        deadlift: number,
        total: number
    }>({ squat: 0, bench: 0, deadlift: 0, total: 0 });

    useEffect(() => {
        loadPRs();
    }, []);

    const loadPRs = async () => {
        // We need to identify SBD exercises. 
        // For now, we search by name pattern since we don't have hardcoded IDs.
        // In a real app, users would tag "Primary Exercises".
        const exercises = await dbService.getAll<{ id: string, name: string }>('SELECT id, name FROM exercises');

        // Simple heuristic matching
        const squatEx = exercises.find((e: { name: string }) => e.name.toLowerCase().includes('squat') && !e.name.toLowerCase().includes('split'));
        const benchEx = exercises.find((e: { name: string }) => e.name.toLowerCase().includes('bench press') && !e.name.toLowerCase().includes('dumbell'));
        const deadliftEx = exercises.find((e: { name: string }) => e.name.toLowerCase().includes('deadlift') && !e.name.toLowerCase().includes('romanian'));

        let s = 0, b = 0, d = 0;

        if (squatEx) {
            const pr = await statsService.getPR(squatEx.id);
            s = pr?.weight || 0;
        }
        if (benchEx) {
            const pr = await statsService.getPR(benchEx.id);
            b = pr?.weight || 0;
        }
        if (deadliftEx) {
            const pr = await statsService.getPR(deadliftEx.id);
            d = pr?.weight || 0;
        }

        setStats({ squat: s, bench: b, deadlift: d, total: s + b + d });
    };

    return (
        <IronCard className="mb-4 bg-iron-900 border-yellow-600/30">
            <View className="flex-row items-center justify-between mb-4">
                <Text className="text-yellow-500 font-bold text-lg uppercase tracking-wider">Trophy Room</Text>
                <View className="bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20">
                    <Text className="text-yellow-400 font-bold">{stats.total} kg TOTAL</Text>
                </View>
            </View>

            <View className="flex-row justify-between">
                <View className="items-center flex-1">
                    <Text className="text-iron-500 text-xs font-bold mb-1">SQUAT</Text>
                    <Text className="text-white text-xl font-black">{stats.squat}</Text>
                    <Text className="text-iron-600 text-[10px]">kg</Text>
                </View>
                <View className="w-[1px] bg-iron-800 h-full mx-2" />
                <View className="items-center flex-1">
                    <Text className="text-iron-500 text-xs font-bold mb-1">BENCH</Text>
                    <Text className="text-white text-xl font-black">{stats.bench}</Text>
                    <Text className="text-iron-600 text-[10px]">kg</Text>
                </View>
                <View className="w-[1px] bg-iron-800 h-full mx-2" />
                <View className="items-center flex-1">
                    <Text className="text-iron-500 text-xs font-bold mb-1">DEADLIFT</Text>
                    <Text className="text-white text-xl font-black">{stats.deadlift}</Text>
                    <Text className="text-iron-600 text-[10px]">kg</Text>
                </View>
            </View>
        </IronCard>
    );
}
