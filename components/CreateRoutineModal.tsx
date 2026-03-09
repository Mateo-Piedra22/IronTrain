import { IronButton } from '@/components/IronButton';
import { IronInput } from '@/components/IronInput';
import { routineService } from '@/src/services/RoutineService';
import { ThemeFx } from '@/src/theme';
import { notify } from '@/src/utils/notify';
import { BookOpen } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '../src/hooks/useColors';

interface CreateRoutineModalProps {
    visible: boolean;
    onClose: () => void;
    onCreated: (id: string) => void;
    /** If provided, the modal is in "edit" mode */
    editRoutine?: { id: string; name: string; description?: string | null } | null;
}

export function CreateRoutineModal({ visible, onClose, onCreated, editRoutine }: CreateRoutineModalProps) {
    const colors = useColors();
    const st = useMemo(() => StyleSheet.create({
        overlay: { flex: 1, backgroundColor: ThemeFx.backdrop, justifyContent: 'center', alignItems: 'center', padding: 16 },
        keyboardView: { width: '100%', maxWidth: 380, alignItems: 'center' },
        container: {
            backgroundColor: colors.surface,
            width: '100%',
            borderRadius: 20,
            padding: 24,
            borderWidth: 1.5,
            borderColor: colors.border,
            elevation: 12,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.15,
            shadowRadius: 24,
        },
        titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
        iconCircle: {
            width: 44, height: 44, borderRadius: 14,
            backgroundColor: colors.primary.DEFAULT + '15',
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 1.5, borderColor: colors.primary.DEFAULT + '30',
        },
        title: { fontSize: 20, fontWeight: '900', color: colors.iron[950], letterSpacing: -0.6 },
        switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingHorizontal: 4 },
        switchInfo: { flex: 1, paddingRight: 16 },
        switchLabel: { color: colors.iron[950], fontWeight: '800', fontSize: 15 },
        switchDesc: { color: colors.iron[500], fontSize: 11, marginTop: 2, fontWeight: '600' },
        actions: { flexDirection: 'row', gap: 12 },
        actionWrapper: { flex: 1 }
    }), [colors]);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    const [loading, setLoading] = useState(false);

    const isEditing = !!editRoutine;

    React.useEffect(() => {
        if (visible && editRoutine) {
            setName(editRoutine.name);
            setDescription(editRoutine.description || '');
            // We don't have isPublic on editRoutine passed here yet, so we assume false or pass it later
        } else if (visible) {
            setName('');
            setDescription('');
            setIsPublic(false);
        }
    }, [visible, editRoutine]);

    const handleSave = async () => {
        if (!name.trim()) {
            notify.error('Datos incompletos', 'La rutina debe tener un nombre.');
            return;
        }

        setLoading(true);
        try {
            if (isEditing && editRoutine) {
                await routineService.updateRoutine(editRoutine.id, name.trim(), description.trim() || undefined, isPublic ? 1 : 0);
                notify.success('Actualizado', 'La rutina fue modificada.');
                onCreated(editRoutine.id);
            } else {
                const id = await routineService.createRoutine(name.trim(), description.trim() || undefined, isPublic ? 1 : 0);
                notify.success('¡Rutina Creada!', 'La rutina ha sido creada correctamente.');
                onCreated(id);
            }
            onClose();
        } catch (e: any) {
            notify.error('Error', e?.message || 'No se pudo guardar la rutina.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <SafeAreaView style={st.overlay} edges={['top', 'bottom', 'left', 'right']}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={st.keyboardView}
                >
                    <View style={st.container}>
                        {/* Title */}
                        <View style={st.titleRow}>
                            <View style={st.iconCircle}>
                                <BookOpen size={18} color={colors.primary.DEFAULT} />
                            </View>
                            <Text style={st.title}>
                                {isEditing ? 'Editar rutina' : 'Nueva rutina'}
                            </Text>
                        </View>

                        {/* Form */}
                        <IronInput
                            label="Nombre"
                            value={name}
                            onChangeText={setName}
                            autoFocus
                            placeholder="Ej: Push / Pull / Legs..."
                        />

                        <IronInput
                            label="Descripción (Opcional)"
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Breve detalle del objetivo..."
                            multiline
                            numberOfLines={3}
                        />

                        <View style={st.switchRow}>
                            <View style={st.switchInfo}>
                                <Text style={st.switchLabel}>Hacer Pública</Text>
                                <Text style={st.switchDesc}>Aparecerá en el Directorio Global para que otros la descarguen.</Text>
                            </View>
                            <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ true: colors.primary.DEFAULT }} />
                        </View>

                        {/* Buttons */}
                        <View style={st.actions}>
                            <View style={st.actionWrapper}>
                                <IronButton label="Cancelar" variant="ghost" onPress={onClose} />
                            </View>
                            <View style={st.actionWrapper}>
                                <IronButton
                                    label={loading ? 'Guardando...' : isEditing ? 'Guardar' : 'Crear'}
                                    onPress={handleSave}
                                    disabled={!name.trim() || loading}
                                    loading={loading}
                                />
                            </View>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
}


