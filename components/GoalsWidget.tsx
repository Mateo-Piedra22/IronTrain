import { IronButton } from '@/components/IronButton';
import { dbService } from '@/src/services/DatabaseService';
import { Colors } from '@/src/theme';
import { Goal } from '@/src/types/db';
import { Check, Plus, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { IronCard } from './IronCard';
import { IronInput } from './IronInput';

export function GoalsWidget() {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [modalVisible, setModalVisible] = useState(false);

    // Form State
    const [newTitle, setNewTitle] = useState('');
    const [newTarget, setNewTarget] = useState('');
    const [newCurrent, setNewCurrent] = useState('');

    useEffect(() => {
        loadGoals();
    }, []);

    const loadGoals = async () => {
        // Fetch active goals
        const result = await dbService.getAll<Goal>('SELECT * FROM goals WHERE completed = 0');
        setGoals(result);
    };

    const handleAddGoal = async () => {
        if (!newTitle || !newTarget) return;

        const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        const target = parseFloat(newTarget);
        const current = parseFloat(newCurrent) || 0;

        await dbService.run(
            'INSERT INTO goals (id, title, target_value, current_value, type, completed) VALUES (?, ?, ?, ?, ?, ?)',
            [id, newTitle, target, current, 'exercise_weight', 0]
        );

        setModalVisible(false);
        setNewTitle('');
        setNewTarget('');
        setNewCurrent('');
        loadGoals();
    };

    const handleDelete = async (id: string) => {
        await dbService.run('DELETE FROM goals WHERE id = ?', [id]);
        loadGoals();
    };

    const handleComplete = async (id: string) => {
        await dbService.run('UPDATE goals SET completed = 1 WHERE id = ?', [id]);
        loadGoals();
        // Maybe fireworks?
    };

    return (
        <IronCard className="mb-8">
            <View className="flex-row justify-between items-center mb-4">
                <Text className="text-iron-950 font-bold text-lg">Active Goals</Text>
                <TouchableOpacity onPress={() => setModalVisible(true)} className="bg-primary/20 p-2 rounded-full">
                    <Plus size={16} color={Colors.primary.dark} />
                </TouchableOpacity>
            </View>

            {goals.length === 0 ? (
                <Text className="text-iron-500 text-center py-4">No active goals. Set one!</Text>
            ) : (
                <View className="gap-4">
                    {goals.map((g) => {
                        const progress = g.target_value ? Math.min((g.current_value / g.target_value) * 100, 100) : 0;
                        return (
                            <View key={g.id}>
                                <View className="flex-row justify-between mb-1">
                                    <Text className="text-iron-500 font-bold">{g.title}</Text>
                                    <Text className="text-iron-500 text-xs">{g.current_value} / {g.target_value} kg</Text>
                                </View>
                                {/* Progress Bar */}
                                <View className="h-2 bg-iron-800 rounded-full overflow-hidden mb-2">
                                    <View style={{ width: `${progress}%` }} className="h-full bg-primary" />
                                </View>
                                <View className="flex-row justify-end gap-3">
                                    <TouchableOpacity onPress={() => handleDelete(g.id)}>
                                        <Trash2 size={16} color={Colors.iron[500]} />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleComplete(g.id)}>
                                        <Check size={16} color={Colors.green} />
                                    </TouchableOpacity>
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
                        <Text className="text-iron-950 font-bold text-xl mb-4">New Goal</Text>

                        <Text className="text-iron-500 mb-1">Goal Title</Text>
                        <IronInput value={newTitle} onChangeText={setNewTitle} placeholder="e.g. 100kg Bench" />

                        <View className="flex-row gap-4 mt-2">
                            <View className="flex-1">
                                <Text className="text-iron-500 mb-1">Target (kg)</Text>
                                <IronInput value={newTarget} onChangeText={setNewTarget} keyboardType="numeric" placeholder="100" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-iron-500 mb-1">Current (kg)</Text>
                                <IronInput value={newCurrent} onChangeText={setNewCurrent} keyboardType="numeric" placeholder="80" />
                            </View>
                        </View>

                        <View className="flex-row gap-4 mt-6">
                            <View className="flex-1">
                                <IronButton label="Cancel" onPress={() => setModalVisible(false)} variant="outline" />
                            </View>
                            <View className="flex-1">
                                <IronButton label="Set Goal" onPress={handleAddGoal} variant="solid" />
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>
        </IronCard>
    );
}
