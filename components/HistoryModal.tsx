import { configService } from '@/src/services/ConfigService';
import { UnitService } from '@/src/services/UnitService';
import { Colors } from '@/src/theme';
import { formatTimeSeconds } from '@/src/utils/time';
import { format } from 'date-fns';
import { X } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Dimensions, FlatList, Modal, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { ExerciseType, WorkoutSet } from '../src/types/db';

interface HistoryModalProps {
    visible: boolean;
    onClose: () => void;
    history: { date: number; sets: WorkoutSet[] }[];
    exerciseName: string;
    exerciseType?: ExerciseType;
}

export function HistoryModal({ visible, onClose, history, exerciseName, exerciseType = 'weight_reps' }: HistoryModalProps) {
    const screenWidth = Dimensions.get('window').width;
    const unit = configService.get('weightUnit') === 'kg' ? 'kg' : 'lb';
    const displayWeight = (kgValue: number) => unit === 'kg' ? kgValue : UnitService.kgToLbs(kgValue);

    const chartData = useMemo(() => {
        // Create a copy and sort ASC for chart
        const sorted = [...history].sort((a, b) => a.date - b.date);

        return sorted.map(h => {
            let value = 0;
            if (exerciseType === 'distance_time') {
                const valid = h.sets.filter(s => (s.distance ?? 0) > 0);
                const maxDist = valid.length > 0 ? Math.max(...valid.map(s => s.distance || 0)) : 0;
                value = Math.round((maxDist / 1000) * 100) / 100;
            } else if (exerciseType === 'reps_only') {
                const valid = h.sets.filter(s => (s.reps ?? 0) > 0);
                value = valid.length > 0 ? Math.max(...valid.map(s => s.reps || 0)) : 0;
            } else {
                const valid = h.sets.filter(s => (s.weight ?? 0) > 0);
                const maxW = valid.length > 0 ? Math.max(...valid.map(s => s.weight || 0)) : 0;
                value = Math.round(displayWeight(maxW) * 10) / 10;
            }

            return {
                value,
                label: format(new Date(h.date), 'd/MM'),
                labelTextStyle: { color: Colors.iron[400], fontSize: 10 },
                dataPointText: value.toString(),
                dataPointTextColor: 'white',
                dataPointTextShiftY: -10
            };
        });
    }, [history, exerciseType, unit]);

    return (
        <Modal visible={visible} animationType="fade" transparent>
            <View className="flex-1 bg-iron-950/90 justify-center px-4 py-12">
                <View className="bg-iron-900 border border-iron-700 rounded-xl flex-1 max-h-[90%] w-full overflow-hidden">
                    <View className="flex-row justify-between items-center p-4 border-b border-iron-800 bg-iron-800">
                        <View>
                            <Text className="text-iron-950 font-bold text-lg">{exerciseName}</Text>
                            <Text className="text-iron-500 text-xs">Historial de progreso</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className="p-2 bg-primary rounded-full active:opacity-80">
                            <X size={20} color="white" />
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        className="flex-1"
                        data={history}
                        ListHeaderComponent={
                            <View className="p-4 items-center justify-center bg-iron-900/50 border-b border-iron-800 mb-2">
                                {chartData.length > 1 ? (
                                    <View className="overflow-hidden">
                                        <LineChart
                                            data={chartData}
                                            color={Colors.primary.dark}
                                            thickness={3}
                                            dataPointsColor={Colors.primary.dark}
                                            startFillColor="rgba(249, 115, 22, 0.3)"
                                            endFillColor="rgba(249, 115, 22, 0.0)"
                                            startOpacity={0.9}
                                            endOpacity={0.0}
                                            areaChart
                                            yAxisTextStyle={{ color: Colors.iron[500], fontSize: 10 }}
                                            xAxisLabelTextStyle={{ color: Colors.iron[500], fontSize: 10 }}
                                            rulesColor={Colors.iron[700]}
                                            rulesType="solid"
                                            hideRules={false}
                                            width={screenWidth - 64}
                                            height={180}
                                            initialSpacing={0}
                                            endSpacing={0}
                                            spacing={32}
                                            hideDataPoints={false}
                                            curved
                                            isAnimated
                                        />
                                    </View>
                                ) : (
                                    <View className="h-40 items-center justify-center">
                                        <Text className="text-iron-500">No hay suficientes datos para el gráfico</Text>
                                    </View>
                                )}
                            </View>
                        }
                        keyExtractor={(item) => item.date.toString()}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        renderItem={({ item }) => (
                            <View className="mb-4 px-4">
                                <Text className="text-primary font-bold mb-2 text-sm bg-iron-800/50 self-start px-2 py-1 rounded">
                                    {format(new Date(item.date), 'EEEE, d MMM yyyy')}
                                </Text>
                                <View className="bg-iron-800 rounded-lg p-2 gap-1 border border-iron-700">
                                    {item.sets.map((set, idx) => (
                                        <View key={set.id} className="flex-row justify-between border-b border-iron-700/50 pb-1 mb-1 last:border-0 last:pb-0 last:mb-0">
                                            <View className="flex-row items-center w-12">
                                                <Text className="text-iron-500 font-mono text-xs w-6">#{idx + 1}</Text>
                                                {set.type === 'pr' && <Text className="text-[10px] text-yellow-500 font-bold ml-1">PR</Text>}
                                            </View>
                                            <Text className="text-iron-950 font-bold text-sm flex-1 text-center">
                                                {exerciseType === 'distance_time'
                                                    ? `${Math.round(((set.distance || 0) / 1000) * 100) / 100} km  •  ${formatTimeSeconds(set.time || 0)}`
                                                    : exerciseType === 'reps_only'
                                                        ? `${set.reps || 0} reps`
                                                        : exerciseType === 'weight_only'
                                                            ? `${Math.round(displayWeight(set.weight || 0) * 10) / 10} ${unit}`
                                                            : `${Math.round(displayWeight(set.weight || 0) * 10) / 10} ${unit}  ×  ${set.reps || 0}`
                                                }
                                            </Text>
                                            <Text className="text-iron-500 text-xs w-24 text-right">
                                                {set.type !== 'normal'
                                                    ? set.type.toUpperCase()
                                                    : exerciseType === 'weight_reps'
                                                        ? `1RM: ${Math.round(displayWeight((set.weight || 0) * (1 + (set.reps || 0) / 30)))}`
                                                        : exerciseType === 'distance_time'
                                                            ? (() => {
                                                                const d = (set.distance || 0) / 1000;
                                                                const t = set.time || 0;
                                                                if (d <= 0 || t <= 0) return '—';
                                                                const pace = t / d;
                                                                return `${formatTimeSeconds(pace)}/km`;
                                                            })()
                                                            : '—'
                                                }
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                        ListEmptyComponent={
                            <Text className="text-iron-500 text-center py-8">No hay historial.</Text>
                        }
                    />
                </View>
            </View>
        </Modal>
    );
}
