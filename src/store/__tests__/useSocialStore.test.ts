import { act, renderHook } from '@testing-library/react-native';
import { SocialService } from '../../services/SocialService';
import { useSocialStore } from '../useSocialStore';

jest.mock('../../services/SocialService');
jest.mock('../../services/LocationPermissionsService', () => ({
    locationPermissionsService: {
        getCurrentLocation: jest.fn(),
    }
}));
jest.mock('../../store/notificationStore', () => ({
    useNotificationStore: {
        getState: () => ({ addToast: jest.fn() }),
    }
}));
jest.mock('expo-location', () => ({
    getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
}));

describe('useSocialStore', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        act(() => {
            useSocialStore.getState().clearData();
        });
    });

    it('should initialize with default state', () => {
        const { result } = renderHook(() => useSocialStore());
        expect(result.current.profile).toBeNull();
        expect(result.current.leaderboard).toEqual([]);
        expect(result.current.friends).toEqual([]);
        expect(result.current.inbox).toEqual([]);
    });

    it('should load data successfully from SocialService', async () => {
        const mockProfile = { id: '1', username: 'test' };
        const mockLeaderboard = [{ id: '1', score: 100 }];
        const mockFriends = [{ id: '2', status: 'accepted' }];
        const mockInbox = [{ id: '3', type: 'friend_request' }];

        (SocialService.getProfile as jest.Mock).mockResolvedValue(mockProfile);
        (SocialService.getAnalytics as jest.Mock).mockResolvedValue(mockLeaderboard);
        (SocialService.getFriends as jest.Mock).mockResolvedValue(mockFriends);
        (SocialService.getInbox as jest.Mock).mockResolvedValue(mockInbox);

        const { result } = renderHook(() => useSocialStore());

        await act(async () => {
            await result.current.loadData(true);
        });

        expect(result.current.profile).toEqual(mockProfile);
        expect(result.current.leaderboard).toEqual(mockLeaderboard);
        expect(result.current.friends).toEqual(mockFriends);
        expect(result.current.inbox).toEqual(mockInbox);
        expect(result.current.loading).toBe(false);
    });

    it('should use cache if TTL has not expired and force=false', async () => {
        const { result } = renderHook(() => useSocialStore());

        // First load
        await act(async () => {
            await result.current.loadData(true);
        });

        // Reset mocks to ensure they are not called again
        jest.clearAllMocks();

        // Second load, should hit cache
        await act(async () => {
            await result.current.loadData(false);
        });

        expect(SocialService.getProfile).not.toHaveBeenCalled();
    });

    it('should allow clearing data', () => {
        const { result } = renderHook(() => useSocialStore());

        act(() => {
            result.current.setProfile({ id: '1', username: 'test' } as any);
        });
        
        expect(result.current.profile).not.toBeNull();

        act(() => {
            result.current.clearData();
        });

        expect(result.current.profile).toBeNull();
        expect(result.current.lastFetched).toBe(0);
    });
});
