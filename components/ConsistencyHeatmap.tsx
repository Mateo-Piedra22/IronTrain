import { Colors } from '@/src/theme';
import { eachDayOfInterval, endOfWeek, format, isSameDay, startOfWeek, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface ConsistencyHeatmapProps {
    timestamps: number[];
}

export function ConsistencyHeatmap({ timestamps }: ConsistencyHeatmapProps) {
    const [selectedDate, setSelectedDate] = useState<{ date: Date; count: number } | null>(null);
    const scrollViewRef = useRef<ScrollView>(null);

    const weeks = useMemo(() => {
        const today = new Date();
        const start = subDays(today, 364);

        // Ensure we cover full weeks starting on Monday
        const alignedStart = startOfWeek(start, { weekStartsOn: 1 });
        const alignedEnd = endOfWeek(today, { weekStartsOn: 1 });

        const allDays = eachDayOfInterval({ start: alignedStart, end: alignedEnd });

        const weeksArray: Date[][] = [];
        let currentWeek: Date[] = [];

        allDays.forEach((day, index) => {
            currentWeek.push(day);
            if (currentWeek.length === 7) {
                weeksArray.push(currentWeek);
                currentWeek = [];
            }
        });

        // Push any remaining partial week (though logic ensures alignment)
        if (currentWeek.length > 0) {
            weeksArray.push(currentWeek);
        }

        return weeksArray;
    }, []);

    const countMap = useMemo(() => {
        const map = new Map<string, number>();
        timestamps.forEach((ts) => {
            const key = format(new Date(ts), 'yyyy-MM-dd');
            map.set(key, (map.get(key) ?? 0) + 1);
        });
        return map;
    }, [timestamps]);

    const getCellColor = (count: number, isSelected: boolean) => {
        if (isSelected) return Colors.iron[950]; // Dark selection
        if (count === 0) return Colors.iron[300]; // Darker empty cell (as requested)
        if (count === 1) return Colors.primary.light;
        if (count === 2) return Colors.primary.DEFAULT;
        return Colors.primary.dark;
    };

    // Auto-scroll to end (Today)
    useEffect(() => {
        if (scrollViewRef.current) {
            // Small timeout to allow layout compilation
            setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 100);
        }
    }, [weeks]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Consistencia (último año)</Text>
                    <Text style={styles.subtitle}>
                        {timestamps.length} entrenamientos en {countMap.size} días activos
                    </Text>
                </View>
                {selectedDate && (
                    <View style={styles.tooltip}>
                        <Text style={styles.tooltipDate}>
                            {format(selectedDate.date, 'd MMM', { locale: es })}
                        </Text>
                        <Text style={styles.tooltipCount}>
                            {selectedDate.count === 1 ? '1 sesión' : `${selectedDate.count} sesiones`}
                        </Text>
                    </View>
                )}
            </View>

            <ScrollView
                ref={scrollViewRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                <View style={styles.grid}>
                    <View style={styles.labels}>
                        <Text style={styles.dayLabel}>Lun</Text>
                        <View style={styles.dayGap} />
                        <Text style={styles.dayLabel}>Mié</Text>
                        <View style={styles.dayGap} />
                        <Text style={styles.dayLabel}>Vie</Text>
                    </View>

                    {weeks.map((week, wIndex) => {
                        const firstDayOfMonth = week.find(d => d.getDate() === 1);
                        const isFirstWeek = wIndex === 0;
                        const labelDay = firstDayOfMonth || (isFirstWeek ? week[0] : null);

                        return (
                            <View key={wIndex} style={styles.weekColumn}>
                                <View style={styles.monthLabelContainer}>
                                    {labelDay && (
                                        <Text style={styles.monthLabel}>
                                            {format(labelDay, 'MMM', { locale: es })}
                                        </Text>
                                    )}
                                </View>

                                {week.map((day, dIndex) => {
                                    const key = format(day, 'yyyy-MM-dd');
                                    const count = countMap.get(key) ?? 0;
                                    const isSelected = selectedDate ? isSameDay(day, selectedDate.date) : false;

                                    return (
                                        <Pressable
                                            key={dIndex}
                                            onPress={() => {
                                                Haptics.selectionAsync();
                                                setSelectedDate({ date: day, count });
                                            }}
                                            style={[
                                                styles.cell,
                                                { backgroundColor: getCellColor(count, isSelected) }
                                            ]}
                                        />
                                    );
                                })}
                            </View>
                        );
                    })}
                </View>
            </ScrollView>

            <View style={styles.legend}>
                <Text style={styles.legendLabel}>Menos</Text>
                <View style={[styles.cell, { backgroundColor: Colors.iron[300] }]} />
                <View style={[styles.cell, { backgroundColor: Colors.primary.light }]} />
                <View style={[styles.cell, { backgroundColor: Colors.primary.DEFAULT }]} />
                <View style={[styles.cell, { backgroundColor: Colors.primary.dark }]} />
                <Text style={styles.legendLabel}>Más</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        padding: 16,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 16,
    },
    title: {
        color: Colors.iron[950],
        fontWeight: 'bold',
        fontSize: 18,
    },
    subtitle: {
        color: Colors.iron[500],
        fontSize: 12,
        marginTop: 2,
    },
    tooltip: {
        alignItems: 'flex-end',
        backgroundColor: Colors.iron[100],
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: Colors.iron[200],
    },
    tooltipDate: {
        color: Colors.iron[900],
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    tooltipCount: {
        color: Colors.primary.DEFAULT,
        fontSize: 12,
        fontWeight: 'bold',
    },
    scrollContent: {
        paddingRight: 8,
    },
    grid: {
        flexDirection: 'row',
        gap: 3, // Tighter gap
    },
    labels: {
        justifyContent: 'space-between',
        paddingVertical: 3, // Align with cells + gaps
        marginRight: 6,
        marginTop: 16, // Offset for month labels
    },
    dayLabel: {
        fontSize: 9,
        color: Colors.iron[400],
        height: 10,
        fontWeight: '600',
    },
    dayGap: {
        height: 10 + 3, // cell height + gap
    },
    weekColumn: {
        gap: 3,
    },
    monthLabelContainer: {
        height: 12,
        marginBottom: 4,
        justifyContent: 'flex-end',
    },
    monthLabel: {
        fontSize: 9,
        color: Colors.iron[500],
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    cell: {
        width: 10,
        height: 10,
        borderRadius: 2,
    },
    legend: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: 12,
        gap: 6,
    },
    legendLabel: {
        color: Colors.iron[400],
        fontSize: 10,
        fontWeight: '600',
    }
});
