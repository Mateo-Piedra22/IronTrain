import { eachDayOfInterval, format, getDay, subDays } from 'date-fns';
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

    // Group by weeks for the grid
    // We want 7 rows (Sun-Sat or Mon-Sun). Let's do Mon-Sun (ISO).
    // But standard heatmap is usually Columns = Weeks.

    // Structure: Array of Weeks. Each Week has 7 days (or nulls if padding).
    const weeks = useMemo(() => {
        const weeksArray: (Date | null)[][] = [];
        let currentWeek: (Date | null)[] = [];

        days.forEach((day, index) => {
            const dayOfWeek = getDay(day); // 0 = Sun, 1 = Mon...

            // Adjust to Monday start (0=Mon, 6=Sun)
            // date-fns getDay returns 0 for Sunday.
            // visual row: Mon, Tue, Wed, Thu, Fri, Sat, Sun

            // Actually, we just push days into the array.
            // The rendering will handle X/Y placement.
        });

        // Easier approach: Just 53 columns.
        // We know the start date.
        // We render Column by Column.

        return days;

    }, [days]);

    // Optimize: Map of 'YYYY-MM-DD' -> boolean
    const activeMap = useMemo(() => {
        const map = new Set<string>();
        timestamps.forEach(ts => {
            map.add(format(new Date(ts), 'yyyy-MM-dd'));
        });
        return map;
    }, [timestamps]);

    const getColor = (date: Date) => {
        const key = format(date, 'yyyy-MM-dd');
        return activeMap.has(key) ? 'bg-primary' : 'bg-iron-800';
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
                                className={`w-3 h-3 rounded-sm ${day ? getColor(day) : 'bg-transparent'}`}
                            />
                        ))}
                    </View>
                ))}
            </View>
        );
    };

    return (
        <View className="bg-iron-900 border border-iron-800 p-4 rounded-xl">
            <View className="flex-row justify-between mb-4">
                <Text className="text-iron-950 font-bold text-lg">Consistency (Year)</Text>
                <Text className="text-iron-950 text-xs text-bold">{activeMap.size} workouts</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-2 px-2">
                <View className="flex-row">
                    {/* Day Labels (Mon, Wed, Fri) */}
                    <View className="justify-between mr-2 py-1">
                        <Text className="text-[9px] text-iron-950 h-3">Mon</Text>
                        <View className="h-3" />
                        <Text className="text-[9px] text-iron-950 h-3">Wed</Text>
                        <View className="h-3" />
                        <Text className="text-[9px] text-iron-950 h-3">Fri</Text>
                        <View className="h-3" />
                    </View>

                    <Grid />
                </View>
            </ScrollView>
        </View>
    );
}
