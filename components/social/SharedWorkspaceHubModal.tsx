import { ToastContainer } from '@/components/ui/ToastContainer';
import { useColors } from '@/src/hooks/useColors';
import { dbService } from '@/src/services/DatabaseService';
import { SharedRoutineItem, SharedRoutineReviewRequest, SocialService } from '@/src/services/SocialService';
import { formatWorkspaceStatus, sharedWorkspaceCopy } from '@/src/social/sharedWorkspaceCopy';
import { workspaceFeedback } from '@/src/social/workspaceFeedback';
import { useAuthStore } from '@/src/store/authStore';
import { ThemeFx, withAlpha } from '@/src/theme';
import { BookOpen, ClipboardList, Users, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';

interface SharedWorkspaceHubModalProps {
    visible: boolean;
    onClose: () => void;
    onOpenRoutine?: (routineId: string) => void;
}

const roleLabel: Record<SharedRoutineItem['membership']['role'], string> = {
    owner: 'PROPIETARIO',
    editor: 'EDITOR',
    viewer: 'LECTOR',
};

export function SharedWorkspaceHubModal({ visible, onClose, onOpenRoutine }: SharedWorkspaceHubModalProps) {
    const colors = useColors();
    const [loading, setLoading] = useState(false);
    const [workspaces, setWorkspaces] = useState<SharedRoutineItem[]>([]);
    const [pendingByWorkspace, setPendingByWorkspace] = useState<Record<string, number>>({});
    const [loadingReviewsByWorkspace, setLoadingReviewsByWorkspace] = useState<Record<string, boolean>>({});
    const [linkedRoutineBySpace, setLinkedRoutineBySpace] = useState<Record<string, string>>({});

    const pendingTotal = useMemo(
        () => Object.values(pendingByWorkspace).reduce((acc, count) => acc + count, 0),
        [pendingByWorkspace]
    );

    const loadWorkspacePendingReviews = useCallback(async (workspaceId: string) => {
        setLoadingReviewsByWorkspace((prev) => ({ ...prev, [workspaceId]: true }));
        try {
            const reviews: SharedRoutineReviewRequest[] = await SocialService.listSharedRoutineReviews(workspaceId);
            const pendingCount = reviews.filter((review) => review.status === 'pending').length;
            setPendingByWorkspace((prev) => ({ ...prev, [workspaceId]: pendingCount }));
        } catch {
            setPendingByWorkspace((prev) => ({ ...prev, [workspaceId]: 0 }));
        } finally {
            setLoadingReviewsByWorkspace((prev) => ({ ...prev, [workspaceId]: false }));
        }
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const items = await SocialService.listSharedRoutines();
            setWorkspaces(items);
            setPendingByWorkspace(
                Object.fromEntries(items.map((space) => [space.id, space.pendingReviewsCount ?? 0]))
            );

            try {
                const userId = useAuthStore.getState().user?.id || null;
                const links = await dbService.getAll<{ shared_routine_id: string; local_routine_id: string }>(
                    'SELECT shared_routine_id, local_routine_id FROM shared_routine_links WHERE ((user_id = ?) OR (user_id IS NULL AND ? IS NULL))',
                    [userId, userId]
                );
                const nextMap: Record<string, string> = {};
                links.forEach((row) => {
                    if (row.shared_routine_id && row.local_routine_id) {
                        nextMap[row.shared_routine_id] = row.local_routine_id;
                    }
                });
                setLinkedRoutineBySpace(nextMap);
            } catch {
                setLinkedRoutineBySpace({});
            }

        } catch (error: any) {
            workspaceFeedback.error('Espacios compartidos', error?.message || 'No se pudieron cargar los espacios compartidos.');
            setWorkspaces([]);
            setPendingByWorkspace({});
        } finally {
            setLoading(false);
        }
    }, [loadWorkspacePendingReviews]);

    useEffect(() => {
        if (visible) {
            void load();
        }
    }, [visible, load]);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={{ flex: 1, backgroundColor: ThemeFx.backdropStrong, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 48 }}>
                <View
                    style={{
                        backgroundColor: colors.surfaceLighter,
                        borderRadius: 24,
                        borderWidth: 1.5,
                        borderColor: colors.border,
                        maxHeight: '92%',
                        overflow: 'hidden',
                        ...ThemeFx.shadowLg,
                    }}
                >
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingHorizontal: 16,
                            paddingVertical: 14,
                            borderBottomWidth: 1.5,
                            borderBottomColor: colors.border,
                            backgroundColor: colors.surface,
                        }}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 12,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderWidth: 1.5,
                                    borderColor: withAlpha(colors.primary.DEFAULT, '35'),
                                    backgroundColor: withAlpha(colors.primary.DEFAULT, '12'),
                                }}
                            >
                                <Users size={16} color={colors.primary.DEFAULT} />
                            </View>
                            <View>
                                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900', letterSpacing: -0.3 }}>{sharedWorkspaceCopy.title}</Text>
                                <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700' }}>
                                    Estado actual: {formatWorkspaceStatus(workspaces.length, pendingTotal)}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={() => {
                                workspaceFeedback.selection();
                                onClose();
                            }}
                            style={{
                                width: 34,
                                height: 34,
                                borderRadius: 12,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: 1.5,
                                borderColor: colors.border,
                                backgroundColor: colors.surfaceLighter,
                            }}
                        >
                            <X size={16} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={{ paddingVertical: 40, alignItems: 'center', justifyContent: 'center' }}>
                            <ActivityIndicator color={colors.primary.DEFAULT} />
                            <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700', marginTop: 8 }}>Cargando espacios compartidos…</Text>
                        </View>
                    ) : (
                        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
                            <View
                                style={{
                                    padding: 12,
                                    borderRadius: 14,
                                    borderWidth: 1.5,
                                    borderColor: colors.border,
                                    backgroundColor: colors.surface,
                                    marginBottom: 12,
                                }}
                            >
                                <Text style={{ color: colors.text, fontWeight: '900', fontSize: 13 }}>Qué podés hacer acá</Text>
                                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4, lineHeight: 16 }}>
                                    Revisá el estado de tus espacios, actualizá pendientes y abrí la rutina vinculada sin duplicar datos.
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                                    <View style={{ borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: withAlpha(colors.primary.DEFAULT, '12') }}>
                                        <Text style={{ color: colors.primary.DEFAULT, fontSize: 10, fontWeight: '900' }}>{workspaces.length} espacios</Text>
                                    </View>
                                    <View style={{ borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: withAlpha(colors.yellow, '16') }}>
                                        <Text style={{ color: colors.yellow, fontSize: 10, fontWeight: '900' }}>{pendingTotal} pendientes</Text>
                                    </View>
                                </View>

                                <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 8 }}>
                                    Mostrando {workspaces.length} espacio(s) en total.
                                </Text>
                            </View>

                            {workspaces.length === 0 ? (
                                <View
                                    style={{
                                        padding: 20,
                                        borderRadius: 16,
                                        borderWidth: 1.5,
                                        borderColor: colors.border,
                                        backgroundColor: colors.surface,
                                        alignItems: 'center',
                                    }}
                                >
                                    <Text style={{ color: colors.text, fontWeight: '900', marginBottom: 6 }}>{sharedWorkspaceCopy.emptyTitle}</Text>
                                    <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center' }}>
                                        {sharedWorkspaceCopy.emptyDescription} Creá uno desde una rutina para empezar a colaborar.
                                    </Text>
                                </View>
                            ) : workspaces.map((workspace) => (
                                <View
                                    key={workspace.id}
                                    style={{
                                        marginBottom: 12,
                                        borderRadius: 16,
                                        borderWidth: 1.5,
                                        borderColor: colors.border,
                                        backgroundColor: colors.surface,
                                        padding: 14,
                                        gap: 10,
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: colors.text, fontWeight: '900', fontSize: 15 }} numberOfLines={1}>
                                                {workspace.title}
                                            </Text>
                                            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                                                Rev {workspace.currentRevision} • {workspace.editMode === 'collaborative' ? 'Colaborativo' : 'Solo propietario'}
                                            </Text>
                                        </View>
                                        <View
                                            style={{
                                                borderRadius: 10,
                                                paddingHorizontal: 8,
                                                paddingVertical: 4,
                                                backgroundColor: withAlpha(colors.primary.DEFAULT, '12'),
                                                borderWidth: 1,
                                                borderColor: withAlpha(colors.primary.DEFAULT, '35'),
                                            }}
                                        >
                                            <Text style={{ color: colors.primary.DEFAULT, fontSize: 10, fontWeight: '900' }}>
                                                {roleLabel[workspace.membership.role]}
                                            </Text>
                                        </View>
                                    </View>

                                    {!!linkedRoutineBySpace[workspace.id] && (
                                        <View
                                            style={{
                                                borderRadius: 10,
                                                paddingHorizontal: 8,
                                                paddingVertical: 4,
                                                backgroundColor: withAlpha(colors.primary.DEFAULT, '12'),
                                                borderWidth: 1,
                                                borderColor: withAlpha(colors.primary.DEFAULT, '35'),
                                                alignSelf: 'flex-start',
                                            }}
                                        >
                                            <Text style={{ color: colors.primary.DEFAULT, fontSize: 10, fontWeight: '900' }}>
                                                VINCULADA EN BIBLIOTECA
                                            </Text>
                                        </View>
                                    )}

                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <View
                                            style={{
                                                borderRadius: 10,
                                                paddingHorizontal: 8,
                                                paddingVertical: 4,
                                                backgroundColor: withAlpha(colors.blue, '14'),
                                            }}
                                        >
                                            <Text style={{ color: colors.blue, fontSize: 10, fontWeight: '900' }}>
                                                {workspace.approvalMode === 'owner_review' ? sharedWorkspaceCopy.reviewRequired : sharedWorkspaceCopy.autoPublish}
                                            </Text>
                                        </View>
                                        {(pendingByWorkspace[workspace.id] ?? 0) > 0 && (
                                            <View
                                                style={{
                                                    borderRadius: 10,
                                                    paddingHorizontal: 8,
                                                    paddingVertical: 4,
                                                    backgroundColor: withAlpha(colors.yellow, '16'),
                                                }}
                                            >
                                                <Text style={{ color: colors.yellow, fontSize: 10, fontWeight: '900' }}>
                                                    {pendingByWorkspace[workspace.id]} {sharedWorkspaceCopy.pendingSuffix.toUpperCase()}
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <TouchableOpacity
                                            onPress={() => {
                                                workspaceFeedback.selection();
                                                void loadWorkspacePendingReviews(workspace.id);
                                            }}
                                            style={{
                                                flex: 1,
                                                height: 38,
                                                borderRadius: 12,
                                                borderWidth: 1.5,
                                                borderColor: colors.border,
                                                backgroundColor: colors.surfaceLighter,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexDirection: 'row',
                                                gap: 6,
                                            }}
                                        >
                                            {loadingReviewsByWorkspace[workspace.id] ? (
                                                <ActivityIndicator size="small" color={colors.textMuted} />
                                            ) : (
                                                <>
                                                    <ClipboardList size={14} color={colors.textMuted} />
                                                    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800' }}>Actualizar pendientes</Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                        {!!(linkedRoutineBySpace[workspace.id] || workspace.sourceRoutineId) && onOpenRoutine && (
                                            <TouchableOpacity
                                                onPress={() => {
                                                    workspaceFeedback.selection();
                                                    onClose();
                                                    onOpenRoutine((linkedRoutineBySpace[workspace.id] || workspace.sourceRoutineId) as string);
                                                }}
                                                style={{
                                                    flex: 1,
                                                    height: 38,
                                                    borderRadius: 12,
                                                    borderWidth: 1.5,
                                                    borderColor: withAlpha(colors.primary.DEFAULT, '35'),
                                                    backgroundColor: withAlpha(colors.primary.DEFAULT, '14'),
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexDirection: 'row',
                                                    gap: 6,
                                                }}
                                            >
                                                <BookOpen size={14} color={colors.primary.DEFAULT} />
                                                <Text style={{ color: colors.primary.DEFAULT, fontSize: 11, fontWeight: '800' }}>{sharedWorkspaceCopy.openRoutine}</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                    )}
                </View>
                <ToastContainer />
            </View>
        </Modal>
    );
}