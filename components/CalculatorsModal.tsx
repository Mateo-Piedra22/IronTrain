import { IronInput } from '@/components/IronInput';
import { CalculatorService, OneRMFormula } from '@/src/services/CalculatorService';
import { configService } from '@/src/services/ConfigService';
import { statsService } from '@/src/services/StatsService';
import { UnitService } from '@/src/services/UnitService';
import { X } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '../src/hooks/useColors';

interface CalculatorsModalProps {
    visible: boolean;
    onClose: () => void;
    initialTab?: 'oneRm' | 'warmup' | 'power';
}

export function CalculatorsModal({ visible, onClose, initialTab = 'oneRm' }: CalculatorsModalProps) {
    const colors = useColors();
    const unit = configService.get('weightUnit');
    const rounding = unit === 'kg' ? configService.get('calculatorsRoundingKg') : configService.get('calculatorsRoundingLbs');

    const ss = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.surface },
        inner: { flex: 1, padding: 20 },
        header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
        headerTitle: { fontSize: 24, fontWeight: '900', color: colors.text, letterSpacing: -0.8 },
        headerSubtitle: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
        closeBtn: { width: 36, height: 36, borderRadius: 16, backgroundColor: colors.surfaceLighter, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border },
        tabTrack: { flexDirection: 'row', backgroundColor: colors.surfaceLighter, padding: 4, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, marginBottom: 24 },
        tab: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
        tabActive: { backgroundColor: colors.primary.DEFAULT },
        tabText: { fontWeight: '800', fontSize: 13, color: colors.textMuted },
        tabTextActive: { color: colors.onPrimary },
        sectionTitle: { fontSize: 18, fontWeight: '900', color: colors.text, marginBottom: 14, letterSpacing: -0.4 },
        card: { backgroundColor: colors.surfaceLighter, borderRadius: 24, borderWidth: 1.5, borderColor: colors.border, padding: 20, marginBottom: 24 },
        cardLabel: { fontSize: 10, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10, marginLeft: 2 },
        chipRow: { flexDirection: 'row', gap: 10 },
        chip: { flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surfaceLighter, alignItems: 'center' },
        chipActive: { backgroundColor: colors.primary.DEFAULT, borderColor: colors.primary.DEFAULT },
        chipText: { fontWeight: '800', fontSize: 13, color: colors.textMuted },
        chipTextActive: { color: colors.onPrimary },
        resultBox: { marginTop: 24, backgroundColor: colors.surfaceLighter, padding: 24, borderRadius: 24, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
        resultLabel: { fontSize: 11, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5 },
        resultValue: { fontSize: 48, fontWeight: '900', color: colors.text, letterSpacing: -1.5, marginVertical: 4 },
        resultUnit: { fontSize: 14, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase' },
        tableCard: { backgroundColor: colors.surfaceLighter, borderRadius: 24, borderWidth: 1.5, borderColor: colors.border, overflow: 'hidden', marginBottom: 32 },
        tableHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.background, borderBottomWidth: 1.5, borderBottomColor: colors.border },
        tableHeaderText: { fontSize: 10, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.2 },
        tableRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
        tableRowBorder: { borderBottomWidth: 1.5, borderBottomColor: colors.border },
        tablePct: { fontSize: 17, fontWeight: '900', color: colors.text },
        tableZone: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
        repsBadge: { backgroundColor: colors.background, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border },
        repsText: { fontSize: 14, fontWeight: '900', color: colors.text },
        tableWeight: { fontSize: 20, fontWeight: '900', color: colors.primary.DEFAULT, letterSpacing: -0.6 },
        tableWeightText: { fontSize: 18, fontWeight: '900', color: colors.text },
        inputLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 8, marginLeft: 4 },
        hintText: { fontSize: 12, color: colors.textMuted, marginTop: 14, fontStyle: 'italic', textAlign: 'center' },
        emptyText: { color: colors.textMuted, textAlign: 'center', fontSize: 14, paddingVertical: 20 },
        scoreCard: { flex: 1, backgroundColor: colors.surfaceLighter, padding: 20, borderRadius: 24, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
        scoreLabel: { fontSize: 11, fontWeight: '800', color: colors.primary.DEFAULT, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 },
        scoreValue: { fontSize: 28, fontWeight: '900', color: colors.text, letterSpacing: -0.5 },
    }), [colors]);

    const [activeTab, setActiveTab] = useState<'oneRm' | 'warmup' | 'power'>('oneRm');

    React.useEffect(() => {
        if (visible && initialTab) { setActiveTab(initialTab); }
    }, [visible, initialTab]);

    const [formula, setFormula] = useState<OneRMFormula>(configService.get('calculatorsDefault1RMFormula'));
    const [setWeight, setSetWeight] = useState('');
    const [setReps, setSetReps] = useState('');
    const [oneRmManual, setOneRmManual] = useState(unit === 'kg' ? '100' : '225');
    const [warmupWorking, setWarmupWorking] = useState(unit === 'kg' ? '100' : '225');
    const [warmupBar, setWarmupBar] = useState(String(unit === 'kg' ? configService.get('plateCalculatorDefaultBarWeightKg') : configService.get('plateCalculatorDefaultBarWeightLbs')));
    const [bw, setBw] = useState('');
    const [total, setTotal] = useState('');
    const [isFemale, setIsFemale] = useState(false);

    const percentages = [0.95, 0.90, 0.875, 0.85, 0.825, 0.80, 0.75, 0.70, 0.65, 0.60, 0.50];

    const estFromSet = CalculatorService.estimate1RM(formula, parseFloat(setWeight) || 0, parseFloat(setReps) || 0);
    const oneRm = Math.max(parseFloat(oneRmManual) || 0, estFromSet || 0);
    const table = CalculatorService.percentTable(oneRm, percentages, rounding);

    const bwValue = parseFloat(bw) || 0;
    const totalValue = parseFloat(total) || 0;
    const bwKg = unit === 'kg' ? bwValue : UnitService.lbsToKg(bwValue);
    const totalKg = unit === 'kg' ? totalValue : UnitService.lbsToKg(totalValue);
    const wilks = statsService.calculateWilks(bwKg, totalKg, isFemale);
    const dots = statsService.calculateDOTS(bwKg, totalKg, isFemale);

    const warmup = CalculatorService.warmupSuggestions({ workingWeight: parseFloat(warmupWorking) || 0, barWeight: parseFloat(warmupBar) || 0, rounding });

    const tabs = [
        { id: 'oneRm', label: '1RM' },
        { id: 'warmup', label: 'Warm-up' },
        { id: 'power', label: 'Scores' },
    ] as const;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={ss.container}>
                <View style={ss.inner}>
                    {/* Header */}
                    <View style={ss.header}>
                        <View>
                            <Text style={ss.headerTitle}>Calculadoras</Text>
                            <Text style={ss.headerSubtitle}>Herramientas de entrenamiento</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={ss.closeBtn} accessibilityRole="button" accessibilityLabel="Cerrar calculadoras">
                            <X color={colors.text} size={20} />
                        </TouchableOpacity>
                    </View>

                    {/* Tabs */}
                    <View style={ss.tabTrack}>
                        {tabs.map((t) => (
                            <TouchableOpacity
                                key={t.id}
                                style={[ss.tab, activeTab === t.id && ss.tabActive]}
                                onPress={() => setActiveTab(t.id)}
                                accessibilityRole="button"
                                accessibilityLabel={`Abrir ${t.label}`}
                            >
                                <Text style={[ss.tabText, activeTab === t.id && ss.tabTextActive]}>{t.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                        {activeTab === 'oneRm' ? (
                            <View>
                                <Text style={ss.sectionTitle}>Estimación de 1RM</Text>
                                <View style={ss.card}>
                                    <Text style={ss.cardLabel}>Fórmula</Text>
                                    <View style={ss.chipRow}>
                                        {([{ id: 'epley', label: 'Epley' }, { id: 'brzycki', label: 'Brzycki' }, { id: 'lombardi', label: 'Lombardi' }] as const).map((f) => (
                                            <TouchableOpacity
                                                key={f.id}
                                                onPress={() => { setFormula(f.id); configService.set('calculatorsDefault1RMFormula', f.id); }}
                                                style={[ss.chip, formula === f.id && ss.chipActive]}
                                                accessibilityRole="button"
                                            >
                                                <Text style={[ss.chipText, formula === f.id && ss.chipTextActive]}>{f.label}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <Text style={[ss.cardLabel, { marginTop: 16 }]}>Desde una serie</Text>
                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                        <View style={{ flex: 1 }}><IronInput value={setWeight} onChangeText={setSetWeight} keyboardType="numeric" placeholder={`Peso (${unit})`} /></View>
                                        <View style={{ flex: 1 }}><IronInput value={setReps} onChangeText={setSetReps} keyboardType="numeric" placeholder="Reps" /></View>
                                    </View>

                                    <Text style={[ss.cardLabel, { marginTop: 16 }]}>1RM manual</Text>
                                    <IronInput value={oneRmManual} onChangeText={setOneRmManual} keyboardType="numeric" placeholder={`1RM (${unit})`} />

                                    {/* Result */}
                                    <View style={ss.resultBox}>
                                        <Text style={ss.resultLabel}>TU 1RM ACTUAL</Text>
                                        <Text style={ss.resultValue}>{Math.round(oneRm)}</Text>
                                        <Text style={ss.resultUnit}>{unit}</Text>
                                    </View>
                                </View>

                                <Text style={ss.sectionTitle}>Perfil de Intensidades</Text>
                                <View style={ss.tableCard}>
                                    <View style={ss.tableHeader}>
                                        <Text style={[ss.tableHeaderText, { flex: 1.2 }]}>INTENSIDAD</Text>
                                        <Text style={[ss.tableHeaderText, { flex: 1, textAlign: 'center' }]}>REPS</Text>
                                        <Text style={[ss.tableHeaderText, { flex: 1.5, textAlign: 'right' }]}>PESO ({unit})</Text>
                                    </View>
                                    {[
                                        { pct: 1.00, reps: '1', zone: 'MÁXIMA', color: colors.red },
                                        { pct: 0.95, reps: '2', zone: 'MÁXIMA', color: colors.red },
                                        { pct: 0.90, reps: '4', zone: 'FUERZA', color: colors.blue },
                                        { pct: 0.85, reps: '6', zone: 'FUERZA', color: colors.blue },
                                        { pct: 0.80, reps: '8', zone: 'HIPERTROFIA', color: colors.green },
                                        { pct: 0.75, reps: '10', zone: 'HIPERTROFIA', color: colors.green },
                                        { pct: 0.70, reps: '12', zone: 'RESISTENCIA', color: colors.primary.light },
                                        { pct: 0.65, reps: '16', zone: 'RESISTENCIA', color: colors.primary.light },
                                        { pct: 0.60, reps: '20', zone: 'TÉCNICA', color: colors.textMuted },
                                        { pct: 0.50, reps: '30+', zone: 'TÉCNICA', color: colors.textMuted },
                                    ].map((row, idx, arr) => {
                                        const weight = CalculatorService.roundToIncrement(oneRm * row.pct, rounding);
                                        return (
                                            <View key={row.pct} style={[ss.tableRow, idx < arr.length - 1 && ss.tableRowBorder]}>
                                                <View style={{ flex: 1.2, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                    <View style={{ width: 4, height: 24, backgroundColor: row.color, borderRadius: 2 }} />
                                                    <View>
                                                        <Text style={ss.tablePct}>{Math.round(row.pct * 100)}%</Text>
                                                        <Text style={[ss.tableZone, { color: row.color }]}>{row.zone}</Text>
                                                    </View>
                                                </View>
                                                <View style={{ flex: 1, alignItems: 'center' }}>
                                                    <View style={ss.repsBadge}>
                                                        <Text style={ss.repsText}>{row.reps}</Text>
                                                    </View>
                                                </View>
                                                <Text style={[ss.tableWeight, { flex: 1.5, textAlign: 'right' }]}>{weight}</Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            </View>
                        ) : activeTab === 'warmup' ? (
                            <View>
                                <Text style={ss.sectionTitle}>Warm-up</Text>
                                <View style={ss.card}>
                                    <Text style={ss.cardLabel}>Peso de trabajo</Text>
                                    <IronInput value={warmupWorking} onChangeText={setWarmupWorking} keyboardType="numeric" placeholder={unit === 'kg' ? '100' : '225'} />
                                    <Text style={[ss.cardLabel, { marginTop: 16 }]}>Barra</Text>
                                    <IronInput value={warmupBar} onChangeText={setWarmupBar} keyboardType="numeric" placeholder={unit === 'kg' ? '20' : '45'} />
                                    <Text style={ss.hintText}>Redondeo: {rounding} {unit}</Text>
                                </View>

                                <View style={ss.tableCard}>
                                    {warmup.length > 0 ? warmup.map((ws, idx) => (
                                        <View key={`${ws.weight}-${idx}`} style={[ss.tableRow, idx < warmup.length - 1 && ss.tableRowBorder]}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.yellow }} />
                                                <Text style={ss.tableWeightText}>{ws.weight} {unit}</Text>
                                            </View>
                                            <Text style={ss.tablePct}>{ws.reps} reps</Text>
                                        </View>
                                    )) : (
                                        <View style={{ padding: 20 }}>
                                            <Text style={ss.emptyText}>Ingresa un peso de trabajo válido.</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        ) : (
                            <View>
                                <Text style={ss.sectionTitle}>Power Scores</Text>
                                <View style={{ marginBottom: 20 }}>
                                    <Text style={ss.inputLabel}>Género</Text>
                                    <View style={ss.chipRow}>
                                        <TouchableOpacity
                                            onPress={() => setIsFemale(false)}
                                            style={[ss.chip, !isFemale && ss.chipActive]}
                                            accessibilityRole="button"
                                        >
                                            <Text style={[ss.chipText, !isFemale && ss.chipTextActive]}>Masculino</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => setIsFemale(true)}
                                            style={[ss.chip, isFemale && ss.chipActive]}
                                            accessibilityRole="button"
                                        >
                                            <Text style={[ss.chipText, isFemale && ss.chipTextActive]}>Femenino</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={ss.inputLabel}>Peso corporal ({unit})</Text>
                                        <IronInput value={bw} onChangeText={setBw} keyboardType="numeric" placeholder={unit === 'kg' ? '80' : '180'} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={ss.inputLabel}>Total SBD</Text>
                                        <IronInput value={total} onChangeText={setTotal} keyboardType="numeric" placeholder={unit === 'kg' ? '500' : '1100'} />
                                    </View>
                                </View>


                                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                                    <View style={ss.scoreCard}>
                                        <Text style={ss.scoreLabel}>WILKS</Text>
                                        <Text style={ss.scoreValue}>{Number.isFinite(wilks) ? wilks.toFixed(2) : '0.00'}</Text>
                                    </View>
                                    <View style={ss.scoreCard}>
                                        <Text style={ss.scoreLabel}>DOTS</Text>
                                        <Text style={ss.scoreValue}>{Number.isFinite(dots) ? dots.toFixed(2) : '0.00'}</Text>
                                    </View>
                                </View>

                                <Text style={ss.hintText}>*Wilks/DOTS se calculan en kg internamente.</Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </SafeAreaView>
        </Modal>
    );
}
