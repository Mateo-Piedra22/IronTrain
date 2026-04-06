import { beforeEach, describe, expect, it, vi } from 'vitest';

type TxMock = {
    execute: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
};

function createTx(limitResults: unknown[]): TxMock {
    let index = 0;
    return {
        execute: vi.fn(async () => undefined),
        select: vi.fn(() => ({
            from: () => ({
                where: () => ({
                    limit: vi.fn(async () => (limitResults[index++] ?? [])),
                }),
            }),
        })),
        insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
        update: vi.fn(() => ({
            set: () => ({
                where: vi.fn(async () => undefined),
            }),
        })),
    };
}

function createSelectMock(limitResults: unknown[]) {
    let index = 0;
    return vi.fn(() => ({
        from: () => ({
            where: () => ({
                limit: vi.fn(async () => (limitResults[index++] ?? [])),
            }),
        }),
    }));
}

async function setupSyncRouteHarness() {
    vi.resetModules();

    const verifyAuth = vi.fn();
    const socialWriteLimit = vi.fn();
    const transaction = vi.fn();
    const canEditSharedRoutine = vi.fn();
    const checkSharedRoutineRevision = vi.fn();

    vi.doMock('../auth', () => ({ verifyAuth }));
    vi.doMock('../rate-limit', () => ({
        RATE_LIMITS: {
            SOCIAL_SHARED_ROUTINES_WRITE: socialWriteLimit,
        },
    }));
    vi.doMock('../../db', () => ({
        db: {
            transaction,
        },
    }));
    vi.doMock('../shared-routine-sync-policy', () => ({
        canEditSharedRoutine,
        checkSharedRoutineRevision,
    }));
    vi.doMock('../shared-routine-payload', async () => {
        const { z } = await import('zod');
        return {
            sharedRoutinePayloadSchema: z.any(),
        };
    });
    vi.doMock('../shared-routine-diff', () => ({
        diffSharedRoutinePayload: vi.fn(() => null),
        summarizeSharedRoutinePayload: vi.fn(() => ({ routines: 1 })),
    }));

    const metrics = await import('../endpoint-metrics');
    metrics.resetEndpointMetricsForTests();

    const route = await import('../../../app/api/social/shared-routines/[id]/sync/route');

    return {
        POST: route.POST,
        metrics,
        verifyAuth,
        socialWriteLimit,
        transaction,
        canEditSharedRoutine,
        checkSharedRoutineRevision,
    };
}

async function setupRollbackRouteHarness() {
    vi.resetModules();

    const verifyAuth = vi.fn();
    const socialWriteLimit = vi.fn();
    const transaction = vi.fn();
    const checkSharedRoutineRevision = vi.fn();

    vi.doMock('../auth', () => ({ verifyAuth }));
    vi.doMock('../rate-limit', () => ({
        RATE_LIMITS: {
            SOCIAL_SHARED_ROUTINES_WRITE: socialWriteLimit,
        },
    }));
    vi.doMock('../../db', () => ({
        db: {
            transaction,
        },
    }));
    vi.doMock('../shared-routine-sync-policy', () => ({
        checkSharedRoutineRevision,
    }));

    const metrics = await import('../endpoint-metrics');
    metrics.resetEndpointMetricsForTests();

    const route = await import('../../../app/api/social/shared-routines/[id]/rollback/route');

    return {
        POST: route.POST,
        metrics,
        verifyAuth,
        socialWriteLimit,
        transaction,
        checkSharedRoutineRevision,
    };
}

