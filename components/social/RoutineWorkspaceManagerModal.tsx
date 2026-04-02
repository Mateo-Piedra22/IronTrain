import { WorkspaceActionsSection } from '@/components/social/WorkspaceActionsSection';
import { WorkspaceConfigSection } from '@/components/social/WorkspaceConfigSection';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { useColors } from '@/src/hooks/useColors';
import { configService } from '@/src/services/ConfigService';
import { routineService } from '@/src/services/RoutineService';
import { SharedRoutineChangeItem, SharedRoutineComment, SharedRoutineInvitationItem, SharedRoutineItem, SharedRoutineReviewRequest, SocialApiError, SocialService } from '@/src/services/SocialService';
import { workspaceFeedback } from '@/src/social/workspaceFeedback';
import { useAuthStore } from '@/src/store/authStore';
import { confirm } from '@/src/store/confirmStore';
import { ThemeFx, withAlpha } from '@/src/theme';
import * as analytics from '@/src/utils/analytics';
import { X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

interface RoutineWorkspaceManagerModalProps {
    visible: boolean;
    routineId: string | null;
    routineName?: string | null;
    onClose: () => void;
}

export function RoutineWorkspaceManagerModal({ visible, routineId, routineName, onClose }: RoutineWorkspaceManagerModalProps) {
    const colors = useColors();
    const authState = useAuthStore();
    const WORKSPACE_AUTO_SYNC_FOR_EDITORS_KEY = 'workspaceAutoSyncForEditors';
    const LEGACY_SHARED_SPACE_AUTO_SYNC_FOR_EDITORS_KEY = 'sharedSpaceAutoSyncForEditors';
    const { height } = useWindowDimensions();
    const isCompact = height < 780;

    const [teamLoading, setTeamLoading] = useState(false);
    const [teamTitle, setTeamTitle] = useState('');
    const [teamEditMode, setTeamEditMode] = useState<'owner_only' | 'collaborative'>('owner_only');
    const [teamApprovalMode, setTeamApprovalMode] = useState<'none' | 'owner_review'>('none');
    const [selectedTeamFriendIds, setSelectedTeamFriendIds] = useState<string[]>([]);
    const [friends, setFriends] = useState<any[]>([]);
    const [teamWorkspaces, setTeamWorkspaces] = useState<SharedRoutineItem[]>([]);
    const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
    const [selectedWorkspaceChanges, setSelectedWorkspaceChanges] = useState<Record<string, SharedRoutineChangeItem[]>>({});
    const [selectedWorkspaceComments, setSelectedWorkspaceComments] = useState<Record<string, SharedRoutineComment[]>>({});
    const [selectedWorkspaceReviews, setSelectedWorkspaceReviews] = useState<Record<string, SharedRoutineReviewRequest[]>>({});
    const [incomingInvitations, setIncomingInvitations] = useState<SharedRoutineInvitationItem[]>([]);
    const [workspaceCommentDrafts, setWorkspaceCommentDrafts] = useState<Record<string, string>>({});
    const [autoSyncingWorkspaceId, setAutoSyncingWorkspaceId] = useState<string | null>(null);
    const [autoSyncedRevisionByWorkspace, setAutoSyncedRevisionByWorkspace] = useState<Record<string, number>>({});
    const [workspaceMembersById, setWorkspaceMembersById] = useState<Record<string, Array<{ userId: string; role: 'owner' | 'editor' | 'viewer'; canEdit: boolean; displayName?: string | null; username?: string | null }>>>({});
    const [workspaceInvitationsById, setWorkspaceInvitationsById] = useState<Record<string, Array<{ id: string; invitedUserId: string; invitedBy: string; proposedRole: 'editor' | 'viewer'; status: 'pending' | 'accepted' | 'rejected' | 'cancelled'; createdAt?: string | number | Date; displayName?: string | null; username?: string | null }>>>({});
    const [memberRoleOverrides, setMemberRoleOverrides] = useState<Record<string, 'editor' | 'viewer'>>({});
    const [memberSearch, setMemberSearch] = useState('');
    const [memberRoleFilter, setMemberRoleFilter] = useState<'all' | 'owner' | 'editor' | 'viewer'>('all');
    const [membersSeededWorkspaceId, setMembersSeededWorkspaceId] = useState<string | null>(null);
    const [autoSyncForEditorsEnabled, setAutoSyncForEditorsEnabled] = useState(false);

    const defaultWorkspaceTitle = useMemo(
        () => (routineName ? `${routineName} (Equipo)` : 'Rutina compartida'),
        [routineName],
    );

    const activeWorkspace = useMemo(
        () => teamWorkspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null,
        [teamWorkspaces, activeWorkspaceId],
    );

    const pendingReviewsCount = useMemo(
        () => Object.values(selectedWorkspaceReviews).flat().filter((review) => review.status === 'pending').length,
        [selectedWorkspaceReviews]
    );

    const activePendingReviewsCount = useMemo(() => {
        if (!activeWorkspace) return 0;
        return (selectedWorkspaceReviews[activeWorkspace.id] ?? []).filter((review) => review.status === 'pending').length;
    }, [activeWorkspace, selectedWorkspaceReviews]);

    const activeWorkspaceMembers = useMemo(
        () => (activeWorkspace ? (workspaceMembersById[activeWorkspace.id] ?? []) : []),
        [activeWorkspace, workspaceMembersById],
    );

    const activeWorkspaceInvitations = useMemo(
        () => (activeWorkspace ? (workspaceInvitationsById[activeWorkspace.id] ?? []) : []),
        [activeWorkspace, workspaceInvitationsById],
    );

    const resolveMemberRole = useCallback((memberId: string): 'editor' | 'viewer' => {
        const explicitRole = memberRoleOverrides[memberId];
        if (explicitRole) return explicitRole;

        const existingMember = activeWorkspaceMembers.find((member) => member.userId === memberId);
        if (existingMember && existingMember.role !== 'owner') {
            return existingMember.role === 'editor' ? 'editor' : 'viewer';
        }

        return 'viewer';
    }, [memberRoleOverrides, activeWorkspaceMembers]);

    const activeMemberIds = useMemo(
        () => new Set(activeWorkspaceMembers.map((member) => member.userId)),
        [activeWorkspaceMembers],
    );

    const inviteableFriends = useMemo(
        () => friends.filter((friend) => !activeMemberIds.has(friend.friendId)),
        [friends, activeMemberIds],
    );

    const visibleActiveWorkspaceMembers = useMemo(() => {
        const rolePriority: Record<'owner' | 'editor' | 'viewer', number> = {
            owner: 0,
            editor: 1,
            viewer: 2,
        };

        const normalizedSearch = memberSearch.trim().toLowerCase();
        return [...activeWorkspaceMembers]
            .filter((member) => memberRoleFilter === 'all' || member.role === memberRoleFilter)
            .filter((member) => {
                if (!normalizedSearch) return true;
                const text = `${member.displayName || ''} ${member.username || ''} ${member.userId}`.toLowerCase();
                return text.includes(normalizedSearch);
            })
            .sort((a, b) => {
                const roleDiff = rolePriority[a.role] - rolePriority[b.role];
                if (roleDiff !== 0) return roleDiff;
                const aName = (a.displayName || a.username || a.userId).toLowerCase();
                const bName = (b.displayName || b.username || b.userId).toLowerCase();
                return aName.localeCompare(bName);
            });
    }, [activeWorkspaceMembers, memberRoleFilter, memberSearch]);

    const isEditingConfig = !!activeWorkspace;
    const canEditConfig = !activeWorkspace || activeWorkspace.membership.role === 'owner';

    const applyWorkspaceToForm = useCallback((workspace: SharedRoutineItem | null) => {
        if (workspace) {
            setTeamTitle(workspace.title || defaultWorkspaceTitle);
            setTeamEditMode(workspace.editMode ?? 'owner_only');
            setTeamApprovalMode(workspace.approvalMode ?? 'none');
        } else {
            setTeamTitle(defaultWorkspaceTitle);
            setTeamEditMode('owner_only');
            setTeamApprovalMode('none');
        }
        setSelectedTeamFriendIds([]);
        setMemberRoleOverrides({});
    }, [defaultWorkspaceTitle]);

    const applyWorkspaceList = useCallback((workspaces: SharedRoutineItem[]) => {
        setTeamWorkspaces(workspaces);
        const nextActive = workspaces.find((item) => item.id === activeWorkspaceId) ?? null;
        setActiveWorkspaceId(nextActive?.id ?? null);
        applyWorkspaceToForm(nextActive);
    }, [activeWorkspaceId, applyWorkspaceToForm]);

    const selectWorkspace = useCallback((workspace: SharedRoutineItem | null) => {
        setActiveWorkspaceId(workspace?.id ?? null);
        applyWorkspaceToForm(workspace);
    }, [applyWorkspaceToForm]);

    const refreshTeamWorkspaces = useCallback(async () => {
        if (!routineId) return;
        const workspaces = await SocialService.listSharedRoutines();
        const byRoutine = workspaces.filter((item) => item.sourceRoutineId === routineId);
        applyWorkspaceList(byRoutine);
    }, [routineId, applyWorkspaceList]);

    const hydrate = useCallback(async () => {
        if (!routineId || !authState.token) return;

        setTeamLoading(true);
        try {
            setAutoSyncForEditorsEnabled(!!(
                configService.getGeneric<boolean>(WORKSPACE_AUTO_SYNC_FOR_EDITORS_KEY)
                ?? configService.getGeneric<boolean>(LEGACY_SHARED_SPACE_AUTO_SYNC_FOR_EDITORS_KEY)
            ));
            const [fr, workspaces, invitations] = await Promise.all([
                SocialService.getFriends(),
                SocialService.listSharedRoutines(),
                SocialService.listSharedRoutineInvitations(),
            ]);

            const acceptedFriends = fr.filter((f: any) => f.status === 'accepted');
            setFriends(acceptedFriends);

            const byRoutine = workspaces.filter((item) => item.sourceRoutineId === routineId);
            applyWorkspaceList(byRoutine);
            setIncomingInvitations(invitations.filter((invitation) => invitation.workspace.sourceRoutineId === routineId));
        } catch (e: any) {
            workspaceFeedback.error('Error', e?.message || 'No se pudo abrir rutinas compartidas.');
        } finally {
            setTeamLoading(false);
        }
    }, [authState.token, routineId, applyWorkspaceList]);

    useEffect(() => {
        if (!visible) return;
        if (!authState.token) {
            workspaceFeedback.error('Oops', 'Inicia sesión para usar rutinas compartidas.');
            onClose();
            return;
        }
        void hydrate();
    }, [visible, authState.token, hydrate, onClose]);

    const handleCreateTeamWorkspace = async () => {
        if (!routineId) return;
        if (activeWorkspace && activeWorkspace.membership.role !== 'owner') {
            workspaceFeedback.error('Permisos', 'Solo el owner puede editar la configuración de este espacio.');
            return;
        }

        const roleMap = selectedTeamFriendIds.reduce<Record<string, 'editor' | 'viewer'>>((acc, memberId) => {
            acc[memberId] = resolveMemberRole(memberId);
            return acc;
        }, {});

        const runSave = async () => {
            setTeamLoading(true);
            try {
                const created = await SocialService.createSharedRoutine({
                    routineId,
                    title: teamTitle.trim() || routineName || 'Rutina compartida',
                    memberIds: selectedTeamFriendIds,
                    memberRoles: roleMap,
                    removeMissingMembers: true,
                    editMode: teamEditMode,
                    approvalMode: teamApprovalMode,
                });

                if (created.reused) {
                    const pendingInfo = (created.pendingInvitations ?? 0) > 0
                        ? ` ${created.pendingInvitations} invitación(es) pendientes de aceptación.`
                        : '';
                    workspaceFeedback.success('Espacio actualizado', `Configuración guardada sin crear duplicados.${pendingInfo}`);
                } else {
                    const pendingInfo = (created.pendingInvitations ?? 0) > 0
                        ? ` ${created.pendingInvitations} invitación(es) pendientes de aceptación.`
                        : '';
                    workspaceFeedback.success('Rutina compartida creada', `Espacio creado. Revisión inicial: ${created.revision}.${pendingInfo}`);
                }
                await refreshTeamWorkspaces();
                const invitations = await SocialService.listSharedRoutineInvitations();
                setIncomingInvitations(invitations.filter((invitation) => invitation.workspace.sourceRoutineId === routineId));
                setSelectedTeamFriendIds([]);
                setMemberRoleOverrides({});
            } catch (e: any) {
                workspaceFeedback.error('Error', e?.message || 'No se pudo crear la rutina compartida.');
            } finally {
                setTeamLoading(false);
            }
        };

        if (isEditingConfig) {
            const existingIds = new Set(
                activeWorkspaceMembers
                    .filter((member) => member.role !== 'owner')
                    .map((member) => member.userId),
            );

            const addedIds = selectedTeamFriendIds.filter((id) => !existingIds.has(id));
            const removedIds = [...existingIds].filter((id) => !selectedTeamFriendIds.includes(id));
            const addedEditors = addedIds.filter((id) => roleMap[id] === 'editor');

            if (addedIds.length > 0 || removedIds.length > 0) {
                const summaryParts: string[] = [];
                if (addedIds.length > 0) summaryParts.push(`Agregar ${addedIds.length} persona(s)`);
                if (removedIds.length > 0) summaryParts.push(`Quitar ${removedIds.length} persona(s)`);

                const safetyLine = addedEditors.length > 0
                    ? `⚠️ ${addedEditors.length} nueva(s) persona(s) entran como editor y podrán publicar cambios para el equipo.`
                    : 'Por seguridad, los nuevos miembros se agregan como viewer salvo que elijas editor manualmente.';

                const message = `${summaryParts.join(' · ')}\n\n${safetyLine}\n\n¿Querés aplicar estos cambios?`;

                if (removedIds.length > 0 || addedEditors.length > 0) {
                    confirm.destructive('Confirmar cambios de miembros', message, () => { void runSave(); }, 'Aplicar cambios');
                } else {
                    confirm.ask('Confirmar cambios de miembros', message, () => { void runSave(); }, 'Aplicar cambios');
                }
                return;
            }
        }

        await runSave();
    };

    const handleToggleEditorAutoSync = async () => {
        const next = !autoSyncForEditorsEnabled;
        setAutoSyncForEditorsEnabled(next);
        await Promise.all([
            configService.setGeneric(WORKSPACE_AUTO_SYNC_FOR_EDITORS_KEY, next),
            configService.setGeneric(LEGACY_SHARED_SPACE_AUTO_SYNC_FOR_EDITORS_KEY, next),
        ]);
        workspaceFeedback.success('Preferencia actualizada', next ? 'Auto-sync para owner/editor activado.' : 'Auto-sync para owner/editor desactivado.');
    };

    const handleDecideIncomingInvitation = async (invitation: SharedRoutineInvitationItem, decision: 'accept' | 'reject') => {
        setTeamLoading(true);
        try {
            await SocialService.decideSharedRoutineInvitation(invitation.id, decision);
            if (decision === 'accept') {
                workspaceFeedback.success(
                    'Invitación aceptada',
                    `Entraste a "${invitation.workspace.title}" como ${invitation.proposedRole.toUpperCase()}.`,
                );
            } else {
                workspaceFeedback.success('Invitación rechazada', `No te agregamos a "${invitation.workspace.title}".`);
            }
            await hydrate();
        } catch (e: any) {
            workspaceFeedback.error('Error', e?.message || 'No se pudo procesar la invitación.');
        } finally {
            setTeamLoading(false);
        }
    };

    const handleOwnerSyncWorkspace = async (workspace: SharedRoutineItem) => {
        if (!routineId) return;
        if (workspace.membership.role !== 'owner') {
            workspaceFeedback.error('Permisos', 'Solo el owner puede sincronizar esta rutina.');
            return;
        }

        setTeamLoading(true);
        try {
            const result = await SocialService.ownerSyncSharedRoutine(workspace.id, routineId, workspace.currentRevision);
            workspaceFeedback.success('Sincronizado', `Nueva revisión: ${result.revision}`);
            await refreshTeamWorkspaces();
        } catch (e: any) {
            if (
                e instanceof SocialApiError
                && e.status === 409
                && e.code === 'SHARED_ROUTINE_REVISION_CONFLICT'
            ) {
                const serverRevision = typeof e.payload?.serverRevision === 'number' ? e.payload.serverRevision : null;
                const clientRevision = typeof e.payload?.baseRevision === 'number' ? e.payload.baseRevision : workspace.currentRevision;

                workspaceFeedback.error(
                    'Conflicto de revisión',
                    serverRevision !== null
                        ? `Tu revisión (${clientRevision}) quedó desactualizada. Última en servidor: ${serverRevision}. Recargamos workspaces para continuar.`
                        : 'Tu revisión quedó desactualizada. Recargamos workspaces para continuar.',
                );
                await refreshTeamWorkspaces();
                return;
            }

            workspaceFeedback.error('Error', e?.message || 'No se pudo sincronizar.');
        } finally {
            setTeamLoading(false);
        }
    };

    const handlePublishWorkspaceChanges = async (
        workspace: SharedRoutineItem,
        opts?: { force?: boolean; baseRevision?: number },
    ) => {
        if (!routineId) return;
        if (!workspace.membership.canEdit) {
            workspaceFeedback.error('Permisos', 'No tenés permisos para publicar cambios en este espacio.');
            return;
        }

        const baseRevision = typeof opts?.baseRevision === 'number' ? opts.baseRevision : workspace.currentRevision;
        const force = !!opts?.force;

        setTeamLoading(true);
        try {
            const payload = await routineService.exportRoutine(routineId);
            const result = await SocialService.syncSharedRoutine(workspace.id, {
                payload: payload as Record<string, unknown>,
                baseRevision,
                sourceRoutineId: routineId,
                force,
            });

            if (result.reviewRequired) {
                workspaceFeedback.success('Enviado a revisión', 'El owner debe aprobar esta propuesta antes de publicarla.');
            } else {
                workspaceFeedback.success('Cambios publicados', `Nueva revisión: ${result.revision}${result.forced ? ' (forzada)' : ''}.`);
            }
            await refreshTeamWorkspaces();
        } catch (e: any) {
            if (
                e instanceof SocialApiError
                && e.status === 409
                && e.code === 'SHARED_ROUTINE_REVISION_CONFLICT'
            ) {
                const serverRevision = typeof e.payload?.serverRevision === 'number' ? e.payload.serverRevision : null;
                const clientRevision = typeof e.payload?.baseRevision === 'number' ? e.payload.baseRevision : workspace.currentRevision;

                confirm.ask(
                    'Conflicto de revisión',
                    serverRevision !== null
                        ? `Tu base (${clientRevision}) quedó vieja frente a servidor (${serverRevision}). ¿Querés sobrescribir con tu versión local?`
                        : 'Tu base quedó vieja frente al servidor. ¿Querés sobrescribir con tu versión local?',
                    () => {
                        void handlePublishWorkspaceChanges(workspace, {
                            force: true,
                            baseRevision: serverRevision ?? clientRevision,
                        });
                    },
                    'Sobrescribir'
                );
                await refreshTeamWorkspaces();
                return;
            }

            workspaceFeedback.error('Error', e?.message || 'No se pudieron publicar los cambios.');
        } finally {
            setTeamLoading(false);
        }
    };

    const handleImportWorkspaceSnapshot = async (workspace: SharedRoutineItem) => {
        setTeamLoading(true);
        try {
            const detail = await SocialService.getSharedRoutine(workspace.id);
            const result = await routineService.syncSharedRoutinePayload(detail.snapshot.payload, {
                sharedRoutineId: workspace.id,
                snapshotId: detail.snapshot.id,
                revision: detail.snapshot.revision,
                targetRoutineId: workspace.sourceRoutineId,
                title: workspace.title,
            });
            if (!result.applied) {
                workspaceFeedback.success('Sin cambios', 'Ya tenías aplicada esta misma revisión en tu biblioteca.');
                return;
            }
            workspaceFeedback.success('Sincronizada', 'La última revisión ya está aplicada en tu biblioteca.');
        } catch (e: any) {
            workspaceFeedback.error('Error', e?.message || 'No se pudo importar la revisión.');
        } finally {
            setTeamLoading(false);
        }
    };

    const runExplainedAction = useCallback((title: string, message: string, actionLabel: string, action: () => void | Promise<void>) => {
        confirm.ask(title, message, () => { void action(); }, actionLabel);
    }, []);

    const autoSyncWorkspaceSilently = useCallback(async (workspace: SharedRoutineItem) => {
        if (!workspace?.id) return;
        const knownRevision = autoSyncedRevisionByWorkspace[workspace.id] ?? 0;
        analytics.capture('shared_workspace_auto_sync_attempted', {
            workspace_id: workspace.id,
            known_revision: knownRevision,
            membership_role: workspace.membership.role,
        });
        setAutoSyncingWorkspaceId(workspace.id);
        try {
            const detail = await SocialService.getSharedRoutine(workspace.id);
            const remoteRevision = detail.snapshot.revision || workspace.currentRevision || 0;

            if (remoteRevision <= knownRevision) {
                analytics.capture('shared_workspace_auto_sync_skipped', {
                    workspace_id: workspace.id,
                    reason: 'already_known_revision',
                    remote_revision: remoteRevision,
                    known_revision: knownRevision,
                });
                return;
            }

            const result = await routineService.syncSharedRoutinePayload(detail.snapshot.payload, {
                sharedRoutineId: workspace.id,
                snapshotId: detail.snapshot.id,
                revision: detail.snapshot.revision,
                targetRoutineId: workspace.sourceRoutineId,
                title: workspace.title,
            });

            setAutoSyncedRevisionByWorkspace((prev) => ({ ...prev, [workspace.id]: remoteRevision }));

            if (result.applied) {
                analytics.capture('shared_workspace_auto_sync_applied', {
                    workspace_id: workspace.id,
                    remote_revision: remoteRevision,
                });
                workspaceFeedback.success('Sincronización automática', `Se aplicó automáticamente la revisión ${remoteRevision}.`);
            } else {
                analytics.capture('shared_workspace_auto_sync_skipped', {
                    workspace_id: workspace.id,
                    reason: 'already_applied_locally',
                    remote_revision: remoteRevision,
                });
            }
        } catch {
            analytics.capture('shared_workspace_auto_sync_error', {
                workspace_id: workspace.id,
            });
            // Silent fail by design: manual actions remain available.
        } finally {
            setAutoSyncingWorkspaceId((current) => (current === workspace.id ? null : current));
        }
    }, [autoSyncedRevisionByWorkspace]);

    useEffect(() => {
        if (!visible || !activeWorkspace) return;
        if (activeWorkspace.membership.canEdit && !autoSyncForEditorsEnabled) return;
        void autoSyncWorkspaceSilently(activeWorkspace);
    }, [visible, activeWorkspace?.id, autoSyncWorkspaceSilently, autoSyncForEditorsEnabled]);

    useEffect(() => {
        if (!visible || !activeWorkspace) return;

        let cancelled = false;

        const loadMembers = async () => {
            try {
                const detail = await SocialService.getSharedRoutine(activeWorkspace.id);
                if (cancelled) return;
                setWorkspaceMembersById((prev) => ({
                    ...prev,
                    [activeWorkspace.id]: (detail.members ?? []).map((member) => ({
                        userId: member.userId,
                        role: member.role,
                        canEdit: member.canEdit,
                        displayName: member.displayName,
                        username: member.username,
                    })),
                }));
                setWorkspaceInvitationsById((prev) => ({
                    ...prev,
                    [activeWorkspace.id]: (detail.pendingInvitations ?? []).map((invitation) => ({
                        id: invitation.id,
                        invitedUserId: invitation.invitedUserId,
                        invitedBy: invitation.invitedBy,
                        proposedRole: invitation.proposedRole,
                        status: invitation.status,
                        createdAt: invitation.createdAt,
                        displayName: invitation.displayName,
                        username: invitation.username,
                    })),
                }));
            } catch {
                if (cancelled) return;
                setWorkspaceMembersById((prev) => ({ ...prev, [activeWorkspace.id]: [] }));
                setWorkspaceInvitationsById((prev) => ({ ...prev, [activeWorkspace.id]: [] }));
            }
        };

        void loadMembers();

        return () => {
            cancelled = true;
        };
    }, [visible, activeWorkspace?.id]);

    useEffect(() => {
        if (!activeWorkspace) {
            setMembersSeededWorkspaceId(null);
            setMemberSearch('');
            setMemberRoleFilter('all');
            return;
        }
        if (membersSeededWorkspaceId === activeWorkspace.id) return;
        if (activeWorkspaceMembers.length === 0) return;

        const seededMemberIds: string[] = [];
        const seededRoles: Record<string, 'editor' | 'viewer'> = {};

        activeWorkspaceMembers.forEach((member) => {
            if (member.role === 'owner') return;
            seededMemberIds.push(member.userId);
            seededRoles[member.userId] = member.role === 'editor' ? 'editor' : 'viewer';
        });

        setSelectedTeamFriendIds(seededMemberIds);
        setMemberRoleOverrides(seededRoles);
        setMembersSeededWorkspaceId(activeWorkspace.id);
    }, [activeWorkspace, activeWorkspaceMembers, membersSeededWorkspaceId]);

    const handleViewWorkspaceHistory = async (workspace: SharedRoutineItem) => {
        setTeamLoading(true);
        try {
            const changes = await SocialService.listSharedRoutineChanges(workspace.id);
            setSelectedWorkspaceChanges((prev) => ({
                ...prev,
                [workspace.id]: changes,
            }));

            if (changes.length === 0) {
                workspaceFeedback.success('Historial', 'No hay cambios registrados todavía.');
                return;
            }

            const lines = changes.slice(0, 8).map((change, index) => {
                const revision =
                    change.metadata && typeof change.metadata.revision === 'number'
                        ? change.metadata.revision
                        : null;

                return `${index + 1}. ${change.actionType}${revision ? ` (rev ${revision})` : ''}`;
            });

            confirm.info('Historial reciente', lines.join('\n'));
        } catch (e: any) {
            workspaceFeedback.error('Error', e?.message || 'No se pudo cargar el historial.');
        } finally {
            setTeamLoading(false);
        }
    };

    const handleLoadWorkspaceComments = async (workspace: SharedRoutineItem) => {
        setTeamLoading(true);
        try {
            const comments = await SocialService.listSharedRoutineComments(workspace.id);
            setSelectedWorkspaceComments((prev) => ({ ...prev, [workspace.id]: comments }));

            if (comments.length === 0) {
                workspaceFeedback.success('Comentarios', 'No hay comentarios todavía.');
                return;
            }

            const preview = comments.slice(-6).map((comment, idx) => `${idx + 1}. ${comment.message}`).join('\n');
            confirm.info('Comentarios recientes', preview);
        } catch (e: any) {
            workspaceFeedback.error('Error', e?.message || 'No se pudieron cargar los comentarios.');
        } finally {
            setTeamLoading(false);
        }
    };

    const handleAddWorkspaceComment = async (workspace: SharedRoutineItem) => {
        const draft = (workspaceCommentDrafts[workspace.id] || '').trim();
        if (!draft) {
            workspaceFeedback.error('Comentario', 'Escribí un comentario antes de enviarlo.');
            return;
        }

        setTeamLoading(true);
        try {
            await SocialService.addSharedRoutineComment(workspace.id, { message: draft });
            setWorkspaceCommentDrafts((prev) => ({ ...prev, [workspace.id]: '' }));
            await handleLoadWorkspaceComments(workspace);
            workspaceFeedback.success('Comentario enviado', 'Se agregó al espacio compartido.');
        } catch (e: any) {
            workspaceFeedback.error('Error', e?.message || 'No se pudo enviar el comentario.');
        } finally {
            setTeamLoading(false);
        }
    };

    const handleLoadWorkspaceReviews = async (workspace: SharedRoutineItem) => {
        setTeamLoading(true);
        try {
            const reviews = await SocialService.listSharedRoutineReviews(workspace.id);
            setSelectedWorkspaceReviews((prev) => ({ ...prev, [workspace.id]: reviews }));

            if (reviews.length === 0) {
                workspaceFeedback.success('Revisiones', 'No hay revisiones registradas.');
                return;
            }

            const summary = reviews
                .slice(0, 8)
                .map((review, index) => `${index + 1}. ${review.status} • base rev ${review.requestedBaseRevision}`)
                .join('\n');

            confirm.info('Revisiones recientes', summary);
        } catch (e: any) {
            workspaceFeedback.error('Error', e?.message || 'No se pudieron cargar las revisiones.');
        } finally {
            setTeamLoading(false);
        }
    };

    const handleDecideReview = async (
        workspace: SharedRoutineItem,
        review: SharedRoutineReviewRequest,
        decision: 'approve' | 'reject',
        opts?: { force?: boolean },
    ) => {
        if (workspace.membership.role !== 'owner') {
            workspaceFeedback.error('Permisos', 'Solo el owner puede decidir revisiones.');
            return;
        }

        setTeamLoading(true);
        try {
            const result = await SocialService.decideSharedRoutineReview(workspace.id, review.id, {
                decision,
                force: !!opts?.force,
            });

            if (decision === 'approve') {
                workspaceFeedback.success('Revisión aprobada', `Nueva revisión publicada: ${result.revision ?? 'n/a'}.`);
            } else {
                workspaceFeedback.success('Revisión rechazada', 'La propuesta fue rechazada.');
            }

            await Promise.all([refreshTeamWorkspaces(), handleLoadWorkspaceReviews(workspace)]);
        } catch (e: any) {
            if (
                e instanceof SocialApiError
                && e.status === 409
                && e.code === 'SHARED_ROUTINE_REVISION_CONFLICT'
                && decision === 'approve'
            ) {
                const serverRevision = typeof e.payload?.serverRevision === 'number' ? e.payload.serverRevision : null;
                confirm.ask(
                    'Conflicto al aprobar',
                    serverRevision !== null
                        ? `La base de la propuesta quedó vieja frente a servidor (${serverRevision}). ¿Aprobar forzando igualmente?`
                        : 'La base de la propuesta quedó vieja. ¿Aprobar forzando igualmente?',
                    () => {
                        void handleDecideReview(workspace, review, decision, { force: true });
                    },
                    'Aprobar forzando'
                );
                return;
            }

            workspaceFeedback.error('Error', e?.message || 'No se pudo procesar la revisión.');
        } finally {
            setTeamLoading(false);
        }
    };

    const handleRollbackWorkspace = async (
        workspace: SharedRoutineItem,
        options?: { force?: boolean; baseRevision?: number },
    ) => {
        if (workspace.membership.role !== 'owner') {
            workspaceFeedback.error('Permisos', 'Solo el owner puede hacer rollback.');
            return;
        }

        const currentRevision = workspace.currentRevision;
        const targetRevision = currentRevision - 1;

        if (targetRevision < 1) {
            workspaceFeedback.error('Rollback', 'No hay revisiones anteriores disponibles para rollback.');
            return;
        }

        setTeamLoading(true);
        try {
            const result = await SocialService.rollbackSharedRoutine(workspace.id, {
                targetRevision,
                baseRevision: options?.baseRevision ?? currentRevision,
                force: !!options?.force,
            });

            workspaceFeedback.success('Rollback aplicado', `Se volvió a rev ${result.targetRevision}. Nueva revisión: ${result.revision}.`);
            await refreshTeamWorkspaces();
        } catch (e: any) {
            if (
                e instanceof SocialApiError
                && e.status === 409
                && e.code === 'SHARED_ROUTINE_REVISION_CONFLICT'
            ) {
                const serverRevision = typeof e.payload?.serverRevision === 'number' ? e.payload.serverRevision : null;
                const clientRevision = typeof e.payload?.baseRevision === 'number' ? e.payload.baseRevision : currentRevision;

                confirm.ask(
                    'Conflicto de revisión',
                    serverRevision !== null
                        ? `Tu base (${clientRevision}) quedó vieja frente a servidor (${serverRevision}). ¿Forzar rollback igualmente?`
                        : 'Tu base quedó vieja frente al servidor. ¿Forzar rollback igualmente?',
                    () => {
                        void handleRollbackWorkspace(workspace, {
                            force: true,
                            baseRevision: serverRevision ?? clientRevision,
                        });
                    },
                    'Forzar rollback'
                );
                await refreshTeamWorkspaces();
                return;
            }

            workspaceFeedback.error('Error', e?.message || 'No se pudo aplicar rollback.');
        } finally {
            setTeamLoading(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <GestureHandlerRootView style={{ flex: 1 }}>
                    <View style={{ flex: 1, backgroundColor: ThemeFx.backdropStrong, justifyContent: 'center', paddingHorizontal: isCompact ? 12 : 16, paddingVertical: isCompact ? 26 : 48 }}>
                        <View style={{
                            backgroundColor: colors.surfaceLighter,
                            borderWidth: 1.5,
                            borderColor: colors.border,
                            borderRadius: 20,
                            flex: 1,
                            maxHeight: isCompact ? '97%' : '95%',
                            width: '100%',
                            overflow: 'hidden',
                            ...ThemeFx.shadowLg,
                        }}>
                        <View style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            paddingHorizontal: isCompact ? 14 : 18,
                            paddingVertical: isCompact ? 12 : 18,
                            borderBottomWidth: 1.5,
                            borderBottomColor: colors.border,
                            backgroundColor: colors.surface,
                        }}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: colors.text, fontWeight: '900', fontSize: isCompact ? 15 : 17, letterSpacing: -0.4 }}>Rutinas compartidas</Text>
                                <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700', marginTop: 2 }}>
                                    Equipo, sincronización e importación de revisiones
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={onClose}
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 10,
                                    backgroundColor: colors.surfaceLighter,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                }}
                            >
                                <X size={18} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={{ flex: 1, padding: isCompact ? 12 : 16, backgroundColor: colors.surfaceLighter }}
                            contentContainerStyle={{ paddingBottom: isCompact ? 16 : 22 }}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="on-drag"
                        >
                            {incomingInvitations.length > 0 && (
                                <View style={{ backgroundColor: colors.surface, borderWidth: 1.5, borderColor: withAlpha(colors.yellow, '35'), borderRadius: 16, padding: 12, marginBottom: 12 }}>
                                    <Text style={{ color: colors.text, fontWeight: '900', fontSize: 14, marginBottom: 4 }}>Invitaciones pendientes para vos</Text>
                                    <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 10 }}>
                                        No te agregamos automáticamente: primero revisás qué rol tendrías y recién ahí aceptás o rechazás.
                                    </Text>

                                    <View style={{ gap: 8 }}>
                                        {incomingInvitations.map((invitation) => (
                                            <View key={`incoming-invitation-${invitation.id}`} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surfaceLighter, padding: 10 }}>
                                                <Text style={{ color: colors.text, fontWeight: '900', fontSize: 12 }}>{invitation.workspace.title}</Text>
                                                <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 3 }}>
                                                    Rol propuesto: {invitation.proposedRole.toUpperCase()} • Modo: {invitation.workspace.editMode === 'collaborative' ? 'Colaborativa' : 'Solo propietario'}
                                                </Text>
                                                <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 2 }}>
                                                    {invitation.proposedRole === 'editor'
                                                        ? 'Si aceptás, podrás publicar cambios/propuestas en este espacio.'
                                                        : 'Si aceptás, podrás ver y traer revisiones, sin publicar cambios.'}
                                                </Text>

                                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                                                    <TouchableOpacity
                                                        onPress={() => confirm.ask(
                                                            'Aceptar invitación',
                                                            `Vas a entrar a "${invitation.workspace.title}" con rol ${invitation.proposedRole.toUpperCase()}.`,
                                                            () => { void handleDecideIncomingInvitation(invitation, 'accept'); },
                                                            'Aceptar',
                                                        )}
                                                        style={{ flex: 1, borderWidth: 1, borderColor: colors.primary.DEFAULT, borderRadius: 10, backgroundColor: withAlpha(colors.primary.DEFAULT, '12'), alignItems: 'center', justifyContent: 'center', minHeight: 34 }}
                                                        disabled={teamLoading}
                                                    >
                                                        <Text style={{ color: colors.primary.DEFAULT, fontWeight: '900', fontSize: 11 }}>Aceptar</Text>
                                                    </TouchableOpacity>

                                                    <TouchableOpacity
                                                        onPress={() => confirm.destructive(
                                                            'Rechazar invitación',
                                                            `No te vamos a agregar a "${invitation.workspace.title}".`,
                                                            () => { void handleDecideIncomingInvitation(invitation, 'reject'); },
                                                            'Rechazar',
                                                        )}
                                                        style={{ flex: 1, borderWidth: 1, borderColor: withAlpha(colors.red, '35'), borderRadius: 10, backgroundColor: withAlpha(colors.red, '08'), alignItems: 'center', justifyContent: 'center', minHeight: 34 }}
                                                        disabled={teamLoading}
                                                    >
                                                        <Text style={{ color: colors.red, fontWeight: '900', fontSize: 11 }}>Rechazar</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                            <View style={{ backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, padding: 12, marginBottom: 12 }}>
                                <Text style={{ color: colors.text, fontWeight: '900', fontSize: 13 }}>Guía rápida</Text>
                                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4, lineHeight: 16 }}>
                                    1) Elegí un espacio. 2) Configurá permisos e invitados. 3) Sincronizá, revisá actividad o deshacé la última versión.
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                                    <View style={{ borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: withAlpha(colors.primary.DEFAULT, '12') }}>
                                        <Text style={{ color: colors.primary.DEFAULT, fontSize: 10, fontWeight: '900' }}>{teamWorkspaces.length} espacios</Text>
                                    </View>
                                    <View style={{ borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: withAlpha(colors.yellow, '16') }}>
                                        <Text style={{ color: colors.yellow, fontSize: 10, fontWeight: '900' }}>{pendingReviewsCount} pendientes</Text>
                                    </View>
                                    {!!routineName && (
                                        <View style={{ borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.surfaceLighter, borderWidth: 1, borderColor: colors.border }}>
                                            <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '900' }}>{routineName}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>

                            <View style={{ backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, padding: 12, marginBottom: 12 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <Text style={{ color: colors.text, fontWeight: '900', fontSize: 15 }}>1) Elegí el espacio</Text>
                                    <TouchableOpacity
                                        onPress={() => selectWorkspace(null)}
                                        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.surfaceLighter }}
                                    >
                                        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800' }}>Nuevo espacio</Text>
                                    </TouchableOpacity>
                                </View>
                                <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 10 }}>
                                    Elegí uno para editarlo. Si creás uno nuevo, se usa esta rutina y no se duplican espacios.
                                </Text>

                                {teamLoading && teamWorkspaces.length === 0 ? (
                                    <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                                        <ActivityIndicator color={colors.primary.DEFAULT} />
                                    </View>
                                ) : teamWorkspaces.length === 0 ? (
                                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>Todavía no hay espacios para esta rutina.</Text>
                                ) : (
                                    <View style={{ gap: 8 }}>
                                        {teamWorkspaces.map((workspace) => {
                                            const isSelected = activeWorkspaceId === workspace.id;
                                            return (
                                                <TouchableOpacity
                                                    key={workspace.id}
                                                    onPress={() => selectWorkspace(workspace)}
                                                    style={{
                                                        borderWidth: 1.5,
                                                        borderColor: isSelected ? colors.primary.DEFAULT : colors.border,
                                                        borderRadius: 12,
                                                        padding: 10,
                                                        backgroundColor: isSelected ? withAlpha(colors.primary.DEFAULT, '10') : colors.surfaceLighter,
                                                    }}
                                                >
                                                    <Text style={{ color: isSelected ? colors.primary.DEFAULT : colors.text, fontWeight: '900', fontSize: 13 }}>
                                                        {workspace.title}
                                                    </Text>
                                                    <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 3 }}>
                                                        Rev {workspace.currentRevision} • {workspace.membership.role} • {workspace.editMode === 'collaborative' ? 'Colaborativa' : 'Solo propietario'}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                )}
                            </View>

                            <WorkspaceConfigSection
                                colors={colors}
                                teamLoading={teamLoading}
                                routineId={routineId}
                                isEditingConfig={isEditingConfig}
                                canEditConfig={canEditConfig}
                                activeWorkspace={activeWorkspace}
                                activeWorkspaceMembers={activeWorkspaceMembers}
                                activeWorkspaceInvitations={activeWorkspaceInvitations}
                                visibleActiveWorkspaceMembers={visibleActiveWorkspaceMembers}
                                inviteableFriends={inviteableFriends}
                                selectedTeamFriendIds={selectedTeamFriendIds}
                                memberSearch={memberSearch}
                                memberRoleFilter={memberRoleFilter}
                                teamTitle={teamTitle}
                                teamEditMode={teamEditMode}
                                teamApprovalMode={teamApprovalMode}
                                autoSyncForEditorsEnabled={autoSyncForEditorsEnabled}
                                resolveMemberRole={resolveMemberRole}
                                onToggleAutoSync={handleToggleEditorAutoSync}
                                onSetTeamTitle={setTeamTitle}
                                onSetTeamEditMode={setTeamEditMode}
                                onSetTeamApprovalMode={setTeamApprovalMode}
                                onSetMemberSearch={setMemberSearch}
                                onSetMemberRoleFilter={setMemberRoleFilter}
                                onSetMemberRole={(memberId, role) => {
                                    setMemberRoleOverrides((prev) => ({ ...prev, [memberId]: role }));
                                }}
                                onAddMember={(memberId, role) => {
                                    setSelectedTeamFriendIds((prev) => (prev.includes(memberId) ? prev : [...prev, memberId]));
                                    setMemberRoleOverrides((prev) => ({ ...prev, [memberId]: role }));
                                }}
                                onRemoveMember={(memberId) => {
                                    setSelectedTeamFriendIds((prev) => prev.filter((id) => id !== memberId));
                                    setMemberRoleOverrides((prev) => {
                                        const next = { ...prev };
                                        delete next[memberId];
                                        return next;
                                    });
                                }}
                                onToggleFriendSelection={(friendId) => {
                                    setSelectedTeamFriendIds((prev) => (
                                        prev.includes(friendId)
                                            ? prev.filter((id) => id !== friendId)
                                            : [...prev, friendId]
                                    ));
                                }}
                                onSaveWorkspace={handleCreateTeamWorkspace}
                            />

                            {!!activeWorkspace && (
                                <WorkspaceActionsSection
                                    colors={colors}
                                    activeWorkspace={activeWorkspace}
                                    activePendingReviewsCount={activePendingReviewsCount}
                                    autoSyncingWorkspaceId={autoSyncingWorkspaceId}
                                    teamLoading={teamLoading}
                                    workspaceCommentDraft={workspaceCommentDrafts[activeWorkspace.id] || ''}
                                    selectedWorkspaceChanges={selectedWorkspaceChanges[activeWorkspace.id] ?? []}
                                    pendingWorkspaceReviews={(selectedWorkspaceReviews[activeWorkspace.id] ?? []).filter((review) => review.status === 'pending')}
                                    runExplainedAction={runExplainedAction}
                                    onImportWorkspaceSnapshot={() => handleImportWorkspaceSnapshot(activeWorkspace)}
                                    onPublishWorkspaceChanges={() => handlePublishWorkspaceChanges(activeWorkspace)}
                                    onOwnerSyncWorkspace={() => handleOwnerSyncWorkspace(activeWorkspace)}
                                    onViewWorkspaceHistory={() => handleViewWorkspaceHistory(activeWorkspace)}
                                    onLoadWorkspaceComments={() => handleLoadWorkspaceComments(activeWorkspace)}
                                    onLoadWorkspaceReviews={() => handleLoadWorkspaceReviews(activeWorkspace)}
                                    onRollbackWorkspace={() => {
                                        confirm.destructive(
                                            'Rollback de workspace',
                                            `Vas a crear una nueva revisión restaurando la versión anterior (rev ${Math.max(1, activeWorkspace.currentRevision - 1)}).`,
                                            () => { void handleRollbackWorkspace(activeWorkspace); },
                                            'Aplicar rollback',
                                        );
                                    }}
                                    onCommentDraftChange={(value) => setWorkspaceCommentDrafts((prev) => ({ ...prev, [activeWorkspace.id]: value }))}
                                    onAddWorkspaceComment={() => handleAddWorkspaceComment(activeWorkspace)}
                                    onDecideReview={(review, decision) => handleDecideReview(activeWorkspace, review, decision)}
                                />
                            )}
                        </ScrollView>
                    </View>
                    </View>
                    <ToastContainer />
                </GestureHandlerRootView>
            </KeyboardAvoidingView>
        </Modal>
    );
}