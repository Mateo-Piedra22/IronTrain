import { eachDayOfInterval, format, getDay, subDays } from 'date-fns';
import { Colors } from '@/src/theme';
import React, { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';

interface ConsistencyHeatmapProps {
    timestamps: number[];
}

export function ConsistencyHeatmap({ timestamps }: ConsistencyHeatmapProps) {
    const today = new Date();
    // Generate last 365 days
    const days = useMemo(() => {
        return eachDayOfInterval({
            start: subDays(today, 364),
            end: today
        });
    }, []);

    const countMap = useMemo(() => {
        const map = new Map<string, number>();
        timestamps.forEach((ts) => {
            const key = format(new Date(ts), 'yyyy-MM-dd');
            map.set(key, (map.get(key) ?? 0) + 1);
        });
        return map;
    }, [timestamps]);

    const getCellColor = (date: Date) => {
        const key = format(date, 'yyyy-MM-dd');
        const count = countMap.get(key) ?? 0;
        if (count <= 0) return Colors.iron[700];
        if (count === 1) return Colors.primary.light;
        if (count === 2) return Colors.primary.DEFAULT;
        return Colors.primary.dark;
    };

    // We render 53 columns.
    // Each column has 7 cells.
    // We need to pad the start so the first day aligns correctly to the day of week.

    const Grid = () => {
        const startDate = days[0];
        const startDayOfWeek = getDay(startDate) === 0 ? 6 : getDay(startDate) - 1; // 0=Mon

        const totalDays = days.length + startDayOfWeek;
        const totalWeeks = Math.ceil(totalDays / 7);

        const grid = [];
        let dayIndex = 0;

        for (let w = 0; w < totalWeeks; w++) {
            const weekColumn = [];
            for (let d = 0; d < 7; d++) {
                // Check if valid day
                const currentGridIndex = w * 7 + d;
                if (currentGridIndex < startDayOfWeek || dayIndex >= days.length) {
                    weekColumn.push(null);
                } else {
                    weekColumn.push(days[dayIndex]);
                    dayIndex++;
                }
            }
            grid.push(weekColumn);
        }

        return (
            <View className="flex-row gap-1">
                {grid.map((week, wIndex) => (
                    <View key={wIndex} className="gap-1">
                        {week.map((day, dIndex) => (
                            <View
                                key={dIndex}
                                className="w-3 h-3 rounded-sm"
                                style={{
                                    backgroundColor: day ? getCellColor(day) : 'transparent'
                                }}
                            />
                        ))}
                    </View>
                ))}
            </View>
        );
    };

    return (
        <View className="bg-surface border border-iron-700 p-4 rounded-xl">
            <View className="flex-row justify-between mb-4">
                <Text className="text-iron-950 font-bold text-lg">Consistencia (1 año)</Text>
                <Text className="text-iron-500 text-xs font-bold">{timestamps.length} entrenamientos · {countMap.size} días</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-2 px-2">
                <View className="flex-row">
                    {/* Day Labels (Mon, Wed, Fri) */}
                    <View className="justify-between mr-2 py-1">
                        <Text className="text-[9px] text-iron-500 h-3">Lun</Text>
                        <View className="h-3" />
                        <Text className="text-[9px] text-iron-500 h-3">Mié</Text>
                        <View className="h-3" />
                        <Text className="text-[9px] text-iron-500 h-3">Vie</Text>
                        <View className="h-3" />
                    </View>

                    <Grid />
                </View>
            </ScrollView>

            <View className="flex-row items-center justify-between mt-4">
                <Text className="text-iron-500 text-xs font-bold">Menos</Text>
                <View className="flex-row items-center gap-2">
                    <View className="w-3 h-3 rounded-sm" style={{ backgroundColor: Colors.iron[700] }} />
                    <View className="w-3 h-3 rounded-sm" style={{ backgroundColor: Colors.primary.light }} />
                    <View className="w-3 h-3 rounded-sm" style={{ backgroundColor: Colors.primary.DEFAULT }} />
                    <View className="w-3 h-3 rounded-sm" style={{ backgroundColor: Colors.primary.dark }} />
                </View>
                <Text className="text-iron-500 text-xs font-bold">Más</Text>
            </View>
        </View>
    );
}
