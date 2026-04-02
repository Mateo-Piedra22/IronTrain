import { IronButton } from '@/components/IronButton';
import { IronInput } from '@/components/IronInput';
import { SharedRoutineChangeItem, SharedRoutineItem, SharedRoutineReviewRequest } from '@/src/services/SocialService';
import { withAlpha } from '@/src/theme';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

type WorkspaceColors = {
    text: string;
    textMuted: string;
    border: string;
    surface: string;
    primary: { DEFAULT: string };
    yellow: string;
    red: string;
};

type WorkspaceActionsSectionProps = {
    colors: WorkspaceColors;
    activeWorkspace: SharedRoutineItem;
    activePendingReviewsCount: number;
    autoSyncingWorkspaceId: string | null;
    teamLoading: boolean;
    workspaceCommentDraft: string;
    selectedWorkspaceChanges: SharedRoutineChangeItem[];
    pendingWorkspaceReviews: SharedRoutineReviewRequest[];
    runExplainedAction: (title: string, message: string, actionLabel: string, action: () => void | Promise<void>) => void;
    onImportWorkspaceSnapshot: () => void;
    onPublishWorkspaceChanges: () => void;
    onOwnerSyncWorkspace: () => void;
    onViewWorkspaceHistory: () => void;
    onLoadWorkspaceComments: () => void;
    onLoadWorkspaceReviews: () => void;
    onRollbackWorkspace: () => void;
    onCommentDraftChange: (value: string) => void;
    onAddWorkspaceComment: () => void;
    onDecideReview: (review: SharedRoutineReviewRequest, decision: 'approve' | 'reject') => void;
};

