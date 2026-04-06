import { SharedRoutineChangeItem, SharedRoutineItem } from '@/src/services/SocialService';
import { workspaceFeedback } from '@/src/social/workspaceFeedback';
import { ThemeFx, withAlpha } from '@/src/theme';
import { RefreshCcw, X } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Text, TouchableOpacity, View } from 'react-native';

type WorkspaceColors = {
    text: string;
    textMuted: string;
    border: string;
    surface: string;
    surfaceLighter: string;
    primary: { DEFAULT: string };
    yellow: string;
    red: string;
};

type WorkspaceHistoryModalProps = {
    visible: boolean;
    colors: WorkspaceColors;
    workspace: SharedRoutineItem | null;
    changes: SharedRoutineChangeItem[];
    loading: boolean;
    onClose: () => void;
    onRefresh: () => void | Promise<void>;
};

function formatDateTime(value?: string | number | Date | null): string {
    if (!value) return 'Sin fecha';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Sin fecha';
    return parsed.toLocaleString();
}

function actionLabel(actionType: string): string {
    const map: Record<string, string> = {
        owner_sync: 'Propietario publicó actualización',
        member_sync: 'Editor publicó cambios',
        forced_member_sync: 'Editor publicó forzando',
        review_requested: 'Revisión solicitada',
        review_approved: 'Revisión aprobada',
        review_rejected: 'Revisión rechazada',
        rollback: 'Revisión restaurada',
        comment_added: 'Comentario agregado',
        member_invitation_accepted: 'Invitación aceptada',
        member_invitation_rejected: 'Invitación rechazada',
    };
    return map[actionType] || actionType;
}

function parseRevision(metadata?: Record<string, unknown> | null): number | null {
    if (!metadata) return null;
    const value = metadata.revision;
    return typeof value === 'number' ? value : null;
}

function parseEntitySummary(metadata?: Record<string, unknown> | null): string | null {
    if (!metadata || typeof metadata !== 'object') return null;
    const entities = metadata.entities as Record<string, unknown> | undefined;
    if (!entities || typeof entities !== 'object') return null;

    const routineDays = typeof entities.routineDays === 'number' ? entities.routineDays : null;
    const routineExercises = typeof entities.routineExercises === 'number' ? entities.routineExercises : null;
    const exercises = typeof entities.exercises === 'number' ? entities.exercises : null;

    if (routineDays === null && routineExercises === null && exercises === null) return null;
    return `Días: ${routineDays ?? '-'} • Ejercicios rutina: ${routineExercises ?? '-'} • Biblioteca: ${exercises ?? '-'}`;
}

function actionCategory(actionType: string): 'all' | 'sync' | 'review' | 'comment' | 'other' {
    if (actionType.includes('sync') || actionType === 'rollback') return 'sync';
    if (actionType.includes('review')) return 'review';
    if (actionType.includes('comment')) return 'comment';
    return 'other';
}

export function WorkspaceHistoryModal({
    visible,
    colors,
    workspace,
    changes,
    loading,
    onClose,
    onRefresh,
}: WorkspaceHistoryModalProps) {
    const [filter, setFilter] = useState<'all' | 'sync' | 'review' | 'comment' | 'other'>('all');

    const filteredChanges = useMemo(() => {
        if (filter === 'all') return changes;
        return changes.filter((change) => actionCategory(change.actionType) === filter);
    }, [changes, filter]);

    const shownCount = filteredChanges.length;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={{ flex: 1, backgroundColor: ThemeFx.backdropStrong, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 48 }}>
                <View style={{ backgroundColor: colors.surfaceLighter, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, maxHeight: '92%', overflow: 'hidden', ...ThemeFx.shadowLg }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1.5, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
                        <View style={{ flex: 1, paddingRight: 10 }}>
                            <Text style={{ color: colors.text, fontWeight: '900', fontSize: 16 }}>Historial del espacio compartido</Text>
                            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                                Espacio: {workspace?.title || 'Espacio compartido'} • {changes.length} eventos
                            </Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                                onPress={() => {
                                    workspaceFeedback.selection();
                                    void onRefresh();
                                }}
                                style={{ width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceLighter }}
                            >
                                <RefreshCcw size={14} color={colors.textMuted} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    workspaceFeedback.selection();
                                    onClose();
                                }}
                                style={{ width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceLighter }}
                            >
                                <X size={14} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {(['all', 'sync', 'review', 'comment', 'other'] as const).map((value) => {
                            const active = value === filter;
                            const label = value === 'all' ? 'TODOS' : value.toUpperCase();
                            return (
                                <TouchableOpacity
                                    key={`history-filter-${value}`}
                                    onPress={() => {
                                        workspaceFeedback.selection();
                                        setFilter(value);
                                    }}
                                    style={{ borderWidth: 1, borderColor: active ? withAlpha(colors.primary.DEFAULT, '35') : colors.border, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: active ? withAlpha(colors.primary.DEFAULT, '12') : colors.surface }}
                                >
                                    <Text style={{ color: active ? colors.primary.DEFAULT : colors.textMuted, fontSize: 10, fontWeight: '900' }}>{label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <Text style={{ color: colors.textMuted, fontSize: 10, paddingHorizontal: 16, paddingBottom: 8 }}>
                        Mostrando {shownCount} de {changes.length} eventos.
                    </Text>

                    {loading ? (
                        <View style={{ paddingVertical: 36, alignItems: 'center', justifyContent: 'center' }}>
                            <ActivityIndicator color={colors.primary.DEFAULT} />
                            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 8, fontWeight: '700' }}>Cargando historial…</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={filteredChanges}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 24, gap: 10 }}
                            ListEmptyComponent={(
                                <View style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, padding: 14, backgroundColor: colors.surface }}>
                                    <Text style={{ color: colors.text, fontWeight: '900' }}>Sin eventos</Text>
                                    <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
                                        No hay actividad para este filtro. Probá con “TODOS” para ver el historial completo.
                                    </Text>
                                </View>
                            )}
                            renderItem={({ item }) => {
                                const actor = item.actorDisplayName || item.actorUsername || item.actorId;
                                const revision = parseRevision(item.metadata);
                                const entities = parseEntitySummary(item.metadata);

                                return (
                                    <View style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface, padding: 12 }}>
                                        <Text style={{ color: colors.text, fontWeight: '900', fontSize: 13 }}>{actionLabel(item.actionType)}</Text>
                                        <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 3 }}>
                                            {actor} • {formatDateTime(item.createdAt)}
                                        </Text>

                                        {(revision !== null || item.snapshotId) && (
                                            <View style={{ marginTop: 8, flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                                                {revision !== null && (
                                                    <View style={{ borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: withAlpha(colors.primary.DEFAULT, '12') }}>
                                                        <Text style={{ color: colors.primary.DEFAULT, fontSize: 10, fontWeight: '900' }}>REV {revision}</Text>
                                                    </View>
                                                )}
                                                {!!item.snapshotId && (
                                                    <View style={{ borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.surfaceLighter, borderWidth: 1, borderColor: colors.border }}>
                                                        <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800' }}>SNAPSHOT</Text>
                                                    </View>
                                                )}
                                            </View>
                                        )}

                                        {!!entities && (
                                            <View style={{ marginTop: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surfaceLighter, padding: 8 }}>
                                                <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '900' }}>RESUMEN</Text>
                                                <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 4 }}>{entities}</Text>
                                            </View>
                                        )}
                                    </View>
                                );
                            }}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
}