async function setupOwnerSyncRouteHarness(dbSelectResults: unknown[] = []) {
    vi.resetModules();

    const verifyAuth = vi.fn();
    const socialWriteLimit = vi.fn();
    const transaction = vi.fn();
    const checkSharedRoutineRevision = vi.fn();
    const buildRoutineSharePayloadForUser = vi.fn();
    const select = createSelectMock(dbSelectResults);

    vi.doMock('../auth', () => ({ verifyAuth }));
    vi.doMock('../rate-limit', () => ({
        RATE_LIMITS: {
            SOCIAL_SHARED_ROUTINES_WRITE: socialWriteLimit,
        },
    }));
    vi.doMock('../../db', () => ({
        db: {
            select,
            transaction,
        },
    }));
    vi.doMock('../shared-routine-sync-policy', () => ({
        checkSharedRoutineRevision,
    }));
    vi.doMock('../social-routine-share-payload', () => ({
        buildRoutineSharePayloadForUser,
    }));
    vi.doMock('../shared-routine-diff', () => ({
        summarizeSharedRoutinePayload: vi.fn(() => ({ routines: 1 })),
    }));

    const metrics = await import('../endpoint-metrics');
    metrics.resetEndpointMetricsForTests();

    const route = await import('../../../app/api/social/shared-routines/[id]/owner-sync/route');

    return {
        POST: route.POST,
        metrics,
        verifyAuth,
        socialWriteLimit,
        transaction,
        checkSharedRoutineRevision,
        buildRoutineSharePayloadForUser,
    };
}

async function setupReviewDecisionRouteHarness() {
    vi.resetModules();

    const verifyAuth = vi.fn();
    const socialWriteLimit = vi.fn();
    const transaction = vi.fn();
    const checkSharedRoutineRevision = vi.fn();

    vi.doMock('../auth', () => ({ verifyAuth }));
    vi.doMock('../rate-limit', () => ({
        RATE_LIMITS: {
            SOCIAL_SHARED_ROUTINES_WRITE: socialWriteLimit,
        },
    }));
    vi.doMock('../../db', () => ({
        db: {
            transaction,
        },
    }));
    vi.doMock('../shared-routine-sync-policy', () => ({
        checkSharedRoutineRevision,
    }));

    const metrics = await import('../endpoint-metrics');
    metrics.resetEndpointMetricsForTests();

    const route = await import('../../../app/api/social/shared-routines/[id]/reviews/[reviewId]/decision/route');

    return {
        POST: route.POST,
        metrics,
        verifyAuth,
        socialWriteLimit,
        transaction,
        checkSharedRoutineRevision,
    };
}

async function setupInvitationDecisionRouteHarness(dbSelectResults: unknown[] = []) {
    vi.resetModules();

    const verifyAuth = vi.fn();
    const socialWriteLimit = vi.fn();
    const select = createSelectMock(dbSelectResults);
    const transaction = vi.fn();

    vi.doMock('../auth', () => ({ verifyAuth }));
    vi.doMock('../rate-limit', () => ({
        RATE_LIMITS: {
            SOCIAL_SHARED_ROUTINES_WRITE: socialWriteLimit,
        },
    }));
    vi.doMock('../../db', () => ({
        db: {
            select,
            transaction,
        },
    }));

    const route = await import('../../../app/api/social/shared-routines/invitations/[invitationId]/decision/route');

    return {
        POST: route.POST,
        verifyAuth,
        socialWriteLimit,
    };
}

