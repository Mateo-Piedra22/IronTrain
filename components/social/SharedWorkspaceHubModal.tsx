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
    const [sharedSpaces, setSharedSpaces] = useState<SharedRoutineItem[]>([]);
    const [pendingBySharedSpace, setPendingBySharedSpace] = useState<Record<string, number>>({});
    const [loadingReviewsBySharedSpace, setLoadingReviewsBySharedSpace] = useState<Record<string, boolean>>({});
    const [linkedRoutineBySpace, setLinkedRoutineBySpace] = useState<Record<string, string>>({});

    const pendingTotal = useMemo(
        () => Object.values(pendingBySharedSpace).reduce((acc, count) => acc + count, 0),
        [pendingBySharedSpace]
    );

    const loadSharedSpacePendingReviews = useCallback(async (sharedSpaceId: string) => {
        setLoadingReviewsBySharedSpace((prev) => ({ ...prev, [sharedSpaceId]: true }));
        try {
            const reviews: SharedRoutineReviewRequest[] = await SocialService.listSharedRoutineReviews(sharedSpaceId);
            const pendingCount = reviews.filter((review) => review.status === 'pending').length;
            setPendingBySharedSpace((prev) => ({ ...prev, [sharedSpaceId]: pendingCount }));
        } catch {
            setPendingBySharedSpace((prev) => ({ ...prev, [sharedSpaceId]: 0 }));
        } finally {
            setLoadingReviewsBySharedSpace((prev) => ({ ...prev, [sharedSpaceId]: false }));
        }
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const items = await SocialService.listSharedRoutines();
            setSharedSpaces(items);
            setPendingBySharedSpace(
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
            workspaceFeedback.error('Workspaces', error?.message || 'No se pudieron cargar los espacios compartidos.');
            setSharedSpaces([]);
            setPendingBySharedSpace({});
        } finally {
            setLoading(false);
        }
    }, [loadSharedSpacePendingReviews]);

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
                                    {formatWorkspaceStatus(sharedSpaces.length, pendingTotal)}
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
                            <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700', marginTop: 8 }}>Sincronizando espacios…</Text>
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
                                    Revisá estado, actualizá pendientes y abrí la rutina vinculada para editar o entrenar sin duplicar datos.
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                                    <View style={{ borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: withAlpha(colors.primary.DEFAULT, '12') }}>
                                        <Text style={{ color: colors.primary.DEFAULT, fontSize: 10, fontWeight: '900' }}>{sharedSpaces.length} espacios</Text>
                                    </View>
                                    <View style={{ borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: withAlpha(colors.yellow, '16') }}>
                                        <Text style={{ color: colors.yellow, fontSize: 10, fontWeight: '900' }}>{pendingTotal} pendientes</Text>
                                    </View>
                                </View>
                            </View>

                            {sharedSpaces.length === 0 ? (
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
                            ) : sharedSpaces.map((sharedSpace) => (
                                <View
                                    key={sharedSpace.id}
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
                                                {sharedSpace.title}
                                            </Text>
                                            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                                                Rev {sharedSpace.currentRevision} • {sharedSpace.editMode === 'collaborative' ? 'Colaborativo' : 'Solo owner'}
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
                                                {roleLabel[sharedSpace.membership.role]}
                                            </Text>
                                        </View>
                                    </View>

                                    {!!linkedRoutineBySpace[sharedSpace.id] && (
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
                                                {sharedSpace.approvalMode === 'owner_review' ? sharedWorkspaceCopy.reviewRequired : sharedWorkspaceCopy.autoPublish}
                                            </Text>
                                        </View>
                                        {(pendingBySharedSpace[sharedSpace.id] ?? 0) > 0 && (
                                            <View
                                                style={{
                                                    borderRadius: 10,
                                                    paddingHorizontal: 8,
                                                    paddingVertical: 4,
                                                    backgroundColor: withAlpha(colors.yellow, '16'),
                                                }}
                                            >
                                                <Text style={{ color: colors.yellow, fontSize: 10, fontWeight: '900' }}>
                                                    {pendingBySharedSpace[sharedSpace.id]} {sharedWorkspaceCopy.pendingSuffix.toUpperCase()}
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <TouchableOpacity
                                            onPress={() => {
                                                workspaceFeedback.selection();
                                                void loadSharedSpacePendingReviews(sharedSpace.id);
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
                                            {loadingReviewsBySharedSpace[sharedSpace.id] ? (
                                                <ActivityIndicator size="small" color={colors.textMuted} />
                                            ) : (
                                                <>
                                                    <ClipboardList size={14} color={colors.textMuted} />
                                                    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800' }}>Actualizar pendientes</Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                        {!!(linkedRoutineBySpace[sharedSpace.id] || sharedSpace.sourceRoutineId) && onOpenRoutine && (
                                            <TouchableOpacity
                                                onPress={() => {
                                                    workspaceFeedback.selection();
                                                    onClose();
                                                    onOpenRoutine((linkedRoutineBySpace[sharedSpace.id] || sharedSpace.sourceRoutineId) as string);
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