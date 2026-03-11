import { withAlpha } from '@/src/theme';
import { Badge } from '@/src/types/db';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, Edit2, Palette, Plus, Search, Trash2, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, KeyboardAvoidingView, LayoutAnimation, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, UIManager, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '../src/hooks/useColors';
import { badgeService } from '../src/services/BadgeService';
import { BadgePill } from './ui/BadgePill';
import { ColorPicker } from './ui/ColorPicker';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface BadgeSelectorModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (selectedIds: string[]) => void;
    initialSelectedIds: string[];
}

export function BadgeSelectorModal({ visible, onClose, onSave, initialSelectedIds }: BadgeSelectorModalProps) {
    const colors = useColors();
    const [allBadges, setAllBadges] = useState<Badge[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
    const [search, setSearch] = useState('');

    const [isCreating, setIsCreating] = useState(false);
    const [editingBadge, setEditingBadge] = useState<Badge | null>(null);
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState(colors.blue);
    const [newGroup, setNewGroup] = useState<'equipamiento' | 'variacion' | 'posicion' | 'otro'>('otro');
    const [showColorPicker, setShowColorPicker] = useState(false);

    const styles = useMemo(() => StyleSheet.create({
        overlay: { flex: 1, backgroundColor: withAlpha(colors.background, '80') },
        scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
        container: {
            width: '100%',
            maxWidth: 400,
            backgroundColor: colors.surface,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: colors.border,
            elevation: 12,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.15,
            shadowRadius: 24,
            overflow: 'hidden',
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 18,
            borderBottomWidth: 1.5,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
        },
        headerTitle: { fontSize: 18, fontWeight: '900', color: colors.text, letterSpacing: -0.6 },
        headerBtn: {
            width: 36, height: 36, borderRadius: 12,
            backgroundColor: colors.surfaceLighter, justifyContent: 'center', alignItems: 'center',
            borderWidth: 1.5, borderColor: colors.border
        },

        // Selection View
        listHeader: { flexDirection: 'row', padding: 16, gap: 10, alignItems: 'center' },
        searchBar: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surfaceLighter,
            paddingHorizontal: 14,
            height: 48,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: colors.border
        },
        searchInput: { flex: 1, marginLeft: 10, fontSize: 14, color: colors.text, fontWeight: '700' },
        addBtn: { width: 48, height: 48, backgroundColor: colors.primary.DEFAULT, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },

        listContent: { padding: 16, paddingTop: 4 },
        section: { marginBottom: 24 },
        sectionTitle: { fontSize: 10, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12, marginLeft: 4 },
        badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
        badgeItem: { position: 'relative' },
        badgeItemSelected: {
            transform: [{ scale: 1.05 }],
            shadowColor: colors.primary.DEFAULT,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
        },
        editBadgeIndicator: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: colors.black, shadowOpacity: 0.1, shadowRadius: 2 },

        footer: { padding: 16, borderTopWidth: 1.5, borderTopColor: colors.border, backgroundColor: colors.surface },
        confirmBtn: { backgroundColor: colors.primary.DEFAULT, height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
        confirmBtnText: { color: colors.onPrimary, fontWeight: '900', fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.5 },

        // Form View
        formContent: { padding: 20 },
        label: { fontSize: 10, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 2 },
        input: {
            backgroundColor: colors.surfaceLighter,
            borderRadius: 14,
            padding: 16,
            fontSize: 16,
            color: colors.text,
            borderWidth: 1.5,
            borderColor: colors.border,
            fontWeight: '700',
            marginBottom: 20
        },
        groupPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
        groupChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.surfaceLighter, borderWidth: 1.5, borderColor: colors.border },
        groupChipActive: { backgroundColor: withAlpha(colors.primary.DEFAULT, '12'), borderColor: colors.primary.DEFAULT },
        groupChipText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
        groupChipTextActive: { color: colors.primary.DEFAULT },
        colorSelector: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.surfaceLighter,
            padding: 14,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: colors.border
        },
        colorDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.white },
        colorHex: { color: colors.text, fontWeight: '800', fontSize: 14 },
        previewContainer: { marginTop: 24, alignItems: 'center', backgroundColor: colors.surfaceLighter, padding: 24, borderRadius: 20, borderStyle: 'dashed', borderWidth: 2, borderColor: withAlpha(colors.border, '50') },
        formFooter: { flexDirection: 'row', gap: 12, marginTop: 32 },
        deleteBtn: { width: 54, height: 54, borderRadius: 16, backgroundColor: withAlpha(colors.red, '10'), borderWidth: 1.5, borderColor: withAlpha(colors.red, '25'), justifyContent: 'center', alignItems: 'center' },
        saveBtn: { flex: 1, height: 54, backgroundColor: colors.primary.DEFAULT, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
        disabledBtn: { opacity: 0.5 },
        saveBtnText: { color: colors.onPrimary, fontWeight: '900', fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.5 }
    }), [colors]);

    useEffect(() => {
        if (visible) {
            loadBadges();
            setSelectedIds(initialSelectedIds);
            setIsCreating(false);
            setEditingBadge(null);
            setNewColor(colors.blue);
        }
    }, [visible, initialSelectedIds, colors.blue]);

    const loadBadges = async () => {
        const badges = await badgeService.getAllBadges();
        setAllBadges(badges);
    };

    const toggleBadge = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleCreateBadge = async () => {
        if (!newName.trim()) return;
        try {
            if (editingBadge) {
                await badgeService.updateBadge(editingBadge.id, {
                    name: newName,
                    color: newColor,
                    group_name: newGroup
                });
            } else {
                await badgeService.createCustomBadge({
                    name: newName,
                    color: newColor,
                    group_name: newGroup,
                });
            }
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setIsCreating(false);
            setEditingBadge(null);
            setNewName('');
            loadBadges();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {
            console.error('Error saving badge', e);
        }
    };

    const handleDeleteBadge = async (id: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            await badgeService.deleteBadge(id);
            setSelectedIds(prev => prev.filter(i => i !== id));
            loadBadges();
            setIsCreating(false);
            setEditingBadge(null);
        } catch (e) {
            console.error('Error deleting badge', e);
        }
    };

    const startEditing = (badge: Badge) => {
        if (badge.is_system) return;
        setEditingBadge(badge);
        setNewName(badge.name);
        setNewColor(badge.color);
        setNewGroup(badge.group_name || 'otro');
        setIsCreating(true);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    };

    const filteredBadges = allBadges.filter(b =>
        b.name.toLowerCase().includes(search.toLowerCase()) ||
        (b.group_name && b.group_name.toLowerCase().includes(search.toLowerCase()))
    );

    const grouped: Record<string, Badge[]> = {
        'equipamiento': [],
        'posicion': [],
        'variacion': [],
        'otro': []
    };

    filteredBadges.forEach(b => {
        const g = b.group_name || 'otro';
        if (!grouped[g]) grouped[g] = [];
        grouped[g].push(b);
    });

    const sections = Object.entries(grouped).filter(([_, items]) => items.length > 0);

    return (
        <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.overlay}
            >
                {Platform.OS === 'ios' && (
                    <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                )}
                <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                        bounces={false}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={[styles.container, { padding: 0 }]}>
                            <View style={styles.header}>
                                {isCreating ? (
                                    <TouchableOpacity
                                        onPress={() => { setIsCreating(false); setEditingBadge(null); }}
                                        style={styles.headerBtn}
                                    >
                                        <ChevronLeft size={20} color={colors.text} />
                                    </TouchableOpacity>
                                ) : (
                                    <View style={{ width: 36 }} />
                                )}
                                <Text style={styles.headerTitle}>
                                    {isCreating ? (editingBadge ? 'Editar Badge' : 'Nuevo Badge') : 'Badges'}
                                </Text>
                                <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
                                    <X size={20} color={colors.text} />
                                </TouchableOpacity>
                            </View>

                            {isCreating ? (
                                <View style={styles.formContent}>
                                    <Text style={styles.label}>Nombre</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={newName}
                                        onChangeText={setNewName}
                                        placeholder="Ej: Barra Z"
                                        placeholderTextColor={colors.textMuted}
                                        autoFocus
                                    />

                                    <Text style={styles.label}>Categoría</Text>
                                    <View style={styles.groupPicker}>
                                        {(['equipamiento', 'posicion', 'variacion', 'otro'] as const).map(g => (
                                            <TouchableOpacity
                                                key={g}
                                                onPress={() => setNewGroup(g)}
                                                style={[styles.groupChip, newGroup === g && styles.groupChipActive]}
                                            >
                                                <Text style={[styles.groupChipText, newGroup === g && styles.groupChipTextActive]}>
                                                    {g.charAt(0).toUpperCase() + g.slice(1)}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <Text style={[styles.label, { marginTop: 20 }]}>Visual</Text>
                                    <TouchableOpacity
                                        onPress={() => setShowColorPicker(true)}
                                        style={styles.colorSelector}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                            <View style={[styles.colorDot, { backgroundColor: newColor }]} />
                                            <Text style={styles.colorHex}>{newColor.toUpperCase()}</Text>
                                        </View>
                                        <Palette size={18} color={colors.textMuted} />
                                    </TouchableOpacity>

                                    <View style={styles.previewContainer}>
                                        <Text style={[styles.label, { marginBottom: 12 }]}>Vista Previa</Text>
                                        <BadgePill name={newName || 'Vista Previa'} color={newColor} size="lg" />
                                    </View>

                                    <View style={styles.formFooter}>
                                        {editingBadge && (
                                            <TouchableOpacity onPress={() => handleDeleteBadge(editingBadge.id)} style={styles.deleteBtn}>
                                                <Trash2 size={18} color={colors.red} />
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity
                                            onPress={handleCreateBadge}
                                            style={[styles.saveBtn, !newName.trim() && styles.disabledBtn]}
                                            disabled={!newName.trim()}
                                        >
                                            <Text style={styles.saveBtnText}>{editingBadge ? 'Guardar' : 'Crear'}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <>
                                    <View style={styles.listHeader}>
                                        <View style={styles.searchBar}>
                                            <Search size={16} color={colors.textMuted} />
                                            <TextInput
                                                placeholder="Buscar..."
                                                placeholderTextColor={colors.textMuted}
                                                value={search}
                                                onChangeText={setSearch}
                                                style={styles.searchInput}
                                            />
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setIsCreating(true);
                                                setNewName('');
                                                setNewColor(colors.blue);
                                                setNewGroup('otro');
                                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                            }}
                                            style={styles.addBtn}
                                        >
                                            <Plus size={20} color={colors.onPrimary} />
                                        </TouchableOpacity>
                                    </View>

                                    <View style={[styles.listContent, { maxHeight: SCREEN_HEIGHT * 0.5 }]}>
                                        {sections.map(([group, items]) => (
                                            <View key={group} style={styles.section}>
                                                <Text style={styles.sectionTitle}>{group}</Text>
                                                <View style={styles.badgeGrid}>
                                                    {items.map(badge => {
                                                        const isSelected = selectedIds.includes(badge.id);
                                                        return (
                                                            <TouchableOpacity
                                                                key={badge.id}
                                                                onPress={() => toggleBadge(badge.id)}
                                                                onLongPress={() => !badge.is_system && startEditing(badge)}
                                                                style={[
                                                                    styles.badgeItem,
                                                                    isSelected && styles.badgeItemSelected
                                                                ]}
                                                            >
                                                                <BadgePill
                                                                    name={badge.name}
                                                                    color={badge.color}
                                                                    icon={badge.icon || undefined}
                                                                    size="md"
                                                                />
                                                                {!badge.is_system && isSelected && (
                                                                    <TouchableOpacity onPress={() => startEditing(badge)} style={styles.editBadgeIndicator}>
                                                                        <Edit2 size={8} color={colors.text} />
                                                                    </TouchableOpacity>
                                                                )}
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </View>
                                            </View>
                                        ))}
                                    </View>

                                    <View style={styles.footer}>
                                        <TouchableOpacity
                                            onPress={() => { onSave(selectedIds); onClose(); }}
                                            style={styles.confirmBtn}
                                        >
                                            <Text style={styles.confirmBtnText}>Confirmar ({selectedIds.length})</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </KeyboardAvoidingView>

            <ColorPicker
                visible={showColorPicker}
                initialColor={newColor}
                onClose={() => setShowColorPicker(false)}
                onSelect={(color) => { setNewColor(color); setShowColorPicker(false); }}
            />
        </Modal>
    );
}
