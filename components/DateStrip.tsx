import { Colors } from '@/src/theme';
import { addDays, format, isSameDay, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronUp, Calendar as LucideCalendar } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import { Dimensions, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';

// Setup Spanish Locale
LocaleConfig.locales['es'] = {
    monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
    monthNamesShort: ['Ene.', 'Feb.', 'Mar.', 'Abr.', 'May.', 'Jun.', 'Jul.', 'Ago.', 'Sep.', 'Oct.', 'Nov.', 'Dic.'],
    dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    today: 'Hoy'
};
LocaleConfig.defaultLocale = 'es';

interface DateStripProps {
    selectedDate: Date;
    onSelectDate: (date: Date) => void;
    markedDates?: Record<string, any>;
}

const DATES_TO_SHOW = 14;

export function DateStrip({ selectedDate, onSelectDate, markedDates = {} }: DateStripProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);
    const screenWidth = Dimensions.get('window').width;

    // Generate dates for Strip
    // Generate dates for Strip
    const dates = Array.from({ length: DATES_TO_SHOW }, (_, i) => {
        const start = subDays(selectedDate, 3); // Centered a bit
        return addDays(start, i);
    });

    const selectedDateStr = selectedDate.toISOString().split('T')[0];

    // Merge selection into markedDates
    const calendarMarks = {
        ...markedDates,
        [selectedDateStr]: {
            ...(markedDates[selectedDateStr] || {}),
            selected: true,
            selectedColor: Colors.primary.dark,
            disableTouchEvent: true
        }
    };

    return (
        <View className="bg-iron-800 border-b border-iron-700 z-10">
            {/* Header / Toggle */}
            <View className="flex-row justify-between items-center px-4 py-2 bg-iron-800 border-b border-iron-700/50">
                <Text className="text-white font-bold capitalize text-lg">
                    {format(selectedDate, 'MMMM yyyy', { locale: es })}
                </Text>
                <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)} className="p-1">
                    {isExpanded ? <ChevronUp color={Colors.iron[400]} size={24} /> : <LucideCalendar color={Colors.iron[400]} size={24} />}
                </TouchableOpacity>
            </View>

            {isExpanded ? (
                <View className="bg-iron-800 pb-2">
                    <Calendar
                        current={selectedDateStr}
                        onDayPress={(day: { dateString: string }) => {
                            // Parse ensuring local noon to avoid TZ shift
                            const parts = day.dateString.split('-');
                            const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
                            onSelectDate(d);
                            setIsExpanded(false);
                        }}
                        markedDates={calendarMarks}
                        theme={{
                            calendarBackground: Colors.iron[900],
                            textSectionTitleColor: Colors.iron[500],
                            dayTextColor: Colors.white,
                            todayTextColor: Colors.primary.dark,
                            selectedDayBackgroundColor: Colors.primary.dark,
                            selectedDayTextColor: Colors.white,
                            monthTextColor: Colors.white,
                            textMonthFontWeight: 'bold',
                            arrowColor: Colors.primary.dark,
                            dotColor: Colors.primary.dark,
                            selectedDotColor: Colors.white
                        }}
                    />
                </View>
            ) : (
                <View className="pb-3 pt-2">
                    <ScrollView
                        ref={scrollViewRef}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 10 }}
                    >
                        {dates.map((date, index) => {
                            const isSelected = isSameDay(date, selectedDate);
                            const isToday = isSameDay(date, new Date());

                            return (
                                <TouchableOpacity
                                    key={index}
                                    onPress={() => onSelectDate(date)}
                                    className={`items-center justify-center mr-2 w-14 h-16 rounded-xl border ${isSelected
                                        ? 'bg-primary border-primary'
                                        : 'bg-iron-900 border-iron-700'
                                        }`}
                                >
                                    <Text className={`text-xs font-semibold uppercase mb-1 ${isSelected ? 'text-white' : 'text-iron-500'
                                        }`}>
                                        {format(date, 'EEE', { locale: es })}
                                    </Text>
                                    <Text className={`text-xl font-bold ${isSelected ? 'text-white' : isToday ? 'text-primary' : 'text-white'
                                        }`}>
                                        {format(date, 'd')}
                                    </Text>

                                    {/* Markers */}
                                    <View className="flex-row gap-0.5 mt-1.5 flex-wrap justify-center px-1">
                                        {markedDates[format(date, 'yyyy-MM-dd')]?.colors?.map((color: string, i: number) => (
                                            <View key={i} style={{ backgroundColor: color }} className="w-1.5 h-1.5 rounded-full" />
                                        ))}
                                    </View>

                                    {/* Completion Border (if status is completed) */}
                                    {markedDates[format(date, 'yyyy-MM-dd')]?.status === 'completed' && !isSelected && (
                                        <View className="absolute inset-0 border-2 border-primary rounded-xl" />
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            )}
        </View>
    );
}
