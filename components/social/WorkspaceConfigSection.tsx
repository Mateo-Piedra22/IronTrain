import { IronButton } from '@/components/IronButton';
import { IronInput } from '@/components/IronInput';
import { SharedRoutineItem } from '@/src/services/SocialService';
import { withAlpha } from '@/src/theme';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

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

type WorkspaceMember = {
    userId: string;
    role: 'owner' | 'editor' | 'viewer';
    canEdit: boolean;
    displayName?: string | null;
    username?: string | null;
};

type WorkspaceInvitation = {
    id: string;
    invitedUserId: string;
    invitedBy: string;
    proposedRole: 'editor' | 'viewer';
    status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
    createdAt?: string | number | Date;
    displayName?: string | null;
    username?: string | null;
};

type InviteableFriend = {
    friendId: string;
    displayName: string;
};

type WorkspaceConfigSectionProps = {
    colors: WorkspaceColors;
    teamLoading: boolean;
    routineId: string | null;
    isEditingConfig: boolean;
    canEditConfig: boolean;
    activeWorkspace: SharedRoutineItem | null;
    activeWorkspaceMembers: WorkspaceMember[];
    activeWorkspaceInvitations: WorkspaceInvitation[];
    visibleActiveWorkspaceMembers: WorkspaceMember[];
    inviteableFriends: InviteableFriend[];
    selectedTeamFriendIds: string[];
    memberSearch: string;
    memberRoleFilter: 'all' | 'owner' | 'editor' | 'viewer';
    teamTitle: string;
    teamEditMode: 'owner_only' | 'collaborative';
    teamApprovalMode: 'none' | 'owner_review';
    autoSyncForEditorsEnabled: boolean;
    resolveMemberRole: (memberId: string) => 'editor' | 'viewer';
    onToggleAutoSync: () => void;
    onSetTeamTitle: (value: string) => void;
    onSetTeamEditMode: (mode: 'owner_only' | 'collaborative') => void;
    onSetTeamApprovalMode: (mode: 'none' | 'owner_review') => void;
    onSetMemberSearch: (value: string) => void;
    onSetMemberRoleFilter: (value: 'all' | 'owner' | 'editor' | 'viewer') => void;
    onSetMemberRole: (memberId: string, role: 'editor' | 'viewer') => void;
    onAddMember: (memberId: string, role: 'editor' | 'viewer') => void;
    onRemoveMember: (memberId: string) => void;
    onToggleFriendSelection: (friendId: string) => void;
    onSaveWorkspace: () => void;
};