describe('shared-routines sync route HTTP behavior', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 401 and records unauthorized metric', async () => {
        const harness = await setupSyncRouteHarness();
        harness.verifyAuth.mockResolvedValue(null);

        const req = new Request('http://localhost/api/social/shared-routines/ws-1/sync', {
            method: 'POST',
            body: JSON.stringify({ payload: {}, baseRevision: 1 }),
        });

        const res = await harness.POST(req as any, { params: Promise.resolve({ id: 'ws-1' }) });
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.error).toBe('Unauthorized');

        const snapshot = harness.metrics.getEndpointMetricsSnapshot();
        expect(snapshot['social.shared_routines.sync|error|401|unauthorized']?.count).toBe(1);
    });

    it('returns 409 on revision conflict, records metric, and acquires workspace lock', async () => {
        const harness = await setupSyncRouteHarness();
        harness.verifyAuth.mockResolvedValue('user-1');
        harness.socialWriteLimit.mockResolvedValue({ ok: true });
        harness.canEditSharedRoutine.mockReturnValue(true);
        harness.checkSharedRoutineRevision.mockReturnValue({ ok: false, baseRevision: 3, serverRevision: 5 });

        const tx = createTx([
            [{
                id: 'ws-1',
                ownerId: 'owner-1',
                editMode: 'collaborative',
                approvalMode: 'none',
                currentRevision: 5,
                sourceRoutineId: 'routine-1',
                deletedAt: null,
            }],
            [{
                userId: 'user-1',
                role: 'editor',
                canEdit: true,
                deletedAt: null,
            }],
        ]);

        harness.transaction.mockImplementation(async (cb: (txArg: unknown) => Promise<void>) => cb(tx));

        const req = new Request('http://localhost/api/social/shared-routines/ws-1/sync', {
            method: 'POST',
            body: JSON.stringify({ payload: { any: 'payload' }, baseRevision: 3, force: false }),
        });

        const res = await harness.POST(req as any, { params: Promise.resolve({ id: 'ws-1' }) });
        const body = await res.json();

        expect(res.status).toBe(409);
        expect(body.code).toBe('SHARED_ROUTINE_REVISION_CONFLICT');
        expect(body.conflictType).toBe('revision_conflict');
        expect(body.retryable).toBe(true);
        expect(body.baseRevision).toBe(3);
        expect(body.serverRevision).toBe(5);
        expect(tx.execute).toHaveBeenCalledTimes(1);

        const snapshot = harness.metrics.getEndpointMetricsSnapshot();
        expect(snapshot['social.shared_routines.sync|conflict|409|revision_conflict']?.count).toBe(1);
    });

    it('returns 403 with standardized forbidden payload on insufficient permissions', async () => {
        const harness = await setupSyncRouteHarness();
        harness.verifyAuth.mockResolvedValue('user-1');
        harness.socialWriteLimit.mockResolvedValue({ ok: true });
        harness.canEditSharedRoutine.mockReturnValue(false);

        const tx = createTx([
            [{
                id: 'ws-1',
                ownerId: 'owner-1',
                editMode: 'owner_only',
                approvalMode: 'none',
                currentRevision: 5,
                sourceRoutineId: 'routine-1',
                deletedAt: null,
            }],
            [{
                userId: 'user-1',
                role: 'viewer',
                canEdit: false,
                deletedAt: null,
            }],
        ]);

        harness.transaction.mockImplementation(async (cb: (txArg: unknown) => Promise<void>) => cb(tx));

        const req = new Request('http://localhost/api/social/shared-routines/ws-1/sync', {
            method: 'POST',
            body: JSON.stringify({ payload: { any: 'payload' }, baseRevision: 5, force: false }),
        });

        const res = await harness.POST(req as any, { params: Promise.resolve({ id: 'ws-1' }) });
        const body = await res.json();

        expect(res.status).toBe(403);
        expect(body.code).toBe('SHARED_ROUTINE_FORBIDDEN');
        expect(body.reason).toBe('INSUFFICIENT_PERMISSIONS');

        const snapshot = harness.metrics.getEndpointMetricsSnapshot();
        expect(snapshot['social.shared_routines.sync|error|403|insufficient_permissions']?.count).toBe(1);
    });
});