export function WorkspaceActionsSection({
    colors,
    activeWorkspace,
    activePendingReviewsCount,
    autoSyncingWorkspaceId,
    teamLoading,
    workspaceCommentDraft,
    selectedWorkspaceChanges,
    pendingWorkspaceReviews,
    runExplainedAction,
    onImportWorkspaceSnapshot,
    onPublishWorkspaceChanges,
    onOwnerSyncWorkspace,
    onViewWorkspaceHistory,
    onLoadWorkspaceComments,
    onLoadWorkspaceReviews,
    onRollbackWorkspace,
    onCommentDraftChange,
    onAddWorkspaceComment,
    onDecideReview,
}: WorkspaceActionsSectionProps) {
    const recentChange = selectedWorkspaceChanges[0] ?? null;

    return (
        <View style={{ backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, padding: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: colors.text, fontWeight: '900' }}>3) Acciones del espacio activo</Text>
                {autoSyncingWorkspaceId === activeWorkspace.id ? (
                    <View style={{ borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: withAlpha(colors.primary.DEFAULT, '12') }}>
                        <Text style={{ color: colors.primary.DEFAULT, fontSize: 10, fontWeight: '900' }}>Sincronizando…</Text>
                    </View>
                ) : activePendingReviewsCount > 0 && (
                    <View style={{ borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: withAlpha(colors.yellow, '16') }}>
                        <Text style={{ color: colors.yellow, fontSize: 10, fontWeight: '900' }}>{activePendingReviewsCount} pendientes</Text>
                    </View>
                )}
            </View>

            <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 8 }}>
                Operá sobre el espacio seleccionado: sincronizar, revisar actividad y colaborar con comentarios.
            </Text>

            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, backgroundColor: colors.surface }}>
                <Text style={{ color: colors.text, fontWeight: '900', fontSize: 13 }}>{activeWorkspace.title}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 3 }}>
                    Rev {activeWorkspace.currentRevision} • {activeWorkspace.membership.role} • {activeWorkspace.editMode === 'collaborative' ? 'Colaborativa' : 'Solo propietario'} • {activeWorkspace.approvalMode === 'owner_review' ? 'Con aprobación de propietario' : 'Sin aprobación'}
                </Text>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    <View style={{ borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: withAlpha(colors.primary.DEFAULT, '12') }}>
                        <Text style={{ color: colors.primary.DEFAULT, fontSize: 10, fontWeight: '900' }}>
                            {activePendingReviewsCount} pendientes
                        </Text>
                    </View>
                    <View style={{ borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                        <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '900' }}>
                            {selectedWorkspaceChanges.length} cambios registrados
                        </Text>
                    </View>
                </View>

                <View style={{ marginTop: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 8 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '900', marginBottom: 3 }}>
                        Cómo funciona según tu rol
                    </Text>
                    {activeWorkspace.membership.role === 'owner' ? (
                        <Text style={{ color: colors.textMuted, fontSize: 10, lineHeight: 14 }}>
                            Owner: configurás reglas, invitaciones y aprobaciones. Podés actualizar desde rutina base y decidir propuestas pendientes.
                        </Text>
                    ) : activeWorkspace.membership.canEdit ? (
                        <Text style={{ color: colors.textMuted, fontSize: 10, lineHeight: 14 }}>
                            Editor: publicás tu versión local. {activeWorkspace.approvalMode === 'owner_review' ? 'El owner debe aprobar la propuesta.' : 'Se publica directamente.'}
                        </Text>
                    ) : (
                        <Text style={{ color: colors.textMuted, fontSize: 10, lineHeight: 14 }}>
                            Viewer: no publicás cambios. Podés traer la última revisión y seguir el estado de comentarios/revisiones.
                        </Text>
                    )}
                </View>

                <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 10, marginBottom: 6, fontWeight: '800' }}>
                    Sincronización
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 10, marginBottom: 8 }}>
                    Elegí una acción para traer/publicar cambios entre tu rutina local y este espacio.
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <TouchableOpacity
                        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, alignItems: 'center', justifyContent: 'center', minHeight: 34, backgroundColor: colors.surface, paddingHorizontal: 10 }}
                        onPress={() => runExplainedAction(
                            'Traer última versión',
                            'Descarga y aplica en tu rutina la versión más reciente de este espacio. Si ya la tenés, no se duplica.',
                            'Aplicar revisión',
                            onImportWorkspaceSnapshot,
                        )}
                        disabled={teamLoading}
                    >
                        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 11 }}>Traer revisión actual</Text>
                    </TouchableOpacity>

                    {activeWorkspace.membership.canEdit && (
                        <TouchableOpacity
                            style={{ borderWidth: 1.5, borderColor: colors.primary.DEFAULT, borderRadius: 10, alignItems: 'center', justifyContent: 'center', minHeight: 34, backgroundColor: withAlpha(colors.primary.DEFAULT, '18'), paddingHorizontal: 10 }}
                            onPress={() => runExplainedAction(
                                'Publicar tus cambios',
                                'Sube tu versión local como nueva propuesta para el equipo. Si el espacio requiere aprobación, quedará pendiente del owner.',
                                'Publicar',
                                onPublishWorkspaceChanges,
                            )}
                            disabled={teamLoading}
                        >
                            <Text style={{ color: colors.primary.DEFAULT, fontWeight: '900', fontSize: 11 }}>Publicar tus cambios</Text>
                        </TouchableOpacity>
                    )}

                    {activeWorkspace.membership.role === 'owner' && (
                        <TouchableOpacity
                            style={{ borderWidth: 1, borderColor: withAlpha(colors.primary.DEFAULT, '35'), borderRadius: 10, alignItems: 'center', justifyContent: 'center', minHeight: 34, backgroundColor: colors.surface, paddingHorizontal: 10 }}
                            onPress={() => runExplainedAction(
                                'Actualizar desde rutina base',
                                'Reemplaza el contenido actual del espacio con tu rutina base local y genera una nueva revisión.',
                                'Actualizar',
                                onOwnerSyncWorkspace,
                            )}
                            disabled={teamLoading}
                        >
                            <Text style={{ color: colors.primary.DEFAULT, fontWeight: '900', fontSize: 11 }}>Actualizar desde rutina base</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 10, marginBottom: 6, fontWeight: '800' }}>
                    Seguimiento y colaboración
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 10, marginBottom: 8 }}>
                    Revisá actividad del equipo y estado de propuestas antes de decidir.
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <TouchableOpacity
                        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, alignItems: 'center', justifyContent: 'center', minHeight: 34, backgroundColor: colors.surface, paddingHorizontal: 10 }}
                        onPress={() => runExplainedAction(
                            'Ver historial',
                            'Muestra los cambios registrados en este espacio para entender qué se modificó y cuándo.',
                            'Ver historial',
                            onViewWorkspaceHistory,
                        )}
                        disabled={teamLoading}
                    >
                        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 11 }}>Abrir historial</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, alignItems: 'center', justifyContent: 'center', minHeight: 34, backgroundColor: colors.surface, paddingHorizontal: 10 }}
                        onPress={() => runExplainedAction(
                            'Ver comentarios',
                            'Abre el resumen de comentarios recientes del equipo para este espacio.',
                            'Ver comentarios',
                            onLoadWorkspaceComments,
                        )}
                        disabled={teamLoading}
                    >
                        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 11 }}>Abrir comentarios</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, alignItems: 'center', justifyContent: 'center', minHeight: 34, backgroundColor: colors.surface, paddingHorizontal: 10 }}
                        onPress={() => runExplainedAction(
                            'Ver revisiones',
                            'Consulta propuestas pendientes, aprobadas o rechazadas en este espacio.',
                            'Ver revisiones',
                            onLoadWorkspaceReviews,
                        )}
                        disabled={teamLoading}
                    >
                        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 11 }}>Abrir revisiones</Text>
                    </TouchableOpacity>
                </View>

                {activeWorkspace.membership.role === 'owner' && (
                    <>
                        <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 10, marginBottom: 6, fontWeight: '800' }}>
                            Operaciones sensibles
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: 10, marginBottom: 8 }}>
                            Usá rollback solo si necesitás deshacer la última versión publicada.
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                                style={{ flex: 1, borderWidth: 1, borderColor: withAlpha(colors.red, '35'), borderRadius: 10, alignItems: 'center', justifyContent: 'center', minHeight: 34, backgroundColor: withAlpha(colors.red, '08') }}
                                onPress={onRollbackWorkspace}
                                disabled={teamLoading || activeWorkspace.currentRevision <= 1}
                            >
                                <Text style={{ color: colors.red, fontWeight: '900', fontSize: 11 }}>Volver a revisión anterior</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'flex-end' }}>
                    <View style={{ flex: 1 }}>
                        <IronInput
                            label="Nuevo comentario del equipo"
                            value={workspaceCommentDraft}
                            onChangeText={onCommentDraftChange}
                        />
                    </View>
                    <View style={{ width: 140, justifyContent: 'flex-end', paddingBottom: 2 }}>
                        <IronButton
                            label="Enviar comentario"
                            onPress={onAddWorkspaceComment}
                            disabled={teamLoading || !workspaceCommentDraft.trim()}
                        />
                    </View>
                </View>

                {!!recentChange && (
                    <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 8 }}>
                        Último cambio: {recentChange.actionType}
                    </Text>
                )}

                {pendingWorkspaceReviews.length > 0 && activeWorkspace.membership.role === 'owner' && (
                    <View style={{ marginTop: 8 }}>
                        <Text style={{ color: colors.textMuted, fontSize: 10, marginBottom: 6 }}>
                            Tenés {pendingWorkspaceReviews.length} propuesta(s) pendiente(s) de decisión.
                        </Text>
                        {pendingWorkspaceReviews.slice(0, 1).map((review) => (
                            <View key={`pending-review-${review.id}`} style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity
                                    style={{ flex: 1, borderWidth: 1, borderColor: colors.primary.DEFAULT, borderRadius: 10, alignItems: 'center', justifyContent: 'center', minHeight: 34, backgroundColor: withAlpha(colors.primary.DEFAULT, '12') }}
                                    onPress={() => onDecideReview(review, 'approve')}
                                    disabled={teamLoading}
                                >
                                    <Text style={{ color: colors.primary.DEFAULT, fontWeight: '900', fontSize: 11 }}>Aprobar propuesta</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={{ flex: 1, borderWidth: 1, borderColor: withAlpha(colors.red, '35'), borderRadius: 10, alignItems: 'center', justifyContent: 'center', minHeight: 34, backgroundColor: withAlpha(colors.red, '08') }}
                                    onPress={() => onDecideReview(review, 'reject')}
                                    disabled={teamLoading}
                                >
                                    <Text style={{ color: colors.red, fontWeight: '900', fontSize: 11 }}>Rechazar propuesta</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        </View>
    );
}
