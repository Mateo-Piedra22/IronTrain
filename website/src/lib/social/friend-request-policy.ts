type FriendshipStatus = 'blocked' | 'pending' | 'accepted' | string;

export type FriendRequestConflictResult =
    | { kind: 'revive_deleted' }
    | { kind: 'reject'; status: number; error: string };

export function resolveFriendRequestConflict(params: {
    deletedAt: Date | null;
    status: FriendshipStatus;
}): FriendRequestConflictResult {
    if (params.deletedAt) {
        return { kind: 'revive_deleted' };
    }

    if (params.status === 'blocked') {
        return { kind: 'reject', status: 403, error: 'Cannot add user' };
    }
    if (params.status === 'pending') {
        return { kind: 'reject', status: 400, error: 'Request is already pending' };
    }
    if (params.status === 'accepted') {
        return { kind: 'reject', status: 400, error: 'You are already friends' };
    }

    return { kind: 'reject', status: 400, error: 'Cannot process friend request' };
}

export function resolveFriendRequestRaceStatus(status: FriendshipStatus | undefined): { status: number; error: string } {
    if (status === 'accepted') {
        return { status: 400, error: 'You are already friends' };
    }
    return { status: 400, error: 'Request is already pending' };
}
