import { EmptyChartPlaceholder } from '@/components/EmptyChartPlaceholder';
import { IronButton } from '@/components/IronButton';
import { IronInput } from '@/components/IronInput';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { BodyMetric, bodyService } from '@/src/services/BodyService';
import { configService } from '@/src/services/ConfigService';
import { UnitService } from '@/src/services/UnitService';
import { ThemeFx, withAlpha } from '@/src/theme';
import { Measurement, MeasurementType } from '@/src/types/db';
import { notify } from '@/src/utils/notify';
import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { ChevronDown, ChevronLeft, ChevronUp, Circle, Minus, Plus, Ruler, Scale, Trash2, TrendingDown, TrendingUp } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useColors } from '../../src/hooks/useColors';
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

const GROUP_LABELS: Record<string, string> = {
    primary: 'Métricas Principales',
    upper: 'Tren Superior',
    core: 'Core',
    lower: 'Tren Inferior',
};

export default function BodyTrackerScreen() {
    const colors = useColors();
    const router = useRouter();

    const MEASUREMENT_CONFIG: MeasurementConfig[] = [
        { type: 'weight', label: 'Peso Corporal', Icon: Scale, color: colors.primary.DEFAULT, unit: 'dynamic', group: 'primary' },
        { type: 'body_fat', label: 'Grasa Corporal', Icon: TrendingDown, color: colors.red, unit: '%', group: 'primary' },
        { type: 'neck', label: 'Cuello', Icon: Circle, color: colors.blue, unit: 'cm', group: 'upper' },
        { type: 'shoulders', label: 'Hombros', Icon: Ruler, color: colors.primary.light, unit: 'cm', group: 'upper' },
        { type: 'chest', label: 'Pecho', Icon: Circle, color: colors.red, unit: 'cm', group: 'upper' },
        { type: 'bicep', label: 'Bíceps', Icon: Circle, color: colors.yellow, unit: 'cm', group: 'upper' },
        { type: 'forearm', label: 'Antebrazo', Icon: Ruler, color: colors.primary.DEFAULT, unit: 'cm', group: 'upper' },
        { type: 'waist', label: 'Cintura', Icon: Circle, color: colors.yellow, unit: 'cm', group: 'core' },
        { type: 'hips', label: 'Caderas', Icon: Circle, color: colors.green, unit: 'cm', group: 'core' },
        { type: 'thigh', label: 'Muslo', Icon: Circle, color: colors.green, unit: 'cm', group: 'lower' },
        { type: 'calf', label: 'Pantorrilla', Icon: Circle, color: colors.blue, unit: 'cm', group: 'lower' },
    ];
    const [metrics, setMetrics] = useState<BodyMetric[]>([]);
    const [measurements, setMeasurements] = useState<Record<MeasurementType, Measurement[]>>({} as any);
    const [loading, setLoading] = useState(true);
    const [unit, setUnit] = useState(configService.get('weightUnit'));
    const [expandedChart, setExpandedChart] = useState<MeasurementType | null>(null);
    const [addModalType, setAddModalType] = useState<MeasurementType | null>(null);
    const [addValue, setAddValue] = useState('');

    // Quick selector state
    const [quickAddType, setQuickAddType] = useState<MeasurementType>('weight');
    const [weight, setWeight] = useState('');
    const [fat, setFat] = useState('');
    const [genericValue, setGenericValue] = useState('');
    const [showTypeSelector, setShowTypeSelector] = useState(false);

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

    const handleQuickAdd = async () => {
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            if (quickAddType === 'weight') {
                const w = parseFloat(weight);
                if (isNaN(w)) { notify.error('Atención', 'Ingresa tu peso correctamente.'); return; }
                const wKg = unit === 'kg' ? w : UnitService.lbsToKg(w);
                await bodyService.add(today, wKg, parseFloat(fat));
                setWeight('');
                setFat('');
            } else {
                const v = parseFloat(genericValue);
                if (isNaN(v) || v <= 0) { notify.error('Valor inválido', 'Ingresa un número positivo.'); return; }
                const cfg = MEASUREMENT_CONFIG.find(c => c.type === quickAddType);
                const measureUnit = cfg?.unit === 'dynamic' ? unit : (cfg?.unit || 'cm');
                await bodyService.addMeasurement(quickAddType as MeasurementType, v, measureUnit);
                setGenericValue('');
            }

            loadData();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            const label = MEASUREMENT_CONFIG.find(c => c.type === quickAddType)?.label || 'Registro';
            notify.success('Guardado', `${label} registrado correctamente.`);
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

    const ss = useMemo(() => StyleSheet.create({
        backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.border, ...ThemeFx.shadowSm },
        pageTitle: { color: colors.text, fontWeight: '900', fontSize: 24, letterSpacing: -1 },
        pageSub: { color: colors.primary.DEFAULT, fontSize: 12, fontWeight: '800', marginTop: 2, letterSpacing: 0.5 },
        quickLogCard: {
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: colors.border,
            padding: 16,
            marginBottom: 20,
            elevation: 1,
        },
        quickLogTitle: { fontSize: 15, fontWeight: '900', color: colors.text, letterSpacing: -0.3 },
        inputRow: { flexDirection: 'row', gap: 12 },
        chartCard: {
            padding: 16,
            width: '100%',
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: colors.border,
            elevation: 1,
            marginBottom: 24,
        },
        chartTitle: { color: colors.primary.DEFAULT, fontWeight: '800', marginBottom: 14, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },

        // Groups
        groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
        groupAccent: { width: 3, height: 16, borderRadius: 2, backgroundColor: colors.primary.DEFAULT },
        groupTitle: { fontSize: 15, fontWeight: '900', color: colors.primary.DEFAULT, letterSpacing: -0.3 },

        // Measure Cards
        measureCard: {
            backgroundColor: colors.surface,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: colors.border,
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
        measureLabel: { fontSize: 13, fontWeight: '800', color: colors.text },
        measureValue: { fontSize: 17, fontWeight: '900', color: colors.text, marginTop: 2 },
        measureEmpty: { fontSize: 12, fontWeight: '600', color: colors.textMuted, fontStyle: 'italic', marginTop: 2 },
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
            height: 28,
            borderRadius: 14,
            backgroundColor: withAlpha(colors.primary.DEFAULT, '12'),
            borderWidth: 1.5,
            borderColor: withAlpha(colors.primary.DEFAULT, '30'),
            alignItems: 'center',
            justifyContent: 'center',
        },
        expandedContent: {
            paddingHorizontal: 14,
            paddingBottom: 14,
            borderTopWidth: 1.5,
            borderTopColor: colors.border,
            paddingTop: 12,
        },
        historyRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 8,
            borderBottomWidth: 1.5,
            borderBottomColor: colors.border,
        },
        historyDate: { fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
        historyValue: { fontSize: 14, fontWeight: '900', color: colors.text, marginTop: 2 },

        // Modal
        modalOverlay: { flex: 1, backgroundColor: withAlpha(colors.black, '8C'), justifyContent: 'center', alignItems: 'center', padding: 32 },
        modalContainer: {
            backgroundColor: colors.surface,
            borderRadius: 20,
            padding: 24,
            width: '100%',
            maxWidth: 340,
            borderWidth: 1.5,
            borderColor: colors.border,
            ...ThemeFx.shadowLg,
        },
        modalTitle: { fontSize: 18, fontWeight: '900', color: colors.text, letterSpacing: -0.3 },
        modalSub: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
        modalInput: {
            backgroundColor: colors.background,
            borderRadius: 12,
            padding: 14,
            fontSize: 18,
            fontWeight: '800',
            color: colors.text,
            textAlign: 'center',
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
        modalBtnCancel: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
        modalBtnCancelText: { fontWeight: '800', fontSize: 14, color: colors.text },
        modalBtnSave: { backgroundColor: colors.primary.DEFAULT },
        modalBtnSaveText: { fontWeight: '800', fontSize: 14, color: colors.onPrimary },

        // Selector
        selectorItem: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            gap: 12,
            borderBottomWidth: 1.5,
            borderBottomColor: colors.border,
        },
        selectorText: {
            fontSize: 14,
            fontWeight: '700',
            color: colors.text,
            flex: 1,
        }
    }), [colors]);

    return (
        <SafeAreaWrapper style={{ backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 60, paddingTop: 16 }}>
                <View style={{ marginBottom: 24, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <TouchableOpacity onPress={() => router.back()} style={ss.backBtn} accessibilityRole="button" accessibilityLabel="Volver">
                        <ChevronLeft size={20} color={colors.text} />
                    </TouchableOpacity>
                    <View>
                        <Text style={ss.pageTitle}>Evolución Física</Text>
                        <Text style={ss.pageSub}>Medidas y seguimiento corporal</Text>
                    </View>
                </View>

                {/* Quick Log — Selectable Metric */}
                <View style={ss.quickLogCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <TouchableOpacity
                            onPress={() => setShowTypeSelector(true)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                        >
                            <Scale size={16} color={colors.primary.DEFAULT} />
                            <Text style={ss.quickLogTitle}>
                                {MEASUREMENT_CONFIG.find(c => c.type === quickAddType)?.label || 'Registro'}
                            </Text>
                            <ChevronDown size={14} color={colors.textMuted} />
                        </TouchableOpacity>

                        {quickAddType === 'weight' && (
                            <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase' }}>
                                + Grasa corporal
                            </Text>
                        )}
                    </View>

                    {quickAddType === 'weight' ? (
                        <View style={ss.inputRow}>
                            <View style={{ flex: 1 }}>
                                <IronInput placeholder={`Peso (${unit})`} keyboardType="numeric" value={weight} onChangeText={setWeight} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <IronInput placeholder="Grasa %" keyboardType="numeric" value={fat} onChangeText={setFat} />
                            </View>
                        </View>
                    ) : (
                        <View style={ss.inputRow}>
                            <View style={{ flex: 1 }}>
                                <IronInput
                                    placeholder={`Valor (${MEASUREMENT_CONFIG.find(c => c.type === quickAddType)?.unit})`}
                                    keyboardType="numeric"
                                    value={genericValue}
                                    onChangeText={setGenericValue}
                                />
                            </View>
                        </View>
                    )}

                    <View style={{ marginTop: 12 }}>
                        <IronButton label="GUARDAR REGISTRO" onPress={handleQuickAdd} />
                    </View>
                </View>

                {/* Weight Trend Chart */}
                {weightChartData.length > 1 ? (
                    <View style={ss.chartCard}>
                        <Text style={ss.chartTitle}>Tendencia de peso</Text>
                        <LineChart
                            data={weightChartData}
                            color={colors.primary.DEFAULT}
                            thickness={3}
                            dataPointsColor={colors.primary.DEFAULT}
                            dataPointsRadius={4}
                            hideRules={false}
                            rulesColor={colors.border}
                            rulesType="solid"
                            height={180}
                            width={screenWidth - 80}
                            curved
                            isAnimated
                            animationDuration={400}
                            startFillColor={colors.primary.DEFAULT}
                            endFillColor={colors.primary.DEFAULT}
                            startOpacity={0.15}
                            endOpacity={0}
                            areaChart
                            yAxisTextStyle={{ color: colors.textMuted, fontSize: 10, fontWeight: '600' }}
                            xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 10, fontWeight: '600' }}
                            initialSpacing={0}
                            endSpacing={0}
                            yAxisLabelSuffix={` ${unit}`}
                            yAxisLabelWidth={45}
                            xAxisThickness={1}
                            xAxisColor={colors.border}
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
                                                    <View style={[ss.measureIconCircle, { backgroundColor: withAlpha(cfg.color, '15') }]}>
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
                                                            backgroundColor: trend.delta > 0 ? withAlpha(colors.green, '20') : trend.delta < 0 ? withAlpha(colors.red, '20') : colors.border,
                                                        }]}>
                                                            {trend.delta > 0 ? <TrendingUp size={10} color={colors.green} /> :
                                                                trend.delta < 0 ? <TrendingDown size={10} color={colors.red} /> :
                                                                    <Minus size={10} color={colors.textMuted} />}
                                                            <Text style={{
                                                                fontSize: 10, fontWeight: '800',
                                                                color: trend.delta > 0 ? colors.green : trend.delta < 0 ? colors.red : colors.textMuted,
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
                                                        <Plus size={14} color={colors.primary.DEFAULT} />
                                                    </Pressable>
                                                    {isExpanded ? <ChevronUp size={16} color={colors.textMuted} /> : <ChevronDown size={16} color={colors.textMuted} />}
                                                </View>
                                            </Pressable>

                                            {/* Expanded: Mini Chart + History */}
                                            {isExpanded && (
                                                <View style={ss.expandedContent}>
                                                    {chartData.length > 1 ? (
                                                        <View style={{ marginBottom: 12 }}>
                                                            <LineChart
                                                                data={chartData}
                                                                color={colors.primary.DEFAULT}
                                                                thickness={2}
                                                                dataPointsColor={colors.primary.DEFAULT}
                                                                dataPointsRadius={3}
                                                                hideRules={false}
                                                                rulesColor={colors.border}
                                                                rulesType="solid"
                                                                height={120}
                                                                width={screenWidth - 100}
                                                                curved
                                                                isAnimated
                                                                animationDuration={300}
                                                                startFillColor={colors.primary.DEFAULT}
                                                                endFillColor={colors.primary.DEFAULT}
                                                                startOpacity={0.1}
                                                                endOpacity={0}
                                                                areaChart
                                                                yAxisTextStyle={{ color: colors.textMuted, fontSize: 9, fontWeight: '600' }}
                                                                xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 9, fontWeight: '600' }}
                                                                initialSpacing={0}
                                                                endSpacing={0}
                                                                xAxisThickness={0}
                                                                yAxisThickness={0}
                                                            />
                                                        </View>
                                                    ) : (
                                                        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 12, fontStyle: 'italic' }}>
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
                                                                <Trash2 size={14} color={colors.textMuted} />
                                                            </Pressable>
                                                        </View>
                                                    ))}
                                                    {historyList.length === 0 && (
                                                        <Text style={{ color: colors.textMuted, fontSize: 11, fontStyle: 'italic' }}>
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
                                            placeholderTextColor={colors.textMuted}
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
            {/* Metric Selector Modal (Quick Add) */}
            <Modal visible={showTypeSelector} transparent animationType="slide" onRequestClose={() => setShowTypeSelector(false)}>
                <Pressable style={ss.modalOverlay} onPress={() => setShowTypeSelector(false)}>
                    <View style={[ss.modalContainer, { maxHeight: '80%', padding: 0, overflow: 'hidden' }]}>
                        <View style={{ padding: 20, borderBottomWidth: 1.5, borderBottomColor: colors.border }}>
                            <Text style={ss.modalTitle}>Seleccionar Métrica</Text>
                        </View>
                        <ScrollView>
                            {MEASUREMENT_CONFIG.map((cfg) => (
                                <TouchableOpacity
                                    key={cfg.type}
                                    style={[
                                        ss.selectorItem,
                                        quickAddType === cfg.type && { backgroundColor: withAlpha(colors.primary.DEFAULT, '10') }
                                    ]}
                                    onPress={() => {
                                        setQuickAddType(cfg.type);
                                        setShowTypeSelector(false);
                                        Haptics.selectionAsync();
                                    }}
                                >
                                    <View style={[ss.measureIconCircle, { backgroundColor: withAlpha(cfg.color, '15'), width: 32, height: 32 }]}>
                                        <cfg.Icon size={14} color={cfg.color} />
                                    </View>
                                    <Text style={[
                                        ss.selectorText,
                                        quickAddType === cfg.type && { color: colors.primary.DEFAULT, fontWeight: '900' }
                                    ]}>
                                        {cfg.label}
                                    </Text>
                                    {quickAddType === cfg.type && <Plus size={16} color={colors.primary.DEFAULT} />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity
                            style={{ padding: 16, alignItems: 'center', backgroundColor: colors.surface }}
                            onPress={() => setShowTypeSelector(false)}
                        >
                            <Text style={{ fontWeight: '800', color: colors.text }}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>
        </SafeAreaWrapper >
    );
}