describe('shared-routines rollback route HTTP behavior', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 404 and records metric when workspace does not exist', async () => {
        const harness = await setupRollbackRouteHarness();
        harness.verifyAuth.mockResolvedValue('user-1');
        harness.socialWriteLimit.mockResolvedValue({ ok: true });

        const tx = createTx([[]]);
        harness.transaction.mockImplementation(async (cb: (txArg: unknown) => Promise<void>) => cb(tx));

        const req = new Request('http://localhost/api/social/shared-routines/ws-missing/rollback', {
            method: 'POST',
            body: JSON.stringify({ targetRevision: 1, baseRevision: 1, force: false }),
        });

        const res = await harness.POST(req as any, { params: Promise.resolve({ id: 'ws-missing' }) });
        const body = await res.json();

        expect(res.status).toBe(404);
        expect(body.error).toBe('Shared routine not found');
        expect(body.code).toBe('SHARED_ROUTINE_RESOURCE_NOT_FOUND');
        expect(body.resource).toBe('workspace');
        expect(tx.execute).toHaveBeenCalledTimes(1);

        const snapshot = harness.metrics.getEndpointMetricsSnapshot();
        expect(snapshot['social.shared_routines.rollback|error|404|not_found']?.count).toBe(1);
    });

    it('returns 409 on revision conflict, records metric, and acquires workspace lock', async () => {
        const harness = await setupRollbackRouteHarness();
        harness.verifyAuth.mockResolvedValue('user-1');
        harness.socialWriteLimit.mockResolvedValue({ ok: true });
        harness.checkSharedRoutineRevision.mockReturnValue({ ok: false, baseRevision: 7, serverRevision: 9 });

        const tx = createTx([
            [{
                id: 'ws-1',
                ownerId: 'owner-1',
                currentRevision: 9,
                deletedAt: null,
            }],
            [{
                userId: 'user-1',
                role: 'owner',
                canEdit: true,
                deletedAt: null,
            }],
        ]);

        harness.transaction.mockImplementation(async (cb: (txArg: unknown) => Promise<void>) => cb(tx));

        const req = new Request('http://localhost/api/social/shared-routines/ws-1/rollback', {
            method: 'POST',
            body: JSON.stringify({ targetRevision: 8, baseRevision: 7, force: false }),
        });

        const res = await harness.POST(req as any, { params: Promise.resolve({ id: 'ws-1' }) });
        const body = await res.json();

        expect(res.status).toBe(409);
        expect(body.code).toBe('SHARED_ROUTINE_REVISION_CONFLICT');
        expect(body.conflictType).toBe('revision_conflict');
        expect(body.retryable).toBe(true);
        expect(body.baseRevision).toBe(7);
        expect(body.serverRevision).toBe(9);
        expect(tx.execute).toHaveBeenCalledTimes(1);

        const snapshot = harness.metrics.getEndpointMetricsSnapshot();
        expect(snapshot['social.shared_routines.rollback|conflict|409|revision_conflict']?.count).toBe(1);
    });

    it('returns 403 with standardized forbidden payload when non-owner attempts rollback', async () => {
        const harness = await setupRollbackRouteHarness();
        harness.verifyAuth.mockResolvedValue('user-1');
        harness.socialWriteLimit.mockResolvedValue({ ok: true });

        const tx = createTx([
            [{
                id: 'ws-1',
                ownerId: 'owner-1',
                currentRevision: 9,
                deletedAt: null,
            }],
            [{
                userId: 'user-1',
                role: 'editor',
                canEdit: true,
                deletedAt: null,
            }],
        ]);

        harness.transaction.mockImplementation(async (cb: (txArg: unknown) => Promise<void>) => cb(tx));

        const req = new Request('http://localhost/api/social/shared-routines/ws-1/rollback', {
            method: 'POST',
            body: JSON.stringify({ targetRevision: 8, baseRevision: 9, force: false }),
        });

        const res = await harness.POST(req as any, { params: Promise.resolve({ id: 'ws-1' }) });
        const body = await res.json();

        expect(res.status).toBe(403);
        expect(body.code).toBe('SHARED_ROUTINE_FORBIDDEN');
        expect(body.reason).toBe('INSUFFICIENT_PERMISSIONS');
    });
});

