import { ThemeFx, withAlpha } from '@/src/theme';
import { FlashList, ViewToken } from '@shopify/flash-list';
import { addDays, differenceInDays, format, isSameDay, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import * as Haptics from 'expo-haptics';
import { Calendar as CalendarIcon, Check, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar, DateData, LocaleConfig } from 'react-native-calendars';
import { DayProps } from 'react-native-calendars/src/calendar/day/index';
import { useColors } from '../src/hooks/useColors';

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
    const colors = useColors();
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

        // 1. Calculamos el nuevo estado directamente
        const nextState = !isExpanded;

        // 2. Ejecutamos la lógica que dependía de esto
        if (nextState) {
            setVisibleMonth(selectedDate);
        }

        // 3. Actualizamos los estados de manera segura (fuera de un callback prev => ...)
        setIsExpanded(nextState);
        onExpandedChange?.(nextState);

    }, [isExpanded, selectedDate, onExpandedChange]); // <-- Agrega isExpanded a las dependencias

    const handleViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken<Date>[] }) => {
        if (viewableItems.length > 0) {
            const centerIndex = Math.floor(viewableItems.length / 2);
            const centerItem = viewableItems[centerIndex]?.item as Date | undefined;
            if (centerItem) {
                // Solo actualizamos si el mes o año han cambiado realmente
                const hasChanged = centerItem.getMonth() !== visibleMonth.getMonth() ||
                    centerItem.getFullYear() !== visibleMonth.getFullYear();

                if (hasChanged) {
                    // Diferimos el update para evitar errores de ciclo de renderizado en FlashList
                    Promise.resolve().then(() => {
                        setVisibleMonth(centerItem);
                    });
                }
            }
        }
    }, [visibleMonth]);

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
        const dayNumStyle = [styles.stripDayNum, isSelected ? styles.textWhite : isToday ? styles.textPrimary : styles.textMuted];

        return (
            <TouchableOpacity onPress={() => handleDateSelect(item)} style={containerStyle} activeOpacity={0.7}>
                {isCompleted && (
                    <View style={styles.completedBadge}>
                        <Check size={8} color={colors.green} />
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
                isCompleted ? styles.bgSurfaceCompleted : {}
        ];

        const textStyle = [
            styles.calendarDayText,
            isSelected ? styles.textWhiteBold : isToday ? styles.textPrimaryBold : styles.textMuted
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

    // --- Styles ---
    const styles = useMemo(() => StyleSheet.create({
        wrapper: {
            backgroundColor: colors.background,
            zIndex: 10,
            borderBottomWidth: 1.5,
            borderBottomColor: colors.border,
            ...ThemeFx.shadowSm,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 16,
            height: 64,
            backgroundColor: colors.background,
        },
        monthTitle: {
            color: colors.text,
            fontWeight: '900',
            fontSize: 20,
            textTransform: 'capitalize',
            letterSpacing: -0.5,
        },
        expandButton: {
            padding: 10,
            backgroundColor: colors.surface,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: colors.border,
            ...ThemeFx.shadowSm,
        },
        stripContainer: {
            paddingVertical: 12,
            height: 96,
            backgroundColor: colors.background,
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
            borderRadius: 16,
            borderWidth: 1.5,
            ...ThemeFx.shadowSm,
        },
        stripItemBorder: {
            // dynamic override
        },
        stripItemSelected: {
            backgroundColor: colors.primary.DEFAULT,
            borderColor: colors.primary.DEFAULT,
        },
        stripItemSelectedCompleted: {
            backgroundColor: colors.primary.DEFAULT,
            borderColor: colors.green,
        },
        stripItemCompleted: {
            backgroundColor: colors.surface,
            borderColor: withAlpha(colors.green, '40'),
        },
        stripItemDefault: {
            backgroundColor: colors.surface,
            borderColor: colors.border,
        },
        textWhite: { color: colors.onPrimary },
        textMuted: { color: colors.textMuted },
        textPrimary: { color: colors.primary.DEFAULT },

        stripDayName: {
            fontSize: 10,
            fontWeight: '700',
            textTransform: 'uppercase',
            marginBottom: 4,
            letterSpacing: 0.5,
        },
        stripDayNum: {
            fontSize: 20,
            fontWeight: '900',
        },
        completedBadge: {
            position: 'absolute',
            top: -4,
            right: -4,
            backgroundColor: colors.green,
            borderRadius: 999,
            padding: 2,
            borderWidth: 1.5,
            borderColor: colors.background,
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
            backgroundColor: colors.background,
            paddingBottom: 8,
        },
        calendarDay: {
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 14,
            margin: 2,
            borderWidth: 1.5,
            borderColor: 'transparent',
        },
        bgPrimary: {
            backgroundColor: colors.primary.DEFAULT,
            borderColor: colors.primary.DEFAULT
        },
        bgPrimaryCompleted: {
            backgroundColor: colors.primary.DEFAULT,
            borderColor: colors.green
        },
        bgSurfaceCompleted: {
            backgroundColor: colors.surface,
            borderColor: withAlpha(colors.green, '40'),
        },
        calendarDayText: {
            fontSize: 15,
            fontWeight: '600',
        },
        textWhiteBold: { color: colors.onPrimary, fontWeight: '900' },
        textPrimaryBold: { color: colors.primary.DEFAULT, fontWeight: '900' },
        textMutedBold: { color: colors.textMuted, fontWeight: '700' },

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
            backgroundColor: colors.green,
            borderRadius: 3,
        }
    }), [colors]);

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
                            <ChevronUp color={colors.primary.DEFAULT} size={20} />
                        ) : (
                            <CalendarIcon color={colors.textMuted} size={20} />
                        )}
                    </TouchableOpacity>
                </View>

                {headerCenter && (
                    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
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
                    renderArrow={(direction: string) => (direction === 'left' ? <ChevronLeft color={colors.textMuted} size={24} /> : <ChevronRight color={colors.textMuted} size={24} />)}
                    enableSwipeMonths={true}
                    theme={{
                        backgroundColor: colors.background,
                        calendarBackground: colors.background,
                        textSectionTitleColor: colors.textMuted,
                        todayTextColor: colors.primary.DEFAULT,
                        dayTextColor: colors.text,
                        monthTextColor: colors.text,
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

