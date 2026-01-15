import { Colors } from '@/src/theme';
import { Ionicons } from '@expo/vector-icons';
import { addDays, format, subDays } from 'date-fns';
import { useState } from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { Calendar } from 'react-native-calendars';

interface DateHeaderProps {
    date: Date;
    onChange: (date: Date) => void;
}

export function DateHeader({ date, onChange }: DateHeaderProps) {
    const [showCalendar, setShowCalendar] = useState(false);

    const prevDay = () => onChange(subDays(date, 1));
    const nextDay = () => onChange(addDays(date, 1));

    const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
    const dateStr = format(date, 'yyyy-MM-dd');

    return (
        <>
            <View className="flex-row items-center justify-between px-4 py-4 bg-background">
                <Pressable onPress={prevDay} className="p-2">
                    <Ionicons name="chevron-back" size={24} color={Colors.primary.dark} />
                </Pressable>

                <Pressable onPress={() => setShowCalendar(true)} className="items-center">
                    <Text className="text-iron-950 text-xl font-bold">
                        {isToday ? 'Today' : format(date, 'EEE, MMM do')} <Ionicons name="calendar-outline" size={16} color={Colors.iron[400]} />
                    </Text>
                    <Text className="text-textMuted text-xs">{format(date, 'yyyy')}</Text>
                </Pressable>

                <Pressable onPress={nextDay} className="p-2">
                    <Ionicons name="chevron-forward" size={24} color={Colors.primary.dark} />
                </Pressable>
            </View>

            <Modal visible={showCalendar} animationType="fade" transparent>
                <View className="flex-1 bg-iron-950/80 justify-center px-4">
                    <View className="bg-surface rounded-xl overflow-hidden">
                        <Calendar
                            current={dateStr}
                            onDayPress={(day: any) => {
                                // date-fns needs local time correction sometimes, but raw date string parsing is safer for Calendar
                                // Create date from YYYY-MM-DD treated as local
                                const [y, m, d] = day.dateString.split('-').map(Number);
                                onChange(new Date(y, m - 1, d));
                                setShowCalendar(false);
                            }}
                            markedDates={{
                                [dateStr]: { selected: true, selectedColor: Colors.primary.dark }
                            }}
                            theme={{
                                backgroundColor: Colors.white,
                                calendarBackground: Colors.white,
                                textSectionTitleColor: Colors.iron[500],
                                selectedDayBackgroundColor: Colors.primary.dark,
                                selectedDayTextColor: Colors.white,
                                todayTextColor: Colors.primary.dark,
                                dayTextColor: Colors.iron[950],
                                textDisabledColor: Colors.iron[400],
                                arrowColor: Colors.primary.dark,
                                monthTextColor: Colors.iron[950],
                                indicatorColor: Colors.primary.dark,
                            }}
                        />
                        <TouchableOpacity onPress={() => setShowCalendar(false)} className="bg-surface p-4 pt-3 items-center border-t border-iron-700">
                            <Text className="text-primary font-bold">Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </>
    );
}
