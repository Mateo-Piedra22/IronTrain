import * as SecureStore from 'expo-secure-store';
import { SocialApiError, SocialService } from '../SocialService';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
}));

describe('SocialService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('token-123');
    global.fetch = jest.fn();
  });

  it('should call backend kudo endpoint and return action', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ success: true, action: 'added' }),
      json: async () => ({ success: true, action: 'added' }),
    });

    const result = await SocialService.toggleKudo('feed-1');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/social/feed/kudos'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
        }),
      })
    );
    expect(result).toBe('added');
  });

  it('should encode friendId in compare endpoint', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        success: true,
        comparison: [{ exerciseName: 'Bench', user1RM: 100, friend1RM: 95, unit: 'kg' }],
      }),
      json: async () => ({
        success: true,
        comparison: [{ exerciseName: 'Bench', user1RM: 100, friend1RM: 95, unit: 'kg' }],
      }),
    });

    await SocialService.compareFriend('id with spaces');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('friendId=id%20with%20spaces'),
      expect.any(Object)
    );
  });

  it('should throw SocialApiError with 409 payload details', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 409,
      text: async () => JSON.stringify({
        success: false,
        code: 'SHARED_ROUTINE_REVISION_CONFLICT',
        message: 'Revision conflict',
        serverRevision: 12,
        baseRevision: 10,
      }),
    });

    await expect(
      SocialService.syncSharedRoutine('workspace-1', {
        payload: { routine: { id: 'r1' } },
        baseRevision: 10,
      })
    ).rejects.toMatchObject({
      name: 'SocialApiError',
      status: 409,
      code: 'SHARED_ROUTINE_REVISION_CONFLICT',
      payload: expect.objectContaining({
        serverRevision: 12,
        baseRevision: 10,
      }),
    });
  });

  it('should throw SocialApiError with 409 payload details on owner sync', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 409,
      text: async () => JSON.stringify({
        success: false,
        code: 'SHARED_ROUTINE_REVISION_CONFLICT',
        message: 'Revision conflict',
        serverRevision: 20,
        baseRevision: 19,
      }),
    });

    await expect(
      SocialService.ownerSyncSharedRoutine('workspace-1', 'routine-1', 19)
    ).rejects.toMatchObject({
      name: 'SocialApiError',
      status: 409,
      code: 'SHARED_ROUTINE_REVISION_CONFLICT',
      payload: expect.objectContaining({
        serverRevision: 20,
        baseRevision: 19,
      }),
    });
  });

  it('should handle empty non-ok body as SocialApiError', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => '',
    });

    try {
      await SocialService.getProfile();
      throw new Error('Expected SocialService.getProfile to throw');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(SocialApiError);
      expect(error).toMatchObject({ status: 500 });
    }
  });

  it('should send force flag when deciding shared routine review', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        success: true,
        decision: 'approve',
        reviewId: 'review-1',
        revision: 13,
        snapshotId: 'snap-13',
      }),
    });

    await SocialService.decideSharedRoutineReview('workspace-1', 'review-1', {
      decision: 'approve',
      force: true,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/social/shared-routines/workspace-1/reviews/review-1/decision'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ decision: 'approve', note: undefined, force: true }),
      })
    );
  });

  it('should throw SocialApiError with 409 payload details on review decision', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 409,
      text: async () => JSON.stringify({
        success: false,
        code: 'SHARED_ROUTINE_REVISION_CONFLICT',
        message: 'Revision conflict',
        serverRevision: 33,
        baseRevision: 31,
      }),
    });

    await expect(
      SocialService.decideSharedRoutineReview('workspace-1', 'review-1', {
        decision: 'approve',
      })
    ).rejects.toMatchObject({
      name: 'SocialApiError',
      status: 409,
      code: 'SHARED_ROUTINE_REVISION_CONFLICT',
      payload: expect.objectContaining({
        serverRevision: 33,
        baseRevision: 31,
      }),
    });
  });

  it('should send baseRevision and force when rolling back shared routine', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        success: true,
        sharedRoutineId: 'workspace-1',
        revision: 14,
        targetRevision: 12,
        snapshotId: 'snap-14',
      }),
    });

    await SocialService.rollbackSharedRoutine('workspace-1', {
      targetRevision: 12,
      baseRevision: 13,
      force: true,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/social/shared-routines/workspace-1/rollback'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ targetRevision: 12, baseRevision: 13, force: true }),
      })
    );
  });

  it('should throw SocialApiError with 409 payload details on rollback', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 409,
      text: async () => JSON.stringify({
        success: false,
        code: 'SHARED_ROUTINE_REVISION_CONFLICT',
        message: 'Revision conflict',
        serverRevision: 40,
        baseRevision: 38,
      }),
    });

    await expect(
      SocialService.rollbackSharedRoutine('workspace-1', {
        targetRevision: 37,
        baseRevision: 38,
      })
    ).rejects.toMatchObject({
      name: 'SocialApiError',
      status: 409,
      code: 'SHARED_ROUTINE_REVISION_CONFLICT',
      payload: expect.objectContaining({
        serverRevision: 40,
        baseRevision: 38,
      }),
    });
  });
});
