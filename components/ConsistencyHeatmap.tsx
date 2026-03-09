import { eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useColors } from '../src/hooks/useColors';

interface ConsistencyHeatmapProps {
    timestamps: number[];
}

const CELL_SIZE = 12;
const GAP = 2;
const MONTH_GAP = 10;
const MONTH_CARD_PADDING = 6;

export function ConsistencyHeatmap({ timestamps }: ConsistencyHeatmapProps) {
    const colors = useColors();
    const [selectedDate, setSelectedDate] = useState<{ date: Date; count: number } | null>(null);
    const scrollViewRef = useRef<ScrollView>(null);

    const ss = useMemo(() => StyleSheet.create({
        container: {
            backgroundColor: colors.surface,
            borderWidth: 1.5,
            borderColor: colors.iron[200],
            padding: 20,
            borderRadius: 20,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.05,
            shadowRadius: 15,
            elevation: 4,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 20,
        },
        headerInfo: {
            flex: 1
        },
        titleRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        title: {
            color: colors.primary.DEFAULT,
            fontWeight: '900',
            fontSize: 18,
            letterSpacing: -0.3,
        },
        yearBadge: {
            backgroundColor: colors.primary.DEFAULT,
            paddingHorizontal: 10,
            paddingVertical: 3,
            borderRadius: 10,
            shadowColor: colors.primary.DEFAULT,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 2,
        },
        yearText: {
            color: colors.surface,
            fontSize: 11,
            fontWeight: '900',
            letterSpacing: 0.5,
        },
        subtitle: {
            color: colors.iron[500],
            fontSize: 12,
            marginTop: 4,
            fontWeight: '700',
        },
        tooltip: {
            alignItems: 'flex-end',
            backgroundColor: colors.iron[100],
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: colors.iron[200],
        },
        tooltipDate: {
            color: colors.iron[950],
            fontSize: 11,
            fontWeight: '900',
            textTransform: 'uppercase',
        },
        tooltipCount: {
            color: colors.primary.DEFAULT,
            fontSize: 12,
            fontWeight: '800',
            marginTop: 2,
        },
        scrollContent: {
            paddingRight: 4,
        },
        gridWrapper: {
            flexDirection: 'row',
            alignItems: 'flex-start',
        },
        dayLabelsColumn: {
            marginRight: 6,
            marginTop: 26, // Offset for month label row
        },
        dayLabelContainer: {
            height: CELL_SIZE + GAP,
            justifyContent: 'center'
        },
        dayLabel: {
            fontSize: 9,
            color: colors.iron[400],
            fontWeight: '900',
            textAlign: 'center',
            width: 12,
        },

        // Year divider between year changes
        yearDivider: {
            width: 24,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 6,
            marginTop: 26, // Align with cells
        },
        yearDividerLine: {
            width: 1.5,
            flex: 1,
            backgroundColor: colors.iron[200],
            minHeight: 12,
        },
        yearDividerText: {
            fontSize: 10,
            color: colors.iron[500],
            fontWeight: '900',
            transform: [{ rotate: '-90deg' }],
            width: 40,
            textAlign: 'center',
            marginVertical: 4,
        },

        // Month card encapsulation
        monthContainer: {
            flexDirection: 'row'
        },
        monthCard: {
            flexDirection: 'column',
        },
        marginRight: {
            marginRight: MONTH_GAP
        },
        monthLabelRow: {
            height: 20,
            marginBottom: 6,
            alignItems: 'center',
        },
        monthLabel: {
            fontSize: 11,
            color: colors.iron[950],
            fontWeight: '900',
            letterSpacing: 0.3,
        },
        monthGridContainer: {
            backgroundColor: colors.iron[50],
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: colors.iron[100],
            padding: MONTH_CARD_PADDING + 2,
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
            borderRadius: 4,
        },
        cellToday: {
            borderWidth: 2,
            borderColor: colors.iron[950],
        },
        cellEmpty: {
            width: CELL_SIZE,
            height: CELL_SIZE,
            borderRadius: 4,
            backgroundColor: 'transparent',
        },
        legend: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            marginTop: 20,
            gap: 6,
            paddingTop: 12,
            borderTopWidth: 1.5,
            borderTopColor: colors.iron[100],
        },
        legendLabel: {
            color: colors.iron[400],
            fontSize: 11,
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        legendCell: {
            width: CELL_SIZE,
            height: CELL_SIZE,
            borderRadius: 4,
        },
    }), [colors]);

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
        if (isSelected) return colors.iron[950];
        if (count === 0) return colors.iron[200];
        if (count === 1) return colors.primary.light;
        if (count === 2) return colors.primary.DEFAULT;
        return colors.primary.dark;
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
        <View style={ss.container}>
            {/* Header */}
            <View style={ss.header}>
                <View style={ss.headerInfo}>
                    <View style={ss.titleRow}>
                        <Text style={ss.title}>Consistencia</Text>
                        <View style={ss.yearBadge}>
                            <Text style={ss.yearText}>{currentYear}</Text>
                        </View>
                    </View>
                    <Text style={ss.subtitle}>
                        {totalSessions} entrenamientos · {totalActiveDays} días activos
                    </Text>
                </View>
                {selectedDate && (
                    <View style={ss.tooltip}>
                        <Text style={ss.tooltipDate}>
                            {format(selectedDate.date, 'd MMM yyyy', { locale: es })}
                        </Text>
                        <Text style={ss.tooltipCount}>
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
                contentContainerStyle={ss.scrollContent}
            >
                <View style={ss.gridWrapper}>
                    {/* Day labels column */}
                    <View style={ss.dayLabelsColumn}>
                        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((label, idx) => (
                            <View key={idx} style={ss.dayLabelContainer}>
                                {(idx === 0 || idx === 2 || idx === 4 || idx === 6) ? (
                                    <Text style={ss.dayLabel}>{label}</Text>
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
                            <View key={mIdx} style={ss.monthContainer}>
                                {/* Year divider line */}
                                {showYearDivider && (
                                    <View style={ss.yearDivider}>
                                        <View style={ss.yearDividerLine} />
                                        <Text style={ss.yearDividerText}>{month.year}</Text>
                                        <View style={ss.yearDividerLine} />
                                    </View>
                                )}

                                {/* Month card */}
                                <View style={[
                                    ss.monthCard,
                                    mIdx < months.length - 1 && ss.marginRight
                                ]}>
                                    {/* Month label centered above the grid */}
                                    <View style={ss.monthLabelRow}>
                                        <Text style={ss.monthLabel}>{month.label}</Text>
                                    </View>

                                    {/* Weeks (columns) inside the card */}
                                    <View style={ss.monthGridContainer}>
                                        <View style={ss.weeksRow}>
                                            {month.weeks.map((week, wIdx) => (
                                                <View key={wIdx} style={ss.weekColumn}>
                                                    {week.map((day, dIdx) => {
                                                        if (!day) {
                                                            return <View key={dIdx} style={ss.cellEmpty} />;
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
                                                                    ss.cell,
                                                                    { backgroundColor: getCellColor(count, isSelected) },
                                                                    isToday && !isSelected && ss.cellToday,
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
            <View style={ss.legend}>
                <Text style={ss.legendLabel}>Menos</Text>
                <View style={[ss.legendCell, { backgroundColor: colors.iron[200] }]} />
                <View style={[ss.legendCell, { backgroundColor: colors.primary.light }]} />
                <View style={[ss.legendCell, { backgroundColor: colors.primary.DEFAULT }]} />
                <View style={[ss.legendCell, { backgroundColor: colors.primary.dark }]} />
                <Text style={ss.legendLabel}>Más</Text>
            </View>
        </View>
    );
}

