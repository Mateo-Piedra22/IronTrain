import { Colors } from '@/src/theme';
import { eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface ConsistencyHeatmapProps {
    timestamps: number[];
}

const CELL_SIZE = 12;
const GAP = 2;
const MONTH_GAP = 10;

export function ConsistencyHeatmap({ timestamps }: ConsistencyHeatmapProps) {
    const [selectedDate, setSelectedDate] = useState<{ date: Date; count: number } | null>(null);
    const scrollViewRef = useRef<ScrollView>(null);

    /** Build month-by-month grid covering exactly the last 12 calendar months */
    const months = useMemo(() => {
        const today = new Date();
        const result: { label: string; year: number; weeks: (Date | null)[][] }[] = [];

        for (let i = 11; i >= 0; i--) {
            const monthStart = startOfMonth(subMonths(today, i));
            const monthEnd = endOfMonth(monthStart);

            // Align to Monday-based week grid
            const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
            const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

            const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

            const weeks: (Date | null)[][] = [];
            let currentWeek: (Date | null)[] = [];

            allDays.forEach((day) => {
                const belongsToMonth = day.getMonth() === monthStart.getMonth() && day.getFullYear() === monthStart.getFullYear();
                currentWeek.push(belongsToMonth ? day : null);

                if (currentWeek.length === 7) {
                    weeks.push(currentWeek);
                    currentWeek = [];
                }
            });

            if (currentWeek.length > 0) {
                while (currentWeek.length < 7) currentWeek.push(null);
                weeks.push(currentWeek);
            }

            // Capitalize first letter manually for cleaner display
            const rawLabel = format(monthStart, 'MMM', { locale: es });
            const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);

            result.push({
                label,
                year: monthStart.getFullYear(),
                weeks,
            });
        }

        return result;
    }, []);

    /** Map timestamps to day keys for O(1) lookup */
    const countMap = useMemo(() => {
        const map = new Map<string, number>();
        timestamps.forEach((ts) => {
            const key = format(new Date(ts), 'yyyy-MM-dd');
            map.set(key, (map.get(key) ?? 0) + 1);
        });
        return map;
    }, [timestamps]);

    const getCellColor = (count: number, isSelected: boolean): string => {
        if (isSelected) return Colors.iron[950];
        if (count === 0) return Colors.iron[300];
        if (count === 1) return Colors.primary.light;
        if (count === 2) return Colors.primary.DEFAULT;
        return Colors.primary.dark;
    };

    // Auto-scroll to the right (today's position)
    useEffect(() => {
        if (scrollViewRef.current) {
            setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 150);
        }
    }, [months]);

    const totalActiveDays = countMap.size;
    const totalSessions = timestamps.length;
    const currentYear = new Date().getFullYear();

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title}>Consistencia</Text>
                        <View style={styles.yearBadge}>
                            <Text style={styles.yearText}>{currentYear}</Text>
                        </View>
                    </View>
                    <Text style={styles.subtitle}>
                        {totalSessions} entrenamientos · {totalActiveDays} días activos
                    </Text>
                </View>
                {selectedDate && (
                    <View style={styles.tooltip}>
                        <Text style={styles.tooltipDate}>
                            {format(selectedDate.date, 'd MMM yyyy', { locale: es })}
                        </Text>
                        <Text style={styles.tooltipCount}>
                            {selectedDate.count === 0
                                ? 'Descanso'
                                : selectedDate.count === 1
                                    ? '1 sesión'
                                    : `${selectedDate.count} sesiones`}
                        </Text>
                    </View>
                )}
            </View>

            {/* Scrollable Heatmap */}
            <ScrollView
                ref={scrollViewRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                <View style={styles.gridWrapper}>
                    {/* Day labels column */}
                    <View style={styles.dayLabelsColumn}>
                        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((label, idx) => (
                            <View key={idx} style={{ height: CELL_SIZE + GAP, justifyContent: 'center' }}>
                                {(idx === 0 || idx === 2 || idx === 4 || idx === 6) ? (
                                    <Text style={styles.dayLabel}>{label}</Text>
                                ) : null}
                            </View>
                        ))}
                    </View>

                    {/* Months grid */}
                    {months.map((month, mIdx) => {
                        // Detect year boundary: show year divider when year changes
                        const prevYear = mIdx > 0 ? months[mIdx - 1].year : month.year;
                        const showYearDivider = mIdx > 0 && month.year !== prevYear;

                        return (
                            <View key={mIdx} style={{ flexDirection: 'row' }}>
                                {/* Year divider line */}
                                {showYearDivider && (
                                    <View style={styles.yearDivider}>
                                        <View style={styles.yearDividerLine} />
                                        <Text style={styles.yearDividerText}>{month.year}</Text>
                                        <View style={styles.yearDividerLine} />
                                    </View>
                                )}

                                {/* Month card */}
                                <View style={[
                                    styles.monthCard,
                                    mIdx < months.length - 1 && { marginRight: MONTH_GAP }
                                ]}>
                                    {/* Month label centered above the grid */}
                                    <View style={styles.monthLabelRow}>
                                        <Text style={styles.monthLabel}>{month.label}</Text>
                                    </View>

                                    {/* Weeks (columns) inside the card */}
                                    <View style={styles.monthGridContainer}>
                                        <View style={styles.weeksRow}>
                                            {month.weeks.map((week, wIdx) => (
                                                <View key={wIdx} style={styles.weekColumn}>
                                                    {week.map((day, dIdx) => {
                                                        if (!day) {
                                                            return <View key={dIdx} style={styles.cellEmpty} />;
                                                        }

                                                        const key = format(day, 'yyyy-MM-dd');
                                                        const count = countMap.get(key) ?? 0;
                                                        const isToday = isSameDay(day, new Date());
                                                        const isSelected = selectedDate ? isSameDay(day, selectedDate.date) : false;

                                                        return (
                                                            <Pressable
                                                                key={dIdx}
                                                                onPress={() => {
                                                                    Haptics.selectionAsync();
                                                                    setSelectedDate({ date: day, count });
                                                                }}
                                                                style={[
                                                                    styles.cell,
                                                                    { backgroundColor: getCellColor(count, isSelected) },
                                                                    isToday && !isSelected && styles.cellToday,
                                                                ]}
                                                            />
                                                        );
                                                    })}
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>

            {/* Legend */}
            <View style={styles.legend}>
                <Text style={styles.legendLabel}>Menos</Text>
                <View style={[styles.legendCell, { backgroundColor: Colors.iron[300] }]} />
                <View style={[styles.legendCell, { backgroundColor: Colors.primary.light }]} />
                <View style={[styles.legendCell, { backgroundColor: Colors.primary.DEFAULT }]} />
                <View style={[styles.legendCell, { backgroundColor: Colors.primary.dark }]} />
                <Text style={styles.legendLabel}>Más</Text>
            </View>
        </View>
    );
}

const MONTH_CARD_PADDING = 6;

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        padding: 16,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 14,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        color: Colors.primary.DEFAULT,
        fontWeight: '900',
        fontSize: 18,
        letterSpacing: -0.3,
    },
    yearBadge: {
        backgroundColor: Colors.primary.dark,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    yearText: {
        color: Colors.surface,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    subtitle: {
        color: Colors.iron[500],
        fontSize: 11,
        marginTop: 3,
        fontWeight: '600',
    },
    tooltip: {
        alignItems: 'flex-end',
        backgroundColor: Colors.iron[200],
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.iron[300],
    },
    tooltipDate: {
        color: Colors.iron[950],
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    tooltipCount: {
        color: Colors.primary.DEFAULT,
        fontSize: 12,
        fontWeight: '700',
    },
    scrollContent: {
        paddingRight: 4,
    },
    gridWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    dayLabelsColumn: {
        marginRight: 4,
        marginTop: 22, // Offset for month label row
    },
    dayLabel: {
        fontSize: 8,
        color: Colors.iron[400],
        fontWeight: '700',
        textAlign: 'center',
        width: 10,
    },

    // Year divider between year changes
    yearDivider: {
        width: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 4,
        marginTop: 22, // Align with cells
    },
    yearDividerLine: {
        width: 1,
        flex: 1,
        backgroundColor: Colors.iron[300],
        minHeight: 12,
    },
    yearDividerText: {
        fontSize: 8,
        color: Colors.iron[400],
        fontWeight: '800',
        transform: [{ rotate: '-90deg' }],
        width: 30,
        textAlign: 'center',
        marginVertical: 2,
    },

    // Month card encapsulation
    monthCard: {
        flexDirection: 'column',
    },
    monthLabelRow: {
        height: 16,
        marginBottom: 4,
        alignItems: 'center',
    },
    monthLabel: {
        fontSize: 10,
        color: Colors.iron[950],
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    monthGridContainer: {
        backgroundColor: Colors.iron[200],
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.iron[300],
        padding: MONTH_CARD_PADDING,
    },
    weeksRow: {
        flexDirection: 'row',
        gap: GAP,
    },
    weekColumn: {
        gap: GAP,
    },
    cell: {
        width: CELL_SIZE,
        height: CELL_SIZE,
        borderRadius: 3,
    },
    cellEmpty: {
        width: CELL_SIZE,
        height: CELL_SIZE,
        borderRadius: 3,
        backgroundColor: 'transparent',
    },
    cellToday: {
        borderWidth: 1.5,
        borderColor: Colors.iron[950],
    },
    legend: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: 14,
        gap: 5,
    },
    legendLabel: {
        color: Colors.iron[400],
        fontSize: 10,
        fontWeight: '700',
    },
    legendCell: {
        width: CELL_SIZE,
        height: CELL_SIZE,
        borderRadius: 3,
    },
});