export function WorkspaceConfigSection({
    colors,
    teamLoading,
    routineId,
    isEditingConfig,
    canEditConfig,
    activeWorkspace,
    activeWorkspaceMembers,
    activeWorkspaceInvitations,
    visibleActiveWorkspaceMembers,
    inviteableFriends,
    selectedTeamFriendIds,
    memberSearch,
    memberRoleFilter,
    teamTitle,
    teamEditMode,
    teamApprovalMode,
    autoSyncForEditorsEnabled,
    resolveMemberRole,
    onToggleAutoSync,
    onSetTeamTitle,
    onSetTeamEditMode,
    onSetTeamApprovalMode,
    onSetMemberSearch,
    onSetMemberRoleFilter,
    onSetMemberRole,
    onAddMember,
    onRemoveMember,
    onToggleFriendSelection,
    onSaveWorkspace,
}: WorkspaceConfigSectionProps) {
    const visibleCount = visibleActiveWorkspaceMembers.length;
    const totalMembers = activeWorkspaceMembers.length;

    return (
        <View style={{ backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, padding: 12, marginBottom: 12 }}>
            <Text style={{ color: colors.text, fontWeight: '900', marginBottom: 4, fontSize: 15 }}>
                2) {isEditingConfig ? 'Editar configuración del espacio' : 'Crear espacio compartido'}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 10 }}>
                {isEditingConfig
                    ? 'Estás editando este espacio. Al guardar, se actualiza sin crear duplicados.'
                    : 'Definí reglas e invitados para crear el espacio de colaboración.'}
            </Text>

            {isEditingConfig && (
                <View style={{ borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceLighter, padding: 10, marginBottom: 10 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '900', marginBottom: 6 }}>SINCRONIZACIÓN AUTOMÁTICA AL ABRIR (OWNER/EDITOR)</Text>
                    <TouchableOpacity
                        onPress={onToggleAutoSync}
                        style={{ borderWidth: 1, borderColor: autoSyncForEditorsEnabled ? withAlpha(colors.primary.DEFAULT, '35') : colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: autoSyncForEditorsEnabled ? withAlpha(colors.primary.DEFAULT, '10') : colors.surface }}
                    >
                        <Text style={{ color: autoSyncForEditorsEnabled ? colors.primary.DEFAULT : colors.textMuted, fontSize: 11, fontWeight: '800' }}>
                            {autoSyncForEditorsEnabled ? 'Activada: sincroniza al abrir' : 'Desactivada: solo manual con botones'}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {isEditingConfig && (activeWorkspace?.pendingInvitationsCount ?? 0) > 0 && (
                <View style={{ borderRadius: 10, padding: 10, borderWidth: 1, borderColor: withAlpha(colors.yellow, '35'), backgroundColor: withAlpha(colors.yellow, '10'), marginBottom: 10 }}>
                    <Text style={{ color: colors.yellow, fontSize: 11, fontWeight: '800' }}>
                        {activeWorkspace?.pendingInvitationsCount} invitación(es) esperando respuesta. Estas personas todavía NO son miembros hasta aceptar.
                    </Text>
                </View>
            )}

            {isEditingConfig && activeWorkspace?.membership.role === 'owner' && activeWorkspaceInvitations.length > 0 && (
                <View style={{ borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceLighter, marginBottom: 10 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '900', marginBottom: 6 }}>
                        ESTADO DE INVITACIONES
                    </Text>
                    <View style={{ gap: 6 }}>
                        {activeWorkspaceInvitations.slice(0, 8).map((invitation) => {
                            const invitee = invitation.displayName || invitation.username || invitation.invitedUserId;
                            const statusColor = invitation.status === 'accepted'
                                ? colors.primary.DEFAULT
                                : invitation.status === 'rejected'
                                    ? colors.red
                                    : invitation.status === 'cancelled'
                                        ? colors.textMuted
                                        : colors.yellow;
                            return (
                                <View key={`invite-status-${invitation.id}`} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, padding: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <View style={{ flex: 1, paddingRight: 8 }}>
                                        <Text style={{ color: colors.text, fontSize: 12, fontWeight: '800' }}>{invitee}</Text>
                                        <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 2 }}>
                                            Rol propuesto: {invitation.proposedRole.toUpperCase()}
                                        </Text>
                                    </View>
                                    <View style={{ borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: withAlpha(statusColor, '14') }}>
                                        <Text style={{ color: statusColor, fontSize: 10, fontWeight: '900' }}>{invitation.status.toUpperCase()}</Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </View>
            )}

            {isEditingConfig && !canEditConfig && (
                <View style={{ borderRadius: 10, padding: 10, borderWidth: 1, borderColor: withAlpha(colors.yellow, '35'), backgroundColor: withAlpha(colors.yellow, '10'), marginBottom: 10 }}>
                    <Text style={{ color: colors.yellow, fontSize: 11, fontWeight: '800' }}>
                        Este espacio no es tuyo. Podés usar las acciones, pero no cambiar su configuración.
                    </Text>
                </View>
            )}

            <IronInput label="Título" value={teamTitle} onChangeText={onSetTeamTitle} />

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                <TouchableOpacity
                    style={{ flex: 1, borderWidth: 1.5, borderColor: teamEditMode === 'owner_only' ? colors.primary.DEFAULT : colors.border, borderRadius: 12, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.surfaceLighter }}
                    onPress={() => onSetTeamEditMode('owner_only')}
                    disabled={!canEditConfig}
                >
                    <Text style={{ color: teamEditMode === 'owner_only' ? colors.primary.DEFAULT : colors.textMuted, fontWeight: '800', fontSize: 12 }}>Solo propietario edita</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={{ flex: 1, borderWidth: 1.5, borderColor: teamEditMode === 'collaborative' ? colors.primary.DEFAULT : colors.border, borderRadius: 12, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.surfaceLighter }}
                    onPress={() => onSetTeamEditMode('collaborative')}
                    disabled={!canEditConfig}
                >
                    <Text style={{ color: teamEditMode === 'collaborative' ? colors.primary.DEFAULT : colors.textMuted, fontWeight: '800', fontSize: 12 }}>Colaborativa</Text>
                </TouchableOpacity>
            </View>

            <Text style={{ color: colors.textMuted, fontWeight: '800', fontSize: 11, marginBottom: 8 }}>Aprobación de cambios</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                <TouchableOpacity
                    style={{ flex: 1, borderWidth: 1.5, borderColor: teamApprovalMode === 'none' ? colors.primary.DEFAULT : colors.border, borderRadius: 12, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.surfaceLighter }}
                    onPress={() => onSetTeamApprovalMode('none')}
                    disabled={!canEditConfig}
                >
                    <Text style={{ color: teamApprovalMode === 'none' ? colors.primary.DEFAULT : colors.textMuted, fontWeight: '800', fontSize: 12 }}>Sin aprobación</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={{ flex: 1, borderWidth: 1.5, borderColor: teamApprovalMode === 'owner_review' ? colors.primary.DEFAULT : colors.border, borderRadius: 12, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.surfaceLighter }}
                    onPress={() => onSetTeamApprovalMode('owner_review')}
                    disabled={!canEditConfig}
                >
                    <Text style={{ color: teamApprovalMode === 'owner_review' ? colors.primary.DEFAULT : colors.textMuted, fontWeight: '800', fontSize: 12 }}>Propietario aprueba</Text>
                </TouchableOpacity>
            </View>

            <Text style={{ color: colors.textMuted, fontWeight: '800', fontSize: 11, marginBottom: 8 }}>Invitar personas</Text>
            <Text style={{ color: colors.textMuted, fontSize: 10, marginBottom: 8 }}>
                Al guardar, las personas seleccionadas se agregan (o se vuelven a activar) en este espacio.
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 10, marginBottom: 8 }}>
                Seguridad: si no elegís rol manualmente, las personas nuevas entran como VIEWER.
            </Text>

            {isEditingConfig && activeWorkspaceMembers.length > 0 && (
                <View style={{ marginBottom: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceLighter, padding: 10 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '900', marginBottom: 6 }}>MIEMBROS Y ROLES</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 10, marginBottom: 8 }}>
                        Se muestran primero owner, luego editores y viewers. Podés cambiar rol, quitar o volver a agregar (owner protegido).
                    </Text>

                    <Text style={{ color: colors.textMuted, fontSize: 10, marginBottom: 8 }}>
                        Mostrando {visibleCount} de {totalMembers} miembro(s).
                    </Text>

                    <IronInput label="Buscar persona" value={memberSearch} onChangeText={onSetMemberSearch} />

                    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                        {(['all', 'owner', 'editor', 'viewer'] as const).map((filterRole) => {
                            const selectedFilter = memberRoleFilter === filterRole;
                            const label = filterRole === 'all' ? 'Todos' : filterRole.toUpperCase();
                            return (
                                <TouchableOpacity
                                    key={`role-filter-${filterRole}`}
                                    onPress={() => onSetMemberRoleFilter(filterRole)}
                                    style={{ borderWidth: 1, borderColor: selectedFilter ? withAlpha(colors.primary.DEFAULT, '35') : colors.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: selectedFilter ? withAlpha(colors.primary.DEFAULT, '12') : colors.surface }}
                                >
                                    <Text style={{ color: selectedFilter ? colors.primary.DEFAULT : colors.textMuted, fontSize: 10, fontWeight: '900' }}>{label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <View style={{ gap: 6 }}>
                        {visibleActiveWorkspaceMembers.map((member) => {
                            const isOwner = member.role === 'owner';
                            const selectedInSpace = isOwner || selectedTeamFriendIds.includes(member.userId);
                            const effectiveRole = isOwner ? 'owner' : resolveMemberRole(member.userId);
                            const name = member.displayName || member.username || member.userId;
                            return (
                                <View key={`active-member-${member.userId}`} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, padding: 8 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text style={{ color: colors.text, fontSize: 12, fontWeight: '800', flex: 1 }}>{name}</Text>
                                        <View style={{ borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: isOwner ? withAlpha(colors.primary.DEFAULT, '14') : effectiveRole === 'editor' ? withAlpha(colors.yellow, '16') : withAlpha(colors.border, '50') }}>
                                            <Text style={{ color: isOwner ? colors.primary.DEFAULT : effectiveRole === 'editor' ? colors.yellow : colors.textMuted, fontSize: 10, fontWeight: '900' }}>
                                                {isOwner ? 'OWNER' : effectiveRole.toUpperCase()}
                                            </Text>
                                        </View>
                                    </View>

                                    {!isOwner && (
                                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                                            <TouchableOpacity
                                                onPress={() => onAddMember(member.userId, 'editor')}
                                                style={{ borderWidth: 1, borderColor: effectiveRole === 'editor' && selectedInSpace ? withAlpha(colors.primary.DEFAULT, '35') : colors.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: effectiveRole === 'editor' && selectedInSpace ? withAlpha(colors.primary.DEFAULT, '12') : colors.surfaceLighter }}
                                                disabled={!canEditConfig}
                                            >
                                                <Text style={{ color: effectiveRole === 'editor' && selectedInSpace ? colors.primary.DEFAULT : colors.textMuted, fontSize: 10, fontWeight: '900' }}>Poner editor</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => onAddMember(member.userId, 'viewer')}
                                                style={{ borderWidth: 1, borderColor: effectiveRole === 'viewer' && selectedInSpace ? withAlpha(colors.primary.DEFAULT, '35') : colors.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: effectiveRole === 'viewer' && selectedInSpace ? withAlpha(colors.primary.DEFAULT, '12') : colors.surfaceLighter }}
                                                disabled={!canEditConfig}
                                            >
                                                <Text style={{ color: effectiveRole === 'viewer' && selectedInSpace ? colors.primary.DEFAULT : colors.textMuted, fontSize: 10, fontWeight: '900' }}>Poner viewer</Text>
                                            </TouchableOpacity>

                                            {selectedInSpace ? (
                                                <TouchableOpacity
                                                    onPress={() => onRemoveMember(member.userId)}
                                                    style={{ borderWidth: 1, borderColor: withAlpha(colors.red, '35'), borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: withAlpha(colors.red, '08') }}
                                                    disabled={!canEditConfig}
                                                >
                                                    <Text style={{ color: colors.red, fontSize: 10, fontWeight: '900' }}>Quitar del espacio</Text>
                                                </TouchableOpacity>
                                            ) : (
                                                <TouchableOpacity
                                                    onPress={() => onAddMember(member.userId, member.role === 'editor' ? 'editor' : 'viewer')}
                                                    style={{ borderWidth: 1, borderColor: withAlpha(colors.primary.DEFAULT, '35'), borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: withAlpha(colors.primary.DEFAULT, '08') }}
                                                    disabled={!canEditConfig}
                                                >
                                                    <Text style={{ color: colors.primary.DEFAULT, fontSize: 10, fontWeight: '900' }}>Volver a agregar</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    )}

                                    {isOwner && (
                                        <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 6 }}>
                                            El owner siempre mantiene control total de este espacio.
                                        </Text>
                                    )}
                                </View>
                            );
                        })}

                        {visibleActiveWorkspaceMembers.length === 0 && (
                            <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                                No encontramos miembros con ese filtro. Probá con “Todos” o limpiá la búsqueda.
                            </Text>
                        )}
                    </View>
                </View>
            )}

            {selectedTeamFriendIds.length > 0 && (
                <View style={{ alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: withAlpha(colors.primary.DEFAULT, '12'), marginBottom: 8 }}>
                    <Text style={{ color: colors.primary.DEFAULT, fontSize: 10, fontWeight: '900' }}>
                        {selectedTeamFriendIds.length} invitación(es) listas para guardar
                    </Text>
                </View>
            )}
            {inviteableFriends.length === 0 ? (
                <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>
                    No hay personas nuevas para invitar (tus contactos ya están dentro o no hay amistades disponibles).
                </Text>
            ) : (
                <View style={{ gap: 8, marginBottom: 10 }}>
                    {inviteableFriends.map((friend) => {
                        const selected = selectedTeamFriendIds.includes(friend.friendId);
                        const roleValue = resolveMemberRole(friend.friendId);
                        return (
                            <TouchableOpacity
                                key={`team-invite-${friend.friendId}`}
                                style={{ borderWidth: 1, borderColor: selected ? colors.primary.DEFAULT : colors.border, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: selected ? withAlpha(colors.primary.DEFAULT, '10') : colors.surfaceLighter }}
                                onPress={() => onToggleFriendSelection(friend.friendId)}
                                disabled={!canEditConfig}
                            >
                                <Text style={{ color: selected ? colors.primary.DEFAULT : colors.text, fontWeight: '800', fontSize: 12 }}>
                                    {friend.displayName}
                                </Text>

                                {selected && (
                                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                                        <TouchableOpacity
                                            onPress={() => onSetMemberRole(friend.friendId, 'editor')}
                                            style={{ borderWidth: 1, borderColor: roleValue === 'editor' ? withAlpha(colors.primary.DEFAULT, '35') : colors.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: roleValue === 'editor' ? withAlpha(colors.primary.DEFAULT, '12') : colors.surface }}
                                            disabled={!canEditConfig}
                                        >
                                            <Text style={{ color: roleValue === 'editor' ? colors.primary.DEFAULT : colors.textMuted, fontSize: 10, fontWeight: '900' }}>EDITOR</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => onSetMemberRole(friend.friendId, 'viewer')}
                                            style={{ borderWidth: 1, borderColor: roleValue === 'viewer' ? withAlpha(colors.primary.DEFAULT, '35') : colors.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: roleValue === 'viewer' ? withAlpha(colors.primary.DEFAULT, '12') : colors.surface }}
                                            disabled={!canEditConfig}
                                        >
                                            <Text style={{ color: roleValue === 'viewer' ? colors.primary.DEFAULT : colors.textMuted, fontSize: 10, fontWeight: '900' }}>VIEWER</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => onRemoveMember(friend.friendId)}
                                            style={{ borderWidth: 1, borderColor: withAlpha(colors.red, '35'), borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: withAlpha(colors.red, '08') }}
                                            disabled={!canEditConfig}
                                        >
                                            <Text style={{ color: colors.red, fontSize: 10, fontWeight: '900' }}>Quitar</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}

            <IronButton
                label={teamLoading ? 'Procesando...' : isEditingConfig ? 'Guardar e invitar' : 'Crear e invitar'}
                onPress={onSaveWorkspace}
                disabled={teamLoading || !routineId || !canEditConfig}
            />
        </View>
    );
}
