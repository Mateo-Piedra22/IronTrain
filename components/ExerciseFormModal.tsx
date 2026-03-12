import { withAlpha } from '@/src/theme';
import { Plus } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '../src/hooks/useColors';
import { badgeService } from '../src/services/BadgeService';
import { CategoryService } from '../src/services/CategoryService';
import { ExerciseService } from '../src/services/ExerciseService';
import { confirm } from '../src/store/confirmStore';
import { Badge, Category, Exercise, ExerciseType } from '../src/types/db';
import { buildDuplicateMessage, findExerciseDuplicates, type ExerciseDuplicateCandidate } from '../src/utils/duplicates';
import { BadgeSelectorModal } from './BadgeSelectorModal';
import { BadgePill } from './ui/BadgePill';


interface ExerciseFormModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: () => void;
    initialData?: Exercise | null;
}

export function ExerciseFormModal({ visible, onClose, onSave, initialData }: ExerciseFormModalProps) {
    const colors = useColors();
    const ss = useMemo(() => StyleSheet.create({
        overlay: { flex: 1, backgroundColor: withAlpha(colors.background, '80') },
        modalContent: {
            backgroundColor: colors.surface,
            width: '100%',
            maxWidth: 380,
            borderRadius: 20,
            padding: 24,
            borderWidth: 1.5,
            borderColor: colors.border,
            elevation: 8,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.1,
            shadowRadius: 24,
        },
        title: { fontSize: 22, fontWeight: '900', color: colors.text, marginBottom: 20, letterSpacing: -0.8 },
        label: { color: colors.textMuted, fontSize: 10, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.2, marginLeft: 4 },
        input: {
            backgroundColor: colors.surfaceLighter,
            borderRadius: 16,
            padding: 16,
            fontSize: 16,
            color: colors.text,
            borderWidth: 1.5,
            borderColor: colors.border,
            marginBottom: 24,
            fontWeight: '700'
        },
        section: { marginBottom: 24 },
        chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
        catChip: {
            paddingHorizontal: 12, paddingVertical: 10,
            borderRadius: 14,
            backgroundColor: colors.surfaceLighter,
            borderWidth: 1.5,
            borderColor: colors.border,
            flexDirection: 'row',
            alignItems: 'center'
        },
        catDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
        catText: { fontSize: 13, fontWeight: '800', color: colors.text },

        badgePicker: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 6,
            minHeight: 52,
            backgroundColor: colors.surfaceLighter,
            borderRadius: 16,
            padding: 10,
            borderWidth: 1.5,
            borderColor: colors.border,
            alignItems: 'center'
        },
        badgePlaceholder: { flexDirection: 'row', alignItems: 'center', opacity: 0.6, gap: 6 },
        badgePlaceholderText: { fontSize: 13, color: colors.textMuted, fontWeight: '800' },
        addBadgeIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },

        typeContainer: { gap: 10 },
        typeCard: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            borderRadius: 16,
            backgroundColor: colors.surfaceLighter,
            borderWidth: 1.5,
            borderColor: colors.border
        },
        typeCardActive: {
            backgroundColor: withAlpha(colors.primary.DEFAULT, '08'),
            borderColor: colors.primary.DEFAULT
        },
        typeLabel: { fontSize: 14, fontWeight: '900', color: colors.text },
        typeLabelActive: { color: colors.primary.DEFAULT },
        typeDesc: { fontSize: 11, color: colors.textMuted, marginTop: 2, fontWeight: '600' },
        typeIndicator: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary.DEFAULT },

        footer: { flexDirection: 'row', gap: 12, marginTop: 12 },
        cancelBtn: { flex: 1, padding: 16, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.surfaceLighter },
        cancelText: { color: colors.textMuted, fontWeight: '800', fontSize: 15 },
        saveBtn: {
            flex: 1, backgroundColor: colors.primary.DEFAULT, padding: 16, borderRadius: 16, alignItems: 'center',
            shadowColor: colors.primary.DEFAULT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4
        },
        saveText: { color: colors.onPrimary, fontWeight: '900', fontSize: 15 }
    }), [colors]);
    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [type, setType] = useState<ExerciseType>('weight_reps');
    const [categories, setCategories] = useState<Category[]>([]);

    // Badges State
    const [allBadges, setAllBadges] = useState<Badge[]>([]);
    const [selectedBadgeIds, setSelectedBadgeIds] = useState<string[]>([]);
    const [showBadgeSelector, setShowBadgeSelector] = useState(false);


    useEffect(() => {
        if (visible) {
            loadInitialData();
        }
    }, [visible, initialData]);

    const loadInitialData = async () => {
        loadCategories();

        // Load all badges for mapping
        const sBadges = await badgeService.getAllBadges();
        setAllBadges(sBadges);

        if (initialData) {
            setName(initialData.name);
            setCategoryId(initialData.category_id);
            setType(initialData.type);

            // Load current exercise badges
            const exerciseBadges = await badgeService.getBadgesByExerciseId(initialData.id);
            setSelectedBadgeIds(exerciseBadges.map(b => b.id));
        } else {
            setName('');
            setCategoryId('');
            setType('weight_reps');
            setSelectedBadgeIds([]);
        }
    };


    const loadCategories = async () => {
        const cats = await CategoryService.getAll();
        setCategories(cats);
        if (!initialData && cats.length > 0 && !categoryId) {
            setCategoryId(cats[0].id);
        }
    };

    const handleSave = async () => {
        if (!name.trim() || !categoryId) return;

        const existingExercises = await ExerciseService.search('', categoryId);
        const candidates: ExerciseDuplicateCandidate[] = existingExercises.map((e: any) => ({
            id: e.id,
            name: e.name,
            category_id: e.category_id,
            type: e.type,
            badge_ids: (e.badges ?? []).map((b: any) => b.id).filter(Boolean),
            category_name: e.category_name,
        }));

        const duplicates = findExerciseDuplicates(
            {
                id: initialData?.id,
                name,
                category_id: categoryId,
                type,
                badge_ids: selectedBadgeIds,
            },
            candidates,
            3
        );

        if (duplicates.length > 0) {
            const preview = duplicates.map((d) => ({
                title: d.name,
                subtitle: d.category_name ?? undefined,
            }));

            confirm.custom({
                title: 'Posible duplicado',
                message: buildDuplicateMessage('Ya existe un ejercicio muy similar. ¿Querés guardarlo igual?', preview),
                variant: 'warning',
                buttons: [
                    { label: 'Cancelar', onPress: confirm.hide, variant: 'ghost' },
                    { label: 'Guardar igualmente', onPress: async () => { confirm.hide(); await doSave(); }, variant: 'solid' },
                ]
            });
            return;
        }

        await doSave();
    };

    const doSave = async () => {
        try {
            let exerciseId = '';
            if (initialData) {
                exerciseId = initialData.id;
                await ExerciseService.update(initialData.id, { name, category_id: categoryId, type });
            } else {
                exerciseId = await ExerciseService.create({ name, category_id: categoryId, type });
            }

            // Update Badges
            await badgeService.updateExerciseBadges(exerciseId, selectedBadgeIds);

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
        <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={ss.overlay}
            >
                <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
                    <GestureHandlerRootView style={{ flex: 1 }}>
                        <ScrollView
                            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}
                            keyboardShouldPersistTaps="handled"
                            bounces={false}
                            showsVerticalScrollIndicator={false}
                        >
                            <View style={ss.modalContent}>
                                <Text style={ss.title}>
                                    {initialData ? 'Editar ejercicio' : 'Nuevo ejercicio'}
                                </Text>

                                {/* Name */}
                                <Text style={ss.label}>Nombre</Text>
                                <TextInput
                                    value={name}
                                    onChangeText={setName}
                                    placeholder="Ej: Press de banca"
                                    placeholderTextColor={colors.textMuted}
                                    style={ss.input}
                                    accessibilityLabel="Nombre del ejercicio"
                                />

                                {/* Category */}
                                <Text style={ss.label}>Categoría</Text>
                                <View style={[ss.chipRow, ss.section]}>
                                    {categories.map(cat => {
                                        const isActive = categoryId === cat.id;
                                        const catColor = (cat as any).color || colors.primary.DEFAULT;
                                        return (
                                            <TouchableOpacity
                                                key={cat.id}
                                                onPress={() => setCategoryId(cat.id)}
                                                style={[
                                                    ss.catChip,
                                                    isActive && { backgroundColor: withAlpha(catColor, '14'), borderColor: catColor }
                                                ]}
                                                accessibilityRole="button"
                                            >
                                                <View style={[ss.catDot, { backgroundColor: catColor }]} />
                                                <Text style={[ss.catText, isActive && { color: catColor, fontWeight: '900' }]}>{cat.name}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                {/* Badges Selection */}
                                <Text style={ss.label}>Badges / Etiquetas</Text>
                                <View style={ss.section}>
                                    <TouchableOpacity
                                        onPress={() => setShowBadgeSelector(true)}
                                        style={ss.badgePicker}
                                    >
                                        {selectedBadgeIds.length === 0 ? (
                                            <View style={ss.badgePlaceholder}>
                                                <Plus size={16} color={colors.textMuted} />
                                                <Text style={ss.badgePlaceholderText}>Añadir badges...</Text>
                                            </View>
                                        ) : (
                                            <>
                                                {selectedBadgeIds.map(id => {
                                                    const badge = allBadges.find(b => b.id === id);
                                                    if (!badge) return null;
                                                    return (
                                                        <BadgePill
                                                            key={badge.id}
                                                            name={badge.name}
                                                            color={badge.color}
                                                            icon={badge.icon || undefined}
                                                            size="md"
                                                        />
                                                    );
                                                })}
                                                <View style={ss.addBadgeIcon}>
                                                    <Plus size={14} color={colors.textMuted} />
                                                </View>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>

                                {/* Type/Registro Selection */}
                                <Text style={ss.label}>Registro</Text>
                                <View style={[ss.typeContainer, ss.section]}>
                                    {EXERCISE_TYPES.map(t => {
                                        const isActive = type === t.id;
                                        return (
                                            <TouchableOpacity
                                                key={t.id}
                                                onPress={() => setType(t.id)}
                                                style={[ss.typeCard, isActive && ss.typeCardActive]}
                                                accessibilityRole="button"
                                            >
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[ss.typeLabel, isActive && ss.typeLabelActive]}>{t.label}</Text>
                                                    <Text style={ss.typeDesc}>{t.desc}</Text>
                                                </View>
                                                {isActive && <View style={ss.typeIndicator} />}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                <View style={ss.footer}>
                                    <TouchableOpacity onPress={onClose} style={ss.cancelBtn}>
                                        <Text style={ss.cancelText}>Cancelar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={handleSave} style={ss.saveBtn}>
                                        <Text style={ss.saveText}>Guardar</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </ScrollView>
                    </GestureHandlerRootView>
                </SafeAreaView>

                <BadgeSelectorModal
                    visible={showBadgeSelector}
                    onClose={() => setShowBadgeSelector(false)}
                    onSave={async (ids) => {
                        setSelectedBadgeIds(ids);
                        const updated = await badgeService.getAllBadges();
                        setAllBadges(updated);
                    }}
                    initialSelectedIds={selectedBadgeIds}
                />
            </KeyboardAvoidingView>
        </Modal>

    );
}


