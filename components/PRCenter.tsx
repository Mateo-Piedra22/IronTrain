import { AnalysisService } from '@/src/services/AnalysisService';
import { Colors } from '@/src/theme';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { IronCard } from './IronCard';

export function PRCenter() {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<{ squat: number; bench: number; deadlift: number; total: number }>({
        squat: 0,
        bench: 0,
        deadlift: 0,
        total: 0
    });

    useEffect(() => {
        loadPRs();
    }, []);

    const loadPRs = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const prs = await AnalysisService.getPowerliftingPRs();
            const s = prs.squat?.weight ?? 0;
            const b = prs.bench?.weight ?? 0;
            const d = prs.deadlift?.weight ?? 0;
            setStats({ squat: s, bench: b, deadlift: d, total: prs.totalKg });
        } catch (e: any) {
            setError(e?.message ?? 'No se pudieron cargar los PRs');
            setStats({ squat: 0, bench: 0, deadlift: 0, total: 0 });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <IronCard className="mb-4 bg-iron-900 border-yellow-600/30">
            <View className="flex-row items-center justify-between mb-4">
                <Text className="text-yellow-500 font-bold text-lg uppercase tracking-wider">Sala de trofeos</Text>
                <View className="bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20">
                    <Text className="text-yellow-400 font-bold">{stats.total} kg TOTAL</Text>
                </View>
            </View>

            {isLoading ? (
                <View className="py-8 items-center justify-center">
                    <ActivityIndicator color={Colors.primary.DEFAULT} />
                    <Text className="text-iron-500 mt-3">Calculando PRs...</Text>
                </View>
            ) : error ? (
                <View className="py-6">
                    <Text className="text-iron-500">{error}</Text>
                </View>
            ) : (
                <View className="flex-row justify-between">
                    <View className="items-center flex-1">
                        <Text className="text-iron-500 text-xs font-bold mb-1">SQUAT</Text>
                        <Text className="text-iron-950 text-xl font-black">{stats.squat}</Text>
                        <Text className="text-iron-600 text-[10px]">kg</Text>
                    </View>
                    <View className="w-[1px] bg-iron-800 h-full mx-2" />
                    <View className="items-center flex-1">
                        <Text className="text-iron-500 text-xs font-bold mb-1">BENCH</Text>
                        <Text className="text-iron-950 text-xl font-black">{stats.bench}</Text>
                        <Text className="text-iron-600 text-[10px]">kg</Text>
                    </View>
                    <View className="w-[1px] bg-iron-800 h-full mx-2" />
                    <View className="items-center flex-1">
                        <Text className="text-iron-500 text-xs font-bold mb-1">DEADLIFT</Text>
                        <Text className="text-iron-950 text-xl font-black">{stats.deadlift}</Text>
                        <Text className="text-iron-600 text-[10px]">kg</Text>
                    </View>
                </View>
            )}
        </IronCard>
    );
}
