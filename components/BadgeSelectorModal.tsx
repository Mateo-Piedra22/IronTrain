import { Colors } from '@/src/theme';
import { Badge } from '@/src/types/db';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, Edit2, Palette, Plus, Search, Trash2, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Dimensions, FlatList, LayoutAnimation, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, UIManager, View } from 'react-native';
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
    const [allBadges, setAllBadges] = useState<Badge[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
    const [search, setSearch] = useState('');

    const [isCreating, setIsCreating] = useState(false);
    const [editingBadge, setEditingBadge] = useState<Badge | null>(null);
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState('#3b82f6');
    const [newGroup, setNewGroup] = useState<'equipamiento' | 'variacion' | 'posicion' | 'otro'>('otro');
    const [showColorPicker, setShowColorPicker] = useState(false);

    useEffect(() => {
        if (visible) {
            loadBadges();
            setSelectedIds(initialSelectedIds);
            setIsCreating(false);
            setEditingBadge(null);
        }
    }, [visible, initialSelectedIds]);

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
            <View style={styles.overlay}>
                {Platform.OS === 'ios' && (
                    <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                )}
                <View style={styles.centeredView}>
                    <View style={styles.modalContent}>
                        <View style={styles.header}>
                            {isCreating ? (
                                <TouchableOpacity
                                    onPress={() => { setIsCreating(false); setEditingBadge(null); }}
                                    style={styles.headerBtn}
                                >
                                    <ChevronLeft size={20} color={Colors.iron[600]} />
                                </TouchableOpacity>
                            ) : (
                                <View style={{ width: 32 }} />
                            )}
                            <Text style={styles.headerTitle}>
                                {isCreating ? (editingBadge ? 'Editar Badge' : 'Nuevo Badge') : 'Badges'}
                            </Text>
                            <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
                                <X size={20} color={Colors.iron[600]} />
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
                                    placeholderTextColor={Colors.iron[400]}
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
                                    <Palette size={18} color={Colors.iron[400]} />
                                </TouchableOpacity>

                                <View style={styles.previewContainer}>
                                    <Text style={[styles.label, { marginBottom: 12 }]}>Vista Previa</Text>
                                    <BadgePill name={newName || 'Vista Previa'} color={newColor} size="md" variant="vibrant" />
                                </View>

                                <View style={styles.formFooter}>
                                    {editingBadge && (
                                        <TouchableOpacity onPress={() => handleDeleteBadge(editingBadge.id)} style={styles.deleteBtn}>
                                            <Trash2 size={18} color="#ef4444" />
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
                                        <Search size={16} color={Colors.iron[400]} />
                                        <TextInput
                                            placeholder="Buscar..."
                                            placeholderTextColor={Colors.iron[400]}
                                            value={search}
                                            onChangeText={setSearch}
                                            style={styles.searchInput}
                                        />
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => {
                                            setIsCreating(true);
                                            setNewName('');
                                            setNewColor('#3b82f6');
                                            setNewGroup('otro');
                                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                        }}
                                        style={styles.addBtn}
                                    >
                                        <Plus size={20} color="#fff" />
                                    </TouchableOpacity>
                                </View>

                                <FlatList
                                    data={sections}
                                    keyExtractor={([group]) => group}
                                    renderItem={({ item: [group, items] }) => (
                                        <View style={styles.section}>
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
                                                                size="sm"
                                                                variant={isSelected ? 'vibrant' : 'default'}
                                                            />
                                                            {!badge.is_system && isSelected && (
                                                                <TouchableOpacity onPress={() => startEditing(badge)} style={styles.editBadgeIndicator}>
                                                                    <Edit2 size={8} color={Colors.iron[400]} />
                                                                </TouchableOpacity>
                                                            )}
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                        </View>
                                    )}
                                    contentContainerStyle={styles.listContent}
                                    style={{ maxHeight: SCREEN_HEIGHT * 0.5 }}
                                />

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
                </View>
            </View>

            <ColorPicker
                visible={showColorPicker}
                initialColor={newColor}
                onClose={() => setShowColorPicker(false)}
                onSelect={(color) => { setNewColor(color); setShowColorPicker(false); }}
            />
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    centeredView: { width: '100%', maxWidth: 360, padding: 16 },
    modalContent: {
        backgroundColor: Colors.surface,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: Colors.iron[300],
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.iron[200],
    },
    headerTitle: { fontSize: 16, fontWeight: '900', color: Colors.iron[950], letterSpacing: -0.3 },
    headerBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.iron[100], justifyContent: 'center', alignItems: 'center' },

    // Selection View
    listHeader: { flexDirection: 'row', padding: 16, gap: 10, alignItems: 'center' },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.iron[50],
        paddingHorizontal: 12,
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.iron[200]
    },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: Colors.iron[950], fontWeight: '600' },
    addBtn: { width: 44, height: 44, backgroundColor: Colors.primary.DEFAULT, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },

    listContent: { padding: 16, paddingTop: 0 },
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 10, fontWeight: '800', color: Colors.iron[400], textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
    badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    badgeItem: { position: 'relative' },
    badgeItemSelected: { transform: [{ scale: 1.05 }] },
    editBadgeIndicator: { position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.iron[100], borderWidth: 1, borderColor: Colors.iron[300], justifyContent: 'center', alignItems: 'center' },

    footer: { padding: 16, borderTopWidth: 1, borderTopColor: Colors.iron[100] },
    confirmBtn: { backgroundColor: Colors.primary.DEFAULT, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    confirmBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

    // Form View
    formContent: { padding: 20 },
    label: { fontSize: 10, fontWeight: '800', color: Colors.iron[400], textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
    input: {
        backgroundColor: Colors.iron[50],
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        color: Colors.iron[950],
        borderWidth: 1,
        borderColor: Colors.iron[200],
        fontWeight: '600',
        marginBottom: 16
    },
    groupPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    groupChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.iron[100], borderWidth: 1, borderColor: Colors.iron[200] },
    groupChipActive: { backgroundColor: Colors.primary.DEFAULT + '12', borderColor: Colors.primary.DEFAULT },
    groupChipText: { color: Colors.iron[500], fontSize: 11, fontWeight: '700' },
    groupChipTextActive: { color: Colors.primary.DEFAULT },
    colorSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.iron[50],
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.iron[200]
    },
    colorDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
    colorHex: { color: Colors.iron[950], fontWeight: '700', fontSize: 14 },
    previewContainer: { marginTop: 20, alignItems: 'center', backgroundColor: Colors.iron[50], padding: 16, borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: Colors.iron[300] },
    formFooter: { flexDirection: 'row', gap: 10, marginTop: 24 },
    deleteBtn: { width: 50, height: 50, borderRadius: 14, backgroundColor: '#ef444415', borderWidth: 1, borderColor: '#ef444430', justifyContent: 'center', alignItems: 'center' },
    saveBtn: { flex: 1, height: 50, backgroundColor: Colors.primary.DEFAULT, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    disabledBtn: { opacity: 0.5 },
    saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 }
});
