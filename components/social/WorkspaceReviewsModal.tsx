import { SharedRoutineItem, SharedRoutineReviewRequest } from '@/src/services/SocialService';
import { workspaceFeedback } from '@/src/social/workspaceFeedback';
import { ThemeFx, withAlpha } from '@/src/theme';
import { Check, RefreshCcw, X } from 'lucide-react-native';
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

type WorkspaceReviewsModalProps = {
    visible: boolean;
    colors: WorkspaceColors;
    workspace: SharedRoutineItem | null;
    reviews: SharedRoutineReviewRequest[];
    loading: boolean;
    onClose: () => void;
    onRefresh: () => void | Promise<void>;
    onDecideReview: (review: SharedRoutineReviewRequest, decision: 'approve' | 'reject') => void;
};

const statusLabel: Record<SharedRoutineReviewRequest['status'], string> = {
    pending: 'PENDIENTE',
    approved: 'APROBADA',
    rejected: 'RECHAZADA',
    cancelled: 'CANCELADA',
};

function formatDateTime(value?: string | number | Date | null): string {
    if (!value) return 'Sin fecha';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Sin fecha';
    return parsed.toLocaleString();
}

function deltaLabel(value: number): string {
    if (value > 0) return `+${value}`;
    return `${value}`;
}

export function WorkspaceReviewsModal({
    visible,
    colors,
    workspace,
    reviews,
    loading,
    onClose,
    onRefresh,
    onDecideReview,
}: WorkspaceReviewsModalProps) {
    const [statusFilter, setStatusFilter] = useState<'all' | SharedRoutineReviewRequest['status']>('all');

    const filteredReviews = useMemo(() => {
        if (statusFilter === 'all') return reviews;
        return reviews.filter((review) => review.status === statusFilter);
    }, [reviews, statusFilter]);

    const pendingCount = useMemo(
        () => reviews.filter((review) => review.status === 'pending').length,
        [reviews],
    );

    const shownCount = filteredReviews.length;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={{ flex: 1, backgroundColor: ThemeFx.backdropStrong, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 48 }}>
                <View style={{ backgroundColor: colors.surfaceLighter, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, maxHeight: '92%', overflow: 'hidden', ...ThemeFx.shadowLg }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1.5, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
                        <View style={{ flex: 1, paddingRight: 10 }}>
                            <Text style={{ color: colors.text, fontWeight: '900', fontSize: 16 }}>Revisiones del espacio</Text>
                            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                                Espacio: {workspace?.title || 'Workspace'} • {reviews.length} revisiones • {pendingCount} pendientes
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
                        {(['all', 'pending', 'approved', 'rejected', 'cancelled'] as const).map((status) => {
                            const active = statusFilter === status;
                            const label = status === 'all' ? 'TODAS' : statusLabel[status];
                            return (
                                <TouchableOpacity
                                    key={`review-filter-${status}`}
                                    onPress={() => {
                                        workspaceFeedback.selection();
                                        setStatusFilter(status);
                                    }}
                                    style={{ borderWidth: 1, borderColor: active ? withAlpha(colors.primary.DEFAULT, '35') : colors.border, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: active ? withAlpha(colors.primary.DEFAULT, '12') : colors.surface }}
                                >
                                    <Text style={{ color: active ? colors.primary.DEFAULT : colors.textMuted, fontSize: 10, fontWeight: '900' }}>{label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <Text style={{ color: colors.textMuted, fontSize: 10, paddingHorizontal: 16, paddingBottom: 8 }}>
                        Mostrando {shownCount} de {reviews.length} revisiones.
                    </Text>

                    {loading ? (
                        <View style={{ paddingVertical: 36, alignItems: 'center', justifyContent: 'center' }}>
                            <ActivityIndicator color={colors.primary.DEFAULT} />
                            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 8, fontWeight: '700' }}>Cargando revisiones…</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={filteredReviews}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 24, gap: 10 }}
                            ListEmptyComponent={(
                                <View style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, padding: 14, backgroundColor: colors.surface }}>
                                    <Text style={{ color: colors.text, fontWeight: '900' }}>Sin revisiones</Text>
                                    <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
                                        No hay revisiones para este filtro. Probá con “TODAS” o pedí una nueva sincronización.
                                    </Text>
                                </View>
                            )}
                            renderItem={({ item }) => {
                                const requester = item.requesterDisplayName || item.requesterUsername || item.requesterId;
                                const statusColor = item.status === 'approved'
                                    ? colors.primary.DEFAULT
                                    : item.status === 'rejected'
                                        ? colors.red
                                        : item.status === 'cancelled'
                                            ? colors.textMuted
                                            : colors.yellow;

                                return (
                                    <View style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface, padding: 12 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ color: colors.text, fontWeight: '900', fontSize: 13 }}>{requester}</Text>
                                                <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 3 }}>
                                                    Base rev {item.requestedBaseRevision} • {formatDateTime(item.createdAt)}
                                                </Text>
                                            </View>
                                            <View style={{ borderWidth: 1, borderColor: withAlpha(statusColor, '35'), borderRadius: 9, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: withAlpha(statusColor, '14') }}>
                                                <Text style={{ color: statusColor, fontSize: 10, fontWeight: '900' }}>{statusLabel[item.status]}</Text>
                                            </View>
                                        </View>

                                        {!!item.candidateSummary && (
                                            <View style={{ marginTop: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surfaceLighter, padding: 8 }}>
                                                <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '900' }}>PREVIEW CANDIDATO</Text>
                                                <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 4 }}>
                                                    Días: {item.candidateSummary.routineDays} • Ejercicios rutina: {item.candidateSummary.routineExercises} • Biblioteca: {item.candidateSummary.exercises}
                                                </Text>

                                                {!!item.candidateDelta && (
                                                    <View style={{ marginTop: 8, gap: 6 }}>
                                                        <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '900' }}>DELTA VS REV ACTUAL</Text>
                                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                                            <View style={{ borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4, backgroundColor: withAlpha(colors.primary.DEFAULT, '12') }}>
                                                                <Text style={{ color: colors.primary.DEFAULT, fontSize: 10, fontWeight: '900' }}>
                                                                    Días {deltaLabel(item.candidateDelta.delta.routineDays.net)}
                                                                </Text>
                                                            </View>
                                                            <View style={{ borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4, backgroundColor: withAlpha(colors.primary.DEFAULT, '12') }}>
                                                                <Text style={{ color: colors.primary.DEFAULT, fontSize: 10, fontWeight: '900' }}>
                                                                    Ej. rutina {deltaLabel(item.candidateDelta.delta.routineExercises.net)}
                                                                </Text>
                                                            </View>
                                                            <View style={{ borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4, backgroundColor: withAlpha(colors.primary.DEFAULT, '12') }}>
                                                                <Text style={{ color: colors.primary.DEFAULT, fontSize: 10, fontWeight: '900' }}>
                                                                    Biblioteca {deltaLabel(item.candidateDelta.delta.exercises.net)}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                    </View>
                                                )}
                                            </View>
                                        )}

                                        {!!item.decisionNote && (
                                            <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 8 }}>
                                                Nota: {item.decisionNote}
                                            </Text>
                                        )}

                                        {item.status === 'pending' && workspace?.membership.role === 'owner' && (
                                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        workspaceFeedback.selection();
                                                        onDecideReview(item, 'approve');
                                                    }}
                                                    style={{ flex: 1, minHeight: 34, borderRadius: 10, borderWidth: 1.5, borderColor: colors.primary.DEFAULT, backgroundColor: withAlpha(colors.primary.DEFAULT, '18'), alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
                                                >
                                                    <Check size={14} color={colors.primary.DEFAULT} />
                                                    <Text style={{ color: colors.primary.DEFAULT, fontSize: 11, fontWeight: '900' }}>Aprobar cambio</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        workspaceFeedback.selection();
                                                        onDecideReview(item, 'reject');
                                                    }}
                                                    style={{ flex: 1, minHeight: 34, borderRadius: 10, borderWidth: 1, borderColor: withAlpha(colors.red, '35'), backgroundColor: colors.surfaceLighter, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
                                                >
                                                    <X size={14} color={colors.red} />
                                                    <Text style={{ color: colors.red, fontSize: 11, fontWeight: '900' }}>Rechazar cambio</Text>
                                                </TouchableOpacity>
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
