import { IronInput } from '@/components/IronInput';
import { CalculatorService, OneRMFormula } from '@/src/services/CalculatorService';
import { configService } from '@/src/services/ConfigService';
import { PlateCalculatorService } from '@/src/services/PlateCalculatorService';
import { statsService } from '@/src/services/StatsService';
import { UnitService } from '@/src/services/UnitService';
import { PlateInventory } from '@/src/types/db';
import { X } from 'lucide-react-native';
import React, { useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface CalculatorsModalProps {
    visible: boolean;
    onClose: () => void;
    initialTab?: 'oneRm' | 'warmup' | 'plates' | 'power';
}

export function CalculatorsModal({ visible, onClose, initialTab = 'oneRm' }: CalculatorsModalProps) {
    const unit = configService.get('weightUnit');
    const rounding = unit === 'kg' ? configService.get('calculatorsRoundingKg') : configService.get('calculatorsRoundingLbs');

    const [activeTab, setActiveTab] = useState<'oneRm' | 'warmup' | 'plates' | 'power'>('oneRm');

    React.useEffect(() => {
        if (visible && initialTab) {
            setActiveTab(initialTab);
        }
    }, [visible, initialTab]);

    const [formula, setFormula] = useState<OneRMFormula>(configService.get('calculatorsDefault1RMFormula'));
    const [setWeight, setSetWeight] = useState('');
    const [setReps, setSetReps] = useState('');
    const [oneRmManual, setOneRmManual] = useState(unit === 'kg' ? '100' : '225');

    const [warmupWorking, setWarmupWorking] = useState(unit === 'kg' ? '100' : '225');
    const [warmupBar, setWarmupBar] = useState(
        String(unit === 'kg' ? configService.get('plateCalculatorDefaultBarWeightKg') : configService.get('plateCalculatorDefaultBarWeightLbs'))
    );

    const [bw, setBw] = useState('');
    const [total, setTotal] = useState('');

    const [calcPlateTarget, setCalcPlateTarget] = useState('');
    const [calcPlateBar, setCalcPlateBar] = useState(
        String(unit === 'kg' ? configService.get('plateCalculatorDefaultBarWeightKg') : configService.get('plateCalculatorDefaultBarWeightLbs'))
    );

    const percentages = [0.95, 0.90, 0.875, 0.85, 0.825, 0.80, 0.75, 0.70, 0.65, 0.60, 0.50];

    const estFromSet = CalculatorService.estimate1RM(
        formula,
        parseFloat(setWeight) || 0,
        parseFloat(setReps) || 0
    );
    const oneRm = Math.max(parseFloat(oneRmManual) || 0, estFromSet || 0);
    const table = CalculatorService.percentTable(oneRm, percentages, rounding);

    const bwValue = parseFloat(bw) || 0;
    const totalValue = parseFloat(total) || 0;
    const bwKg = unit === 'kg' ? bwValue : UnitService.lbsToKg(bwValue);
    const totalKg = unit === 'kg' ? totalValue : UnitService.lbsToKg(totalValue);
    const wilks = statsService.calculateWilks(bwKg, totalKg);
    const dots = statsService.calculateDOTS(bwKg, totalKg);

    const warmup = CalculatorService.warmupSuggestions({
        workingWeight: parseFloat(warmupWorking) || 0,
        barWeight: parseFloat(warmupBar) || 0,
        rounding
    });

    const plateResult = React.useMemo(() => {
        if (activeTab !== 'plates') return null;
        const target = parseFloat(calcPlateTarget);
        if (isNaN(target) || target <= 0) return null;
        const bar = parseFloat(calcPlateBar) || 0;

        // Standard Inventory
        const inventory: PlateInventory[] = unit === 'kg'
            ? [25, 20, 15, 10, 5, 2.5, 1.25].map(w => ({ weight: w, count: 10, type: 'standard', unit: 'kg' }))
            : [45, 35, 25, 10, 5, 2.5].map(w => ({ weight: w, count: 10, type: 'standard', unit: 'lbs' }));

        return PlateCalculatorService.calculate({
            targetWeight: target,
            barWeight: bar,
            inventory,
            maxSolutions: 1
        });
    }, [calcPlateTarget, calcPlateBar, unit, activeTab]);

    const getPlateColor = (weight: number) => {
        if (unit === 'kg') {
            if (weight >= 25) return '#ef4444'; // Red
            if (weight >= 20) return '#3b82f6'; // Blue
            if (weight >= 15) return '#eab308'; // Yellow
            if (weight >= 10) return '#22c55e'; // Green
            if (weight >= 5) return '#f4f4f5'; // White
            if (weight >= 2.5) return '#000000'; // Black
            return '#d4d4d8'; // Silver
        } else {
            if (weight >= 55) return '#ef4444';
            if (weight >= 45) return '#3b82f6';
            if (weight >= 35) return '#eab308';
            if (weight >= 25) return '#22c55e';
            if (weight >= 10) return '#f4f4f5';
            if (weight >= 5) return '#000000';
            return '#d4d4d8';
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <SafeAreaView edges={['top', 'bottom', 'left', 'right']} className="flex-1 bg-iron-900">
                <View className="flex-1 p-4">
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-iron-950 font-bold text-lg">Calculadoras</Text>
                        <TouchableOpacity
                            onPress={onClose}
                            className="p-2 bg-primary rounded-full active:opacity-80"
                            accessibilityRole="button"
                            accessibilityLabel="Cerrar calculadoras"
                        >
                            <X color="white" size={24} />
                        </TouchableOpacity>
                    </View>

                    <View className="flex-row mb-6 bg-iron-800 p-1 rounded-lg">
                        <TouchableOpacity
                            className={`flex-1 py-2 rounded-md ${activeTab === 'oneRm' ? 'bg-iron-700' : ''}`}
                            onPress={() => setActiveTab('oneRm')}
                            accessibilityRole="button"
                            accessibilityLabel="Abrir calculadora 1RM"
                        >
                            <Text className={`text-center font-bold ${activeTab === 'oneRm' ? 'text-iron-950' : 'text-iron-500'}`}>1RM</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className={`flex-1 py-2 rounded-md ${activeTab === 'warmup' ? 'bg-iron-700' : ''}`}
                            onPress={() => setActiveTab('warmup')}
                            accessibilityRole="button"
                            accessibilityLabel="Abrir warm-up"
                        >
                            <Text className={`text-center font-bold ${activeTab === 'warmup' ? 'text-iron-950' : 'text-iron-500'}`}>Warm-up</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className={`flex-1 py-2 rounded-md ${activeTab === 'power' ? 'bg-iron-700' : ''}`}
                            onPress={() => setActiveTab('power')}
                            accessibilityRole="button"
                            accessibilityLabel="Abrir scores powerlifting"
                        >
                            <Text className={`text-center font-bold ${activeTab === 'power' ? 'text-iron-950' : 'text-iron-500'}`}>Scores</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView>
                        {activeTab === 'oneRm' ? (
                            <View>
                                <Text className="text-iron-950 font-bold text-lg mb-3">Estimación de 1RM</Text>

                                <View className="bg-surface p-4 rounded-xl border border-iron-700 mb-6">
                                    <Text className="text-iron-500 text-xs font-bold uppercase mb-2">Fórmula</Text>
                                    <View className="flex-row gap-2 mb-4">
                                        {([
                                            { id: 'epley', label: 'Epley' },
                                            { id: 'brzycki', label: 'Brzycki' },
                                            { id: 'lombardi', label: 'Lombardi' }
                                        ] as const).map((f) => (
                                            <TouchableOpacity
                                                key={f.id}
                                                onPress={() => {
                                                    setFormula(f.id);
                                                    configService.set('calculatorsDefault1RMFormula', f.id);
                                                }}
                                                className={`flex-1 px-3 py-2 rounded-lg border ${formula === f.id ? 'bg-primary border-primary' : 'bg-white border-iron-200'}`}
                                                accessibilityRole="button"
                                                accessibilityLabel={`Seleccionar fórmula ${f.label}`}
                                            >
                                                <Text className={`text-center font-bold ${formula === f.id ? 'text-white' : 'text-iron-950'}`}>{f.label}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <Text className="text-iron-500 text-xs font-bold uppercase mb-2">Desde una serie</Text>
                                    <View className="flex-row gap-3">
                                        <View className="flex-1">
                                            <IronInput
                                                value={setWeight}
                                                onChangeText={setSetWeight}
                                                keyboardType="numeric"
                                                placeholder={unit === 'kg' ? 'Peso (kg)' : 'Peso (lbs)'}
                                                accessibilityLabel="Ingresar peso de la serie"
                                            />
                                        </View>
                                        <View className="flex-1">
                                            <IronInput
                                                value={setReps}
                                                onChangeText={setSetReps}
                                                keyboardType="numeric"
                                                placeholder="Reps"
                                                accessibilityLabel="Ingresar repeticiones de la serie"
                                            />
                                        </View>
                                    </View>

                                    <Text className="text-iron-500 text-xs font-bold uppercase mt-4 mb-2">1RM manual</Text>
                                    <IronInput
                                        value={oneRmManual}
                                        onChangeText={setOneRmManual}
                                        keyboardType="numeric"
                                        placeholder={unit === 'kg' ? '1RM (kg)' : '1RM (lbs)'}
                                        accessibilityLabel="Ingresar 1RM manual"
                                    />

                                    <View className="mt-4 bg-iron-100 p-4 rounded-xl border border-iron-200">
                                        <Text className="text-iron-500 text-xs font-bold uppercase">1RM usado</Text>
                                        <Text className="text-iron-950 text-3xl font-black mt-1">{Math.round(oneRm)}</Text>
                                        <Text className="text-iron-500 text-xs font-bold">{unit}</Text>
                                    </View>
                                </View>

                                <Text className="text-iron-950 font-bold text-lg mb-3">Porcentajes</Text>
                                <View className="bg-surface rounded-xl overflow-hidden border border-iron-700 mb-8">
                                    {table.map((row) => (
                                        <View key={row.pct} className="flex-row justify-between p-4 border-b border-iron-200">
                                            <Text className="text-iron-500 font-bold">{Math.round(row.pct * 100)}%</Text>
                                            <Text className="text-iron-950 font-bold text-lg">{row.weight} {unit}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        ) : activeTab === 'warmup' ? (
                            <View>
                                <Text className="text-iron-950 font-bold text-lg mb-3">Warm-up</Text>
                                <View className="bg-surface p-4 rounded-xl border border-iron-700 mb-6">
                                    <Text className="text-iron-500 text-xs font-bold uppercase mb-2">Peso de trabajo</Text>
                                    <IronInput
                                        value={warmupWorking}
                                        onChangeText={setWarmupWorking}
                                        keyboardType="numeric"
                                        placeholder={unit === 'kg' ? 'p. ej. 100' : 'p. ej. 225'}
                                        accessibilityLabel="Ingresar peso de trabajo"
                                    />
                                    <Text className="text-iron-500 text-xs font-bold uppercase mt-4 mb-2">Barra</Text>
                                    <IronInput
                                        value={warmupBar}
                                        onChangeText={setWarmupBar}
                                        keyboardType="numeric"
                                        placeholder={unit === 'kg' ? '20' : '45'}
                                        accessibilityLabel="Ingresar peso de barra"
                                    />
                                    <Text className="text-iron-500 text-xs mt-3">
                                        Redondeo: {rounding} {unit}
                                    </Text>
                                </View>

                                <View className="bg-surface rounded-xl overflow-hidden border border-iron-700">
                                    {warmup.length > 0 ? (
                                        warmup.map((s, idx) => (
                                            <View key={`${s.weight}-${idx}`} className="flex-row justify-between p-4 border-b border-iron-200">
                                                <View className="flex-row items-center">
                                                    <View className="w-2 h-2 rounded-full bg-yellow-500 mr-2" />
                                                    <Text className="text-iron-950 font-bold">{s.weight} {unit}</Text>
                                                </View>
                                                <Text className="text-iron-500 font-bold">{s.reps} reps</Text>
                                            </View>
                                        ))
                                    ) : (
                                        <View className="p-4">
                                            <Text className="text-iron-500">Ingresa un peso de trabajo válido.</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        ) : activeTab === 'plates' ? (
                            <View>
                                <Text className="text-iron-950 font-bold text-lg mb-3">Calculadora de Discos</Text>

                                <View className="flex-row gap-4 mb-6">
                                    <View className="flex-1">
                                        <Text className="text-iron-500 mb-2">Peso Objetivo ({unit})</Text>
                                        <IronInput
                                            value={calcPlateTarget}
                                            onChangeText={setCalcPlateTarget}
                                            keyboardType="numeric"
                                            placeholder={unit === 'kg' ? '100' : '225'}
                                            autoFocus
                                        />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-iron-500 mb-2">Barra ({unit})</Text>
                                        <IronInput
                                            value={calcPlateBar}
                                            onChangeText={setCalcPlateBar}
                                            keyboardType="numeric"
                                            placeholder={unit === 'kg' ? '20' : '45'}
                                        />
                                    </View>
                                </View>

                                {plateResult && plateResult.exact.length > 0 ? (
                                    <View className="bg-surface rounded-xl border border-iron-700 p-4">
                                        <Text className="text-iron-500 font-bold uppercase text-xs mb-4 text-center">Por lado</Text>
                                        <View className="flex-row items-center justify-center h-24 relative mb-4">
                                            {/* Bar End */}
                                            <View className="h-4 w-full absolute bg-iron-300 rounded-full" />

                                            {/* Plates */}
                                            <View className="flex-row items-center gap-1 z-10">
                                                <View className="w-4 h-16 bg-iron-400 rounded-sm" /> {/* Collar */}
                                                {plateResult.exact[0].perSide.map((p, i) => (
                                                    <View key={i} className="flex-row items-center gap-0.5">
                                                        {Array.from({ length: p.pairs }).map((_, j) => (
                                                            <View
                                                                key={`${i}-${j}`}
                                                                style={{
                                                                    height: Math.min(80, 25 + (p.plate * 1.5)),
                                                                    width: Math.max(8, p.plate / 1.5),
                                                                    backgroundColor: getPlateColor(p.plate),
                                                                    borderColor: '#00000020',
                                                                    borderWidth: 1
                                                                }}
                                                                className="rounded-sm"
                                                            />
                                                        ))}
                                                    </View>
                                                ))}
                                            </View>
                                        </View>

                                        <View>
                                            {plateResult.exact[0].perSide.map((p, idx) => (
                                                <View key={idx} className="flex-row justify-between border-b border-iron-100 py-2">
                                                    <View className="flex-row items-center gap-2">
                                                        <View className="w-3 h-3 rounded-full" style={{ backgroundColor: getPlateColor(p.plate), borderWidth: 1, borderColor: '#00000020' }} />
                                                        <Text className="text-iron-950 font-bold">{p.plate} {unit}</Text>
                                                    </View>
                                                    <Text className="text-iron-500 font-bold">x{p.pairs}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                ) : calcPlateTarget ? (
                                    <View className="p-4 bg-iron-200 rounded-xl">
                                        <Text className="text-iron-500 text-center">No es posible armar este peso exacto.</Text>
                                    </View>
                                ) : null}
                            </View>
                        ) : (
                            <View>
                                <View className="flex-row gap-4 mb-6">
                                    <View className="flex-1">
                                        <Text className="text-iron-500 mb-2">Peso corporal ({unit})</Text>
                                        <IronInput value={bw} onChangeText={setBw} keyboardType="numeric" placeholder={unit === 'kg' ? '80' : '180'} accessibilityLabel="Ingresar peso corporal" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-iron-500 mb-2">Total (SBD)</Text>
                                        <IronInput value={total} onChangeText={setTotal} keyboardType="numeric" placeholder={unit === 'kg' ? '500' : '1100'} accessibilityLabel="Ingresar total SBD" />
                                    </View>
                                </View>

                                <View className="flex-row gap-4">
                                    <View className="flex-1 bg-iron-200 p-4 rounded-xl border border-iron-300 items-center">
                                        <Text className="text-iron-950 font-bold text-xs uppercase mb-1">Wilks</Text>
                                        <Text className="text-iron-950 font-black text-2xl">{Number.isFinite(wilks) ? wilks.toFixed(2) : '0.00'}</Text>
                                    </View>
                                    <View className="flex-1 bg-iron-200 p-4 rounded-xl border border-iron-300 items-center">
                                        <Text className="text-iron-950 font-bold text-xs uppercase mb-1">DOTS</Text>
                                        <Text className="text-iron-950 font-black text-2xl">{Number.isFinite(dots) ? dots.toFixed(2) : '0.00'}</Text>
                                    </View>
                                </View>

                                <Text className="text-iron-500 text-xs mt-4 text-center">
                                    *Wilks/DOTS se calculan en kg internamente.
                                </Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </SafeAreaView>
        </Modal>
    );
}
