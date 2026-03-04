import { Colors } from '@/src/theme';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { SafeAreaView } from 'react-native-safe-area-context';
import { confirm } from '../src/store/confirmStore';
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
            await onSave(data.map(d => d.key));
            onClose();
        } catch (e) {
            confirm.error('Error', 'No se pudo guardar el orden.');
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
                    style={[ss.item, isActive && ss.itemActive]}
                >
                    <Ionicons name="menu" size={22} color={Colors.iron[400]} style={{ marginRight: 12 }} />
                    <Text style={ss.itemText}>{item.exerciseName}</Text>
                </TouchableOpacity>
            </ScaleDecorator>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={ss.container}>
                <View style={ss.content}>
                    <View style={ss.header}>
                        <Text style={ss.headerTitle}>Reordenar ejercicios</Text>
                        <TouchableOpacity onPress={onClose} style={ss.closeBtn} accessibilityRole="button" accessibilityLabel="Cerrar">
                            <Text style={ss.closeBtnText}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={ss.hint}>Mantené presionado y arrastrá para reordenar.</Text>

                    <DraggableFlatList
                        data={data}
                        onDragEnd={({ data }) => setData(data)}
                        keyExtractor={(item) => item.key}
                        renderItem={renderItem}
                        containerStyle={{ flex: 1 }}
                    />

                    <View style={{ paddingVertical: 24 }}>
                        <IronButton label="Guardar orden" onPress={handleSave} loading={loading} />
                    </View>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const ss = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.iron[900] },
    content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    headerTitle: { fontSize: 20, fontWeight: '900', color: Colors.iron[950], letterSpacing: -0.5 },
    closeBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.iron[200], borderWidth: 1, borderColor: Colors.iron[300] },
    closeBtnText: { fontSize: 13, fontWeight: '700', color: Colors.iron[500] },
    hint: { color: Colors.iron[400], fontSize: 13, marginBottom: 16 },
    item: { flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: 8, borderRadius: 14, borderWidth: 1, borderColor: Colors.iron[700], backgroundColor: Colors.surface },
    itemActive: { backgroundColor: Colors.primary.DEFAULT + '15', borderColor: Colors.primary.DEFAULT + '40' },
    itemText: { color: Colors.iron[950], fontSize: 15, fontWeight: '700' },
});
