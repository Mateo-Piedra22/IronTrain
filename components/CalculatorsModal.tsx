import { IronInput } from '@/components/IronInput';
import { statsService } from '@/src/services/StatsService';
import { X } from 'lucide-react-native';
import React, { useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';

interface CalculatorsModalProps {
    visible: boolean;
    onClose: () => void;
}

export function CalculatorsModal({ visible, onClose }: CalculatorsModalProps) {
    const [activeTab, setActiveTab] = useState<'percent' | 'power'>('percent');

    // State 1RM
    const [oneRm, setOneRm] = useState('100');

    // State Power
    const [bw, setBw] = useState('');
    const [total, setTotal] = useState('');

    const percentages = [0.95, 0.90, 0.85, 0.80, 0.75, 0.70, 0.65, 0.60, 0.50];

    const wilks = statsService.calculateWilks(parseFloat(bw) || 0, parseFloat(total) || 0);
    const dots = statsService.calculateDOTS(parseFloat(bw) || 0, parseFloat(total) || 0);

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View className="flex-1 bg-iron-900 p-4">
                <View className="flex-row justify-between items-center mb-6 mt-4">
                    <Text className="text-iron-950 font-bold text-lg">Tools & Calculators</Text>
                    <TouchableOpacity onPress={onClose} className="p-2 bg-primary rounded-full active:opacity-80">
                        <X color="white" size={24} />
                    </TouchableOpacity>
                </View>

                {/* Tabs */}
                <View className="flex-row mb-6 bg-iron-800 p-1 rounded-lg">
                    <TouchableOpacity
                        className={`flex-1 py-2 rounded-md ${activeTab === 'percent' ? 'bg-iron-700' : ''}`}
                        onPress={() => setActiveTab('percent')}
                    >
                        <Text className={`text-center font-bold ${activeTab === 'percent' ? 'text-iron-950' : 'text-iron-500'}`}>% 1RM</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        className={`flex-1 py-2 rounded-md ${activeTab === 'power' ? 'bg-iron-700' : ''}`}
                        onPress={() => setActiveTab('power')}
                    >
                        <Text className={`text-center font-bold ${activeTab === 'power' ? 'text-iron-950' : 'text-iron-500'}`}>Powerlifting</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView>
                    {activeTab === 'percent' ? (
                        <View>
                            <Text className="text-iron-500 mb-2">Enter your 1 Rep Max (kg)</Text>
                            <IronInput
                                value={oneRm}
                                onChangeText={setOneRm}
                                keyboardType="numeric"
                                className="text-center text-3xl font-bold text-primary mb-6"
                            />

                            <View className="bg-iron-800 rounded-xl overflow-hidden border border-iron-700">
                                {percentages.map((pct) => (
                                    <View key={pct} className="flex-row justify-between p-4 border-b border-iron-700">
                                        <Text className="text-iron-500 font-bold">{(pct * 100)}%</Text>
                                        <Text className="text-iron-950 font-bold text-lg">
                                            {Math.round((parseFloat(oneRm) || 0) * pct)} kg
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    ) : (
                        <View>
                            <View className="flex-row gap-4 mb-6">
                                <View className="flex-1">
                                    <Text className="text-iron-500 mb-2">Body Weight</Text>
                                    <IronInput value={bw} onChangeText={setBw} keyboardType="numeric" placeholder="80" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-iron-500 mb-2">Total (SBD)</Text>
                                    <IronInput value={total} onChangeText={setTotal} keyboardType="numeric" placeholder="500" />
                                </View>
                            </View>

                            <View className="flex-row gap-4">
                                <View className="flex-1 bg-iron-200 p-4 rounded-xl border border-iron-300 items-center">
                                    <Text className="text-iron-950 font-bold text-xs uppercase mb-1">Wilks Score</Text>
                                    <Text className="text-iron-950 font-black text-2xl">{wilks.toFixed(2)}</Text>
                                </View>
                                <View className="flex-1 bg-iron-200 p-4 rounded-xl border border-iron-300 items-center">
                                    <Text className="text-iron-950 font-bold text-xs uppercase mb-1">DOTS Score</Text>
                                    <Text className="text-iron-950 font-black text-2xl">{dots.toFixed(2)}</Text>
                                </View>
                            </View>

                            <Text className="text-iron-500 text-xs mt-4 text-center">
                                *Using standard coefficients (Male default for MVP).
                            </Text>
                        </View>
                    )}
                </ScrollView>
            </View>
        </Modal>
    );
}
