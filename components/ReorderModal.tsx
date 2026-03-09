import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '../src/hooks/useColors';
import { confirm } from '../src/store/confirmStore';
import { IronButton } from './IronButton';

interface ReorderModalProps {
    visible: boolean;
    onClose: () => void;
    items: { key: string, exerciseId: number, exerciseName: string }[];
    onSave: (newOrderKeys: string[]) => Promise<void>;
}

export function ReorderModal({ visible, onClose, items, onSave }: ReorderModalProps) {
    const colors = useColors();
    const [data, setData] = useState(items);
    const [loading, setLoading] = useState(false);

    const ss = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
        header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
        headerTitle: { fontSize: 20, fontWeight: '900', color: colors.iron[950], letterSpacing: -0.5 },
        closeBtn: {
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 12,
            backgroundColor: colors.iron[100],
            borderWidth: 1.5,
            borderColor: colors.iron[200]
        },
        closeBtnText: { fontSize: 13, fontWeight: '800', color: colors.iron[500] },
        hint: { color: colors.iron[400], fontSize: 13, marginBottom: 20, fontWeight: '500' },
        item: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            marginBottom: 10,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: colors.iron[200],
            backgroundColor: colors.surface,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.05,
            shadowRadius: 10,
            elevation: 2,
        },
        itemActive: {
            backgroundColor: colors.primary.DEFAULT + '15',
            borderColor: colors.primary.DEFAULT + '40'
        },
        itemText: { color: colors.iron[950], fontSize: 15, fontWeight: '700' },
        dragHandle: { marginRight: 12 },
        footer: { paddingVertical: 24 },
    }), [colors]);

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
                    <Ionicons name="menu" size={22} color={colors.iron[400]} style={ss.dragHandle} />
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

                    <View style={ss.footer}>
                        <IronButton label="Guardar orden" onPress={handleSave} loading={loading} />
                    </View>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

