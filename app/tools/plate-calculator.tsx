import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { settingsService } from '@/src/services/SettingsService';
import { Colors } from '@/src/theme';
import { PlateInventory } from '@/src/types/db';
import { Stack } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function PlateCalculator() {
    const [targetWeight, setTargetWeight] = useState('');
    const [barWeight, setBarWeight] = useState('20');
    const [results, setResults] = useState<{ plate: number, count: number }[]>([]);
    const [inventory, setInventory] = useState<PlateInventory[]>([]);
    const [isSettingsVisible, setIsSettingsVisible] = useState(false);

    useEffect(() => {
        loadInventory();
    }, []);

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
            setResults([]);
            return;
        }

        let weightPerSide = (target - bar) / 2;

        // Deep copy inventory to track usage without mutating state
        const availablePlates = inventory.map(p => ({ ...p }));

        const calculated: { plate: number, count: number }[] = [];

        for (const p of availablePlates) {
            // We strictly need pairs (2 plates at a time)
            // Logic: As long as we need at least p.weight per side (which is p.weight * 2 total), and we have at least 2 plates
            while (weightPerSide >= p.weight && p.count >= 2) {
                // Determine how many pairs we can add at once
                // Actually, just iterative is fine

                const existing = calculated.find(c => c.plate === p.weight);
                if (existing) {
                    existing.count += 2; // Add 2 plates (1 per side)
                } else {
                    calculated.push({ plate: p.weight, count: 2 }); // Start with 2
                }

                weightPerSide -= p.weight;
                // Avoid floating point drift
                weightPerSide = Math.round(weightPerSide * 100) / 100;
                p.count -= 2;
            }
        }

        setResults(calculated);
    };

    const updateInventory = async (weight: number, delta: number) => {
        const updated = inventory.map(p => {
            if (p.weight === weight) {
                return { ...p, count: Math.max(0, p.count + delta) };
            }
            return p;
        });
        setInventory(updated);
        await settingsService.updatePlateInventory(updated);
    };

    // Auto-recalc when inventory changes if results exist
    useEffect(() => {
        if (results.length > 0) calculate();
    }, [inventory]);

    return (
        <SafeAreaWrapper className="bg-iron-900" edges={['left', 'right']}>
            <ScrollView className="flex-1 px-4 pt-4">
                <Stack.Screen options={{
                    headerTitle: 'Plate Calculator',
                    headerStyle: { backgroundColor: Colors.iron[900] },
                    headerTintColor: Colors.primary.DEFAULT,
                    headerRight: () => (
                        <TouchableOpacity onPress={() => setIsSettingsVisible(true)}>
                            <Settings color={Colors.primary.DEFAULT} size={24} />
                        </TouchableOpacity>
                    )
                }} />

                <View className="mb-6">
                    <Text className="text-iron-950 font-bold mb-2">Target Weight (kg)</Text>
                    <TextInput
                        className="bg-surface text-iron-950 text-3xl font-bold p-4 rounded-xl border border-iron-700 text-center elevation-1"
                        placeholder="e.g. 100"
                        placeholderTextColor={Colors.iron[400]}
                        keyboardType="numeric"
                        value={targetWeight}
                        onChangeText={(t) => { setTargetWeight(t); }}
                        onEndEditing={calculate}
                    />
                </View>

                <View className="mb-6">
                    <Text className="text-iron-950 mb-2 font-bold">Bar Weight (kg)</Text>
                    <View className="flex-row gap-4 mb-2">
                        {['20', '15', '10'].map(w => (
                            <Pressable
                                key={w}
                                onPress={() => { setBarWeight(w); setTimeout(calculate, 0); }}
                                className={`flex-1 p-3 rounded-lg border ${barWeight === w ? 'bg-primary border-primary' : 'bg-surface border-iron-700'}`}
                            >
                                <Text className={`text-center font-bold ${barWeight === w ? 'text-white' : 'text-iron-500'}`}>{w}kg</Text>
                            </Pressable>
                        ))}
                    </View>
                    <TextInput
                        className="bg-surface text-iron-950 p-3 rounded-lg border border-iron-700 text-center elevation-1"
                        placeholder="Custom Bar Weight"
                        placeholderTextColor={Colors.iron[400]}
                        keyboardType="numeric"
                        value={barWeight}
                        onChangeText={(t) => { setBarWeight(t); }}
                        onEndEditing={calculate}
                    />
                </View>

                <Pressable
                    onPress={calculate}
                    className="bg-primary p-4 rounded-xl mb-8 active:opacity-90 elevation-2"
                >
                    <Text className="text-white text-center font-bold text-lg uppercase">Calculate</Text>
                </Pressable>

                {results.length > 0 && (
                    <View className="bg-surface p-6 rounded-xl border border-iron-700 items-center elevation-1">
                        <Text className="text-iron-950 mb-4 font-bold">Plates per side</Text>
                        <View className="flex-row flex-wrap justify-center gap-2">
                            {results.map((r, idx) => (
                                <View key={idx} className="items-center">
                            <View className="w-16 h-16 rounded-full bg-white border-4 border-yellow-600 items-center justify-center mb-1 shadow-sm">
                                <Text className="text-iron-950 font-bold">{r.plate}</Text>
                                    </View>
                                    <Text className="text-iron-950 font-bold">x{r.count}</Text>
                                </View>
                            ))}
                        </View>
                        <Text className="mt-6 text-2xl font-bold text-iron-950">
                            Total: {parseFloat(targetWeight)} kg
                        </Text>
                    </View>
                )}

                <Modal visible={isSettingsVisible} animationType="slide" presentationStyle="formSheet">
                    <View className="flex-1 bg-iron-900 p-4">
                        <View className="flex-row justify-between items-center mb-6 border-b border-iron-200 pb-4">
                            <Text className="text-iron-950 text-xl font-bold">Plate Inventory</Text>
                            <TouchableOpacity onPress={() => setIsSettingsVisible(false)}>
                                <Text className="text-primary font-bold">Done</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView>
                            {inventory.map((p, idx) => (
                                <View key={p.weight} className="flex-row items-center justify-between mb-4 bg-surface p-3 rounded-xl border border-iron-700 elevation-1">
                                    <View>
                                        <Text className="text-iron-950 font-bold text-lg">{p.weight} {p.unit}</Text>
                                        <Text className="text-iron-500 text-xs">Total available</Text>
                                    </View>
                                    <View className="flex-row items-center gap-4">
                                        <TouchableOpacity onPress={() => updateInventory(p.weight, -1)} className="w-10 h-10 bg-iron-200 rounded-full items-center justify-center">
                                            <Text className="text-iron-950 font-bold text-xl">-</Text>
                                        </TouchableOpacity>
                                        <Text className="text-iron-950 font-bold text-xl w-6 text-center">{p.count}</Text>
                                        <TouchableOpacity onPress={() => updateInventory(p.weight, 1)} className="w-10 h-10 bg-iron-200 rounded-full items-center justify-center">
                                            <Text className="text-iron-950 font-bold text-xl">+</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}

                            {/* Add Custom Plate View */}
                            <View className="mt-4 pt-4 border-t border-iron-200">
                                <Text className="text-iron-950 font-bold mb-2">Add Custom Plate</Text>
                                <View className="flex-row gap-2">
                                    <TextInput
                                        className="flex-1 bg-surface text-iron-950 p-3 rounded-lg border border-iron-700"
                                        placeholder="Weight (kg)"
                                        placeholderTextColor={Colors.iron[400]}
                                        keyboardType="numeric"
                                        onSubmitEditing={(e) => {
                                            const w = parseFloat(e.nativeEvent.text);
                                            if (!isNaN(w) && w > 0) {
                                                const newInv = [...inventory, { weight: w, count: 2, type: 'standard' as any, unit: 'kg' as const }].sort((a, b) => b.weight - a.weight);
                                                setInventory(newInv);
                                                settingsService.updatePlateInventory(newInv);
                                            }
                                        }}
                                    />
                                </View>
                                <Text className="text-iron-500 text-xs mt-2">Type weight and press return inventory.</Text>
                            </View>
                        </ScrollView>
                    </View>
                </Modal>
            </ScrollView>
        </SafeAreaWrapper>
    );
}
