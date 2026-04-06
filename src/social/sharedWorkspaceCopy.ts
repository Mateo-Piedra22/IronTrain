export const sharedWorkspaceCopy = {
    title: 'Espacios compartidos',
    emptyTitle: 'Sin espacios por ahora',
    emptyDescription: 'Creá o uníte a un espacio compartido desde una rutina para colaborar con otras personas.',
    statLabel: 'ESPACIOS COMPARTIDOS',
    ctaOpenHub: 'Abrir espacios',
    ctaReviewNow: 'Revisar pendientes',
    cardBadge: 'ESPACIO COMPARTIDO',
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