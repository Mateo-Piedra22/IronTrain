import { describe, expect, it } from 'vitest';
import { resolveFriendRequestConflict, resolveFriendRequestRaceStatus } from './friend-request-policy';

describe('friend request policy', () => {
    it('revives deleted relationships', () => {
        const result = resolveFriendRequestConflict({ deletedAt: new Date(), status: 'pending' });
        expect(result.kind).toBe('revive_deleted');
    });

    it('rejects blocked relationships', () => {
        const result = resolveFriendRequestConflict({ deletedAt: null, status: 'blocked' });
        expect(result).toEqual({ kind: 'reject', status: 403, error: 'Cannot add user' });
    });

    it('rejects pending relationships', () => {
        const result = resolveFriendRequestConflict({ deletedAt: null, status: 'pending' });
        expect(result).toEqual({ kind: 'reject', status: 400, error: 'Request is already pending' });
    });

    it('maps race accepted row correctly', () => {
        const result = resolveFriendRequestRaceStatus('accepted');
        expect(result).toEqual({ status: 400, error: 'You are already friends' });
    });

    it('maps unknown race status to pending message', () => {
        const result = resolveFriendRequestRaceStatus('blocked');
        expect(result).toEqual({ status: 400, error: 'Request is already pending' });
    });
});
