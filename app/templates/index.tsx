import { IronButton } from '@/components/IronButton';
import { IronInput } from '@/components/IronInput';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { workoutService } from '@/src/services/WorkoutService';
import { ThemeFx, withAlpha } from '@/src/theme';
import { Workout } from '@/src/types/db';
import { notify } from '@/src/utils/notify';
import { FlashList } from '@shopify/flash-list';
import { format } from 'date-fns';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Dumbbell, Play, Plus, Trash2 } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '../../src/hooks/useColors';
import { confirm } from '../../src/store/confirmStore';

const FlashListAny = FlashList as any;

export default function TemplatesScreen() {
    const colors = useColors();
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

    const ss = useMemo(() => StyleSheet.create({
        header: {
            paddingTop: 16,
            paddingHorizontal: 16,
            paddingBottom: 14,
            borderBottomWidth: 1.5,
            borderBottomColor: colors.border,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: colors.background
        },
        headerTitle: {
            fontSize: 26,
            fontWeight: '900',
            color: colors.text,
            letterSpacing: -0.5
        },
        addBtn: {
            backgroundColor: colors.surface,
            padding: 10,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: colors.border,
            ...ThemeFx.shadowSm,
        },
        templateCard: {
            backgroundColor: colors.surface,
            padding: 14,
            borderRadius: 20,
            marginBottom: 12,
            borderWidth: 1.5,
            borderColor: colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            ...ThemeFx.shadowSm,
        },
        templateInfo: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14
        },
        templateIcon: {
            width: 48,
            height: 48,
            backgroundColor: withAlpha(colors.primary.DEFAULT, '10'),
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: withAlpha(colors.primary.DEFAULT, '20')
        },
        templateName: {
            color: colors.text,
            fontWeight: '800',
            fontSize: 16
        },
        templateSub: {
            color: colors.textMuted,
            fontSize: 11,
            marginTop: 2,
            fontWeight: '600'
        },
        templateActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8
        },
        playBtn: {
            width: 40,
            height: 40,
            backgroundColor: colors.primary.DEFAULT,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            ...ThemeFx.shadowSm,
            shadowColor: colors.primary.DEFAULT,
        },
        deleteBtn: {
            width: 40,
            height: 40,
            backgroundColor: colors.surfaceLighter,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center'
        },
        emptyContainer: {
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 80
        },
        emptyText: {
            color: colors.textMuted,
            textAlign: 'center',
            marginBottom: 16,
            fontWeight: '600'
        },
        modalOverlay: {
            flex: 1,
            backgroundColor: ThemeFx.backdrop,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16
        },
        modalSheet: {
            backgroundColor: colors.surface,
            width: '100%',
            maxWidth: 380,
            borderRadius: 24,
            padding: 24,
            borderWidth: 1.5,
            borderColor: colors.border,
            ...ThemeFx.shadowLg,
        },
        modalTitle: {
            fontSize: 20,
            fontWeight: '900',
            color: colors.text,
            marginBottom: 20,
            letterSpacing: -0.5,
        },
        modalActions: {
            flexDirection: 'row',
            gap: 12,
            marginTop: 16
        },
    }), [colors]);

    return (
        <SafeAreaWrapper style={{ backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={ss.header}>
                <Text style={ss.headerTitle}>Plantillas</Text>
                <TouchableOpacity onPress={() => setIsCreating(true)} style={ss.addBtn} activeOpacity={0.8}>
                    <Plus size={22} color={colors.primary.DEFAULT} />
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
                                <Dumbbell size={22} color={colors.primary.DEFAULT} />
                            </View>
                            <View>
                                <Text style={ss.templateName}>{item.name}</Text>
                                <Text style={ss.templateSub}>Toca para editar</Text>
                            </View>
                        </Pressable>

                        <View style={ss.templateActions}>
                            <TouchableOpacity onPress={() => handleLoad(item.id)} style={ss.playBtn} activeOpacity={0.8}>
                                <Play size={18} color={colors.onPrimary} fill={colors.onPrimary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(item.id)} style={ss.deleteBtn} activeOpacity={0.8}>
                                <Trash2 size={18} color={colors.red} />
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
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
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
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaWrapper>
    );
}
