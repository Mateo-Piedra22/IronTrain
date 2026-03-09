import { ThemeFx } from '@/src/theme';
import { Ionicons } from '@expo/vector-icons';
import { addDays, format, subDays } from 'date-fns';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useColors } from '../src/hooks/useColors';

interface DateHeaderProps {
    date: Date;
    onChange: (date: Date) => void;
}

export function DateHeader({ date, onChange }: DateHeaderProps) {
    const colors = useColors();
    const [showCalendar, setShowCalendar] = useState(false);

    const prevDay = () => onChange(subDays(date, 1));
    const nextDay = () => onChange(addDays(date, 1));

    const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
    const dateStr = format(date, 'yyyy-MM-dd');

    const ss = useMemo(() => StyleSheet.create({
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 14,
            backgroundColor: colors.background
        },
        arrowBtn: { padding: 8 },
        dateText: { color: colors.iron[950], fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
        yearText: { color: colors.iron[400], fontSize: 11, fontWeight: '600', marginTop: 2 },
        modalOverlay: { flex: 1, backgroundColor: ThemeFx.backdrop, justifyContent: 'center', paddingHorizontal: 16 },
        modalSheet: {
            backgroundColor: colors.surface,
            borderRadius: 20,
            overflow: 'hidden',
            borderWidth: 1.5,
            borderColor: colors.iron[200],
            ...ThemeFx.shadowSm
        },
        closeBtn: {
            backgroundColor: colors.surface,
            padding: 16,
            alignItems: 'center',
            borderTopWidth: 1.5,
            borderTopColor: colors.iron[100]
        },
        closeBtnText: { color: colors.primary.DEFAULT, fontWeight: '800', fontSize: 14 },
    }), [colors]);

    return (
        <>
            <View style={ss.header}>
                <Pressable onPress={prevDay} style={ss.arrowBtn} hitSlop={8}>
                    <Ionicons name="chevron-back" size={22} color={colors.primary.DEFAULT} />
                </Pressable>

                <Pressable onPress={() => setShowCalendar(true)} style={{ alignItems: 'center' }}>
                    <Text style={ss.dateText}>
                        {isToday ? 'Hoy' : format(date, 'EEE, MMM do')} <Ionicons name="calendar-outline" size={14} color={colors.iron[400]} />
                    </Text>
                    <Text style={ss.yearText}>{format(date, 'yyyy')}</Text>
                </Pressable>

                <Pressable onPress={nextDay} style={ss.arrowBtn} hitSlop={8}>
                    <Ionicons name="chevron-forward" size={22} color={colors.primary.DEFAULT} />
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
                                [dateStr]: { selected: true, selectedColor: colors.primary.DEFAULT }
                            }}
                            theme={{
                                backgroundColor: colors.surface,
                                calendarBackground: colors.surface,
                                textSectionTitleColor: colors.iron[500],
                                selectedDayBackgroundColor: colors.primary.DEFAULT,
                                selectedDayTextColor: colors.white,
                                todayTextColor: colors.primary.DEFAULT,
                                dayTextColor: colors.iron[950],
                                textDisabledColor: colors.iron[400],
                                arrowColor: colors.primary.DEFAULT,
                                monthTextColor: colors.iron[950],
                                indicatorColor: colors.primary.DEFAULT,
                                textMonthFontWeight: '900',
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

