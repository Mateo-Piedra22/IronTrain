import { IronInput } from '@/components/IronInput';
import { CalculatorService, OneRMFormula } from '@/src/services/CalculatorService';
import { configService } from '@/src/services/ConfigService';
import { statsService } from '@/src/services/StatsService';
import { UnitService } from '@/src/services/UnitService';
import { Colors } from '@/src/theme';
import { X } from 'lucide-react-native';
import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface CalculatorsModalProps {
    visible: boolean;
    onClose: () => void;
    initialTab?: 'oneRm' | 'warmup' | 'power';
}

export function CalculatorsModal({ visible, onClose, initialTab = 'oneRm' }: CalculatorsModalProps) {
    const unit = configService.get('weightUnit');
    const rounding = unit === 'kg' ? configService.get('calculatorsRoundingKg') : configService.get('calculatorsRoundingLbs');

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

    const percentages = [0.95, 0.90, 0.875, 0.85, 0.825, 0.80, 0.75, 0.70, 0.65, 0.60, 0.50];
    const estFromSet = CalculatorService.estimate1RM(formula, parseFloat(setWeight) || 0, parseFloat(setReps) || 0);
    const oneRm = Math.max(parseFloat(oneRmManual) || 0, estFromSet || 0);
    const table = CalculatorService.percentTable(oneRm, percentages, rounding);

    const bwValue = parseFloat(bw) || 0;
    const totalValue = parseFloat(total) || 0;
    const bwKg = unit === 'kg' ? bwValue : UnitService.lbsToKg(bwValue);
    const totalKg = unit === 'kg' ? totalValue : UnitService.lbsToKg(totalValue);
    const wilks = statsService.calculateWilks(bwKg, totalKg);
    const dots = statsService.calculateDOTS(bwKg, totalKg);

    const warmup = CalculatorService.warmupSuggestions({ workingWeight: parseFloat(warmupWorking) || 0, barWeight: parseFloat(warmupBar) || 0, rounding });



    const tabs = [
        { id: 'oneRm', label: '1RM' },
        { id: 'warmup', label: 'Warm-up' },
        { id: 'power', label: 'Scores' },
    ] as const;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={s.container}>
                <View style={s.inner}>
                    {/* Header */}
                    <View style={s.header}>
                        <View>
                            <Text style={s.headerTitle}>Calculadoras</Text>
                            <Text style={s.headerSubtitle}>Herramientas de entrenamiento</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={s.closeBtn} accessibilityRole="button" accessibilityLabel="Cerrar calculadoras">
                            <X color="white" size={20} />
                        </TouchableOpacity>
                    </View>

                    {/* Tabs */}
                    <View style={s.tabTrack}>
                        {tabs.map((t) => (
                            <TouchableOpacity
                                key={t.id}
                                style={[s.tab, activeTab === t.id && s.tabActive]}
                                onPress={() => setActiveTab(t.id)}
                                accessibilityRole="button"
                                accessibilityLabel={`Abrir ${t.label}`}
                            >
                                <Text style={[s.tabText, activeTab === t.id && s.tabTextActive]}>{t.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                        {activeTab === 'oneRm' ? (
                            <View>
                                <Text style={s.sectionTitle}>Estimación de 1RM</Text>
                                <View style={s.card}>
                                    <Text style={s.cardLabel}>Fórmula</Text>
                                    <View style={s.chipRow}>
                                        {([{ id: 'epley', label: 'Epley' }, { id: 'brzycki', label: 'Brzycki' }, { id: 'lombardi', label: 'Lombardi' }] as const).map((f) => (
                                            <TouchableOpacity
                                                key={f.id}
                                                onPress={() => { setFormula(f.id); configService.set('calculatorsDefault1RMFormula', f.id); }}
                                                style={[s.chip, formula === f.id && s.chipActive]}
                                                accessibilityRole="button"
                                            >
                                                <Text style={[s.chipText, formula === f.id && s.chipTextActive]}>{f.label}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <Text style={[s.cardLabel, { marginTop: 16 }]}>Desde una serie</Text>
                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                        <View style={{ flex: 1 }}><IronInput value={setWeight} onChangeText={setSetWeight} keyboardType="numeric" placeholder={`Peso (${unit})`} /></View>
                                        <View style={{ flex: 1 }}><IronInput value={setReps} onChangeText={setSetReps} keyboardType="numeric" placeholder="Reps" /></View>
                                    </View>

                                    <Text style={[s.cardLabel, { marginTop: 16 }]}>1RM manual</Text>
                                    <IronInput value={oneRmManual} onChangeText={setOneRmManual} keyboardType="numeric" placeholder={`1RM (${unit})`} />

                                    {/* Result */}
                                    <View style={s.resultBox}>
                                        <Text style={s.resultLabel}>1RM USADO</Text>
                                        <Text style={s.resultValue}>{Math.round(oneRm)}</Text>
                                        <Text style={s.resultUnit}>{unit}</Text>
                                    </View>
                                </View>

                                <Text style={s.sectionTitle}>Porcentajes</Text>
                                <View style={s.tableCard}>
                                    <View style={s.tableHeader}>
                                        <Text style={s.tableHeaderText}>%</Text>
                                        <Text style={[s.tableHeaderText, { textAlign: 'right' }]}>PESO</Text>
                                    </View>
                                    {table.map((row, idx) => (
                                        <View key={row.pct} style={[s.tableRow, idx < table.length - 1 && s.tableRowBorder]}>
                                            <Text style={s.tablePct}>{Math.round(row.pct * 100)}%</Text>
                                            <Text style={s.tableWeight}>{row.weight} {unit}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        ) : activeTab === 'warmup' ? (
                            <View>
                                <Text style={s.sectionTitle}>Warm-up</Text>
                                <View style={s.card}>
                                    <Text style={s.cardLabel}>Peso de trabajo</Text>
                                    <IronInput value={warmupWorking} onChangeText={setWarmupWorking} keyboardType="numeric" placeholder={unit === 'kg' ? '100' : '225'} />
                                    <Text style={[s.cardLabel, { marginTop: 16 }]}>Barra</Text>
                                    <IronInput value={warmupBar} onChangeText={setWarmupBar} keyboardType="numeric" placeholder={unit === 'kg' ? '20' : '45'} />
                                    <Text style={s.hintText}>Redondeo: {rounding} {unit}</Text>
                                </View>

                                <View style={s.tableCard}>
                                    {warmup.length > 0 ? warmup.map((ws, idx) => (
                                        <View key={`${ws.weight}-${idx}`} style={[s.tableRow, idx < warmup.length - 1 && s.tableRowBorder]}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#eab308' }} />
                                                <Text style={s.tableWeight}>{ws.weight} {unit}</Text>
                                            </View>
                                            <Text style={s.tablePct}>{ws.reps} reps</Text>
                                        </View>
                                    )) : (
                                        <View style={{ padding: 20 }}>
                                            <Text style={s.emptyText}>Ingresa un peso de trabajo válido.</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        ) : (
                            <View>
                                <Text style={s.sectionTitle}>Power Scores</Text>
                                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.inputLabel}>Peso corporal ({unit})</Text>
                                        <IronInput value={bw} onChangeText={setBw} keyboardType="numeric" placeholder={unit === 'kg' ? '80' : '180'} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.inputLabel}>Total SBD</Text>
                                        <IronInput value={total} onChangeText={setTotal} keyboardType="numeric" placeholder={unit === 'kg' ? '500' : '1100'} />
                                    </View>
                                </View>

                                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                                    <View style={s.scoreCard}>
                                        <Text style={s.scoreLabel}>WILKS</Text>
                                        <Text style={s.scoreValue}>{Number.isFinite(wilks) ? wilks.toFixed(2) : '0.00'}</Text>
                                    </View>
                                    <View style={s.scoreCard}>
                                        <Text style={s.scoreLabel}>DOTS</Text>
                                        <Text style={s.scoreValue}>{Number.isFinite(dots) ? dots.toFixed(2) : '0.00'}</Text>
                                    </View>
                                </View>

                                <Text style={s.hintText}>*Wilks/DOTS se calculan en kg internamente.</Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.iron[900] },
    inner: { flex: 1, padding: 16 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    headerTitle: { fontSize: 22, fontWeight: '900', color: Colors.iron[950], letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 11, fontWeight: '600', color: Colors.iron[400], marginTop: 2 },
    closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary.DEFAULT, justifyContent: 'center', alignItems: 'center' },
    tabTrack: { flexDirection: 'row', backgroundColor: Colors.surface, padding: 4, borderRadius: 14, borderWidth: 1, borderColor: Colors.iron[700], marginBottom: 20 },
    tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
    tabActive: { backgroundColor: Colors.primary.DEFAULT, shadowColor: Colors.primary.DEFAULT, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 2 },
    tabText: { fontWeight: '800', fontSize: 13, color: Colors.iron[500] },
    tabTextActive: { color: '#fff' },
    sectionTitle: { fontSize: 17, fontWeight: '900', color: Colors.iron[950], marginBottom: 12, letterSpacing: -0.3 },
    card: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.iron[700], padding: 20, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
    cardLabel: { fontSize: 10, fontWeight: '800', color: Colors.iron[500], textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
    chipRow: { flexDirection: 'row', gap: 8 },
    chip: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.iron[300], backgroundColor: Colors.iron[200], alignItems: 'center' },
    chipActive: { backgroundColor: Colors.primary.DEFAULT, borderColor: Colors.primary.DEFAULT },
    chipText: { fontWeight: '800', fontSize: 13, color: Colors.iron[500] },
    chipTextActive: { color: '#fff' },
    resultBox: { marginTop: 20, backgroundColor: Colors.iron[200], padding: 20, borderRadius: 14, borderWidth: 1, borderColor: Colors.iron[300], alignItems: 'center' },
    resultLabel: { fontSize: 10, fontWeight: '800', color: Colors.iron[500], textTransform: 'uppercase', letterSpacing: 1 },
    resultValue: { fontSize: 40, fontWeight: '900', color: Colors.iron[950], letterSpacing: -1, marginTop: 4 },
    resultUnit: { fontSize: 12, fontWeight: '700', color: Colors.iron[400], textTransform: 'uppercase' },
    tableCard: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.iron[700], overflow: 'hidden', marginBottom: 24, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
    tableHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.iron[200], borderBottomWidth: 1, borderBottomColor: Colors.iron[300] },
    tableHeaderText: { fontSize: 10, fontWeight: '800', color: Colors.iron[500], textTransform: 'uppercase', letterSpacing: 1, flex: 1 },
    tableRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
    tableRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.iron[200] },
    tablePct: { fontSize: 14, fontWeight: '700', color: Colors.iron[500] },
    tableWeight: { fontSize: 16, fontWeight: '900', color: Colors.iron[950] },
    inputLabel: { fontSize: 12, fontWeight: '700', color: Colors.iron[500], marginBottom: 6 },
    hintText: { fontSize: 11, color: Colors.iron[400], marginTop: 12, fontStyle: 'italic' },
    emptyCard: { padding: 24, backgroundColor: Colors.iron[200], borderRadius: 16, borderWidth: 1, borderColor: Colors.iron[300] },
    emptyText: { color: Colors.iron[500], textAlign: 'center', fontSize: 13 },
    scoreCard: { flex: 1, backgroundColor: Colors.iron[200], padding: 20, borderRadius: 14, borderWidth: 1, borderColor: Colors.iron[300], alignItems: 'center' },
    scoreLabel: { fontSize: 10, fontWeight: '800', color: Colors.primary.DEFAULT, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
    scoreValue: { fontSize: 28, fontWeight: '900', color: Colors.iron[950], letterSpacing: -0.5 },
});
