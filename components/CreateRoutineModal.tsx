import { IronButton } from '@/components/IronButton';
import { IronInput } from '@/components/IronInput';
import { routineService } from '@/src/services/RoutineService';
import { Colors } from '@/src/theme';
import { notify } from '@/src/utils/notify';
import { BookOpen } from 'lucide-react-native';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface CreateRoutineModalProps {
    visible: boolean;
    onClose: () => void;
    onCreated: (id: string) => void;
    /** If provided, the modal is in "edit" mode */
    editRoutine?: { id: string; name: string; description?: string | null } | null;
}

export function CreateRoutineModal({ visible, onClose, onCreated, editRoutine }: CreateRoutineModalProps) {
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
                                <BookOpen size={18} color={Colors.primary.DEFAULT} />
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

                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: 4 }}>
                            <View style={{ flex: 1, paddingRight: 16 }}>
                                <Text style={{ color: Colors.iron[950], fontWeight: 'bold' }}>Hacer Pública</Text>
                                <Text style={{ color: Colors.iron[500], fontSize: 11 }}>Aparecerá en el Directorio Global para que otros la descarguen.</Text>
                            </View>
                            <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ true: Colors.primary.DEFAULT }} />
                        </View>

                        {/* Buttons — matching CategoryManager pattern exactly */}
                        <View style={st.actions}>
                            <View style={{ flex: 1 }}>
                                <IronButton label="Cancelar" variant="ghost" onPress={onClose} />
                            </View>
                            <View style={{ flex: 1 }}>
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

const st = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    keyboardView: {
        width: '100%',
        maxWidth: 360,
        alignItems: 'center',
    },
    container: {
        backgroundColor: Colors.surface,
        width: '100%',
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
    },
    iconCircle: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: Colors.primary.DEFAULT + '12',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: '900',
        color: Colors.iron[950],
        letterSpacing: -0.3,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 4,
    },
});
