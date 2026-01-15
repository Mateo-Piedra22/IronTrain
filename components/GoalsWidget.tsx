import { IronButton } from '@/components/IronButton';
import { GoalsService } from '@/src/services/GoalsService';
import { Colors } from '@/src/theme';
import { Goal } from '@/src/types/db';
import { Check, Plus, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Text, TouchableOpacity, View } from 'react-native';
import { IronCard } from './IronCard';
import { IronInput } from './IronInput';

export function GoalsWidget() {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [newTitle, setNewTitle] = useState('');
    const [newTarget, setNewTarget] = useState('');
    const [newCurrent, setNewCurrent] = useState('');

    useEffect(() => {
        loadGoals();
    }, []);

    const loadGoals = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await GoalsService.getActiveGoals();
            setGoals(result);
        } catch (e: any) {
            setError(e?.message ?? 'No se pudieron cargar las metas');
            setGoals([]);
        } finally {
            setLoading(false);
        }
    };

    const handleAddGoal = async () => {
        if (!newTitle || !newTarget) return;
        try {
            const target = parseFloat(newTarget);
            const current = newCurrent ? parseFloat(newCurrent) : 0;
            await GoalsService.createGoal({
                title: newTitle,
                targetValue: target,
                currentValue: Number.isFinite(current) ? current : 0
            });

            setModalVisible(false);
            setNewTitle('');
            setNewTarget('');
            setNewCurrent('');
            loadGoals();
        } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'No se pudo crear la meta');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await GoalsService.deleteGoal(id);
            loadGoals();
        } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'No se pudo eliminar la meta');
        }
    };

    const handleComplete = async (id: string) => {
        try {
            await GoalsService.completeGoal(id);
            loadGoals();
        } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'No se pudo completar la meta');
        }
    };

    return (
        <IronCard className="mb-8">
            <View className="flex-row justify-between items-center mb-4">
                <Text className="text-iron-950 font-bold text-lg">Metas activas</Text>
                <TouchableOpacity
                    onPress={() => setModalVisible(true)}
                    className="bg-primary/20 p-2 rounded-full"
                    accessibilityRole="button"
                    accessibilityLabel="Crear meta"
                >
                    <Plus size={16} color={Colors.primary.dark} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View className="py-8 items-center justify-center">
                    <ActivityIndicator color={Colors.primary.DEFAULT} />
                    <Text className="text-iron-500 mt-3">Cargando metas...</Text>
                </View>
            ) : error ? (
                <Text className="text-iron-500 py-4">{error}</Text>
            ) : goals.length === 0 ? (
                <Text className="text-iron-500 text-center py-4">No hay metas activas.</Text>
            ) : (
                <View className="gap-4">
                    {goals.map((g) => {
                        const progress = g.target_value ? Math.min((g.current_value / g.target_value) * 100, 100) : 0;
                        return (
                            <View key={g.id}>
                                <View className="flex-row justify-between mb-1">
                                    <Text className="text-iron-950 font-bold flex-1 pr-2">{g.title}</Text>
                                    <Text className="text-iron-500 text-xs">{g.current_value} / {g.target_value} kg</Text>
                                </View>
                                <View className="h-2 bg-iron-800 rounded-full overflow-hidden mb-2">
                                    <View style={{ width: `${progress}%` }} className="h-full bg-primary" />
                                </View>
                                <View className="flex-row justify-between items-center">
                                    <Text className="text-iron-500 text-xs font-bold">{Math.round(progress)}%</Text>
                                    <View className="flex-row justify-end gap-3">
                                        <TouchableOpacity
                                            onPress={() => handleDelete(g.id)}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Eliminar meta ${g.title}`}
                                        >
                                            <Trash2 size={16} color={Colors.iron[500]} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => handleComplete(g.id)}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Completar meta ${g.title}`}
                                        >
                                            <Check size={16} color={Colors.green} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}

            {/* Add Goal Modal */}
            <Modal visible={modalVisible} transparent animationType="slide">
                <View className="flex-1 justify-end bg-iron-950/50">
                    <View className="bg-iron-900 p-6 rounded-t-3xl border-t border-iron-700">
                        <Text className="text-iron-950 font-bold text-xl mb-4">Nueva meta</Text>

                        <Text className="text-iron-500 mb-1">Título</Text>
                        <IronInput value={newTitle} onChangeText={setNewTitle} placeholder="p. ej. Press banca 100kg" />

                        <View className="flex-row gap-4 mt-2">
                            <View className="flex-1">
                                <Text className="text-iron-500 mb-1">Objetivo (kg)</Text>
                                <IronInput value={newTarget} onChangeText={setNewTarget} keyboardType="numeric" placeholder="100" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-iron-500 mb-1">Actual (kg)</Text>
                                <IronInput value={newCurrent} onChangeText={setNewCurrent} keyboardType="numeric" placeholder="80" />
                            </View>
                        </View>

                        <View className="flex-row gap-4 mt-6">
                            <View className="flex-1">
                                <IronButton label="Cancelar" onPress={() => setModalVisible(false)} variant="outline" />
                            </View>
                            <View className="flex-1">
                                <IronButton label="Guardar" onPress={handleAddGoal} variant="solid" />
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>
        </IronCard>
    );
}
