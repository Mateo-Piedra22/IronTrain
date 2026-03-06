import * as SecureStore from 'expo-secure-store';
import { SocialService } from '../SocialService';

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
});
