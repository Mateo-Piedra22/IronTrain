import { Colors } from '@/src/theme';
import { FlashList, ViewToken } from '@shopify/flash-list';
import { addDays, differenceInDays, format, isSameDay, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import * as Haptics from 'expo-haptics';
import { Calendar as CalendarIcon, Check, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar, DateData, LocaleConfig } from 'react-native-calendars';
import { DayProps } from 'react-native-calendars/src/calendar/day/index';

// --- Configuration & Localization ---

LocaleConfig.locales['es'] = {
    monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
    monthNamesShort: ['Ene.', 'Feb.', 'Mar.', 'Abr.', 'May.', 'Jun.', 'Jul.', 'Ago.', 'Sep.', 'Oct.', 'Nov.', 'Dic.'],
    dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    today: 'Hoy'
};
LocaleConfig.defaultLocale = 'es';

const VISIBLE_RANGE_DAYS = 365; // Days before and after today
const TOTAL_DAYS = VISIBLE_RANGE_DAYS * 2;
const ITEM_WIDTH = 60; // Fixed width for FlashList optimization
const ITEM_SPACING = 8;
const FULL_ITEM_SIZE = ITEM_WIDTH + ITEM_SPACING;

// --- Interfaces ---

interface DailyStatus {
    status?: string; // 'completed' | 'in_progress' | undefined
    colors?: string[];
}

interface DateStripProps {
    selectedDate: Date;
    onSelectDate: (date: Date) => void;
    onExpandedChange?: (expanded: boolean) => void;
    markedDates?: Record<string, DailyStatus>;
    headerCenter?: React.ReactNode;
    headerRight?: React.ReactNode;
}

export function DateStrip({ selectedDate, onSelectDate, onExpandedChange, markedDates = {}, headerCenter, headerRight }: DateStripProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [visibleMonth, setVisibleMonth] = useState(selectedDate);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listRef = useRef<any>(null);

    // --- Memoized Data ---

    const anchorDate = useMemo(() => subDays(new Date(), VISIBLE_RANGE_DAYS), []);

    const dates = useMemo(() => {
        return Array.from({ length: TOTAL_DAYS }, (_, i) => addDays(anchorDate, i));
    }, [anchorDate]);

    const getIndexForDate = useCallback((date: Date) => {
        const diff = differenceInDays(date, anchorDate);
        return Math.max(0, Math.min(diff, TOTAL_DAYS - 1));
    }, [anchorDate]);

    // --- Synchronization Effects ---

    useEffect(() => {
        if (isExpanded || !listRef.current) return;

        const index = getIndexForDate(selectedDate);
        listRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
        setVisibleMonth(selectedDate);
    }, [selectedDate, isExpanded, getIndexForDate]);

    // --- Handlers ---

    const handleDateSelect = useCallback((date: Date) => {
        Haptics.selectionAsync();
        onSelectDate(date);
        if (isExpanded) {
            setIsExpanded(false);
            onExpandedChange?.(false);
        }
    }, [onSelectDate, isExpanded, onExpandedChange]);

    const toggleExpand = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsExpanded(prev => {
            const nextState = !prev;
            if (nextState) {
                setVisibleMonth(selectedDate);
            }
            onExpandedChange?.(nextState);
            return nextState;
        });
    }, [selectedDate, onExpandedChange]);

    const handleViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken<Date>[] }) => {
        if (viewableItems.length > 0) {
            const centerIndex = Math.floor(viewableItems.length / 2);
            const centerItem = viewableItems[centerIndex]?.item as Date | undefined;
            if (centerItem) {
                setVisibleMonth(centerItem);
            }
        }
    }, []);

    // --- Renderers ---

    const renderStripItem = useCallback(({ item }: { item: Date }) => {
        const isSelected = isSameDay(item, selectedDate);
        const isToday = isSameDay(item, new Date());
        const dateStr = format(item, 'yyyy-MM-dd');
        const marks = markedDates[dateStr];
        const isCompleted = marks?.status === 'completed';

        // Styles
        const containerStyle = [
            styles.stripItem,
            styles.stripItemBorder,
            isSelected ? (isCompleted ? styles.stripItemSelectedCompleted : styles.stripItemSelected) :
                isCompleted ? styles.stripItemCompleted : styles.stripItemDefault
        ];

        const dayNameStyle = [styles.stripDayName, isSelected ? styles.textWhite : styles.textMuted];
        const dayNumStyle = [styles.stripDayNum, isSelected ? styles.textWhite : isToday ? styles.textPrimary : styles.textIron200];

        return (
            <TouchableOpacity onPress={() => handleDateSelect(item)} style={containerStyle} activeOpacity={0.7}>
                {isCompleted && (
                    <View style={styles.completedBadge}>
                        <Check size={8} color={Colors.green} />
                    </View>
                )}
                <Text style={dayNameStyle}>{format(item, 'EEE', { locale: es })}</Text>
                <Text style={dayNumStyle}>{format(item, 'd')}</Text>
            </TouchableOpacity>
        );
    }, [selectedDate, markedDates, handleDateSelect]);

    const renderCalendarDay = useCallback((props: DayProps & { date?: DateData }) => {
        const { date } = props;
        if (!date) return <View style={styles.calendarDay} />;

        const dayDate = new Date(date.year, date.month - 1, date.day);
        const isSelected = isSameDay(dayDate, selectedDate);
        const isToday = isSameDay(dayDate, new Date());
        const dateStr = date.dateString;
        const marks = markedDates[dateStr];
        const isCompleted = marks?.status === 'completed';

        const containerStyle = [
            styles.calendarDay,
            isSelected ? (isCompleted ? styles.bgPrimaryCompleted : styles.bgPrimary) :
                isCompleted ? styles.bgIron800Completed : {}
        ];

        const textStyle = [
            styles.calendarDayText,
            isSelected ? styles.textWhiteBold : isToday ? styles.textPrimaryBold : styles.textIron200
        ];

        return (
            <TouchableOpacity onPress={() => handleDateSelect(dayDate)} style={containerStyle} activeOpacity={0.7}>
                <Text style={textStyle}>{date.day}</Text>
                <View style={styles.calendarDotsContainer}>
                    {marks?.colors?.slice(0, 4).map((color, i) => (
                        <View key={`${dateStr}-cal-dot-${i}`} style={[styles.calDot, { backgroundColor: color }]} />
                    ))}
                </View>
                {isCompleted && (
                    <View style={styles.calendarCompletedTick}>
                        <View style={styles.tickDot} />
                    </View>
                )}
            </TouchableOpacity>
        );
    }, [selectedDate, markedDates, handleDateSelect]);

    // --- Main Render ---

    return (
        <View style={styles.wrapper}>
            {/* Header */}
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', zIndex: 10 }}>
                    <Text style={styles.monthTitle}>
                        {format(visibleMonth, 'MMMM yyyy', { locale: es })}
                    </Text>

                    <TouchableOpacity onPress={toggleExpand} style={[styles.expandButton, { marginLeft: 8 }]} accessibilityLabel={isExpanded ? "Colapsar calendario" : "Expandir calendario"}>
                        {isExpanded ? (
                            <ChevronUp color={Colors.primary.DEFAULT} size={20} />
                        ) : (
                            <CalendarIcon color={Colors.iron[400]} size={20} />
                        )}
                    </TouchableOpacity>
                </View>

                {headerCenter && (
                    <View style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center', pointerEvents: 'none' }}>
                        {headerCenter}
                    </View>
                )}

                <View style={{ zIndex: 10 }}>
                    {headerRight}
                </View>
            </View>

            <View style={[styles.calendarContainer, { paddingBottom: 16, display: isExpanded ? 'flex' : 'none' }]}>
                <Calendar
                    initialDate={format(selectedDate, 'yyyy-MM-dd')}
                    key="calendar-view"
                    onMonthChange={(date: DateData) => {
                        setVisibleMonth(new Date(date.year, date.month - 1, date.day));
                    }}
                    dayComponent={renderCalendarDay}
                    renderArrow={(direction: string) => (direction === 'left' ? <ChevronLeft color={Colors.iron[400]} size={24} /> : <ChevronRight color={Colors.iron[400]} size={24} />)}
                    enableSwipeMonths={true}
                    theme={{
                        backgroundColor: Colors.iron[900],
                        calendarBackground: Colors.iron[900],
                        textSectionTitleColor: Colors.iron[500],
                        todayTextColor: Colors.primary.DEFAULT,
                        dayTextColor: Colors.iron[50],
                        monthTextColor: Colors.iron[950],
                        textMonthFontWeight: '900',
                        textMonthFontSize: 16,
                        'stylesheet.calendar.header': {
                            header: {
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                paddingLeft: 10,
                                paddingRight: 10,
                                marginTop: 6,
                            },
                        }
                    } as any}
                    markingType={'custom'}
                />
            </View>

            <View style={[styles.stripContainer, { display: !isExpanded ? 'flex' : 'none' }]}>
                <FlashList
                    ref={listRef}
                    data={dates}
                    extraData={[selectedDate, markedDates]}
                    renderItem={renderStripItem}
                    // @ts-ignore
                    estimatedItemSize={FULL_ITEM_SIZE}
                    initialScrollIndex={getIndexForDate(selectedDate)}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    drawDistance={ITEM_WIDTH * 10}
                    onViewableItemsChanged={handleViewableItemsChanged}
                    viewabilityConfig={{
                        itemVisiblePercentThreshold: 50,
                        minimumViewTime: 100
                    }}
                    contentContainerStyle={styles.listContent}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        backgroundColor: Colors.iron[800],
        zIndex: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 4,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: Colors.iron[900],
    },
    monthTitle: {
        color: Colors.iron[50],
        fontWeight: 'bold',
        textTransform: 'capitalize',
        fontSize: 18,
    },
    expandButton: {
        padding: 8,
        backgroundColor: Colors.iron[800],
        borderRadius: 999,
        borderWidth: 1,
        borderColor: Colors.iron[700],
    },
    stripContainer: {
        paddingVertical: 8,
        height: 90,
        backgroundColor: Colors.iron[900],
    },
    listContent: {
        paddingHorizontal: 16,
    },
    // Strip Item Styles
    stripItem: {
        width: ITEM_WIDTH,
        height: 72,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
        borderRadius: 12,
        borderWidth: 1,
    },
    stripItemBorder: {
        // dynamic override
    },
    stripItemSelected: {
        backgroundColor: Colors.primary.DEFAULT + 'E6', // slightly translucent
        borderColor: Colors.primary.light,
    },
    stripItemSelectedCompleted: {
        backgroundColor: Colors.primary.DEFAULT + 'E6',
        borderColor: Colors.green,
    },
    stripItemCompleted: {
        backgroundColor: Colors.iron[900],
        borderColor: 'rgba(34, 197, 94, 0.5)', // green-600/50
    },
    stripItemDefault: {
        backgroundColor: Colors.iron[900],
        borderColor: 'rgba(156, 110, 100, 0.4)', // marroncito/bordó clarito
    },
    textWhite: { color: Colors.white },
    textMuted: { color: Colors.iron[500] },
    textPrimary: { color: Colors.primary.DEFAULT },
    textIron200: { color: Colors.iron[400] },

    stripDayName: {
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    stripDayNum: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    completedBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        borderRadius: 999,
        padding: 2,
    },
    dotsContainer: {
        flexDirection: 'row',
        gap: 2,
        marginTop: 6,
        height: 6,
        justifyContent: 'center',
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    // Calendar Styles
    calendarContainer: {
        backgroundColor: Colors.iron[900],
        paddingBottom: 8,
    },
    calendarDay: {
        width: 45,
        height: 45,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        margin: 2,
    },
    bgPrimary: { backgroundColor: Colors.primary.DEFAULT + 'E6', borderWidth: 1, borderColor: Colors.primary.light },
    bgPrimaryCompleted: { backgroundColor: Colors.primary.DEFAULT + 'E6', borderWidth: 1, borderColor: Colors.green },
    bgIron800Completed: {
        backgroundColor: Colors.iron[800],
        borderWidth: 1,
        borderColor: 'rgba(34, 197, 94, 0.3)'
    },
    calendarDayText: {
        fontSize: 16,
        fontWeight: '500',
    },
    textWhiteBold: { color: Colors.white, fontWeight: 'bold' },
    textPrimaryBold: { color: Colors.primary.DEFAULT, fontWeight: 'bold' },
    textIron700: { color: Colors.iron[700] },

    calendarDotsContainer: {
        flexDirection: 'row',
        gap: 2,
        marginTop: 4,
        position: 'absolute',
        bottom: 6,
        justifyContent: 'center',
        width: '100%',
    },
    calDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    calendarCompletedTick: {
        position: 'absolute',
        top: 2,
        right: 2,
    },
    tickDot: {
        width: 6,
        height: 6,
        backgroundColor: Colors.green,
        borderRadius: 3,
    }
});
