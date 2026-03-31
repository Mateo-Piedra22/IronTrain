import { describe, expect, it } from 'vitest';
import { canEditSharedRoutine, checkSharedRoutineRevision } from './shared-routine-sync-policy';

describe('shared-routine-sync-policy', () => {
    describe('canEditSharedRoutine', () => {
        it('always allows owner', () => {
            expect(canEditSharedRoutine({ role: 'owner', canEditFlag: false, editMode: 'owner_only' })).toBe(true);
            expect(canEditSharedRoutine({ role: 'owner', canEditFlag: false, editMode: 'collaborative' })).toBe(true);
        });

        it('allows editor in collaborative mode', () => {
            expect(canEditSharedRoutine({ role: 'editor', canEditFlag: false, editMode: 'collaborative' })).toBe(true);
        });

        it('denies editor in owner_only without explicit flag', () => {
            expect(canEditSharedRoutine({ role: 'editor', canEditFlag: false, editMode: 'owner_only' })).toBe(false);
        });

        it('allows any member with explicit canEdit flag', () => {
            expect(canEditSharedRoutine({ role: 'viewer', canEditFlag: true, editMode: 'owner_only' })).toBe(true);
            expect(canEditSharedRoutine({ role: 'viewer', canEditFlag: true, editMode: 'collaborative' })).toBe(true);
        });

        it('denies viewer without edit privileges', () => {
            expect(canEditSharedRoutine({ role: 'viewer', canEditFlag: false, editMode: 'collaborative' })).toBe(false);
        });
    });

    describe('checkSharedRoutineRevision', () => {
        it('accepts matching revisions', () => {
            expect(checkSharedRoutineRevision({ baseRevision: 10, serverRevision: 10, force: false })).toEqual({ ok: true });
        });

        it('accepts mismatched revisions when force is enabled', () => {
            expect(checkSharedRoutineRevision({ baseRevision: 3, serverRevision: 9, force: true })).toEqual({ ok: true });
        });

        it('returns standardized conflict payload when revisions mismatch without force', () => {
            expect(checkSharedRoutineRevision({ baseRevision: 4, serverRevision: 5, force: false })).toEqual({
                ok: false,
                code: 'SHARED_ROUTINE_REVISION_CONFLICT',
                message: 'Shared routine has a newer revision. Refresh and retry.',
                baseRevision: 4,
                serverRevision: 5,
            });
        });
    });
});