describe('shared-routines owner-sync route HTTP behavior', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 401 and records unauthorized metric', async () => {
        const harness = await setupOwnerSyncRouteHarness();
        harness.verifyAuth.mockResolvedValue(null);

        const req = new Request('http://localhost/api/social/shared-routines/ws-1/owner-sync', {
            method: 'POST',
            body: JSON.stringify({ sourceRoutineId: 'routine-1', baseRevision: 1 }),
        });

        const res = await harness.POST(req as any, { params: Promise.resolve({ id: 'ws-1' }) });
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.error).toBe('Unauthorized');

        const snapshot = harness.metrics.getEndpointMetricsSnapshot();
        expect(snapshot['social.shared_routines.owner_sync|error|401|unauthorized']?.count).toBe(1);
    });

    it('returns 409 on revision conflict, records metric, and acquires workspace lock', async () => {
        const harness = await setupOwnerSyncRouteHarness([
            [{
                id: 'ws-1',
                ownerId: 'user-1',
                sourceRoutineId: 'routine-1',
                currentRevision: 11,
                deletedAt: null,
            }],
        ]);
        harness.verifyAuth.mockResolvedValue('user-1');
        harness.socialWriteLimit.mockResolvedValue({ ok: true });
        harness.checkSharedRoutineRevision.mockReturnValue({ ok: false, baseRevision: 9, serverRevision: 11 });
        harness.buildRoutineSharePayloadForUser.mockResolvedValue({
            routine_exercises: [{ id: 'ex-1' }],
        });

        const tx = createTx([
            [{
                id: 'ws-1',
                ownerId: 'user-1',
                sourceRoutineId: 'routine-1',
                currentRevision: 11,
                deletedAt: null,
            }],
        ]);

        harness.transaction.mockImplementation(async (cb: (txArg: unknown) => Promise<void>) => cb(tx));

        const req = new Request('http://localhost/api/social/shared-routines/ws-1/owner-sync', {
            method: 'POST',
            body: JSON.stringify({ sourceRoutineId: 'routine-1', baseRevision: 9 }),
        });

        const res = await harness.POST(req as any, { params: Promise.resolve({ id: 'ws-1' }) });
        const body = await res.json();

        expect(res.status).toBe(409);
        expect(body.code).toBe('SHARED_ROUTINE_REVISION_CONFLICT');
        expect(body.conflictType).toBe('revision_conflict');
        expect(body.retryable).toBe(true);
        expect(body.baseRevision).toBe(9);
        expect(body.serverRevision).toBe(11);
        expect(tx.execute).toHaveBeenCalledTimes(1);

        const snapshot = harness.metrics.getEndpointMetricsSnapshot();
        expect(snapshot['social.shared_routines.owner_sync|conflict|409|revision_conflict']?.count).toBe(1);
    });

    it('returns 403 with standardized forbidden payload when requester is not owner', async () => {
        const harness = await setupOwnerSyncRouteHarness([
            [{
                id: 'ws-1',
                ownerId: 'owner-1',
                sourceRoutineId: 'routine-1',
                currentRevision: 11,
                deletedAt: null,
            }],
        ]);
        harness.verifyAuth.mockResolvedValue('user-1');
        harness.socialWriteLimit.mockResolvedValue({ ok: true });

        const req = new Request('http://localhost/api/social/shared-routines/ws-1/owner-sync', {
            method: 'POST',
            body: JSON.stringify({ sourceRoutineId: 'routine-1', baseRevision: 11 }),
        });

        const res = await harness.POST(req as any, { params: Promise.resolve({ id: 'ws-1' }) });
        const body = await res.json();

        expect(res.status).toBe(403);
        expect(body.code).toBe('SHARED_ROUTINE_FORBIDDEN');
        expect(body.reason).toBe('INSUFFICIENT_PERMISSIONS');
    });
});

