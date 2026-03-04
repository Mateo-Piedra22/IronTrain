import { EmptyChartPlaceholder } from '@/components/EmptyChartPlaceholder';
import { IronButton } from '@/components/IronButton';
import { IronInput } from '@/components/IronInput';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { BodyMetric, bodyService } from '@/src/services/BodyService';
import { configService } from '@/src/services/ConfigService';
import { UnitService } from '@/src/services/UnitService';
import { Colors } from '@/src/theme';
import { Measurement, MeasurementType } from '@/src/types/db';
import { notify } from '@/src/utils/notify';
import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { ChevronDown, ChevronLeft, ChevronUp, Circle, Minus, Plus, Ruler, Scale, Trash2, TrendingDown, TrendingUp } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { confirm } from '../../src/store/confirmStore';

const screenWidth = Dimensions.get('window').width;

interface MeasurementConfig {
    type: MeasurementType;
    label: string;
    Icon: any;
    color: string;
    unit: string;
    group: 'primary' | 'upper' | 'core' | 'lower';
}

const MEASUREMENT_CONFIG: MeasurementConfig[] = [
    { type: 'weight', label: 'Peso Corporal', Icon: Scale, color: Colors.primary.DEFAULT, unit: 'dynamic', group: 'primary' },
    { type: 'body_fat', label: 'Grasa Corporal', Icon: TrendingDown, color: '#ef4444', unit: '%', group: 'primary' },
    { type: 'neck', label: 'Cuello', Icon: Circle, color: '#3b82f6', unit: 'cm', group: 'upper' },
    { type: 'shoulders', label: 'Hombros', Icon: Ruler, color: '#8b5cf6', unit: 'cm', group: 'upper' },
    { type: 'chest', label: 'Pecho', Icon: Circle, color: '#ef4444', unit: 'cm', group: 'upper' },
    { type: 'bicep', label: 'Bíceps', Icon: Circle, color: '#f97316', unit: 'cm', group: 'upper' },
    { type: 'forearm', label: 'Antebrazo', Icon: Ruler, color: '#f59e0b', unit: 'cm', group: 'upper' },
    { type: 'waist', label: 'Cintura', Icon: Circle, color: '#eab308', unit: 'cm', group: 'core' },
    { type: 'hips', label: 'Caderas', Icon: Circle, color: '#22c55e', unit: 'cm', group: 'core' },
    { type: 'thigh', label: 'Muslo', Icon: Circle, color: '#14b8a6', unit: 'cm', group: 'lower' },
    { type: 'calf', label: 'Pantorrilla', Icon: Circle, color: '#06b6d4', unit: 'cm', group: 'lower' },
];

const GROUP_LABELS: Record<string, string> = {
    primary: 'Métricas Principales',
    upper: 'Tren Superior',
    core: 'Core',
    lower: 'Tren Inferior',
};

