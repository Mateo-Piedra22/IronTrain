import { EmptyChartPlaceholder } from '@/components/EmptyChartPlaceholder';
import { configService } from '@/src/services/ConfigService';
import { UnitService } from '@/src/services/UnitService';
import { Colors } from '@/src/theme';
import { formatTimeSeconds } from '@/src/utils/time';
import { format } from 'date-fns';
import { X } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Dimensions, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { ExerciseType, WorkoutSet } from '../src/types/db';

interface HistoryModalProps {
    visible: boolean;
    onClose: () => void;
    history: { date: number; sets: WorkoutSet[] }[];
    exerciseName: string;
    exerciseType?: ExerciseType;
}

export function HistoryModal({ visible, onClose, history, exerciseName, exerciseType = 'weight_reps' }: HistoryModalProps) {
    const screenWidth = Dimensions.get('window').width;
    const unit = configService.get('weightUnit') === 'kg' ? 'kg' : 'lb';
    const displayWeight = (kgValue: number) => unit === 'kg' ? kgValue : UnitService.kgToLbs(kgValue);

    const chartData = useMemo(() => {
        const sorted = [...history].sort((a, b) => a.date - b.date);
        return sorted.map(h => {
            let value = 0;
            if (exerciseType === 'distance_time') {
                const valid = h.sets.filter(s => (s.distance ?? 0) > 0);
                const maxDist = valid.length > 0 ? Math.max(...valid.map(s => s.distance || 0)) : 0;
                value = Math.round((maxDist / 1000) * 100) / 100;
            } else if (exerciseType === 'reps_only') {
                const valid = h.sets.filter(s => (s.reps ?? 0) > 0);
                value = valid.length > 0 ? Math.max(...valid.map(s => s.reps || 0)) : 0;
            } else {
                const valid = h.sets.filter(s => (s.weight ?? 0) > 0);
                const maxW = valid.length > 0 ? Math.max(...valid.map(s => s.weight || 0)) : 0;
                value = Math.round(displayWeight(maxW) * 10) / 10;
            }
            return {
                value,
                label: format(new Date(h.date), 'd/MM'),
                labelTextStyle: { color: Colors.iron[400], fontSize: 10 },
                dataPointText: value.toString(),
                dataPointTextColor: 'white',
                dataPointTextShiftY: -10
            };
        });
    }, [history, exerciseType, unit]);

    return (
        <Modal visible={visible} animationType="fade" transparent>
            <View style={ss.overlay}>
                <View style={ss.sheet}>
                    {/* Header */}
                    <View style={ss.header}>
                        <View>
                            <Text style={ss.headerTitle}>{exerciseName}</Text>
                            <Text style={ss.headerSub}>Historial de progreso</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={ss.closeBtn} accessibilityRole="button" accessibilityLabel="Cerrar historial">
                            <X size={18} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        style={{ flex: 1 }}
                        data={history}
                        ListHeaderComponent={
                            <View style={ss.chartContainer}>
                                {chartData.length > 1 ? (
                                    <View style={{ overflow: 'hidden' }}>
                                        <LineChart
                                            data={chartData}
                                            color={Colors.primary.DEFAULT}
                                            thickness={3}
                                            dataPointsColor={Colors.primary.DEFAULT}
                                            dataPointsRadius={4}
                                            startFillColor={Colors.primary.DEFAULT}
                                            endFillColor={Colors.primary.DEFAULT}
                                            startOpacity={0.2}
                                            endOpacity={0.0}
                                            areaChart
                                            yAxisTextStyle={{ color: Colors.iron[400], fontSize: 10, fontWeight: '600' }}
                                            xAxisLabelTextStyle={{ color: Colors.iron[400], fontSize: 10, fontWeight: '600' }}
                                            rulesColor={Colors.iron[200]}
                                            rulesType="solid"
                                            hideRules={false}
                                            width={screenWidth - 64}
                                            height={180}
                                            initialSpacing={0}
                                            endSpacing={0}
                                            spacing={32}
                                            hideDataPoints={false}
                                            curved
                                            isAnimated
                                            animationDuration={400}
                                            yAxisLabelSuffix={exerciseType === 'distance_time' ? ' km' : exerciseType === 'reps_only' ? ' rep' : ` ${unit}`}
                                            yAxisLabelWidth={40}
                                            xAxisThickness={1}
                                            xAxisColor={Colors.iron[200]}
                                            yAxisThickness={0}
                                        />
                                    </View>
                                ) : (
                                    <EmptyChartPlaceholder
                                        title="Sin historial gráfico"
                                        message="Necesitás al menos 2 sesiones previas para ver tu progreso."
                                        height={160}
                                    />
                                )}
                            </View>
                        }
                        keyExtractor={(item) => item.date.toString()}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        renderItem={({ item }) => (
                            <View style={ss.sessionCard}>
                                <Text style={ss.sessionDate}>
                                    {format(new Date(item.date), 'EEEE, d MMM yyyy')}
                                </Text>
                                <View style={ss.setsContainer}>
                                    {item.sets.map((set, idx) => (
                                        <View key={set.id} style={[ss.setRow, idx < item.sets.length - 1 && ss.setRowBorder]}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', width: 44 }}>
                                                <Text style={ss.setIndex}>#{idx + 1}</Text>
                                                {set.type === 'pr' && <Text style={ss.prBadge}>PR</Text>}
                                            </View>
                                            <Text style={ss.setValue}>
                                                {exerciseType === 'distance_time'
                                                    ? `${Math.round(((set.distance || 0) / 1000) * 100) / 100} km  •  ${formatTimeSeconds(set.time || 0)}`
                                                    : exerciseType === 'reps_only'
                                                        ? `${set.reps || 0} reps`
                                                        : exerciseType === 'weight_only'
                                                            ? `${Math.round(displayWeight(set.weight || 0) * 10) / 10} ${unit}`
                                                            : `${Math.round(displayWeight(set.weight || 0) * 10) / 10} ${unit}  ×  ${set.reps || 0}`
                                                }
                                            </Text>
                                            <Text style={ss.setMeta}>
                                                {set.type !== 'normal'
                                                    ? set.type.toUpperCase()
                                                    : exerciseType === 'weight_reps'
                                                        ? `1RM: ${Math.round(displayWeight((set.weight || 0) * (1 + (set.reps || 0) / 30)))}`
                                                        : exerciseType === 'distance_time'
                                                            ? (() => {
                                                                const d = (set.distance || 0) / 1000;
                                                                const t = set.time || 0;
                                                                if (d <= 0 || t <= 0) return '—';
                                                                const pace = t / d;
                                                                return `${formatTimeSeconds(pace)}/km`;
                                                            })()
                                                            : '—'
                                                }
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                        ListEmptyComponent={
                            <Text style={ss.emptyText}>No hay historial.</Text>
                        }
                    />
                </View>
            </View>
        </Modal>
    );
}

const ss = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 48 },
    sheet: { backgroundColor: Colors.iron[900], borderWidth: 1, borderColor: Colors.iron[700], borderRadius: 20, flex: 1, maxHeight: '90%', width: '100%', overflow: 'hidden' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.iron[200], backgroundColor: Colors.surface },
    headerTitle: { color: Colors.iron[950], fontWeight: '900', fontSize: 16, letterSpacing: -0.3 },
    headerSub: { color: Colors.iron[400], fontSize: 11, marginTop: 2 },
    closeBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.primary.DEFAULT, justifyContent: 'center', alignItems: 'center' },
    chartContainer: { padding: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.iron[200], marginBottom: 8 },
    sessionCard: { marginBottom: 12, paddingHorizontal: 16 },
    sessionDate: { color: Colors.primary.DEFAULT, fontWeight: '800', fontSize: 12, backgroundColor: Colors.primary.DEFAULT + '10', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 8 },
    setsContainer: { backgroundColor: Colors.surface, borderRadius: 14, padding: 8, borderWidth: 1, borderColor: Colors.iron[700] },
    setRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 6 },
    setRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.iron[200] },
    setIndex: { color: Colors.iron[400], fontSize: 11, fontWeight: '700', width: 24 },
    prBadge: { fontSize: 9, color: '#f59e0b', fontWeight: '900', marginLeft: 4 },
    setValue: { color: Colors.iron[950], fontWeight: '800', fontSize: 13, flex: 1, textAlign: 'center' },
    setMeta: { color: Colors.iron[400], fontSize: 11, width: 88, textAlign: 'right', fontWeight: '600' },
    emptyText: { color: Colors.iron[400], textAlign: 'center', paddingVertical: 32, fontSize: 14 },
});
