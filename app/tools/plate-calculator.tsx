import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { configService } from '@/src/services/ConfigService';
import { PlateCalculatorService, PlateLoadout } from '@/src/services/PlateCalculatorService';
import { settingsService } from '@/src/services/SettingsService';
import { Colors } from '@/src/theme';
import { PlateInventory } from '@/src/types/db';
import { Stack, useFocusEffect } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function PlateCalculator() {
    const [unit, setUnit] = useState(configService.get('weightUnit'));
    const [targetWeight, setTargetWeight] = useState('');
    const [barWeight, setBarWeight] = useState('20');
    const [activeLoadout, setActiveLoadout] = useState<PlateLoadout | null>(null);
    const [exactAlternatives, setExactAlternatives] = useState<PlateLoadout[]>([]);
    const [closestBelow, setClosestBelow] = useState<PlateLoadout | null>(null);
    const [closestAbove, setClosestAbove] = useState<PlateLoadout | null>(null);
    const [inventory, setInventory] = useState<PlateInventory[]>([]);
    const [isSettingsVisible, setIsSettingsVisible] = useState(false);
    const [preferFewerPlates, setPreferFewerPlates] = useState(configService.get('plateCalculatorPreferFewerPlates'));

    useEffect(() => {
        loadInventory();
    }, []);

    useFocusEffect(
        useCallback(() => {
            const nextUnit = configService.get('weightUnit');
            setUnit(nextUnit);
            const defaultBar = nextUnit === 'kg'
                ? configService.get('plateCalculatorDefaultBarWeightKg')
                : configService.get('plateCalculatorDefaultBarWeightLbs');
            setBarWeight(String(defaultBar));
        }, [])
    );

    const loadInventory = async () => {
        // Seed default if empty happens inside service usually, but let's call it just in case or assume service handled it.
        // Actually SettingsService doesn't auto-seed on get. Let's do it here.
        let inv = await settingsService.getPlateInventory();
        if (inv.length === 0) {
            await settingsService.seedDefaultInventory();
            inv = await settingsService.getPlateInventory();
        }
        setInventory(inv);
    };

    const calculate = () => {
        const target = parseFloat(targetWeight);
        const bar = parseFloat(barWeight);

        if (isNaN(target) || isNaN(bar) || target <= bar) {
            setActiveLoadout(null);
            setExactAlternatives([]);
            setClosestBelow(null);
            setClosestAbove(null);
            return;
        }

        const filteredInventory = inventory.filter((p) => p.unit === unit);

        const result = PlateCalculatorService.calculate({
            targetWeight: target,
            barWeight: bar,
            inventory: filteredInventory,
            maxSolutions: 6,
            preferFewerPlates
        });

        const firstExact = result.exact[0] ?? null;
        setActiveLoadout(firstExact);
        setExactAlternatives(result.exact.slice(1));
        setClosestBelow(result.closestBelow);
        setClosestAbove(result.closestAbove);
    };

    const updateInventory = async (weight: number, delta: number) => {
        const updated = inventory.map(p => {
            if (p.weight === weight && p.unit === unit) {
                return { ...p, count: Math.max(0, p.count + delta) };
            }
            return p;
        });
        setInventory(updated);
        await settingsService.updatePlateInventory(updated);
    };

    // Auto-recalc when inventory changes if results exist
    useEffect(() => {
        if (activeLoadout || closestBelow || closestAbove) calculate();
    }, [inventory]);

    useEffect(() => {
        configService.set('plateCalculatorPreferFewerPlates', preferFewerPlates);
        if (activeLoadout || closestBelow || closestAbove) calculate();
    }, [preferFewerPlates]);

    const inventoryForUnit = inventory.filter((p) => p.unit === unit);
    const hasInventoryForUnit = inventoryForUnit.some((p) => p.count > 0);
    const hasOddCounts = inventoryForUnit.some((p) => (p.count ?? 0) % 2 !== 0);
    const normalizeToPairs = async () => {
        const updated = inventory.map((p) => {
            if (p.unit !== unit) return p;
            const count = p.count ?? 0;
            if (count % 2 === 0) return p;
            return { ...p, count: Math.max(0, count - 1) };
        });
        setInventory(updated);
        await settingsService.updatePlateInventory(updated);
    };

    return (
        <SafeAreaWrapper className="bg-iron-900" edges={['left', 'right']}>
            <ScrollView className="flex-1 px-4 pt-4">
                <Stack.Screen options={{
                    headerTitle: 'Calculadora de discos',
                    headerStyle: { backgroundColor: Colors.iron[900] },
                    headerTintColor: Colors.primary.DEFAULT,
                    headerRight: () => (
                        <TouchableOpacity
                            onPress={() => setIsSettingsVisible(true)}
                            accessibilityRole="button"
                            accessibilityLabel="Abrir configuración de discos"
                        >
                            <Settings color={Colors.primary.DEFAULT} size={24} />
                        </TouchableOpacity>
                    )
                }} />

                <View className="mb-6">
                    <Text className="text-iron-950 font-bold mb-2">Peso objetivo ({unit})</Text>
                    <TextInput
                        className="bg-surface text-iron-950 text-3xl font-bold p-4 rounded-xl border border-iron-700 text-center elevation-1"
                        placeholder={unit === 'kg' ? 'p. ej. 100' : 'p. ej. 225'}
                        placeholderTextColor={Colors.iron[400]}
                        keyboardType="numeric"
                        value={targetWeight}
                        onChangeText={(t) => { setTargetWeight(t); }}
                        onEndEditing={calculate}
                        accessibilityLabel="Ingresar peso objetivo"
                    />
                </View>

                <View className="mb-6">
                    <Text className="text-iron-950 mb-2 font-bold">Barra ({unit})</Text>
                    <View className="flex-row gap-4 mb-2">
                        {(unit === 'kg' ? ['20', '15', '10'] : ['45', '35', '25']).map(w => (
                            <Pressable
                                key={w}
                                onPress={() => { setBarWeight(w); setTimeout(calculate, 0); }}
                                className={`flex-1 p-3 rounded-lg border ${barWeight === w ? 'bg-primary border-primary' : 'bg-surface border-iron-700'}`}
                                accessibilityRole="button"
                                accessibilityLabel={`Seleccionar barra ${w}${unit}`}
                            >
                                <Text className={`text-center font-bold ${barWeight === w ? 'text-white' : 'text-iron-500'}`}>{w}{unit}</Text>
                            </Pressable>
                        ))}
                    </View>
                    <TextInput
                        className="bg-surface text-iron-950 p-3 rounded-lg border border-iron-700 text-center elevation-1"
                        placeholder="Barra personalizada"
                        placeholderTextColor={Colors.iron[400]}
                        keyboardType="numeric"
                        value={barWeight}
                        onChangeText={(t) => { setBarWeight(t); }}
                        onEndEditing={calculate}
                        accessibilityLabel="Ingresar peso de barra personalizada"
                    />
                </View>

                <Pressable
                    onPress={calculate}
                    className="bg-primary p-4 rounded-xl mb-8 active:opacity-90 elevation-2"
                    accessibilityRole="button"
                    accessibilityLabel="Calcular discos"
                >
                    <Text className="text-white text-center font-bold text-lg uppercase">Calcular</Text>
                </Pressable>

                {!hasInventoryForUnit && (
                    <View className="bg-surface p-4 rounded-xl border border-iron-700 mb-8">
                        <Text className="text-iron-950 font-bold mb-2">Inventario vacío ({unit})</Text>
                        <Text className="text-iron-500">Abre el inventario y agrega tus discos para este sistema de unidades.</Text>
                    </View>
                )}

                {activeLoadout && (
                    <View className="bg-surface p-6 rounded-xl border border-iron-700 items-center elevation-1 mb-4">
                        <Text className="text-iron-950 mb-2 font-bold">Armado recomendado (por lado)</Text>
                        <Text className="text-iron-500 mb-4 text-xs font-bold">
                            Total: <Text className="text-iron-950">{activeLoadout.totalWeight}</Text> {unit} · Barra: <Text className="text-iron-950">{activeLoadout.barWeight}</Text> {unit}
                        </Text>
                        <View className="flex-row flex-wrap justify-center gap-2">
                            {activeLoadout.perSide.map((p) => (
                                <View key={p.plate} className="items-center">
                                    <View className="w-16 h-16 rounded-full bg-white border-4 border-yellow-600 items-center justify-center mb-1 shadow-sm">
                                        <Text className="text-iron-950 font-bold">{p.plate}</Text>
                                    </View>
                                    <Text className="text-iron-950 font-bold">x{p.pairs} por lado</Text>
                                    <Text className="text-iron-500 text-[10px] font-bold">({p.pairs * 2} discos)</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {!activeLoadout && (closestBelow || closestAbove) && (
                    <View className="bg-surface p-6 rounded-xl border border-iron-700 items-center elevation-1 mb-4">
                        <Text className="text-iron-950 mb-4 font-bold">No se puede llegar exacto</Text>
                        {closestBelow && (
                            <View className="w-full mb-4">
                                <Text className="text-iron-950 font-bold mb-2">Más cercano por debajo: {closestBelow.totalWeight} {unit}</Text>
                                <View className="flex-row flex-wrap gap-2">
                                    {closestBelow.perSide.map((p) => (
                                        <View key={`b-${p.plate}`} className="items-center">
                                            <View className="w-14 h-14 rounded-full bg-white border-4 border-iron-300 items-center justify-center mb-1 shadow-sm">
                                                <Text className="text-iron-950 font-bold">{p.plate}</Text>
                                            </View>
                                            <Text className="text-iron-950 font-bold text-xs">x{p.pairs}/lado</Text>
                                            <Text className="text-iron-500 text-[10px] font-bold">({p.pairs * 2})</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                        {closestAbove && (
                            <View className="w-full">
                                <Text className="text-iron-950 font-bold mb-2">Más cercano por arriba: {closestAbove.totalWeight} {unit}</Text>
                                <View className="flex-row flex-wrap gap-2">
                                    {closestAbove.perSide.map((p) => (
                                        <View key={`a-${p.plate}`} className="items-center">
                                            <View className="w-14 h-14 rounded-full bg-white border-4 border-iron-300 items-center justify-center mb-1 shadow-sm">
                                                <Text className="text-iron-950 font-bold">{p.plate}</Text>
                                            </View>
                                            <Text className="text-iron-950 font-bold text-xs">x{p.pairs}/lado</Text>
                                            <Text className="text-iron-500 text-[10px] font-bold">({p.pairs * 2})</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                    </View>
                )}

                {exactAlternatives.length > 0 && (
                    <View className="bg-surface p-4 rounded-xl border border-iron-700 mb-8">
                        <Text className="text-iron-950 font-bold mb-3">Alternativas exactas</Text>
                        {exactAlternatives.map((l, idx) => (
                            <Pressable
                                key={idx}
                                onPress={() => setActiveLoadout(l)}
                                className="p-3 rounded-xl border border-iron-200 mb-3 active:bg-iron-200"
                                accessibilityRole="button"
                                accessibilityLabel={`Seleccionar alternativa exacta ${l.totalWeight} ${unit}`}
                            >
                                <Text className="text-iron-950 font-bold mb-1">{l.totalWeight} {unit}</Text>
                                <Text className="text-iron-500 text-xs font-bold">
                                    {l.perSide.map((p) => `${p.plate}×${p.pairs}/lado`).join(' · ')}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                )}

                <Modal visible={isSettingsVisible} animationType="slide" presentationStyle="formSheet">
                    <View className="flex-1 bg-iron-900 p-4">
                        <View className="flex-row justify-between items-center mb-6 border-b border-iron-200 pb-4">
                            <Text className="text-iron-950 text-xl font-bold">Inventario de discos</Text>
                            <TouchableOpacity
                                onPress={() => setIsSettingsVisible(false)}
                                accessibilityRole="button"
                                accessibilityLabel="Cerrar inventario"
                            >
                                <Text className="text-primary font-bold">Listo</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView>
                            <View className="bg-surface p-4 rounded-xl border border-iron-700 mb-4">
                                <Text className="text-iron-950 font-bold mb-2">Preferencia</Text>
                                <TouchableOpacity
                                    onPress={() => setPreferFewerPlates(!preferFewerPlates)}
                                    className={`p-3 rounded-xl border ${preferFewerPlates ? 'bg-primary border-primary' : 'bg-white border-iron-200'}`}
                                    accessibilityRole="button"
                                    accessibilityLabel="Alternar preferencia de menos discos"
                                >
                                    <Text className={`font-bold ${preferFewerPlates ? 'text-white' : 'text-iron-950'}`}>
                                        {preferFewerPlates ? 'Preferir menos discos (más rápido)' : 'Permitir más discos (más opciones)'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <View className="bg-surface p-4 rounded-xl border border-iron-700 mb-4">
                                <Text className="text-iron-950 font-bold mb-2">Simetría</Text>
                                <Text className="text-iron-500 text-xs mb-3">La app calcula siempre por pares (1 disco por lado). Un disco suelto no se usa.</Text>
                                {hasOddCounts && (
                                    <TouchableOpacity
                                        onPress={normalizeToPairs}
                                        className="p-3 rounded-xl border bg-white border-iron-200 active:bg-iron-200"
                                        accessibilityRole="button"
                                        accessibilityLabel="Normalizar inventario a pares"
                                    >
                                        <Text className="text-iron-950 font-bold">Normalizar a pares</Text>
                                        <Text className="text-iron-500 text-xs mt-1">Resta 1 a los conteos impares (solo {unit}).</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {inventoryForUnit.map((p, idx) => (
                                <View key={p.weight} className="flex-row items-center justify-between mb-4 bg-surface p-3 rounded-xl border border-iron-700 elevation-1">
                                    <View>
                                        <Text className="text-iron-950 font-bold text-lg">{p.weight} {p.unit}</Text>
                                        <Text className="text-iron-500 text-xs">
                                            Pares utilizables: {Math.floor((p.count ?? 0) / 2)} {((p.count ?? 0) % 2 !== 0) ? '· sobra 1' : ''}
                                        </Text>
                                    </View>
                                    <View className="flex-row items-center gap-4">
                                        <TouchableOpacity
                                            onPress={() => updateInventory(p.weight, -2)}
                                            className="w-10 h-10 bg-iron-200 rounded-full items-center justify-center"
                                            accessibilityRole="button"
                                            accessibilityLabel={`Quitar un par de ${p.weight} ${p.unit}`}
                                        >
                                            <Text className="text-iron-950 font-bold text-xl">-</Text>
                                        </TouchableOpacity>
                                        <Text className="text-iron-950 font-bold text-xl w-10 text-center">{p.count}</Text>
                                        <TouchableOpacity
                                            onPress={() => updateInventory(p.weight, 2)}
                                            className="w-10 h-10 bg-iron-200 rounded-full items-center justify-center"
                                            accessibilityRole="button"
                                            accessibilityLabel={`Agregar un par de ${p.weight} ${p.unit}`}
                                        >
                                            <Text className="text-iron-950 font-bold text-xl">+</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}

                            {/* Add Custom Plate View */}
                            <View className="mt-4 pt-4 border-t border-iron-200">
                                <Text className="text-iron-950 font-bold mb-2">Agregar disco</Text>
                                <View className="flex-row gap-2">
                                    <TextInput
                                        className="flex-1 bg-surface text-iron-950 p-3 rounded-lg border border-iron-700"
                                        placeholder={`Peso (${unit})`}
                                        placeholderTextColor={Colors.iron[400]}
                                        keyboardType="numeric"
                                        onSubmitEditing={(e) => {
                                            const w = parseFloat(e.nativeEvent.text);
                                            if (!isNaN(w) && w > 0) {
                                                const existing = inventory.find((p) => p.weight === w && p.unit === unit && p.type === 'standard');
                                                const base = existing
                                                    ? inventory.map((p) => (p.weight === w && p.unit === unit && p.type === 'standard' ? { ...p, count: p.count + 2 } : p))
                                                    : [...inventory, { weight: w, count: 2, type: 'standard' as any, unit } as any];
                                                const newInv = base.sort((a, b) => b.weight - a.weight);
                                                setInventory(newInv);
                                                settingsService.updatePlateInventory(newInv);
                                            }
                                        }}
                                        accessibilityLabel="Agregar disco personalizado"
                                    />
                                </View>
                                <Text className="text-iron-500 text-xs mt-2">Escribe el peso y presiona Enter. Se agrega como par (2 discos).</Text>
                            </View>
                        </ScrollView>
                    </View>
                </Modal>
            </ScrollView>
        </SafeAreaWrapper>
    );
}
