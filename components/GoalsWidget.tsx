import { GoalsService } from '@/src/services/GoalsService';
import { ThemeFx } from '@/src/theme';
import { Goal } from '@/src/types/db';
import { notify } from '@/src/utils/notify';
import * as Haptics from 'expo-haptics';
import { Check, ChevronDown, ChevronUp, Plus, RotateCcw, Target, Trash2, Trophy } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useColors } from '../src/hooks/useColors';
import { confirm } from '../src/store/confirmStore';

export function GoalsWidget() {
    const colors = useColors();
    const [goals, setGoals] = useState<Goal[]>([]);
    const [completedGoals, setCompletedGoals] = useState<Goal[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [newTitle, setNewTitle] = useState('');
    const [newTarget, setNewTarget] = useState('');
    const [newCurrent, setNewCurrent] = useState('');

    const ss = useMemo(() => StyleSheet.create({
        container: {
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.iron[700],
            padding: 20,
            elevation: 2,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
        },
        headerLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        iconCircle: {
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: colors.primary.DEFAULT + '15',
            justifyContent: 'center',
            alignItems: 'center',
        },
        title: {
            fontSize: 15,
            fontWeight: '900',
            color: colors.iron[950],
            letterSpacing: -0.3,
        },
        subtitle: {
            fontSize: 10,
            fontWeight: '600',
            color: colors.iron[400],
            textTransform: 'uppercase',
        },
        addButton: {
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.primary.DEFAULT,
            justifyContent: 'center',
            alignItems: 'center',
        },
        loadingContainer: {
            paddingVertical: 24,
            alignItems: 'center',
        },
        loadingText: {
            color: colors.iron[500],
            marginTop: 8,
            fontSize: 12,
        },
        errorText: {
            color: colors.iron[500],
            paddingVertical: 16,
        },
        emptyState: {
            alignItems: 'center',
            paddingVertical: 20,
            gap: 6,
        },
        emptyTitle: {
            color: colors.iron[500],
            fontWeight: '800',
            fontSize: 13,
        },
        emptyMessage: {
            color: colors.iron[400],
            fontSize: 11,
            textAlign: 'center',
        },
        goalCard: {
            backgroundColor: colors.iron[200],
            borderRadius: 12,
            padding: 14,
            borderWidth: 1,
            borderColor: colors.iron[300],
        },
        goalHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
        },
        goalTitle: {
            fontSize: 14,
            fontWeight: '700',
            color: colors.iron[950],
            flex: 1,
            paddingRight: 8,
        },
        goalProgress: {
            fontSize: 14,
            fontWeight: '900',
            color: colors.primary.DEFAULT,
        },
        progressTrack: {
            height: 6,
            backgroundColor: colors.iron[300],
            borderRadius: 3,
            overflow: 'hidden',
            marginBottom: 10,
        },
        progressFill: {
            height: '100%',
            borderRadius: 3,
        },
        goalFooter: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        goalValues: {
            fontSize: 11,
            fontWeight: '600',
            color: colors.iron[500],
        },
        goalActions: {
            flexDirection: 'row',
            gap: 8,
        },
        actionButton: {
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: colors.iron[300],
            justifyContent: 'center',
            alignItems: 'center',
        },
        completeButton: {
            backgroundColor: colors.green + '20',
        },
        historySection: {
            marginTop: 16,
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: colors.iron[300],
        },
        historyToggle: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 4,
        },
        historyToggleLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        historyToggleText: {
            fontSize: 13,
            fontWeight: '700',
            color: colors.iron[950],
        },
        completedCard: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.iron[200],
            borderRadius: 10,
            padding: 12,
            borderWidth: 1,
            borderColor: colors.iron[300],
        },
        completedCheckCircle: {
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: colors.green + '20',
            justifyContent: 'center',
            alignItems: 'center',
        },
        completedTitle: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.iron[500],
            textDecorationLine: 'line-through',
        },
        completedValues: {
            fontSize: 10,
            fontWeight: '500',
            color: colors.iron[400],
        },
        reopenButton: {
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: colors.iron[300],
            justifyContent: 'center',
            alignItems: 'center',
        },
    }), [colors]);

    useEffect(() => {
        loadGoals();
    }, []);

    const loadGoals = async () => {
        setLoading(true);
        setError(null);
        try {
            const [active, completed] = await Promise.all([
                GoalsService.getActiveGoals(),
                GoalsService.getCompletedGoals(),
            ]);
            setGoals(active);
            setCompletedGoals(completed);
        } catch (e: any) {
            setError(e?.message ?? 'No se pudieron cargar las metas');
            setGoals([]);
            setCompletedGoals([]);
        } finally {
            setLoading(false);
        }
    };

    const handleAddGoal = async () => {
        if (!newTitle || !newTarget) return;
        try {
            const target = parseFloat(newTarget);
            const current = newCurrent ? parseFloat(newCurrent) : 0;
            await GoalsService.createGoal({
                title: newTitle,
                targetValue: target,
                currentValue: Number.isFinite(current) ? current : 0
            });

            setModalVisible(false);
            setNewTitle('');
            setNewTarget('');
            setNewCurrent('');
            notify.success('Meta Creada', `"${newTitle}" añadida a tus metas activas.`);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            loadGoals();
        } catch (e: any) {
            notify.error('Error', e?.message ?? 'No se pudo crear la meta');
        }
    };

    const handleDelete = async (id: string, title: string) => {
        confirm.destructive(
            'Eliminar meta',
            `¿Seguro que querés eliminar "${title}"?`,
            async () => {
                try {
                    await GoalsService.deleteGoal(id);
                    notify.info('Meta Eliminada', `"${title}" fue eliminada.`);
                    loadGoals();
                } catch (e: any) {
                    notify.error('Error', e?.message ?? 'No se pudo eliminar la meta');
                }
            },
            'Eliminar'
        );
    };

    const handleComplete = async (id: string) => {
        try {
            const goalTitle = await GoalsService.completeGoal(id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            notify.success('¡Meta Completada! 🎉', `"${goalTitle}" — ¡Felicitaciones por tu logro!`);
            loadGoals();
        } catch (e: any) {
            notify.error('Error', e?.message ?? 'No se pudo completar la meta');
        }
    };

    const handleReopen = async (id: string, title: string) => {
        try {
            await GoalsService.reopenGoal(id);
            notify.info('Meta Reabierta', `"${title}" fue movida a metas activas.`);
            loadGoals();
        } catch (e: any) {
            notify.error('Error', e?.message ?? 'No se pudo reabrir la meta');
        }
    };

    return (
        <View style={ss.container}>
            {/* Header */}
            <View style={ss.header}>
                <View style={ss.headerLeft}>
                    <View style={ss.iconCircle}>
                        <Target size={16} color={colors.primary.DEFAULT} />
                    </View>
                    <View>
                        <Text style={ss.title}>Metas Activas</Text>
                        <Text style={ss.subtitle}>
                            {goals.length === 0 ? 'Sin metas' : `${goals.length} meta${goals.length > 1 ? 's' : ''}`}
                        </Text>
                    </View>
                </View>
                <TouchableOpacity
                    onPress={() => setModalVisible(true)}
                    style={ss.addButton}
                    accessibilityRole="button"
                    accessibilityLabel="Crear meta"
                >
                    <Plus size={16} color={colors.surface} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={ss.loadingContainer}>
                    <ActivityIndicator color={colors.primary.DEFAULT} />
                    <Text style={ss.loadingText}>Cargando metas...</Text>
                </View>
            ) : error ? (
                <Text style={ss.errorText}>{error}</Text>
            ) : goals.length === 0 ? (
                <View style={ss.emptyState}>
                    <Target size={24} color={colors.iron[300]} />
                    <Text style={ss.emptyTitle}>Sin metas activas</Text>
                    <Text style={ss.emptyMessage}>
                        Crea tu primera meta para seguir tu progreso.
                    </Text>
                </View>
            ) : (
                <View style={{ gap: 10 }}>
                    {goals.map((g) => {
                        const progress = g.target_value ? Math.min((g.current_value / g.target_value) * 100, 100) : 0;
                        const isNearComplete = progress >= 80;
                        return (
                            <View key={g.id} style={ss.goalCard}>
                                <View style={ss.goalHeader}>
                                    <Text style={ss.goalTitle} numberOfLines={1} ellipsizeMode="tail">{g.title}</Text>
                                    <Text style={[ss.goalProgress, isNearComplete && { color: colors.green }]}>
                                        {Math.round(progress)}%
                                    </Text>
                                </View>

                                <View style={ss.progressTrack}>
                                    <View
                                        style={[
                                            ss.progressFill,
                                            {
                                                width: `${progress}%`,
                                                backgroundColor: isNearComplete ? colors.green : colors.primary.DEFAULT,
                                            }
                                        ]}
                                    />
                                </View>

                                <View style={ss.goalFooter}>
                                    <Text style={ss.goalValues}>
                                        {g.current_value} / {g.target_value} kg
                                    </Text>
                                    <View style={ss.goalActions}>
                                        <TouchableOpacity
                                            onPress={() => handleDelete(g.id, g.title)}
                                            style={ss.actionButton}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Eliminar meta ${g.title}`}
                                        >
                                            <Trash2 size={14} color={colors.iron[400]} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => handleComplete(g.id)}
                                            style={[ss.actionButton, ss.completeButton]}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Completar meta ${g.title}`}
                                        >
                                            <Check size={14} color={colors.green} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}

            {/* Completed Goals History Toggle */}
            {completedGoals.length > 0 && (
                <View style={ss.historySection}>
                    <TouchableOpacity
                        style={ss.historyToggle}
                        onPress={() => setShowHistory(!showHistory)}
                        accessibilityRole="button"
                        accessibilityLabel="Mostrar historial de metas"
                    >
                        <View style={ss.historyToggleLeft}>
                            <Trophy size={14} color={colors.primary.DEFAULT} />
                            <Text style={ss.historyToggleText}>
                                Metas cumplidas ({completedGoals.length})
                            </Text>
                        </View>
                        {showHistory
                            ? <ChevronUp size={16} color={colors.iron[400]} />
                            : <ChevronDown size={16} color={colors.iron[400]} />
                        }
                    </TouchableOpacity>

                    {showHistory && (
                        <View style={{ gap: 8, marginTop: 10 }}>
                            {completedGoals.map((g) => (
                                <View key={g.id} style={ss.completedCard}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                        <View style={ss.completedCheckCircle}>
                                            <Check size={12} color={colors.green} />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={ss.completedTitle} numberOfLines={1}>
                                                {g.title}
                                            </Text>
                                            <Text style={ss.completedValues}>
                                                {g.target_value} kg
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <TouchableOpacity
                                            onPress={() => handleReopen(g.id, g.title)}
                                            style={ss.reopenButton}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Reabrir meta ${g.title}`}
                                        >
                                            <RotateCcw size={12} color={colors.iron[400]} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => handleDelete(g.id, g.title)}
                                            style={ss.reopenButton}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Eliminar meta ${g.title}`}
                                        >
                                            <Trash2 size={12} color={colors.iron[400]} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            )}

            {/* Add Goal Modal */}
            <Modal visible={modalVisible} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: ThemeFx.backdrop, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
                    <View style={{
                        backgroundColor: colors.surface, width: '100%', maxWidth: 360,
                        borderRadius: 20, padding: 24, borderWidth: 1, borderColor: colors.iron[700],
                        elevation: 8, shadowColor: colors.black, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 24,
                    }}>
                        <Text style={{ fontSize: 20, fontWeight: '900', color: colors.iron[950], marginBottom: 20, letterSpacing: -0.3 }}>
                            Nueva meta
                        </Text>

                        <Text style={{ color: colors.iron[500], fontSize: 10, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Título</Text>
                        <TextInput
                            value={newTitle}
                            onChangeText={setNewTitle}
                            placeholder="Ej. Press banca 100kg"
                            style={{
                                backgroundColor: colors.iron[200], borderRadius: 12, padding: 14,
                                fontSize: 16, color: colors.iron[950], borderWidth: 1, borderColor: colors.iron[300],
                                marginBottom: 20
                            }}
                        />

                        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: colors.iron[500], fontSize: 10, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Objetivo (kg)</Text>
                                <TextInput
                                    value={newTarget}
                                    onChangeText={setNewTarget}
                                    keyboardType="numeric"
                                    placeholder="100"
                                    style={{
                                        backgroundColor: colors.iron[200], borderRadius: 12, padding: 14,
                                        fontSize: 16, color: colors.iron[950], borderWidth: 1, borderColor: colors.iron[300],
                                    }}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: colors.iron[500], fontSize: 10, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Actual (kg)</Text>
                                <TextInput
                                    value={newCurrent}
                                    onChangeText={setNewCurrent}
                                    keyboardType="numeric"
                                    placeholder="80"
                                    style={{
                                        backgroundColor: colors.iron[200], borderRadius: 12, padding: 14,
                                        fontSize: 16, color: colors.iron[950], borderWidth: 1, borderColor: colors.iron[300],
                                    }}
                                />
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <View style={{ flex: 1 }}>
                                <TouchableOpacity onPress={() => setModalVisible(false)} style={{ padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.iron[300], alignItems: 'center' }}>
                                    <Text style={{ color: colors.iron[600], fontWeight: '700', fontSize: 14 }}>Cancelar</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={{ flex: 1 }}>
                                <TouchableOpacity onPress={handleAddGoal} style={{ backgroundColor: colors.primary.DEFAULT, padding: 14, borderRadius: 12, alignItems: 'center' }}>
                                    <Text style={{ color: colors.surface, fontWeight: '800', fontSize: 14 }}>Guardar</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
