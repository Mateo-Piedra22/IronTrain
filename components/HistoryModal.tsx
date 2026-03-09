import { EmptyChartPlaceholder } from '@/components/EmptyChartPlaceholder';
import { configService } from '@/src/services/ConfigService';
import { UnitService } from '@/src/services/UnitService';
import { ThemeFx } from '@/src/theme';
import { formatTimeSeconds } from '@/src/utils/time';
import { format } from 'date-fns';
import { X } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Dimensions, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useColors } from '../src/hooks/useColors';
import { ExerciseType, WorkoutSet } from '../src/types/db';

interface HistoryModalProps {
    visible: boolean;
    onClose: () => void;
    history: { date: number; sets: WorkoutSet[] }[];
    exerciseName: string;
    exerciseType?: ExerciseType;
}

export function HistoryModal({ visible, onClose, history, exerciseName, exerciseType = 'weight_reps' }: HistoryModalProps) {
    const colors = useColors();
    const screenWidth = Dimensions.get('window').width;
    const unit = configService.get('weightUnit') === 'kg' ? 'kg' : 'lb';
    const displayWeight = (kgValue: number) => unit === 'kg' ? kgValue : UnitService.kgToLbs(kgValue);

    const ss = useMemo(() => StyleSheet.create({
        overlay: { flex: 1, backgroundColor: ThemeFx.backdropStrong, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 48 },
        sheet: {
            backgroundColor: colors.background,
            borderWidth: 1.5,
            borderColor: colors.iron[300],
            borderRadius: 20,
            flex: 1,
            maxHeight: '90%',
            width: '100%',
            overflow: 'hidden',
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.15,
            shadowRadius: 24,
            elevation: 10,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            borderBottomWidth: 1.5,
            borderBottomColor: colors.iron[200],
            backgroundColor: colors.surface
        },
        headerTitle: { color: colors.iron[950], fontWeight: '900', fontSize: 16, letterSpacing: -0.3 },
        headerSub: { color: colors.iron[400], fontSize: 11, marginTop: 2, fontWeight: '600' },
        closeBtn: {
            width: 34,
            height: 34,
            borderRadius: 14,
            backgroundColor: colors.primary.DEFAULT,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: colors.primary.DEFAULT,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 4
        },
        chartContainer: {
            padding: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            borderBottomWidth: 1.5,
            borderBottomColor: colors.iron[200],
            marginBottom: 12
        },
        chartClipping: { overflow: 'hidden' },
        sessionCard: { marginBottom: 20, paddingHorizontal: 16 },
        sessionDate: {
            color: colors.primary.DEFAULT,
            fontWeight: '900',
            fontSize: 11,
            backgroundColor: colors.primary.DEFAULT + '12',
            alignSelf: 'flex-start',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 12,
            marginBottom: 10,
            textTransform: 'uppercase',
            letterSpacing: 0.5
        },
        setsContainer: {
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 12,
            borderWidth: 1.5,
            borderColor: colors.iron[200],
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.05,
            shadowRadius: 10,
            elevation: 2,
        },
        setRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 10,
            paddingHorizontal: 4
        },
        setRowBorder: {
            borderBottomWidth: 1.5,
            borderBottomColor: colors.iron[100]
        },
        setIndexContainer: { flexDirection: 'row', alignItems: 'center', width: 44 },
        setIndex: { color: colors.iron[400], fontSize: 11, fontWeight: '800', width: 24 },
        prBadge: { fontSize: 10, color: colors.yellow, fontWeight: '900', marginLeft: 4 },
        setValue: { color: colors.iron[950], fontWeight: '800', fontSize: 13, flex: 1, textAlign: 'center' },
        setMeta: { color: colors.iron[500], fontSize: 11, width: 88, textAlign: 'right', fontWeight: '700' },
        emptyText: { color: colors.iron[400], textAlign: 'center', paddingVertical: 48, fontSize: 14, fontWeight: '600' },
    }), [colors]);

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
                labelTextStyle: { color: colors.iron[400], fontSize: 10, fontWeight: '700' as const },
                dataPointText: value.toString(),
                dataPointTextColor: colors.white,
                dataPointTextShiftY: -10
            };
        });
    }, [history, exerciseType, unit, colors]);

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
                            <X size={18} color={colors.white} />
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        style={{ flex: 1 }}
                        data={history}
                        ListHeaderComponent={
                            <View style={ss.chartContainer}>
                                {chartData.length > 1 ? (
                                    <View style={ss.chartClipping}>
                                        <LineChart
                                            data={chartData}
                                            color={colors.primary.DEFAULT}
                                            thickness={3}
                                            dataPointsColor={colors.primary.DEFAULT}
                                            dataPointsRadius={4}
                                            startFillColor={colors.primary.DEFAULT}
                                            endFillColor={colors.primary.DEFAULT}
                                            startOpacity={0.2}
                                            endOpacity={0.0}
                                            areaChart
                                            yAxisTextStyle={{ color: colors.iron[400], fontSize: 10, fontWeight: '700' }}
                                            xAxisLabelTextStyle={{ color: colors.iron[400], fontSize: 10, fontWeight: '700' }}
                                            rulesColor={colors.iron[100]}
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
                                            xAxisThickness={1.5}
                                            xAxisColor={colors.iron[200]}
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
                        contentContainerStyle={{ paddingBottom: 40 }}
                        renderItem={({ item }) => (
                            <View style={ss.sessionCard}>
                                <Text style={ss.sessionDate}>
                                    {format(new Date(item.date), 'EEEE, d MMM yyyy')}
                                </Text>
                                <View style={ss.setsContainer}>
                                    {item.sets.map((set, idx) => (
                                        <View key={set.id} style={[ss.setRow, idx < item.sets.length - 1 && ss.setRowBorder]}>
                                            <View style={ss.setIndexContainer}>
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
                            <Text style={ss.emptyText}>No hay historial registrado.</Text>
                        }
                    />
                </View>
            </View>
        </Modal>
    );
}

