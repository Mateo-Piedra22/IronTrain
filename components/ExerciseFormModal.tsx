import { Colors } from '@/src/theme';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CategoryService } from '../src/services/CategoryService';
import { ExerciseService } from '../src/services/ExerciseService';
import { Category, Exercise, ExerciseType } from '../src/types/db';

interface ExerciseFormModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: () => void;
    initialData?: Exercise | null;
}

export function ExerciseFormModal({ visible, onClose, onSave, initialData }: ExerciseFormModalProps) {
    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [type, setType] = useState<ExerciseType>('weight_reps');
    const [categories, setCategories] = useState<Category[]>([]);

    useEffect(() => {
        if (visible) {
            loadCategories();
            if (initialData) {
                setName(initialData.name);
                setCategoryId(initialData.category_id);
                setType(initialData.type);
            } else {
                setName('');
                setCategoryId('');
                setType('weight_reps');
            }
        }
    }, [visible, initialData]);

    const loadCategories = async () => {
        const cats = await CategoryService.getAll();
        setCategories(cats);
        if (!initialData && cats.length > 0 && !categoryId) {
            setCategoryId(cats[0].id);
        }
    };

    const handleSave = async () => {
        if (!name.trim() || !categoryId) return;
        try {
            if (initialData) {
                await ExerciseService.update(initialData.id, { name, category_id: categoryId, type });
            } else {
                await ExerciseService.create({ name, category_id: categoryId, type });
            }
            onSave();
            onClose();
        } catch (e) {
            /* handled by caller */
        }
    };

    const EXERCISE_TYPES: { id: ExerciseType; label: string; desc: string }[] = [
        { id: 'weight_reps', label: 'Peso + reps', desc: 'Ej: Press banca, sentadilla' },
        { id: 'reps_only', label: 'Solo reps', desc: 'Ej: Dominadas, flexiones' },
        { id: 'distance_time', label: 'Distancia + tiempo', desc: 'Ej: Correr, nadar' },
        { id: 'weight_only', label: 'Solo peso', desc: 'Ej: Peso muerto a 1RM' },
    ];

    return (
        <Modal visible={visible} animationType="fade" transparent>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 }}
            >
                <View style={{
                    backgroundColor: Colors.surface, width: '100%', maxWidth: 360,
                    borderRadius: 20, padding: 24, borderWidth: 1, borderColor: Colors.iron[700],
                    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 24,
                }}>
                    <Text style={{ fontSize: 20, fontWeight: '900', color: Colors.iron[950], marginBottom: 20, letterSpacing: -0.3 }}>
                        {initialData ? 'Editar ejercicio' : 'Nuevo ejercicio'}
                    </Text>

                    {/* Name */}
                    <Text style={{ color: Colors.iron[500], fontSize: 10, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Nombre</Text>
                    <TextInput
                        value={name}
                        onChangeText={setName}
                        placeholder="Ej: Press de banca"
                        placeholderTextColor={Colors.iron[400]}
                        style={{
                            backgroundColor: Colors.iron[200], borderRadius: 12, padding: 14,
                            fontSize: 16, color: Colors.iron[950], borderWidth: 1, borderColor: Colors.iron[300],
                            marginBottom: 20
                        }}
                        accessibilityLabel="Nombre del ejercicio"
                    />

                    {/* Category */}
                    <Text style={{ color: Colors.iron[500], fontSize: 10, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Categoría</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                        {categories.map(cat => {
                            const isActive = categoryId === cat.id;
                            const catColor = (cat as any).color || Colors.primary.DEFAULT;
                            return (
                                <TouchableOpacity
                                    key={cat.id}
                                    onPress={() => setCategoryId(cat.id)}
                                    style={[
                                        { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.iron[200], borderWidth: 1, borderColor: Colors.iron[300], flexDirection: 'row', alignItems: 'center' },
                                        isActive && { backgroundColor: catColor + '18', borderColor: catColor }
                                    ]}
                                    accessibilityRole="button"
                                >
                                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: catColor, marginRight: 6 }} />
                                    <Text style={[{ fontSize: 13, fontWeight: '600', color: Colors.iron[600] }, isActive && { color: catColor, fontWeight: '700' }]}>{cat.name}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Type */}
                    <Text style={{ color: Colors.iron[500], fontSize: 10, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Registro</Text>
                    <View style={{ gap: 8, marginBottom: 24 }}>
                        {EXERCISE_TYPES.map(t => {
                            const isActive = type === t.id;
                            return (
                                <TouchableOpacity
                                    key={t.id}
                                    onPress={() => setType(t.id)}
                                    style={[
                                        { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, backgroundColor: Colors.iron[200], borderWidth: 1, borderColor: Colors.iron[300] },
                                        isActive && { backgroundColor: Colors.primary.DEFAULT + '12', borderColor: Colors.primary.DEFAULT }
                                    ]}
                                    accessibilityRole="button"
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={[{ fontSize: 14, fontWeight: '700', color: Colors.iron[950] }, isActive && { color: Colors.primary.DEFAULT }]}>{t.label}</Text>
                                        <Text style={{ fontSize: 11, color: Colors.iron[400], marginTop: 2 }}>{t.desc}</Text>
                                    </View>
                                    {isActive && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary.DEFAULT }} />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                            <TouchableOpacity onPress={onClose} style={{ padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.iron[300], alignItems: 'center' }}>
                                <Text style={{ color: Colors.iron[600], fontWeight: '700', fontSize: 14 }}>Cancelar</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={{ flex: 1 }}>
                            <TouchableOpacity onPress={handleSave} style={{ backgroundColor: Colors.primary.DEFAULT, padding: 14, borderRadius: 12, alignItems: 'center' }}>
                                <Text style={{ color: Colors.surface, fontWeight: '800', fontSize: 14 }}>Guardar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const ss = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: Colors.iron[900], borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '85%', borderTopWidth: 1, borderTopColor: Colors.iron[700] },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.iron[200] },
    headerBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: Colors.iron[200], borderWidth: 1, borderColor: Colors.iron[300], justifyContent: 'center', alignItems: 'center' },
    headerTitle: { color: Colors.iron[950], fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
    label: { fontSize: 10, fontWeight: '800', color: Colors.iron[400], textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
    input: { backgroundColor: Colors.surface, color: Colors.iron[950], padding: 16, borderRadius: 14, fontSize: 16, marginBottom: 24, borderWidth: 1, borderColor: Colors.iron[700], fontWeight: '600' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
    catChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.iron[700], backgroundColor: 'transparent' },
    catChipText: { fontSize: 13, fontWeight: '700', color: Colors.iron[500] },
    typeCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 14, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.iron[700] },
    typeCardActive: { borderColor: Colors.primary.DEFAULT, backgroundColor: Colors.primary.DEFAULT + '08' },
    typeLabel: { fontSize: 14, fontWeight: '800', color: Colors.iron[950] },
    typeDesc: { fontSize: 11, color: Colors.iron[400], marginTop: 2 },
    activeIndicator: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary.DEFAULT },
    bottomBar: { padding: 16, backgroundColor: Colors.iron[900], borderTopWidth: 1, borderTopColor: Colors.iron[200], marginBottom: 16 },
    saveBtn: { backgroundColor: Colors.primary.DEFAULT, paddingVertical: 16, borderRadius: 14, alignItems: 'center', shadowColor: Colors.primary.DEFAULT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
    saveBtnText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 0.3 },
});
