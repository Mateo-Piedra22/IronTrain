import { PRCenter } from '@/components/PRCenter';
import { OneRepMax } from '@/src/services/AnalysisService';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

interface AnalysisRecordsProps {
    oneRepMaxes: OneRepMax[];
    rangeDays: 7 | 30 | 90 | 365;
}

export function AnalysisRecords({ oneRepMaxes, rangeDays }: AnalysisRecordsProps) {
    const router = useRouter();

    return (
        <View className="pb-8">
            <PRCenter />
            <View className="mb-8 mt-6">
                <Text className="text-lg text-primary font-bold mb-4">Est. 1RM (Top · {rangeDays} días)</Text>
                {oneRepMaxes.length === 0 ? (
                    <View className="bg-surface p-6 rounded-xl border border-iron-200 items-center border-dashed">
                        <Text className="text-iron-400 font-bold mb-1">Sin registros suficientes</Text>
                        <Text className="text-iron-300 text-xs text-center">
                            Necesitamos al menos 1 serie con peso para calcular tu 1RM estimado.
                        </Text>
                    </View>
                ) : (
                    oneRepMaxes.map((orm) => (
                        <Pressable
                            key={orm.exerciseId}
                            className="bg-surface p-4 mb-3 rounded-xl border border-iron-700 flex-row justify-between items-center active:bg-iron-200"
                            onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: orm.exerciseId, exerciseName: orm.exerciseName } } as any)}
                        >
                            <View>
                                <Text className="text-iron-950 font-bold">{orm.exerciseName}</Text>
                                <Text className="text-iron-500 text-xs">Based on {orm.weight}kg x {orm.reps}</Text>
                            </View>
                            <View>
                                <Text className="text-primary font-black text-xl text-right">{Math.round(orm.estimated1RM)}</Text>
                                <Text className="text-iron-400 text-[10px] text-right">KG (Est)</Text>
                            </View>
                        </Pressable>
                    ))
                )}
            </View>
        </View>
    );
}
