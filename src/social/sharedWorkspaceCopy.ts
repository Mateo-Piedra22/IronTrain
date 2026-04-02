export const sharedWorkspaceCopy = {
    title: 'Espacios compartidos',
    emptyTitle: 'Sin espacios por ahora',
    emptyDescription: 'Creá o uníte a un espacio desde una rutina para colaborar en equipo.',
    statLabel: 'ESPACIOS COMPARTIDOS',
    ctaOpenHub: 'Abrir espacios',
    ctaReviewNow: 'Revisar pendientes',
    cardBadge: 'ESPACIO EQUIPO',
    reviewRequired: 'REQUIERE APROBACIÓN',
    autoPublish: 'PUBLICACIÓN DIRECTA',
    pendingSuffix: 'pendientes',
    activeSuffix: 'activos',
    refreshReviews: 'Actualizar revisiones',
    openRoutine: 'Abrir rutina',
} as const;

export function formatWorkspaceStatus(workspaceCount: number, pendingReviewsCount: number): string {
    if (workspaceCount <= 0) {
        return `0 ${sharedWorkspaceCopy.activeSuffix}`;
    }

    if (pendingReviewsCount > 0) {
        return `${workspaceCount} ${sharedWorkspaceCopy.activeSuffix} • ${pendingReviewsCount} ${sharedWorkspaceCopy.pendingSuffix}`;
    }

    return `${workspaceCount} ${sharedWorkspaceCopy.activeSuffix}`;
}