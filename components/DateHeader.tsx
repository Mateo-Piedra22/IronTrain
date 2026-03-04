import { Colors } from '@/src/theme';
import { Ionicons } from '@expo/vector-icons';
import { addDays, format, subDays } from 'date-fns';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
            <View style={ss.header}>
                <Pressable onPress={prevDay} style={ss.arrowBtn} hitSlop={8}>
                    <Ionicons name="chevron-back" size={22} color={Colors.primary.dark} />
                </Pressable>

                <Pressable onPress={() => setShowCalendar(true)} style={{ alignItems: 'center' }}>
                    <Text style={ss.dateText}>
                        {isToday ? 'Today' : format(date, 'EEE, MMM do')} <Ionicons name="calendar-outline" size={14} color={Colors.iron[400]} />
                    </Text>
                    <Text style={ss.yearText}>{format(date, 'yyyy')}</Text>
                </Pressable>

                <Pressable onPress={nextDay} style={ss.arrowBtn} hitSlop={8}>
                    <Ionicons name="chevron-forward" size={22} color={Colors.primary.dark} />
                </Pressable>
            </View>

            <Modal visible={showCalendar} animationType="fade" transparent>
                <View style={ss.modalOverlay}>
                    <View style={ss.modalSheet}>
                        <Calendar
                            current={dateStr}
                            onDayPress={(day: any) => {
                                const [y, m, d] = day.dateString.split('-').map(Number);
                                onChange(new Date(y, m - 1, d));
                                setShowCalendar(false);
                            }}
                            markedDates={{
                                [dateStr]: { selected: true, selectedColor: Colors.primary.dark }
                            }}
                            theme={{
                                backgroundColor: Colors.surface,
                                calendarBackground: Colors.surface,
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
                        <TouchableOpacity onPress={() => setShowCalendar(false)} style={ss.closeBtn}>
                            <Text style={ss.closeBtnText}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const ss = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: Colors.iron[900] },
    arrowBtn: { padding: 8 },
    dateText: { color: Colors.iron[950], fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
    yearText: { color: Colors.iron[400], fontSize: 11, fontWeight: '600', marginTop: 2 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', paddingHorizontal: 16 },
    modalSheet: { backgroundColor: Colors.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: Colors.iron[700] },
    closeBtn: { backgroundColor: Colors.surface, padding: 14, paddingTop: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.iron[200] },
    closeBtnText: { color: Colors.primary.DEFAULT, fontWeight: '800', fontSize: 14 },
});
