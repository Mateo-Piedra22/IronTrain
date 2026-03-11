import { IronButton } from '@/components/IronButton';
import { IronInput } from '@/components/IronInput';
import { ModalScreenOverlayHost } from '@/components/ui/ModalScreenOverlayHost';
import { ExerciseService } from '@/src/services/ExerciseService';
import { withAlpha } from '@/src/theme';
import { ExerciseType } from '@/src/types/db';
import { notify } from '@/src/utils/notify';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Dumbbell, FileText, Tag } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '../../src/hooks/useColors';

export default function ExerciseModal() {
    const colors = useColors();
    const router = useRouter();
    const params = useLocalSearchParams();
    const categoryId = params.categoryId as string;
    const exerciseId = params.exerciseId as string;

    const [name, setName] = useState('');
    const [type, setType] = useState<ExerciseType>('weight_reps');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => { if (exerciseId) loadExercise(); }, [exerciseId]);

    const loadExercise = async () => {
        try {
            const exercises = await ExerciseService.getAll();
            const ex = exercises.find(e => e.id === exerciseId);
            if (ex) { setName(ex.name); setType(ex.type); setNotes(ex.notes || ''); }
        } catch (e: any) {
            notify.error('Error', 'No se pudo cargar el ejercicio.');
        }
    };

    const handleSave = async () => {
        if (!name.trim()) { notify.error('Falta el nombre', 'El nombre es obligatorio para guardar el ejercicio.'); return; }
        setLoading(true);
        try {
            if (exerciseId) {
                await ExerciseService.update(exerciseId, { name, type, notes });
                notify.success('Actualizado', `"${name}" fue modificado.`);
            } else {
                await ExerciseService.create({ category_id: categoryId, name, type, notes });
                notify.success('Creado', `"${name}" fue añadido.`);
            }
            router.back();
        } catch (e: any) {
            notify.error('Error al guardar', e?.message || 'Error tratando de guardar tu progreso.');
        } finally { setLoading(false); }
    };

    const typeOptions: { id: ExerciseType; label: string; icon: string }[] = [
        { id: 'weight_reps', label: 'Peso + reps', icon: '🏋️' },
        { id: 'distance_time', label: 'Distancia + tiempo', icon: '🏃' },
        { id: 'weight_only', label: 'Solo peso', icon: '⚖️' },
        { id: 'reps_only', label: 'Solo reps', icon: '🔄' },
    ];

    const s = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        scrollContent: { padding: 16, flexGrow: 1 },
        section: { marginBottom: 20 },
        sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
        sectionIconCircle: { width: 28, height: 28, borderRadius: 8, backgroundColor: withAlpha(colors.primary.DEFAULT, '15'), justifyContent: 'center', alignItems: 'center' },
        sectionLabel: { fontSize: 12, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
        typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
        typeCard: { width: '48%' as any, flexBasis: '48%', flexGrow: 0, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10 },
        typeCardActive: { borderColor: colors.primary.DEFAULT, backgroundColor: withAlpha(colors.primary.DEFAULT, '12') },
        typeIcon: { fontSize: 18 },
        typeLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, flex: 1 },
        typeLabelActive: { color: colors.primary.DEFAULT, fontWeight: '800' },
    }), [colors]);

    return (
        <ModalScreenOverlayHost>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.container}>
                <Stack.Screen options={{
                    title: exerciseId ? 'Editar ejercicio' : 'Nuevo ejercicio',
                    presentation: 'modal',
                    headerTitleStyle: { fontWeight: '900', color: colors.text },
                    headerStyle: { backgroundColor: colors.background },
                    headerTintColor: colors.primary.DEFAULT,
                }} />

                <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled" bounces={false}>
                    {/* Exercise Name */}
                    <View style={s.section}>
                        <View style={s.sectionHeader}>
                            <View style={s.sectionIconCircle}><Tag size={14} color={colors.primary.DEFAULT} /></View>
                            <Text style={s.sectionLabel}>Nombre del ejercicio</Text>
                        </View>
                        <IronInput
                            placeholder="Ej: Press de banca"
                            value={name}
                            onChangeText={setName}
                            autoFocus={!exerciseId}
                        />
                    </View>

                    {/* Type */}
                    <View style={s.section}>
                        <View style={s.sectionHeader}>
                            <View style={s.sectionIconCircle}><Dumbbell size={14} color={colors.primary.DEFAULT} /></View>
                            <Text style={s.sectionLabel}>Tipo</Text>
                        </View>
                        <View style={s.typeGrid}>
                            {typeOptions.map((t) => (
                                <TouchableOpacity
                                    key={t.id}
                                    onPress={() => setType(t.id)}
                                    style={[s.typeCard, type === t.id && s.typeCardActive]}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Seleccionar tipo ${t.label}`}
                                >
                                    <Text style={s.typeIcon}>{t.icon}</Text>
                                    <Text style={[s.typeLabel, type === t.id && s.typeLabelActive]}>{t.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Notes */}
                    <View style={s.section}>
                        <View style={s.sectionHeader}>
                            <View style={s.sectionIconCircle}><FileText size={14} color={colors.primary.DEFAULT} /></View>
                            <Text style={s.sectionLabel}>Notas (opcional)</Text>
                        </View>
                        <IronInput
                            placeholder="Ej: ancho de agarre…"
                            value={notes}
                            onChangeText={setNotes}
                            multiline
                            numberOfLines={3}
                        />
                    </View>

                    <View style={{ marginTop: 'auto', paddingTop: 16, paddingBottom: 16 }}>
                        <IronButton
                            label={exerciseId ? "Actualizar ejercicio" : "Crear ejercicio"}
                            onPress={handleSave}
                            loading={loading}
                        />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </ModalScreenOverlayHost>
    );
}
