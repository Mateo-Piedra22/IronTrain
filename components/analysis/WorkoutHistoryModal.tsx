import { format, isSameMonth, subDays, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Clock, Dumbbell, History, Search, Trash2, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useColors } from '../../src/hooks/useColors';
import { workoutService } from '../../src/services/WorkoutService';
import { confirm } from '../../src/store/confirmStore';
import { ThemeFx, withAlpha } from '../../src/theme';
import { formatTimeSeconds } from '../../src/utils/time';

interface WorkoutHistoryModalProps {
    visible: boolean;
    onClose: () => void;
}

export function WorkoutHistoryModal({ visible, onClose }: WorkoutHistoryModalProps) {
    const colors = useColors();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | '7d' | '30d' | 'thisMonth' | 'lastMonth'>('all');

    // Editing state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (visible) {
            loadHistory();
        }
    }, [visible]);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const data = await workoutService.getWorkoutHistory();
            setHistory(data);
        } catch (e) {
            console.error('Failed to load history', e);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (workout: any) => {
        setEditingId(workout.id);
        setEditName(workout.name || '');
        setEditNotes(workout.notes || '');
    };

    const handleSave = async (id: string) => {
        if (!id) return;
        setSaving(true);
        try {
            await workoutService.updateWorkout(id, {
                name: editName.trim(),
                notes: editNotes.trim()
            });
            setEditingId(null);
            loadHistory();
        } catch (e) {
            confirm.error('Error', 'No se pudo actualizar el entrenamiento.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (workoutId: string, name: string) => {
        confirm.custom({
            title: '¿Eliminar entrenamiento?',
            message: `Vas a eliminar "${name || 'Entrenamiento'}". \n\n⚠️ ESTA ACCIÓN REVERTIRÁ: \n• Puntos IronScore obtenidos \n• Récords (PRs) de esta sesión \n• Estadísticas de volumen y tiempo`,
            variant: 'destructive',
            buttons: [
                { label: 'Cancelar', variant: 'ghost', onPress: confirm.hide },
                {
                    label: 'Eliminar definitivamente',
                    destructive: true,
                    onPress: async () => {
                        confirm.hide();
                        try {
                            await workoutService.deleteWorkout(workoutId);
                            loadHistory();
                        } catch (e) {
                            confirm.error('Error', 'No se pudo eliminar el entrenamiento.');
                        }
                    }
                }
            ]
        });
    };

    const filteredHistory = useMemo(() => {
        let list = history;

        // Search filter
        if (search) {
            list = list.filter(w =>
                (w.name || 'Entrenamiento').toLowerCase().includes(search.toLowerCase())
            );
        }

        // Date filter
        const now = new Date();
        if (filter === '7d') {
            const limit = subDays(now, 7).getTime();
            list = list.filter(w => w.date >= limit);
        } else if (filter === '30d') {
            const limit = subDays(now, 30).getTime();
            list = list.filter(w => w.date >= limit);
        } else if (filter === 'thisMonth') {
            list = list.filter(w => isSameMonth(new Date(w.date), now));
        } else if (filter === 'lastMonth') {
            const lastMonth = subMonths(now, 1);
            list = list.filter(w => isSameMonth(new Date(w.date), lastMonth));
        }

        return list;
    }, [history, search, filter]);

    const styles = useMemo(() => StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: ThemeFx.backdropStrong,
            justifyContent: 'flex-end',
        },
        container: {
            backgroundColor: colors.background,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            height: '92%',
            width: '100%',
            overflow: 'hidden',
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 18,
            borderBottomWidth: 1.5,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
        },
        headerTitle: {
            fontSize: 20,
            fontWeight: '900',
            color: colors.text,
            letterSpacing: -0.5,
        },
        closeBtn: {
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: colors.surfaceLighter,
            justifyContent: 'center',
            alignItems: 'center',
        },
        searchContainer: {
            padding: 16,
            backgroundColor: colors.surface,
            borderBottomWidth: 1.5,
            borderBottomColor: colors.border,
        },
        searchInputWrapper: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.background,
            borderRadius: 14,
            paddingHorizontal: 12,
            height: 48,
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        searchInput: {
            flex: 1,
            marginLeft: 10,
            fontSize: 15,
            fontWeight: '600',
            color: colors.text,
        },
        filtersContainer: {
            paddingHorizontal: 16,
            paddingBottom: 16,
            backgroundColor: colors.surface,
            borderBottomWidth: 1.5,
            borderBottomColor: colors.border,
        },
        filtersScroll: {
            flexDirection: 'row',
            gap: 8,
        },
        filterChip: {
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: colors.surfaceLighter,
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        filterChipActive: {
            backgroundColor: withAlpha(colors.primary.DEFAULT, '15'),
            borderColor: colors.primary.DEFAULT,
        },
        filterChipText: {
            fontSize: 12,
            fontWeight: '800',
            color: colors.textMuted,
        },
        filterChipTextActive: {
            color: colors.primary.DEFAULT,
        },
        list: {
            flex: 1,
        },
        listContent: {
            padding: 16,
            paddingBottom: 40,
        },
        card: {
            backgroundColor: colors.surface,
            borderRadius: 20,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1.5,
            borderColor: colors.border,
            ...ThemeFx.shadowSm,
        },
        cardHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 12,
        },
        workoutName: {
            fontSize: 17,
            fontWeight: '900',
            color: colors.text,
            flex: 1,
            marginRight: 12,
        },
        deleteBtn: {
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: withAlpha(colors.red, '10'),
            justifyContent: 'center',
            alignItems: 'center',
        },
        editBtn: {
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: withAlpha(colors.primary.DEFAULT, '10'),
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 8,
        },
        editInput: {
            flex: 1,
            backgroundColor: colors.background,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 8,
            fontSize: 16,
            fontWeight: '700',
            color: colors.text,
            borderWidth: 1.5,
            borderColor: colors.primary.DEFAULT,
            marginRight: 10,
        },
        notesContainer: {
            marginTop: 12,
            padding: 10,
            backgroundColor: colors.surfaceLighter,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
        },
        notesText: {
            fontSize: 13,
            color: colors.textMuted,
            lineHeight: 18,
        },
        notesInput: {
            marginTop: 12,
            backgroundColor: colors.background,
            borderRadius: 12,
            padding: 12,
            fontSize: 14,
            color: colors.text,
            borderWidth: 1,
            borderColor: colors.border,
            minHeight: 60,
            textAlignVertical: 'top',
        },
        saveBtn: {
            backgroundColor: colors.primary.DEFAULT,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 8,
        },
        saveText: {
            color: '#fff',
            fontSize: 12,
            fontWeight: '900',
        },
        cancelText: {
            color: colors.textMuted,
            fontSize: 12,
            fontWeight: '700',
            marginRight: 12,
        },
        cardInfo: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
        },
        infoItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        infoText: {
            fontSize: 13,
            fontWeight: '700',
            color: colors.textMuted,
        },
        statusBadge: {
            alignSelf: 'flex-start',
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 8,
            marginTop: 12,
        },
        statusText: {
            fontSize: 11,
            fontWeight: '900',
            textTransform: 'uppercase',
        },
        emptyContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingTop: 80,
        },
        emptyTitle: {
            fontSize: 18,
            fontWeight: '900',
            color: colors.text,
            marginTop: 16,
        },
        emptySub: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.textMuted,
            marginTop: 8,
            textAlign: 'center',
            paddingHorizontal: 40,
        },
    }), [colors]);

    const renderItem = ({ item }: { item: any }) => {
        const duration = item.end_time && item.start_time ? Math.round((item.end_time - item.start_time) / 1000) : 0;
        const statusConfig = item.status === 'completed'
            ? { label: 'Completado', color: colors.green, bg: withAlpha(colors.green, '15') }
            : { label: 'En progreso', color: colors.primary.DEFAULT, bg: withAlpha(colors.primary.DEFAULT, '15') };

        const isEditing = editingId === item.id;

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    {isEditing ? (
                        <TextInput
                            style={styles.editInput}
                            value={editName}
                            onChangeText={setEditName}
                            placeholder="Nombre del entrenamiento"
                            placeholderTextColor={colors.textMuted}
                            autoFocus
                        />
                    ) : (
                        <Text style={styles.workoutName}>{item.name || 'Entrenamiento sin nombre'}</Text>
                    )}

                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {isEditing ? (
                            <>
                                <TouchableOpacity onPress={() => setEditingId(null)}>
                                    <Text style={styles.cancelText}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.saveBtn}
                                    onPress={() => handleSave(item.id)}
                                    disabled={saving}
                                >
                                    <Text style={styles.saveText}>{saving ? '...' : 'Guardar'}</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <TouchableOpacity
                                    style={styles.editBtn}
                                    onPress={() => handleEdit(item)}
                                >
                                    <View style={{ opacity: 0.7 }}>
                                        <Search size={14} color={colors.primary.DEFAULT} />
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.deleteBtn}
                                    onPress={() => handleDelete(item.id, item.name)}
                                >
                                    <Trash2 size={16} color={colors.red} />
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>

                {isEditing ? (
                    <TextInput
                        style={styles.notesInput}
                        value={editNotes}
                        onChangeText={setEditNotes}
                        placeholder="Añadir notas..."
                        placeholderTextColor={colors.textMuted}
                        multiline
                    />
                ) : (
                    item.notes && (
                        <View style={styles.notesContainer}>
                            <Text style={styles.notesText} numberOfLines={3}>{item.notes}</Text>
                        </View>
                    )
                )}

                <View style={styles.cardInfo}>
                    <View style={styles.infoItem}>
                        <Calendar size={14} color={colors.textMuted} />
                        <Text style={styles.infoText}>
                            {format(new Date(item.date), 'd MMM, yyyy', { locale: es })}
                        </Text>
                    </View>

                    {duration > 0 && (
                        <View style={styles.infoItem}>
                            <Clock size={14} color={colors.textMuted} />
                            <Text style={styles.infoText}>{formatTimeSeconds(duration)}</Text>
                        </View>
                    )}

                    <View style={styles.infoItem}>
                        <Dumbbell size={14} color={colors.textMuted} />
                        <Text style={styles.infoText}>{item.exercise_count} ej. / {item.set_count} sets</Text>
                    </View>
                </View>

                <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                    <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                </View>
            </View>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <History size={22} color={colors.primary.DEFAULT} />
                            <Text style={styles.headerTitle}>Historial</Text>
                        </View>
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                            <X size={20} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Search */}
                    <View style={styles.searchContainer}>
                        <View style={styles.searchInputWrapper}>
                            <Search size={18} color={colors.textMuted} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Buscar entrenamiento..."
                                placeholderTextColor={colors.textMuted}
                                value={search}
                                onChangeText={setSearch}
                                clearButtonMode="while-editing"
                            />
                        </View>
                    </View>

                    {/* Filters */}
                    <View style={styles.filtersContainer}>
                        <View style={styles.filtersScroll}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
                                <TouchableOpacity
                                    onPress={() => setFilter('all')}
                                    style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
                                >
                                    <Text style={[styles.filterChipText, filter === 'all' && styles.filterChipTextActive]}>Todos</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setFilter('7d')}
                                    style={[styles.filterChip, filter === '7d' && styles.filterChipActive]}
                                >
                                    <Text style={[styles.filterChipText, filter === '7d' && styles.filterChipTextActive]}>7 Días</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setFilter('30d')}
                                    style={[styles.filterChip, filter === '30d' && styles.filterChipActive]}
                                >
                                    <Text style={[styles.filterChipText, filter === '30d' && styles.filterChipTextActive]}>30 Días</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setFilter('thisMonth')}
                                    style={[styles.filterChip, filter === 'thisMonth' && styles.filterChipActive]}
                                >
                                    <Text style={[styles.filterChipText, filter === 'thisMonth' && styles.filterChipTextActive]}>Este Mes</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setFilter('lastMonth')}
                                    style={[styles.filterChip, filter === 'lastMonth' && styles.filterChipActive]}
                                >
                                    <Text style={[styles.filterChipText, filter === 'lastMonth' && styles.filterChipTextActive]}>Mes Pasado</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </View>

                    {loading ? (
                        <View style={styles.emptyContainer}>
                            <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
                        </View>
                    ) : (
                        <FlatList
                            data={filteredHistory}
                            keyExtractor={(item) => item.id}
                            renderItem={renderItem}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                                        <History size={32} color={colors.textMuted} />
                                    </View>
                                    <Text style={styles.emptyTitle}>No hay entrenamientos</Text>
                                    <Text style={styles.emptySub}>
                                        {search ? 'No se encontraron resultados para tu búsqueda.' : 'Tus entrenamientos finalizados aparecerán aquí.'}
                                    </Text>
                                </View>
                            }
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
}