describe('shared-routines review decision route HTTP behavior', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 401 and records unauthorized metric', async () => {
        const harness = await setupReviewDecisionRouteHarness();
        harness.verifyAuth.mockResolvedValue(null);

        const req = new Request('http://localhost/api/social/shared-routines/ws-1/reviews/rev-1/decision', {
            method: 'POST',
            body: JSON.stringify({ decision: 'approve' }),
        });

        const res = await harness.POST(req as any, { params: Promise.resolve({ id: 'ws-1', reviewId: 'rev-1' }) });
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.error).toBe('Unauthorized');

        const snapshot = harness.metrics.getEndpointMetricsSnapshot();
        expect(snapshot['social.shared_routines.review_decision|error|401|unauthorized']?.count).toBe(1);
    });

    it('returns 409 on revision conflict, records metric, and acquires workspace lock', async () => {
        const harness = await setupReviewDecisionRouteHarness();
        harness.verifyAuth.mockResolvedValue('owner-1');
        harness.socialWriteLimit.mockResolvedValue({ ok: true });
        harness.checkSharedRoutineRevision.mockReturnValue({ ok: false, baseRevision: 5, serverRevision: 8 });

        const tx = createTx([
            [{
                id: 'ws-1',
                ownerId: 'owner-1',
                currentRevision: 8,
                sourceRoutineId: 'routine-1',
                deletedAt: null,
            }],
            [{
                id: 'rev-1',
                sharedRoutineId: 'ws-1',
                requesterId: 'editor-1',
                requestedBaseRevision: 5,
                candidatePayload: { any: 'payload' },
                sourceRoutineId: 'routine-1',
                status: 'pending',
                deletedAt: null,
            }],
        ]);

        harness.transaction.mockImplementation(async (cb: (txArg: unknown) => Promise<void>) => cb(tx));

        const req = new Request('http://localhost/api/social/shared-routines/ws-1/reviews/rev-1/decision', {
            method: 'POST',
            body: JSON.stringify({ decision: 'approve', force: false }),
        });

        const res = await harness.POST(req as any, { params: Promise.resolve({ id: 'ws-1', reviewId: 'rev-1' }) });
        const body = await res.json();

        expect(res.status).toBe(409);
        expect(body.code).toBe('SHARED_ROUTINE_REVISION_CONFLICT');
        expect(body.conflictType).toBe('revision_conflict');
        expect(body.retryable).toBe(true);
        expect(body.baseRevision).toBe(5);
        expect(body.serverRevision).toBe(8);
        expect(tx.execute).toHaveBeenCalledTimes(1);

        const snapshot = harness.metrics.getEndpointMetricsSnapshot();
        expect(snapshot['social.shared_routines.review_decision|conflict|409|revision_conflict']?.count).toBe(1);
    });

    it('returns 403 with standardized forbidden payload when requester is not owner', async () => {
        const harness = await setupReviewDecisionRouteHarness();
        harness.verifyAuth.mockResolvedValue('editor-1');
        harness.socialWriteLimit.mockResolvedValue({ ok: true });

        const tx = createTx([
            [{
                id: 'ws-1',
                ownerId: 'owner-1',
                currentRevision: 8,
                sourceRoutineId: 'routine-1',
                deletedAt: null,
            }],
        ]);

        harness.transaction.mockImplementation(async (cb: (txArg: unknown) => Promise<void>) => cb(tx));

        const req = new Request('http://localhost/api/social/shared-routines/ws-1/reviews/rev-1/decision', {
            method: 'POST',
            body: JSON.stringify({ decision: 'approve' }),
        });

        const res = await harness.POST(req as any, { params: Promise.resolve({ id: 'ws-1', reviewId: 'rev-1' }) });
        const body = await res.json();

        expect(res.status).toBe(403);
        expect(body.code).toBe('SHARED_ROUTINE_FORBIDDEN');
        expect(body.reason).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('returns 409 with standardized invalid-state payload when review is not pending', async () => {
        const harness = await setupReviewDecisionRouteHarness();
        harness.verifyAuth.mockResolvedValue('owner-1');
        harness.socialWriteLimit.mockResolvedValue({ ok: true });

        const tx = createTx([
            [{
                id: 'ws-1',
                ownerId: 'owner-1',
                currentRevision: 8,
                sourceRoutineId: 'routine-1',
                deletedAt: null,
            }],
            [{
                id: 'rev-1',
                sharedRoutineId: 'ws-1',
                requesterId: 'editor-1',
                requestedBaseRevision: 5,
                candidatePayload: { any: 'payload' },
                sourceRoutineId: 'routine-1',
                status: 'rejected',
                deletedAt: null,
            }],
        ]);

        harness.transaction.mockImplementation(async (cb: (txArg: unknown) => Promise<void>) => cb(tx));

        const req = new Request('http://localhost/api/social/shared-routines/ws-1/reviews/rev-1/decision', {
            method: 'POST',
            body: JSON.stringify({ decision: 'approve' }),
        });

        const res = await harness.POST(req as any, { params: Promise.resolve({ id: 'ws-1', reviewId: 'rev-1' }) });
        const body = await res.json();

        expect(res.status).toBe(409);
        expect(body.code).toBe('SHARED_ROUTINE_INVALID_STATE');
        expect(body.resource).toBe('review_request');
        expect(body.expectedStatus).toBe('pending');
        expect(body.currentStatus).toBe('rejected');
    });

    it('returns 200 idempotent payload when same review decision is submitted twice', async () => {
        const harness = await setupReviewDecisionRouteHarness();
        harness.verifyAuth.mockResolvedValue('owner-1');
        harness.socialWriteLimit.mockResolvedValue({ ok: true });

        const tx = createTx([
            [{
                id: 'ws-1',
                ownerId: 'owner-1',
                currentRevision: 8,
                currentSnapshotId: 'snap-8',
                sourceRoutineId: 'routine-1',
                deletedAt: null,
            }],
            [{
                id: 'rev-1',
                sharedRoutineId: 'ws-1',
                requesterId: 'editor-1',
                requestedBaseRevision: 5,
                candidatePayload: { any: 'payload' },
                sourceRoutineId: 'routine-1',
                status: 'approved',
                deletedAt: null,
            }],
        ]);

        harness.transaction.mockImplementation(async (cb: (txArg: unknown) => Promise<void>) => cb(tx));

        const req = new Request('http://localhost/api/social/shared-routines/ws-1/reviews/rev-1/decision', {
            method: 'POST',
            body: JSON.stringify({ decision: 'approve' }),
        });

        const res = await harness.POST(req as any, { params: Promise.resolve({ id: 'ws-1', reviewId: 'rev-1' }) });
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.idempotent).toBe(true);
        expect(body.decision).toBe('approve');
        expect(body.reviewId).toBe('rev-1');
    });
});

