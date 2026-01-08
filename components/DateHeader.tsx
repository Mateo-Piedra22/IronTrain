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
                    <Ionicons name="chevron-back" size={24} color="#f97316" />
                </Pressable>

                <Pressable onPress={() => setShowCalendar(true)} className="items-center">
                    <Text className="text-white text-xl font-bold">
                        {isToday ? 'Today' : format(date, 'EEE, MMM do')} <Ionicons name="calendar-outline" size={16} color="#94a3b8" />
                    </Text>
                    <Text className="text-textMuted text-xs">{format(date, 'yyyy')}</Text>
                </Pressable>

                <Pressable onPress={nextDay} className="p-2">
                    <Ionicons name="chevron-forward" size={24} color="#f97316" />
                </Pressable>
            </View>

            <Modal visible={showCalendar} animationType="fade" transparent>
                <View className="flex-1 bg-black/80 justify-center px-4">
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
                                [dateStr]: { selected: true, selectedColor: '#f97316' }
                            }}
                            theme={{
                                backgroundColor: '#1e293b',
                                calendarBackground: '#1e293b',
                                textSectionTitleColor: '#94a3b8',
                                selectedDayBackgroundColor: '#f97316',
                                selectedDayTextColor: '#ffffff',
                                todayTextColor: '#f97316',
                                dayTextColor: '#ffffff',
                                textDisabledColor: '#475569',
                                arrowColor: '#f97316',
                                monthTextColor: '#ffffff',
                                indicatorColor: '#f97316',
                            }}
                        />
                        <TouchableOpacity onPress={() => setShowCalendar(false)} className="bg-background param-4 py-3 items-center">
                            <Text className="text-primary font-bold">Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </>
    );
}
