export function canEditSharedRoutine(input: {
    role: string;
    canEditFlag: boolean;
    editMode: string;
}): boolean {
    if (input.role === 'owner') return true;
    if (input.canEditFlag) return true;
    return input.editMode === 'collaborative' && input.role === 'editor';
}

export type RevisionCheckResult =
    | { ok: true }
    | {
        ok: false;
        code: 'SHARED_ROUTINE_REVISION_CONFLICT';
        message: string;
        baseRevision: number;
        serverRevision: number;
    };

export function checkSharedRoutineRevision(input: {
    baseRevision: number;
    serverRevision: number;
    force: boolean;
}): RevisionCheckResult {
    if (input.force || input.baseRevision === input.serverRevision) {
        return { ok: true };
    }

    return {
        ok: false,
        code: 'SHARED_ROUTINE_REVISION_CONFLICT',
        message: 'Shared routine has a newer revision. Refresh and retry.',
        baseRevision: input.baseRevision,
        serverRevision: input.serverRevision,
    };
}