export default function BodyTrackerScreen() {
    const router = useRouter();
    const [metrics, setMetrics] = useState<BodyMetric[]>([]);
    const [measurements, setMeasurements] = useState<Record<MeasurementType, Measurement[]>>({} as any);
    const [loading, setLoading] = useState(true);
    const [unit, setUnit] = useState(configService.get('weightUnit'));
    const [expandedChart, setExpandedChart] = useState<MeasurementType | null>(null);
    const [addModalType, setAddModalType] = useState<MeasurementType | null>(null);
    const [addValue, setAddValue] = useState('');

    // Weight & fat quick-add
    const [weight, setWeight] = useState('');
    const [fat, setFat] = useState('');

    const loadData = useCallback(async () => {
        try {
            const [data, ...histories] = await Promise.all([
                bodyService.getAll(),
                ...MEASUREMENT_CONFIG.map(c => bodyService.getHistory(c.type)),
            ]);
            setMetrics(data);
            const map: Record<string, Measurement[]> = {};
            MEASUREMENT_CONFIG.forEach((c, i) => { map[c.type] = histories[i]; });
            setMeasurements(map as any);
        } catch {
            /* handled */
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            setUnit(configService.get('weightUnit'));
            loadData();
        }, [loadData])
    );

    const handleLogPrimary = async () => {
        const w = parseFloat(weight);
        if (!weight || isNaN(w)) {
            notify.error('Atención', 'Ingresa tu peso correctamente.');
            return;
        }
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            const wKg = unit === 'kg' ? w : UnitService.lbsToKg(w);
            await bodyService.add(today, wKg, parseFloat(fat));
            setWeight('');
            setFat('');
            loadData();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            notify.success('Guardado', 'Tu peso ha sido registrado.');
        } catch (e: any) {
            notify.error('Error', e?.message || 'No se pudo guardar.');
        }
    };

    const handleAddMeasurement = async () => {
        if (!addModalType || !addValue) return;
        const v = parseFloat(addValue);
        if (isNaN(v) || v <= 0) { notify.error('Valor inválido', 'Ingresa un número positivo.'); return; }
        const cfg = MEASUREMENT_CONFIG.find(c => c.type === addModalType);
        const measureUnit = cfg?.unit === 'dynamic' ? unit : (cfg?.unit || 'cm');
        try {
            await bodyService.addMeasurement(addModalType, v, measureUnit);
            setAddModalType(null);
            setAddValue('');
            loadData();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            notify.success('Registrado', `${cfg?.label} guardado correctamente.`);
        } catch (e: any) {
            notify.error('Error', e?.message || 'No se pudo guardar.');
        }
    };

    const handleDeleteMeasurement = (id: string, label: string) => {
        confirm.destructive(
            'Eliminar',
            `¿Eliminar esta medición de ${label}?`,
            async () => {
                await bodyService.deleteMeasurement(id);
                loadData();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            },
            'Eliminar'
        );
    };

    const handleDeleteLegacy = async (id: string) => {
        confirm.destructive(
            'Eliminar',
            '¿Eliminar entradas de este día?',
            async () => { await bodyService.delete(id); loadData(); },
            'Eliminar'
        );
    };

    const getLatest = (type: MeasurementType): Measurement | null => {
        const list = measurements[type];
        return list && list.length > 0 ? list[0] : null;
    };

    const getTrend = (type: MeasurementType): { delta: number | null; pct: number | null } => {
        const list = measurements[type];
        if (!list || list.length < 2) return { delta: null, pct: null };
        const latest = list[0].value;
        const prev = list[1].value;
        const delta = latest - prev;
        const pct = prev > 0 ? Math.round((delta / prev) * 100) : null;
        return { delta: Math.round(delta * 10) / 10, pct };
    };

    const getChartData = (type: MeasurementType) => {
        const list = measurements[type];
        if (!list || list.length < 2) return [];
        return [...list].reverse().map(m => ({
            value: type === 'weight' && unit !== 'kg' ? UnitService.kgToLbs(m.value) : m.value,
            label: format(new Date(m.date), 'dd/MM'),
        }));
    };

    const getUnitForType = (cfg: MeasurementConfig) => {
        if (cfg.unit === 'dynamic') return unit;
        return cfg.unit;
    };

    const formatValue = (cfg: MeasurementConfig, value: number) => {
        if (cfg.type === 'weight' && unit !== 'kg') return Math.round(UnitService.kgToLbs(value) * 10) / 10;
        return Math.round(value * 10) / 10;
    };

    const groups = useMemo(() => {
        const g: Record<string, MeasurementConfig[]> = {};
        MEASUREMENT_CONFIG.forEach(c => {
            if (!g[c.group]) g[c.group] = [];
            g[c.group].push(c);
        });
        return g;
    }, []);

    // Weight chart data (for primary hero chart)
    const weightChartData = useMemo(() => {
        return [...metrics].reverse()
            .filter(m => m.weight != null)
            .map(m => ({
                value: unit === 'kg' ? (m.weight || 0) : UnitService.kgToLbs(m.weight || 0),
                label: format(new Date(m.date), 'dd/MM'),
            }));
    }, [metrics, unit]);
    return (
        <SafeAreaWrapper style={{ backgroundColor: Colors.iron[900] }} edges={['top', 'left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 60, paddingTop: 16 }}>
                <View style={{ marginBottom: 24, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <TouchableOpacity onPress={() => router.back()} style={ss.backBtn} accessibilityRole="button" accessibilityLabel="Volver">
                        <ChevronLeft size={20} color={Colors.iron[950]} />
                    </TouchableOpacity>
                    <View>
                        <Text style={ss.pageTitle}>Evolución Física</Text>
                        <Text style={ss.pageSub}>Medidas y seguimiento corporal</Text>
                    </View>
                </View>

                {/* Quick Log — Weight & Fat */}
                <View style={ss.quickLogCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <Scale size={16} color={Colors.primary.DEFAULT} />
                        <Text style={ss.quickLogTitle}>Registro rápido</Text>
                    </View>
                    <View style={ss.inputRow}>
                        <View style={{ flex: 1 }}>
                            <IronInput placeholder={`Peso (${unit})`} keyboardType="numeric" value={weight} onChangeText={setWeight} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <IronInput placeholder="Grasa %" keyboardType="numeric" value={fat} onChangeText={setFat} />
                        </View>
                    </View>
                    <View style={{ marginTop: 10 }}>
                        <IronButton label="GUARDAR" onPress={handleLogPrimary} />
                    </View>
                </View>

                {/* Weight Trend Chart */}
                {weightChartData.length > 1 ? (
                    <View style={ss.chartCard}>
                        <Text style={ss.chartTitle}>Tendencia de peso</Text>
                        <LineChart
                            data={weightChartData}
                            color={Colors.primary.DEFAULT}
                            thickness={3}
                            dataPointsColor={Colors.primary.DEFAULT}
                            dataPointsRadius={4}
                            hideRules={false}
                            rulesColor={Colors.iron[200]}
                            rulesType="solid"
                            height={180}
                            width={screenWidth - 80}
                            curved
                            isAnimated
                            animationDuration={400}
                            startFillColor={Colors.primary.DEFAULT}
                            endFillColor={Colors.primary.DEFAULT}
                            startOpacity={0.15}
                            endOpacity={0}
                            areaChart
                            yAxisTextStyle={{ color: Colors.iron[400], fontSize: 10, fontWeight: '600' }}
                            xAxisLabelTextStyle={{ color: Colors.iron[400], fontSize: 10, fontWeight: '600' }}
                            initialSpacing={0}
                            endSpacing={0}
                            yAxisLabelSuffix={` ${unit}`}
                            yAxisLabelWidth={45}
                            xAxisThickness={1}
                            xAxisColor={Colors.iron[200]}
                            yAxisThickness={0}
                        />
                    </View>
                ) : (
                    <View style={ss.chartCard}>
                        <Text style={ss.chartTitle}>Tendencia de peso</Text>
                        <EmptyChartPlaceholder
                            title="Sin tendencia disponible"
                            message="Registra al menos 2 mediciones de peso para ver tu gráfico."
                            height={180}
                        />
                    </View>
                )
                }

                {/* Measurement Groups */}
                {
                    ['primary', 'upper', 'core', 'lower'].map(groupKey => {
                        const items = groups[groupKey];
                        if (!items) return null;
                        return (
                            <View key={groupKey} style={{ marginBottom: 20 }}>
                                <View style={ss.groupHeader}>
                                    <View style={ss.groupAccent} />
                                    <Text style={ss.groupTitle}>{GROUP_LABELS[groupKey]}</Text>
                                </View>

                                {items.map(cfg => {
                                    const latest = getLatest(cfg.type);
                                    const trend = getTrend(cfg.type);
                                    const chartData = getChartData(cfg.type);
                                    const isExpanded = expandedChart === cfg.type;
                                    const displayUnit = getUnitForType(cfg);
                                    const historyList = measurements[cfg.type] || [];

                                    return (
                                        <View key={cfg.type} style={ss.measureCard}>
                                            <Pressable
                                                onPress={() => {
                                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                    setExpandedChart(isExpanded ? null : cfg.type);
                                                }}
                                                style={ss.measureHeader}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                                    <View style={[ss.measureIconCircle, { backgroundColor: cfg.color + '15' }]}>
                                                        <cfg.Icon size={16} color={cfg.color} />
                                                    </View>
                                                    <View>
                                                        <Text style={ss.measureLabel}>{cfg.label}</Text>
                                                        {latest ? (
                                                            <Text style={ss.measureValue}>
                                                                {formatValue(cfg, latest.value)} {displayUnit}
                                                            </Text>
                                                        ) : (
                                                            <Text style={ss.measureEmpty}>Sin datos</Text>
                                                        )}
                                                    </View>
                                                </View>

                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                    {/* Trend indicator */}
                                                    {trend.delta !== null && (
                                                        <View style={[ss.trendBadge, {
                                                            backgroundColor: trend.delta > 0 ? '#dcfce720' : trend.delta < 0 ? '#fee2e220' : Colors.iron[200],
                                                        }]}>
                                                            {trend.delta > 0 ? <TrendingUp size={10} color="#166534" /> :
                                                                trend.delta < 0 ? <TrendingDown size={10} color="#991b1b" /> :
                                                                    <Minus size={10} color={Colors.iron[500]} />}
                                                            <Text style={{
                                                                fontSize: 10, fontWeight: '800',
                                                                color: trend.delta > 0 ? '#166534' : trend.delta < 0 ? '#991b1b' : Colors.iron[500],
                                                            }}>
                                                                {trend.delta > 0 ? '+' : ''}{trend.delta}
                                                            </Text>
                                                        </View>
                                                    )}
                                                    {/* Add button */}
                                                    <Pressable
                                                        onPress={(e) => { e.stopPropagation(); setAddModalType(cfg.type); setAddValue(''); }}
                                                        style={ss.addBtn}
                                                        accessibilityLabel={`Registrar ${cfg.label}`}
                                                    >
                                                        <Plus size={14} color={Colors.primary.DEFAULT} />
                                                    </Pressable>
                                                    {isExpanded ? <ChevronUp size={16} color={Colors.iron[400]} /> : <ChevronDown size={16} color={Colors.iron[400]} />}
                                                </View>
                                            </Pressable>

                                            {/* Expanded: Mini Chart + History */}
                                            {isExpanded && (
                                                <View style={ss.expandedContent}>
                                                    {chartData.length > 1 ? (
                                                        <View style={{ marginBottom: 12 }}>
                                                            <LineChart
                                                                data={chartData}
                                                                color={Colors.primary.DEFAULT}
                                                                thickness={2}
                                                                dataPointsColor={Colors.primary.DEFAULT}
                                                                dataPointsRadius={3}
                                                                hideRules={false}
                                                                rulesColor={Colors.iron[200]}
                                                                rulesType="solid"
                                                                height={120}
                                                                width={screenWidth - 100}
                                                                curved
                                                                isAnimated
                                                                animationDuration={300}
                                                                startFillColor={Colors.primary.DEFAULT}
                                                                endFillColor={Colors.primary.DEFAULT}
                                                                startOpacity={0.1}
                                                                endOpacity={0}
                                                                areaChart
                                                                yAxisTextStyle={{ color: Colors.iron[400], fontSize: 9, fontWeight: '600' }}
                                                                xAxisLabelTextStyle={{ color: Colors.iron[400], fontSize: 9, fontWeight: '600' }}
                                                                initialSpacing={0}
                                                                endSpacing={0}
                                                                xAxisThickness={0}
                                                                yAxisThickness={0}
                                                            />
                                                        </View>
                                                    ) : (
                                                        <Text style={{ color: Colors.iron[400], fontSize: 11, fontWeight: '600', marginBottom: 12, fontStyle: 'italic' }}>
                                                            Registra al menos 2 mediciones para ver la tendencia.
                                                        </Text>
                                                    )}

                                                    {/* History entries */}
                                                    {historyList.slice(0, 8).map(m => (
                                                        <View key={m.id} style={ss.historyRow}>
                                                            <View>
                                                                <Text style={ss.historyDate}>{format(new Date(m.date), 'dd MMM yyyy')}</Text>
                                                                <Text style={ss.historyValue}>
                                                                    {formatValue(cfg, m.value)} {displayUnit}
                                                                </Text>
                                                            </View>
                                                            <Pressable
                                                                onPress={() => handleDeleteMeasurement(m.id, cfg.label)}
                                                                style={{ padding: 6 }}
                                                                accessibilityLabel={`Eliminar medición`}
                                                            >
                                                                <Trash2 size={14} color={Colors.iron[400]} />
                                                            </Pressable>
                                                        </View>
                                                    ))}
                                                    {historyList.length === 0 && (
                                                        <Text style={{ color: Colors.iron[400], fontSize: 11, fontStyle: 'italic' }}>
                                                            Aún no hay registros de {cfg.label.toLowerCase()}.
                                                        </Text>
                                                    )}
                                                </View>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        );
                    })
                }
            </ScrollView >

            {/* Add Measurement Modal */}
            < Modal visible={addModalType !== null
            } transparent animationType="fade" onRequestClose={() => setAddModalType(null)}>
                <Pressable style={ss.modalOverlay} onPress={() => setAddModalType(null)}>
                    <View style={ss.modalContainer}>
                        {(() => {
                            const cfg = MEASUREMENT_CONFIG.find(c => c.type === addModalType);
                            if (!cfg) return null;
                            const displayUnit = getUnitForType(cfg);
                            return (
                                <>
                                    <Text style={ss.modalTitle}>{cfg.label}</Text>
                                    <Text style={ss.modalSub}>Registrar nueva medición</Text>
                                    <View style={{ marginVertical: 16 }}>
                                        <TextInput
                                            style={ss.modalInput}
                                            placeholder={`Valor (${displayUnit})`}
                                            placeholderTextColor={Colors.iron[400]}
                                            keyboardType="numeric"
                                            value={addValue}
                                            onChangeText={setAddValue}
                                            autoFocus
                                        />
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                        <Pressable onPress={() => setAddModalType(null)} style={[ss.modalBtn, ss.modalBtnCancel]}>
                                            <Text style={ss.modalBtnCancelText}>Cancelar</Text>
                                        </Pressable>
                                        <Pressable onPress={handleAddMeasurement} style={[ss.modalBtn, ss.modalBtnSave]}>
                                            <Text style={ss.modalBtnSaveText}>Guardar</Text>
                                        </Pressable>
                                    </View>
                                </>
                            );
                        })()}
                    </View>
                </Pressable>
            </Modal >
        </SafeAreaWrapper >
    );
}

const ss = StyleSheet.create({
    backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.iron[300], elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
    pageTitle: { color: Colors.iron[950], fontWeight: '900', fontSize: 24, letterSpacing: -1 },
    pageSub: { color: Colors.primary.DEFAULT, fontSize: 12, fontWeight: '800', marginTop: 2, letterSpacing: 0.5 },
    quickLogCard: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        padding: 16,
        marginBottom: 20,
        elevation: 1,
    },
    quickLogTitle: { fontSize: 15, fontWeight: '900', color: Colors.iron[950], letterSpacing: -0.3 },
    inputRow: { flexDirection: 'row', gap: 12 },
    chartCard: {
        padding: 16,
        width: '100%',
        backgroundColor: Colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        elevation: 1,
        marginBottom: 24,
    },
    chartTitle: { color: Colors.primary.DEFAULT, fontWeight: '800', marginBottom: 14, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },

    // Groups
    groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    groupAccent: { width: 3, height: 16, borderRadius: 2, backgroundColor: Colors.primary.DEFAULT },
    groupTitle: { fontSize: 15, fontWeight: '900', color: Colors.primary.DEFAULT, letterSpacing: -0.3 },

    // Measure Cards
    measureCard: {
        backgroundColor: Colors.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        marginBottom: 8,
        overflow: 'hidden',
    },
    measureHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    measureLabel: { fontSize: 13, fontWeight: '800', color: Colors.iron[950] },
    measureValue: { fontSize: 17, fontWeight: '900', color: Colors.iron[950], marginTop: 2 },
    measureEmpty: { fontSize: 12, fontWeight: '600', color: Colors.iron[500], fontStyle: 'italic', marginTop: 2 },
    measureIconCircle: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    trendBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
    },
    addBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: Colors.primary.DEFAULT + '12',
        borderWidth: 1,
        borderColor: Colors.primary.DEFAULT + '30',
        alignItems: 'center',
        justifyContent: 'center',
    },
    expandedContent: {
        paddingHorizontal: 14,
        paddingBottom: 14,
        borderTopWidth: 1,
        borderTopColor: Colors.iron[200],
        paddingTop: 12,
    },
    historyRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: Colors.iron[200],
    },
    historyDate: { fontSize: 10, fontWeight: '700', color: Colors.iron[400], textTransform: 'uppercase', letterSpacing: 0.5 },
    historyValue: { fontSize: 14, fontWeight: '900', color: Colors.iron[950], marginTop: 2 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 32 },
    modalContainer: {
        backgroundColor: Colors.surface,
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 340,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
        elevation: 10,
    },
    modalTitle: { fontSize: 18, fontWeight: '900', color: Colors.iron[950], letterSpacing: -0.3 },
    modalSub: { fontSize: 12, fontWeight: '600', color: Colors.iron[400], marginTop: 4 },
    modalInput: {
        backgroundColor: Colors.iron[200],
        borderRadius: 12,
        padding: 14,
        fontSize: 18,
        fontWeight: '800',
        color: Colors.iron[950],
        textAlign: 'center',
        borderWidth: 1,
        borderColor: Colors.iron[300],
    },
    modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    modalBtnCancel: { backgroundColor: Colors.iron[200] },
    modalBtnCancelText: { fontWeight: '800', fontSize: 14, color: Colors.iron[950] },
    modalBtnSave: { backgroundColor: Colors.primary.DEFAULT },
    modalBtnSaveText: { fontWeight: '800', fontSize: 14, color: '#fff' },
});