describe('shared-routines invitation decision route HTTP behavior', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 409 with standardized invalid-state payload when invitation is not pending', async () => {
        const harness = await setupInvitationDecisionRouteHarness([
            [{
                id: 'inv-1',
                sharedRoutineId: 'ws-1',
                invitedUserId: 'user-1',
                invitedBy: 'owner-1',
                proposedRole: 'viewer',
                status: 'rejected',
                deletedAt: null,
            }],
        ]);

        harness.verifyAuth.mockResolvedValue('user-1');
        harness.socialWriteLimit.mockResolvedValue({ ok: true });

        const req = new Request('http://localhost/api/social/shared-routines/invitations/inv-1/decision', {
            method: 'POST',
            body: JSON.stringify({ decision: 'accept' }),
        });

        const res = await harness.POST(req as any, { params: Promise.resolve({ invitationId: 'inv-1' }) });
        const body = await res.json();

        expect(res.status).toBe(409);
        expect(body.code).toBe('SHARED_ROUTINE_INVALID_STATE');
        expect(body.resource).toBe('invitation');
        expect(body.expectedStatus).toBe('pending');
        expect(body.currentStatus).toBe('rejected');
    });

    it('returns 200 idempotent payload when same invitation decision is submitted twice', async () => {
        const harness = await setupInvitationDecisionRouteHarness([
            [{
                id: 'inv-1',
                sharedRoutineId: 'ws-1',
                invitedUserId: 'user-1',
                invitedBy: 'owner-1',
                proposedRole: 'viewer',
                status: 'accepted',
                deletedAt: null,
            }],
        ]);

        harness.verifyAuth.mockResolvedValue('user-1');
        harness.socialWriteLimit.mockResolvedValue({ ok: true });

        const req = new Request('http://localhost/api/social/shared-routines/invitations/inv-1/decision', {
            method: 'POST',
            body: JSON.stringify({ decision: 'accept' }),
        });

        const res = await harness.POST(req as any, { params: Promise.resolve({ invitationId: 'inv-1' }) });
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.idempotent).toBe(true);
        expect(body.decision).toBe('accept');
        expect(body.invitationId).toBe('inv-1');
    });
});
