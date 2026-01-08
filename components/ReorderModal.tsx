import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Modal, Text, TouchableOpacity, View } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { IronButton } from './IronButton';

interface ReorderModalProps {
    visible: boolean;
    onClose: () => void;
    items: { key: string, exerciseId: number, exerciseName: string }[];
    onSave: (newOrderKeys: string[]) => Promise<void>;
}

export function ReorderModal({ visible, onClose, items, onSave }: ReorderModalProps) {
    const [data, setData] = useState(items);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setData(items);
    }, [items, visible]);

    const handleSave = async () => {
        setLoading(true);
        try {
            await onSave(data.map(d => d.key)); // Passing Keys (ExID-Name) is fine, we just need order
            onClose();
        } catch (e) {
            Alert.alert('Error', 'Failed to save order');
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item, drag, isActive }: RenderItemParams<typeof items[0]>) => {
        return (
            <ScaleDecorator>
                <TouchableOpacity
                    onLongPress={drag}
                    disabled={isActive}
                    className={`flex-row items-center p-4 mb-2 rounded-lg border border-border ${isActive ? 'bg-primary/20' : 'bg-surface'}`}
                >
                    <Ionicons name="menu" size={24} color="#94a3b8" style={{ marginRight: 12 }} />
                    <Text className="text-white text-lg font-bold">{item.exerciseName}</Text>
                </TouchableOpacity>
            </ScaleDecorator>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View className="flex-1 bg-background pt-10 px-4">
                <View className="flex-row justify-between items-center mb-6">
                    <Text className="text-2xl font-bold text-white">Reorder Exercises</Text>
                    <IronButton label="Close" variant="ghost" size="sm" onPress={onClose} />
                </View>

                <Text className="text-textMuted mb-4">Long press and drag to reorder.</Text>

                <DraggableFlatList
                    data={data}
                    onDragEnd={({ data }) => setData(data)}
                    keyExtractor={(item) => item.key}
                    renderItem={renderItem}
                    containerStyle={{ flex: 1 }}
                />

                <View className="py-6">
                    <IronButton label="Save Order" onPress={handleSave} loading={loading} />
                </View>
            </View>
        </Modal>
    );
}
