import { ColorPicker } from '@/components/ui/ColorPicker';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { configService } from '@/src/services/ConfigService';
import { PlateCalculatorService, PlateLoadout } from '@/src/services/PlateCalculatorService';
import { settingsService } from '@/src/services/SettingsService';
import { Colors } from '@/src/theme';
import { PlateInventory, PlateType } from '@/src/types/db';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { ChevronDown, ChevronLeft, ChevronUp, Disc, PaintBucket, Plus, Settings, Trash2, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const getPlateColor = (weight: number, unit: string, type?: PlateType) => {
    if (!type || type === 'standard') return '#3f3f46';

    const w = unit === 'kg' ? weight : weight / 2.20462;
    if (w >= 25) return '#ef4444'; // Red
    if (w >= 20) return '#3b82f6'; // Blue
    if (w >= 15) return '#eab308'; // Yellow
    if (w >= 10) return '#22c55e'; // Green
    if (w >= 5) return '#f4f4f5';  // White
    if (w >= 2.5) return '#1c1917'; // Black
    return '#d4d4d8';              // Silver
};

const getPlateGeometry = (weight: number, unit: string, type?: PlateType) => {
    const val = unit === 'kg' ? weight : weight / 2.20462;

    if (type === 'bumper') {
        const height = val >= 10 ? 90 : Math.min(80, 40 + (val * 2));
        const width = Math.max(12, val * 1.5);
        return { height, width };
    }

    if (type === 'calibrated') {
        const height = val >= 20 ? 90 : val >= 15 ? 80 : val >= 10 ? 65 : 45;
        const width = Math.max(8, val / 1.8);
        return { height, width };
    }

    // Standard
    const height = Math.min(80, 25 + (val * 1.5));
    const width = Math.max(10, val / 1.3);
    return { height, width };
};

export default function PlateCalculator() {
    const router = useRouter();
    const [unit, setUnit] = useState(configService.get('weightUnit'));
    const [targetWeight, setTargetWeight] = useState('');
    const [barWeight, setBarWeight] = useState('20');
    const [activeLoadout, setActiveLoadout] = useState<PlateLoadout | null>(null);
    const [exactAlternatives, setExactAlternatives] = useState<PlateLoadout[]>([]);
    const [closestBelow, setClosestBelow] = useState<PlateLoadout | null>(null);
    const [closestAbove, setClosestAbove] = useState<PlateLoadout | null>(null);
    const [inventory, setInventory] = useState<PlateInventory[]>([]);
    const [isSettingsVisible, setIsSettingsVisible] = useState(false);
    const [editingPlate, setEditingPlate] = useState<{ weight: string, count: string, color?: string, type?: PlateType, originalWeight?: number, originalType?: PlateType } | null>(null);
    const [isColorPickerVisible, setIsColorPickerVisible] = useState(false);
    const [preferFewerPlates, setPreferFewerPlates] = useState(configService.get('plateCalculatorPreferFewerPlates'));

    useEffect(() => { loadInventory(); }, []);

    useFocusEffect(useCallback(() => {
        const nextUnit = configService.get('weightUnit');
        setUnit(nextUnit);
        const defaultBar = nextUnit === 'kg' ? configService.get('plateCalculatorDefaultBarWeightKg') : configService.get('plateCalculatorDefaultBarWeightLbs');
        setBarWeight(String(defaultBar));
    }, []));

    const loadInventory = async () => {
        let inv = await settingsService.getPlateInventory();
        if (inv.length === 0) { await settingsService.seedDefaultInventory(); inv = await settingsService.getPlateInventory(); }
        setInventory(inv);
    };

    const calculate = () => {
        const target = parseFloat(targetWeight);
        const bar = parseFloat(barWeight);
        if (isNaN(target) || isNaN(bar) || target <= bar) { setActiveLoadout(null); setExactAlternatives([]); setClosestBelow(null); setClosestAbove(null); return; }
        const filteredInventory = inventory.filter((p) => p.unit === unit);
        const result = PlateCalculatorService.calculate({ targetWeight: target, barWeight: bar, inventory: filteredInventory, maxSolutions: 6, preferFewerPlates });
        setActiveLoadout(result.exact[0] ?? null);
        setExactAlternatives(result.exact.slice(1));
        setClosestBelow(result.closestBelow);
        setClosestAbove(result.closestAbove);
    };

    const updateInventory = async (weight: number, delta: number) => {
        const updated = inventory.map(p => p.weight === weight && p.unit === unit ? { ...p, count: Math.max(0, p.count + delta) } : p);
        setInventory(updated);
        await settingsService.updatePlateInventory(updated);
    };

    const savePlateEditor = async () => {
        if (!editingPlate) return;
        const w = parseFloat(editingPlate.weight);
        const c = parseInt(editingPlate.count);
        if (isNaN(w) || isNaN(c) || w <= 0 || c < 0) return;

        let newInv = [...inventory];
        // If editing existing, remove old one first
        if (editingPlate.originalWeight !== undefined) {
            newInv = newInv.filter((p) => !(p.weight === editingPlate.originalWeight && p.unit === unit && p.type === (editingPlate.originalType || 'standard')));
        }

        // Add new one
        const plateType = editingPlate.type || 'standard';
        const existingIdx = newInv.findIndex((p) => p.weight === w && p.unit === unit && p.type === plateType);
        if (existingIdx >= 0) {
            newInv[existingIdx] = { ...newInv[existingIdx], count: c, color: editingPlate.color };
        } else {
            newInv.push({ weight: w, count: c, type: plateType, unit: unit as any, color: editingPlate.color });
        }

        newInv.sort((a, b) => b.weight - a.weight);
        setInventory(newInv);
        await settingsService.updatePlateInventory(newInv);
        setEditingPlate(null);
    };

    const deletePlateEditor = async () => {
        if (!editingPlate || editingPlate.originalWeight === undefined) return;
        const newInv = inventory.filter((p) => !(p.weight === editingPlate.originalWeight && p.unit === unit && p.type === (editingPlate.originalType || 'standard')));
        setInventory(newInv);
        await settingsService.updatePlateInventory(newInv);
        setEditingPlate(null);
    };

    useEffect(() => { if (activeLoadout || closestBelow || closestAbove) calculate(); }, [inventory]);
    useEffect(() => { configService.set('plateCalculatorPreferFewerPlates', preferFewerPlates); if (activeLoadout || closestBelow || closestAbove) calculate(); }, [preferFewerPlates]);

    const inventoryForUnit = inventory.filter((p) => p.unit === unit);
    const hasInventoryForUnit = inventoryForUnit.some((p) => p.count > 0);
    const hasOddCounts = inventoryForUnit.some((p) => (p.count ?? 0) % 2 !== 0);
    const normalizeToPairs = async () => {
        const updated = inventory.map((p) => { if (p.unit !== unit) return p; const count = p.count ?? 0; if (count % 2 === 0) return p; return { ...p, count: Math.max(0, count - 1) }; });
        setInventory(updated);
        await settingsService.updatePlateInventory(updated);
    };

    const renderLoadout = (loadout: PlateLoadout, label: string) => (
        <View style={ss.card}>
            <View style={ss.loadoutHeader}>
                <Text style={ss.loadoutLabel}>{label}</Text>
                <Text style={ss.loadoutTotal}>{loadout.totalWeight} {unit}</Text>
            </View>

            {/* Bar visualization */}
            <View style={ss.barVis}>
                <View style={ss.barLine} />
                <View style={ss.platesRow}>
                    <View style={ss.collar} />
                    {loadout.perSide.map((p, i) => (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
                            {Array.from({ length: p.pairs }).map((_, j) => {
                                const geo = getPlateGeometry(p.plate, unit, p.type);
                                return (
                                    <View key={`${i}-${j}`} style={{
                                        height: geo.height, width: geo.width,
                                        backgroundColor: p.color || getPlateColor(p.plate, unit, p.type),
                                        borderColor: '#00000020', borderWidth: 1, borderRadius: 3,
                                    }} />
                                );
                            })}
                        </View>
                    ))}
                </View>
            </View>

            {/* Plate list */}
            <View style={{ marginTop: 14 }}>
                {loadout.perSide.map((p, idx) => (
                    <View key={idx} style={[ss.plateRow, idx < loadout.perSide.length - 1 && ss.plateRowBorder]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: p.color || getPlateColor(p.plate, unit, p.type), borderWidth: 1, borderColor: '#00000020' }} />
                            <Text style={ss.plateWeight}>{p.plate} {unit}</Text>
                            {p.type && p.type !== 'standard' && (
                                <View style={{ backgroundColor: getPlateColor(p.plate, unit, p.type) + '20', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                                    <Text style={{ fontSize: 8, fontWeight: '800', color: getPlateColor(p.plate, unit, p.type), textTransform: 'uppercase' }}>{p.type === 'bumper' ? 'BMP' : 'CAL'}</Text>
                                </View>
                            )}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={ss.plateBadge}><Text style={ss.plateBadgeText}>×{p.pairs}/lado</Text></View>
                            <Text style={ss.plateCount}>{p.pairs * 2} discos</Text>
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );

    return (
        <SafeAreaWrapper style={{ backgroundColor: Colors.iron[900] }} edges={['top', 'left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40, paddingTop: 16 }}>
                <View style={{ marginBottom: 24, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                        <TouchableOpacity onPress={() => router.back()} style={ss.backBtn} accessibilityRole="button" accessibilityLabel="Volver">
                            <ChevronLeft size={20} color={Colors.iron[950]} />
                        </TouchableOpacity>
                        <View>
                            <Text style={ss.pageTitle}>Discos</Text>
                            <Text style={ss.pageSub}>Armado e inventario</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={() => setIsSettingsVisible(true)}
                        style={ss.backBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Abrir inventario de discos"
                    >
                        <Settings color={Colors.iron[950]} size={20} />
                    </TouchableOpacity>
                </View>

                {/* Target weight input */}
                <View style={ss.inputSection}>
                    <Text style={ss.inputLabel}>Peso objetivo ({unit})</Text>
                    <TextInput
                        style={ss.bigInput}
                        placeholder={unit === 'kg' ? '100' : '225'}
                        placeholderTextColor={Colors.iron[400]}
                        keyboardType="numeric"
                        value={targetWeight}
                        onChangeText={setTargetWeight}
                        onEndEditing={calculate}
                        accessibilityLabel="Ingresar peso objetivo"
                    />
                </View>

                {/* Bar weight */}
                <View style={ss.inputSection}>
                    <Text style={ss.inputLabel}>Barra ({unit})</Text>
                    <View style={ss.barChipRow}>
                        {(unit === 'kg' ? ['20', '15', '10'] : ['45', '35', '25']).map(w => (
                            <Pressable
                                key={w}
                                onPress={() => { setBarWeight(w); setTimeout(calculate, 0); }}
                                style={[ss.barChip, barWeight === w && ss.barChipActive]}
                                accessibilityRole="button"
                            >
                                <Text style={[ss.barChipText, barWeight === w && ss.barChipTextActive]}>{w}{unit}</Text>
                            </Pressable>
                        ))}
                    </View>
                    <TextInput
                        style={ss.smallInput}
                        placeholder="Barra personalizada"
                        placeholderTextColor={Colors.iron[400]}
                        keyboardType="numeric"
                        value={barWeight}
                        onChangeText={setBarWeight}
                        onEndEditing={calculate}
                        accessibilityLabel="Ingresar peso de barra personalizada"
                    />
                </View>

                {/* Calculate CTA */}
                <Pressable onPress={calculate} style={ss.calcBtn} accessibilityRole="button" accessibilityLabel="Calcular discos">
                    <Disc size={18} color="#fff" />
                    <Text style={ss.calcBtnText}>CALCULAR</Text>
                </Pressable>

                {/* Empty inventory warning */}
                {!hasInventoryForUnit && (
                    <View style={[ss.card, { marginBottom: 16 }]}>
                        <Text style={{ color: Colors.iron[950], fontWeight: '800', fontSize: 14, marginBottom: 4 }}>Inventario vacío ({unit})</Text>
                        <Text style={{ color: Colors.iron[400], fontSize: 12, lineHeight: 18 }}>Abre el inventario y agrega tus discos para este sistema de unidades.</Text>
                    </View>
                )}

                {/* Results */}
                {activeLoadout && renderLoadout(activeLoadout, 'ARMADO RECOMENDADO')}

                {!activeLoadout && (closestBelow || closestAbove) && (
                    <View style={[ss.card, { marginBottom: 16 }]}>
                        <Text style={{ color: Colors.iron[950], fontWeight: '800', fontSize: 14, marginBottom: 14 }}>No se puede llegar exacto</Text>
                        {closestBelow && (
                            <View style={{ marginBottom: closestAbove ? 14 : 0 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                    <ChevronDown size={14} color="#ef4444" />
                                    <Text style={{ color: Colors.iron[950], fontWeight: '700', fontSize: 13 }}>Más cercano por debajo: {closestBelow.totalWeight} {unit}</Text>
                                </View>
                                {closestBelow.perSide.map((p) => (
                                    <View key={`b-${p.plate}-${p.type}`} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.color || getPlateColor(p.plate, unit, p.type) }} />
                                            <Text style={{ color: Colors.iron[950], fontWeight: '700' }}>{p.plate} {unit}</Text>
                                            {p.type && p.type !== 'standard' && (
                                                <Text style={{ fontSize: 9, fontWeight: '800', color: Colors.iron[400], textTransform: 'uppercase' }}>{p.type === 'bumper' ? 'BMP' : 'CAL'}</Text>
                                            )}
                                        </View>
                                        <Text style={{ color: Colors.iron[400], fontWeight: '700' }}>×{p.pairs}/lado</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                        {closestAbove && (
                            <View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                    <ChevronUp size={14} color="#22c55e" />
                                    <Text style={{ color: Colors.iron[950], fontWeight: '700', fontSize: 13 }}>Más cercano por arriba: {closestAbove.totalWeight} {unit}</Text>
                                </View>
                                {closestAbove.perSide.map((p) => (
                                    <View key={`a-${p.plate}-${p.type}`} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.color || getPlateColor(p.plate, unit, p.type) }} />
                                            <Text style={{ color: Colors.iron[950], fontWeight: '700' }}>{p.plate} {unit}</Text>
                                            {p.type && p.type !== 'standard' && (
                                                <Text style={{ fontSize: 9, fontWeight: '800', color: Colors.iron[400], textTransform: 'uppercase' }}>{p.type === 'bumper' ? 'BMP' : 'CAL'}</Text>
                                            )}
                                        </View>
                                        <Text style={{ color: Colors.iron[400], fontWeight: '700' }}>×{p.pairs}/lado</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                )}

                {exactAlternatives.length > 0 && (
                    <View style={[ss.card, { marginBottom: 24 }]}>
                        <Text style={{ color: Colors.iron[950], fontWeight: '800', fontSize: 14, marginBottom: 12 }}>Alternativas exactas</Text>
                        {exactAlternatives.map((l, idx) => (
                            <Pressable key={idx} onPress={() => setActiveLoadout(l)} style={[ss.altRow, idx < exactAlternatives.length - 1 && ss.plateRowBorder]} accessibilityRole="button">
                                <Text style={{ color: Colors.iron[950], fontWeight: '800', fontSize: 14 }}>{l.totalWeight} {unit}</Text>
                                <Text style={{ color: Colors.iron[400], fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                                    {l.perSide.map((p) => `${p.plate}${unit} ×${p.pairs}`).join(' · ')}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                )}

                {/* Settings/Inventory Modal */}
                <Modal visible={isSettingsVisible} animationType="slide" presentationStyle="formSheet">
                    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={ss.modalContainer}>
                        <View style={{ flex: 1, padding: 16 }}>
                            {/* Modal Header */}
                            <View style={ss.modalHeader}>
                                <View>
                                    <Text style={ss.modalTitle}>{editingPlate ? (editingPlate.originalWeight ? 'Editar Disco' : 'Nuevo Disco') : 'Inventario de discos'}</Text>
                                    <Text style={ss.modalSub}>{editingPlate ? 'Ajusta peso, color y cantidad' : 'Gestiona tus discos disponibles'}</Text>
                                </View>
                                <TouchableOpacity onPress={() => { editingPlate ? setEditingPlate(null) : setIsSettingsVisible(false) }} style={ss.modalCloseBtn} accessibilityRole="button">
                                    <X color={Colors.iron[950]} size={18} />
                                </TouchableOpacity>
                            </View>

                            {editingPlate ? (
                                <View style={{ flex: 1 }}>
                                    <View style={ss.card}>
                                        <Text style={ss.invSectionTitle}>Peso del disco ({unit})</Text>
                                        <TextInput
                                            style={[ss.smallInput, { marginBottom: 16 }]}
                                            placeholder="Ej: 20"
                                            placeholderTextColor={Colors.iron[400]}
                                            keyboardType="numeric"
                                            value={editingPlate.weight}
                                            onChangeText={(t) => setEditingPlate({ ...editingPlate, weight: t })}
                                        />

                                        <Text style={ss.invSectionTitle}>Cantidad (total)</Text>
                                        <TextInput
                                            style={[ss.smallInput, { marginBottom: 16 }]}
                                            placeholder="Ej: 2"
                                            placeholderTextColor={Colors.iron[400]}
                                            keyboardType="numeric"
                                            value={editingPlate.count}
                                            onChangeText={(t) => setEditingPlate({ ...editingPlate, count: t })}
                                        />

                                        <Text style={ss.invSectionTitle}>Color (opcional)</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                                            <TouchableOpacity
                                                style={[ss.colorBtn, { backgroundColor: editingPlate.color || getPlateColor(parseFloat(editingPlate.weight) || 0, unit, editingPlate.type) }]}
                                                onPress={() => setIsColorPickerVisible(true)}
                                            >
                                                <PaintBucket size={18} color={editingPlate.color ? '#fff' : '#000'} />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => setEditingPlate({ ...editingPlate, color: undefined })}>
                                                <Text style={{ color: Colors.iron[400], fontWeight: '700', fontSize: 12 }}>RESTABLECER AUTO</Text>
                                            </TouchableOpacity>
                                        </View>

                                        <Text style={ss.invSectionTitle}>Tipo de disco</Text>
                                        <View style={ss.barChipRow}>
                                            {[
                                                { val: 'standard', label: 'Estándar' },
                                                { val: 'bumper', label: 'Bumper' },
                                                { val: 'calibrated', label: 'Calibrado' }
                                            ].map(opt => {
                                                const isActive = (editingPlate.type || 'standard') === opt.val;
                                                return (
                                                    <Pressable
                                                        key={opt.val}
                                                        onPress={() => setEditingPlate({ ...editingPlate, type: opt.val as PlateType })}
                                                        style={[ss.barChip, { paddingVertical: 10 }, isActive && ss.barChipActive]}
                                                    >
                                                        <Text style={[ss.barChipText, { fontSize: 13 }, isActive && ss.barChipTextActive]}>{opt.label}</Text>
                                                    </Pressable>
                                                )
                                            })}
                                        </View>
                                    </View>

                                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 'auto', paddingTop: 16 }}>
                                        {editingPlate.originalWeight !== undefined && (
                                            <TouchableOpacity onPress={deletePlateEditor} style={[ss.calcBtn, { flex: 0, paddingHorizontal: 20, backgroundColor: '#ef4444' }]}>
                                                <Trash2 size={18} color="#fff" />
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity onPress={savePlateEditor} style={[ss.calcBtn, { flex: 1, marginBottom: 0 }]}>
                                            <Text style={ss.calcBtnText}>GUARDAR DISCO</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <ScrollView showsVerticalScrollIndicator={false}>
                                    {/* Preference toggle */}
                                    <View style={[ss.card, { marginBottom: 12 }]}>
                                        <Text style={ss.invSectionTitle}>Preferencia</Text>
                                        <TouchableOpacity
                                            onPress={() => setPreferFewerPlates(!preferFewerPlates)}
                                            style={[ss.toggleRow, preferFewerPlates && { backgroundColor: Colors.primary.DEFAULT + '15', borderColor: Colors.primary.DEFAULT }]}
                                        >
                                            <Text style={[{ fontWeight: '700', fontSize: 13 }, preferFewerPlates ? { color: Colors.primary.DEFAULT } : { color: Colors.iron[950] }]}>
                                                {preferFewerPlates ? 'Preferir menos discos (más rápido)' : 'Permitir más discos (más opciones)'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Symmetry */}
                                    <View style={[ss.card, { marginBottom: 12 }]}>
                                        <Text style={ss.invSectionTitle}>Simetría</Text>
                                        <Text style={{ color: Colors.iron[400], fontSize: 11, marginBottom: 8, lineHeight: 16 }}>La app calcula por pares (1 disco por lado). Un disco suelto no se usa.</Text>
                                        {hasOddCounts && (
                                            <TouchableOpacity onPress={normalizeToPairs} style={ss.toggleRow}>
                                                <Text style={{ color: Colors.iron[950], fontWeight: '700', fontSize: 13 }}>Normalizar a pares</Text>
                                                <Text style={{ color: Colors.iron[400], fontSize: 11, marginTop: 2 }}>Resta 1 a los conteos impares (solo {unit}).</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    {/* Inventory list */}
                                    {inventoryForUnit.map((p) => (
                                        <TouchableOpacity
                                            key={`${p.weight}-${p.type || 'standard'}`}
                                            style={ss.invRow}
                                            onPress={() => setEditingPlate({ weight: String(p.weight), count: String(p.count), color: p.color, type: p.type, originalWeight: p.weight, originalType: p.type })}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                    <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: p.color || getPlateColor(p.weight, unit, p.type), borderWidth: 1, borderColor: '#00000020' }} />
                                                    <Text style={{ color: Colors.iron[950], fontWeight: '900', fontSize: 16 }}>{p.weight} {p.unit}</Text>
                                                    {p.type && p.type !== 'standard' && (
                                                        <View style={{ backgroundColor: Colors.iron[200], paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                                            <Text style={{ color: Colors.iron[600], fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>{p.type}</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <Text style={{ color: Colors.iron[400], fontSize: 10, fontWeight: '600', marginTop: 2, marginLeft: 22 }}>
                                                    Pares: {Math.floor((p.count ?? 0) / 2)} {((p.count ?? 0) % 2 !== 0) ? '· sobra 1' : ''}
                                                </Text>
                                            </View>
                                            <View style={ss.invControls}>
                                                <Text style={{ color: Colors.iron[400], fontSize: 11, fontWeight: '700' }}>TOCAR PARA EDITAR</Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}

                                    <TouchableOpacity
                                        onPress={() => setEditingPlate({ weight: '', count: '2' })}
                                        style={[ss.calcBtn, { marginTop: 16, backgroundColor: Colors.iron[200], shadowOpacity: 0, borderWidth: 1, borderColor: Colors.iron[300] }]}
                                    >
                                        <Plus size={18} color={Colors.iron[950]} />
                                        <Text style={[ss.calcBtnText, { color: Colors.iron[950] }]}>NUEVO DISCO</Text>
                                    </TouchableOpacity>
                                </ScrollView>
                            )}
                        </View>
                    </SafeAreaView>
                </Modal>
                <ColorPicker
                    visible={isColorPickerVisible}
                    initialColor={editingPlate?.color || getPlateColor(parseFloat(editingPlate?.weight || '0'), unit, editingPlate?.type)}
                    onClose={() => setIsColorPickerVisible(false)}
                    onSelect={(c) => { setEditingPlate({ ...editingPlate!, color: c }); setIsColorPickerVisible(false); }}
                />
            </ScrollView>
        </SafeAreaWrapper>
    );
}


const ss = StyleSheet.create({
    backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.iron[300], elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
    pageTitle: { color: Colors.iron[950], fontWeight: '900', fontSize: 24, letterSpacing: -1 },
    pageSub: { color: Colors.primary.DEFAULT, fontSize: 12, fontWeight: '800', marginTop: 2, letterSpacing: 0.5 },
    headerBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: Colors.iron[200], borderWidth: 1, borderColor: Colors.iron[300], justifyContent: 'center', alignItems: 'center' },
    inputSection: { marginBottom: 20 },
    inputLabel: { fontSize: 10, fontWeight: '800', color: Colors.iron[400], textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
    bigInput: { backgroundColor: Colors.surface, color: Colors.iron[950], fontSize: 32, fontWeight: '900', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: Colors.iron[700], textAlign: 'center', elevation: 1, fontVariant: ['tabular-nums'] },
    smallInput: { backgroundColor: Colors.surface, color: Colors.iron[950], fontSize: 14, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: Colors.iron[700], fontWeight: '600' },
    barChipRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    barChip: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.iron[700], backgroundColor: Colors.surface, alignItems: 'center' },
    barChipActive: { backgroundColor: Colors.primary.DEFAULT, borderColor: Colors.primary.DEFAULT },
    barChipText: { fontWeight: '800', fontSize: 14, color: Colors.iron[500] },
    barChipTextActive: { color: '#fff' },
    calcBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary.DEFAULT, paddingVertical: 16, borderRadius: 16, marginBottom: 24, shadowColor: Colors.primary.DEFAULT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    calcBtnText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
    card: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.iron[700], padding: 20, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
    loadoutHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    loadoutLabel: { fontSize: 10, fontWeight: '800', color: Colors.iron[400], textTransform: 'uppercase', letterSpacing: 1 },
    loadoutTotal: { fontSize: 20, fontWeight: '900', color: Colors.iron[950], fontVariant: ['tabular-nums'] },
    barVis: { height: 90, justifyContent: 'center', alignItems: 'center', position: 'relative' },
    barLine: { height: 6, width: '100%', position: 'absolute', backgroundColor: Colors.iron[300], borderRadius: 3 },
    platesRow: { flexDirection: 'row', alignItems: 'center', gap: 2, zIndex: 10 },
    collar: { width: 6, height: 48, backgroundColor: Colors.iron[400], borderRadius: 2 },
    plateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
    plateRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.iron[200] },
    plateWeight: { fontSize: 15, fontWeight: '800', color: Colors.iron[950] },
    plateBadge: { backgroundColor: Colors.iron[200], paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    plateBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.iron[500] },
    plateCount: { fontSize: 11, fontWeight: '600', color: Colors.iron[400] },
    altRow: { paddingVertical: 12 },
    // Inventory Modal
    modalContainer: { flex: 1, backgroundColor: Colors.iron[900] },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: Colors.iron[200], paddingBottom: 16 },
    modalTitle: { color: Colors.iron[950], fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
    modalSub: { color: Colors.iron[400], fontSize: 11, fontWeight: '600', marginTop: 2 },
    modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.iron[200], justifyContent: 'center', alignItems: 'center' },
    invSectionTitle: { color: Colors.iron[950], fontWeight: '800', fontSize: 13, marginBottom: 8 },
    toggleRow: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.iron[300], backgroundColor: Colors.iron[200] },
    invRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, backgroundColor: Colors.surface, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: Colors.iron[700], elevation: 1 },
    invControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    stepBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.iron[200], borderWidth: 1, borderColor: Colors.iron[300], justifyContent: 'center', alignItems: 'center' },
    invCount: { color: Colors.iron[950], fontWeight: '900', fontSize: 18, minWidth: 30, textAlign: 'center', fontVariant: ['tabular-nums'] },
    addSection: { marginTop: 16, borderTopWidth: 1, borderTopColor: Colors.iron[200], paddingTop: 16 },
    colorBtn: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.iron[300] }
});
