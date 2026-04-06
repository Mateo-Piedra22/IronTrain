export const SHARED_ROUTINE_REVISION_CONFLICT_CODE = 'SHARED_ROUTINE_REVISION_CONFLICT';
export const SHARED_ROUTINE_FORBIDDEN_CODE = 'SHARED_ROUTINE_FORBIDDEN';
export const SHARED_ROUTINE_NOT_FOUND_CODE = 'SHARED_ROUTINE_RESOURCE_NOT_FOUND';
export const SHARED_ROUTINE_INVALID_STATE_CODE = 'SHARED_ROUTINE_INVALID_STATE';

export type SharedRoutineRevisionConflictPayload = {
    error: string;
    code: typeof SHARED_ROUTINE_REVISION_CONFLICT_CODE;
    conflictType: 'revision_conflict';
    retryable: true;
    baseRevision: number;
    serverRevision: number;
};

export type SharedRoutineForbiddenPayload = {
    error: string;
    code: typeof SHARED_ROUTINE_FORBIDDEN_CODE;
    reason: 'INSUFFICIENT_PERMISSIONS';
};

export type SharedRoutineNotFoundResource =
    | 'workspace'
    | 'review_request'
    | 'invitation'
    | 'target_revision';

export type SharedRoutineInvalidStateResource = 'review_request' | 'invitation';

export type SharedRoutineNotFoundPayload = {
    error: string;
    code: typeof SHARED_ROUTINE_NOT_FOUND_CODE;
    resource: SharedRoutineNotFoundResource;
};

export type SharedRoutineInvalidStatePayload = {
    error: string;
    code: typeof SHARED_ROUTINE_INVALID_STATE_CODE;
    resource: SharedRoutineInvalidStateResource;
    expectedStatus: string;
    currentStatus: string;
};

export function buildSharedRoutineRevisionConflictPayload(
    baseRevision: number,
    serverRevision: number,
    message = 'Shared routine has a newer revision. Refresh and retry.',
): SharedRoutineRevisionConflictPayload {
    return {
        error: message,
        code: SHARED_ROUTINE_REVISION_CONFLICT_CODE,
        conflictType: 'revision_conflict',
        retryable: true,
        baseRevision,
        serverRevision,
    };
}

export function buildSharedRoutineForbiddenPayload(
    message = 'Insufficient permissions for this shared routine action.',
): SharedRoutineForbiddenPayload {
    return {
        error: message,
        code: SHARED_ROUTINE_FORBIDDEN_CODE,
        reason: 'INSUFFICIENT_PERMISSIONS',
    };
}

export function buildSharedRoutineNotFoundPayload(
    resource: SharedRoutineNotFoundResource,
    message = 'Shared routine resource not found.',
): SharedRoutineNotFoundPayload {
    return {
        error: message,
        code: SHARED_ROUTINE_NOT_FOUND_CODE,
        resource,
    };
}

export function buildSharedRoutineInvalidStatePayload(
    resource: SharedRoutineInvalidStateResource,
    currentStatus: string,
    expectedStatus = 'pending',
    message = 'Shared routine resource is in an invalid state for this action.',
): SharedRoutineInvalidStatePayload {
    return {
        error: message,
        code: SHARED_ROUTINE_INVALID_STATE_CODE,
        resource,
        expectedStatus,
        currentStatus,
    };
}
