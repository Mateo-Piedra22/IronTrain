import { IronButton } from '@/components/IronButton';
import { IronInput } from '@/components/IronInput';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { workoutService } from '@/src/services/WorkoutService';
import { Colors } from '@/src/theme';
import { Workout } from '@/src/types/db';
import { notify } from '@/src/utils/notify';
import { FlashList } from '@shopify/flash-list';
import { format } from 'date-fns';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Dumbbell, Play, Plus, Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { confirm } from '../../src/store/confirmStore';

const FlashListAny = FlashList as any;

export default function TemplatesScreen() {
    const router = useRouter();
    const [templates, setTemplates] = useState<Workout[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');

    const loadTemplates = useCallback(async () => {
        setLoading(true);
        try {
            const data = await workoutService.getTemplates();
            setTemplates(data);
        } catch (e) {
            /* handled */
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { loadTemplates(); }, [loadTemplates]));

    const handleCreate = async () => {
        if (!newTemplateName.trim()) return;
        try {
            const id = await workoutService.createTemplate(newTemplateName);
            setNewTemplateName('');
            setIsCreating(false);
            router.push({ pathname: '/workout/[id]', params: { id } });
        } catch (error: any) {
            notify.error('Plantilla fallida', error?.message || 'Hubo un error al intentar crearla al guardar.');
        }
    };

    const handleLoad = (templateId: string) => {
        confirm.ask(
            'Iniciar entrenamiento',
            '¿Usar esta plantilla para la sesión de hoy?',
            async () => {
                try {
                    const today = format(new Date(), 'yyyy-MM-dd');
                    const newId = await workoutService.loadTemplate(templateId, today);
                    router.push({ pathname: '/workout/[id]', params: { id: newId } });
                } catch (e: any) {
                    notify.error('Error al cargar', e?.message || 'Hubo un error al leer la plantilla.');
                }
            },
            'Iniciar'
        );
    };

    const handleDelete = (id: string) => {
        confirm.destructive(
            'Eliminar',
            '¿Eliminar esta plantilla permanentemente?',
            async () => { await workoutService.delete(id); loadTemplates(); },
            'Eliminar'
        );
    };

    return (
        <SafeAreaWrapper style={{ backgroundColor: Colors.iron[900] }} edges={['top', 'left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={ss.header}>
                <Text style={ss.headerTitle}>Plantillas</Text>
                <TouchableOpacity onPress={() => setIsCreating(true)} style={ss.addBtn} activeOpacity={0.8}>
                    <Plus size={22} color={Colors.primary.DEFAULT} />
                </TouchableOpacity>
            </View>

            <FlashListAny
                data={templates}
                estimatedItemSize={100}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }: { item: Workout }) => (
                    <View style={ss.templateCard}>
                        <Pressable style={ss.templateInfo} onPress={() => router.push({ pathname: '/workout/[id]', params: { id: item.id } })}>
                            <View style={ss.templateIcon}>
                                <Dumbbell size={22} color={Colors.primary.DEFAULT} />
                            </View>
                            <View>
                                <Text style={ss.templateName}>{item.name}</Text>
                                <Text style={ss.templateSub}>Toca para editar</Text>
                            </View>
                        </Pressable>

                        <View style={ss.templateActions}>
                            <TouchableOpacity onPress={() => handleLoad(item.id)} style={ss.playBtn} activeOpacity={0.8}>
                                <Play size={18} color="white" fill="white" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(item.id)} style={ss.deleteBtn} activeOpacity={0.8}>
                                <Trash2 size={18} color={Colors.red} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
                ListEmptyComponent={
                    <View style={ss.emptyContainer}>
                        <Text style={ss.emptyText}>Todavía no hay plantillas.</Text>
                        <IronButton label="Crear primera plantilla" onPress={() => setIsCreating(true)} />
                    </View>
                }
            />

            {/* Create Modal */}
            <Modal transparent visible={isCreating} animationType="fade" onRequestClose={() => setIsCreating(false)}>
                <View style={ss.modalOverlay}>
                    <View style={ss.modalSheet}>
                        <Text style={ss.modalTitle}>Nueva plantilla</Text>
                        <IronInput placeholder="Nombre de plantilla (ej: Piernas)" value={newTemplateName} onChangeText={setNewTemplateName} autoFocus />
                        <View style={ss.modalActions}>
                            <View style={{ flex: 1 }}><IronButton label="Cancelar" variant="ghost" onPress={() => setIsCreating(false)} /></View>
                            <View style={{ flex: 1 }}><IronButton label="Crear" onPress={handleCreate} /></View>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaWrapper>
    );
}

const ss = StyleSheet.create({
    header: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.iron[200], flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.iron[900] },
    headerTitle: { fontSize: 26, fontWeight: '900', color: Colors.iron[950], letterSpacing: -0.5 },
    addBtn: { backgroundColor: Colors.surface, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: Colors.iron[700], elevation: 1 },
    templateCard: { backgroundColor: Colors.surface, padding: 14, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.iron[700], elevation: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    templateInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
    templateIcon: { width: 48, height: 48, backgroundColor: Colors.primary.DEFAULT + '10', borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.primary.DEFAULT + '20' },
    templateName: { color: Colors.iron[950], fontWeight: '800', fontSize: 16 },
    templateSub: { color: Colors.iron[400], fontSize: 11, marginTop: 2, fontWeight: '600' },
    templateActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    playBtn: { width: 40, height: 40, backgroundColor: Colors.primary.DEFAULT, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.primary.DEFAULT, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 2 },
    deleteBtn: { width: 40, height: 40, backgroundColor: Colors.iron[200], borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
    emptyText: { color: Colors.iron[400], textAlign: 'center', marginBottom: 16, fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    modalSheet: { backgroundColor: Colors.surface, width: '100%', maxWidth: 380, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: Colors.iron[700], elevation: 2 },
    modalTitle: { fontSize: 18, fontWeight: '900', color: Colors.iron[950], marginBottom: 20 },
    modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
});
