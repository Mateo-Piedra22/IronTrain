import { act, renderHook } from '@testing-library/react-native';
import { SocialService } from '../../services/SocialService';
import * as analytics from '../../utils/analytics';
import { useSocialStore } from '../useSocialStore';

type NetInfoState = { isConnected: boolean; isInternetReachable: boolean };

let mockNetInfoListener: ((state: NetInfoState) => void) | null = null;
const mockNetInfoUnsubscribe = jest.fn();

jest.mock('../../services/SocialService');
jest.mock('../../utils/analytics', () => ({
    capture: jest.fn(),
}));
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
jest.mock('@react-native-community/netinfo', () => ({
    __esModule: true,
    default: {
        addEventListener: jest.fn((cb: (state: NetInfoState) => void) => {
            mockNetInfoListener = cb;
            cb({ isConnected: true, isInternetReachable: true });
            return mockNetInfoUnsubscribe;
        }),
    },
}));
jest.mock('expo-location', () => ({
    getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
}));

const flushAsync = async () => {
    await Promise.resolve();
    await Promise.resolve();
};

const pulseFixture = {
    version: 'v1',
    profileUpdatedAtMs: Date.now(),
    latestActivityAtMs: Date.now(),
    latestShareAtMs: Date.now(),
    latestFriendAtMs: Date.now(),
    latestScoreAtMs: Date.now(),
    latestFriendProfileAtMs: Date.now(),
    latestLeaderboardAtMs: Date.now(),
    pendingShareCount: 0,
    pendingFriendRequestCount: 0,
    domainVersions: {
        profile: '1',
        feed: '1',
        notifications: '1:0',
        friends: '1:0',
        leaderboard: '1:0',
    },
    serverTimeMs: Date.now(),
};

const setupPulseDependencies = () => {
    (SocialService.getPulse as jest.Mock).mockResolvedValue(pulseFixture);
    (SocialService.getProfile as jest.Mock).mockResolvedValue({ id: 'u1', username: 'u1' });
    (SocialService.getFriends as jest.Mock).mockResolvedValue([]);
    (SocialService.getAnalytics as jest.Mock).mockResolvedValue([]);
    (SocialService.getInbox as jest.Mock).mockResolvedValue([]);
};

describe('useSocialStore', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        mockNetInfoListener = null;
        setupPulseDependencies();
        (global as any).fetch = jest.fn();
        act(() => {
            useSocialStore.getState().clearData();
        });
    });

    afterEach(() => {
        act(() => {
            useSocialStore.getState().clearData();
        });
        jest.clearAllTimers();
        jest.useRealTimers();
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
        const mockFeedInbox = [{ id: '3', type: 'activity_log', createdAt: '2026-03-30T10:00:00.000Z' }];
        const mockNotificationsInbox = [{ id: '4', type: 'direct_share', createdAt: '2026-03-30T12:00:00.000Z' }];

        (SocialService.getProfile as jest.Mock).mockResolvedValue(mockProfile);
        (SocialService.getAnalytics as jest.Mock).mockResolvedValue(mockLeaderboard);
        (SocialService.getFriends as jest.Mock).mockResolvedValue(mockFriends);
        (SocialService.getInbox as jest.Mock)
            .mockResolvedValueOnce(mockFeedInbox)
            .mockResolvedValueOnce(mockNotificationsInbox);

        const { result } = renderHook(() => useSocialStore());

        await act(async () => {
            await result.current.loadData(true);
        });

        expect(result.current.profile).toEqual(mockProfile);
        expect(result.current.leaderboard).toEqual(mockLeaderboard);
        expect(result.current.friends).toEqual(mockFriends);
        expect(result.current.inbox).toEqual([...mockNotificationsInbox, ...mockFeedInbox]);
        expect(SocialService.getInbox).toHaveBeenNthCalledWith(1, 'feed');
        expect(SocialService.getInbox).toHaveBeenNthCalledWith(2, 'notifications');
        expect(result.current.loading).toBe(false);
    });

    it('should use cache if TTL has not expired and force=false', async () => {
        const mockProfile = { id: '1', username: 'test' };
        const mockLeaderboard = [{ id: '1', score: 100 }];
        const mockFriends = [{ id: '2', status: 'accepted' }];

        (SocialService.getProfile as jest.Mock).mockResolvedValue(mockProfile);
        (SocialService.getAnalytics as jest.Mock).mockResolvedValue(mockLeaderboard);
        (SocialService.getFriends as jest.Mock).mockResolvedValue(mockFriends);
        (SocialService.getInbox as jest.Mock)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]);

        const { result } = renderHook(() => useSocialStore());

        // First load
        await act(async () => {
            await result.current.loadData(true);
        });

        const profileCallsAfterFirstLoad = (SocialService.getProfile as jest.Mock).mock.calls.length;

        // Second load, should hit cache
        await act(async () => {
            await result.current.loadData(false);
        });

        expect((SocialService.getProfile as jest.Mock).mock.calls.length).toBe(profileCallsAfterFirstLoad);
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

    it('falls back to polling when SSE stream fails', async () => {
        (SocialService.getToken as jest.Mock).mockResolvedValue('token-1');
        (global as any).fetch = jest.fn().mockRejectedValue(new Error('sse error'));

        const { result } = renderHook(() => useSocialStore());

        await act(async () => {
            result.current.startRealtimeSync();
            await flushAsync();
        });

        expect((global as any).fetch).toHaveBeenCalled();
        expect(result.current.realtimeSource).toBe('polling');
    });

    it('attempts upgrade from polling to SSE and reconnects', async () => {
        const streamChunk = new TextEncoder().encode('event: ready\ndata: {"serverTimeMs": 1}\n\n');
        const reader = {
            read: jest
                .fn()
                .mockResolvedValueOnce({ done: false, value: streamChunk })
                .mockResolvedValueOnce({ done: true, value: undefined }),
        };

        (SocialService.getToken as jest.Mock)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce('token-2');

        (global as any).fetch = jest.fn().mockResolvedValue({
            ok: true,
            body: {
                getReader: () => reader,
            },
        });

        const { result } = renderHook(() => useSocialStore());

        await act(async () => {
            result.current.startRealtimeSync();
            await flushAsync();
        });

        expect(result.current.realtimeSource).toBe('polling');

        await act(async () => {
            jest.advanceTimersByTime(60000);
            await flushAsync();
        });

        expect((global as any).fetch).toHaveBeenCalledTimes(1);
        expect(analytics.capture).toHaveBeenCalledWith(
            'social_realtime_transport_changed',
            expect.objectContaining({ transport: 'sse' })
        );
    });

    it('detects stale state and triggers polling recovery sync', async () => {
        (SocialService.getToken as jest.Mock).mockResolvedValue(null);

        const { result } = renderHook(() => useSocialStore());

        await act(async () => {
            result.current.startRealtimeSync();
            await flushAsync();
        });

        const pulseCallsBefore = (SocialService.getPulse as jest.Mock).mock.calls.length;

        act(() => {
            useSocialStore.setState({
                realtimeSource: 'polling',
                realtimeConnected: true,
                lastRealtimeSyncAt: Date.now() - 60000,
            });
        });

        await act(async () => {
            jest.advanceTimersByTime(10000);
            await flushAsync();
        });

        expect((SocialService.getPulse as jest.Mock).mock.calls.length).toBeGreaterThan(pulseCallsBefore);
        expect(result.current.realtimeSource).toBe('polling');
    });

    it('refreshes only feed domain when only feed version changes', async () => {
        const feedOnlyPulse = {
            ...pulseFixture,
            version: 'v-feed',
            domainVersions: {
                profile: 'same-profile',
                feed: 'new-feed',
                notifications: 'same-notifications',
                friends: 'same-friends',
                leaderboard: 'same-leaderboard',
            },
        };

        (SocialService.getPulse as jest.Mock).mockResolvedValue(feedOnlyPulse);
        (SocialService.getInbox as jest.Mock)
            .mockResolvedValueOnce([
                { id: 'feed-new', feedType: 'activity_log', createdAt: '2026-03-30T12:00:00.000Z' },
            ]);

        const { result } = renderHook(() => useSocialStore());

        act(() => {
            useSocialStore.setState({
                lastPulseVersion: 'v-old',
                lastDomainVersions: {
                    profile: 'same-profile',
                    feed: 'old-feed',
                    notifications: 'same-notifications',
                    friends: 'same-friends',
                    leaderboard: 'same-leaderboard',
                },
                inbox: [
                    { id: 'notification-1', feedType: 'direct_share', createdAt: '2026-03-30T11:00:00.000Z' } as any,
                    { id: 'other-1', feedType: 'misc', createdAt: '2026-03-30T10:00:00.000Z' } as any,
                ],
            });
        });

        await act(async () => {
            const changed = await result.current.syncFromPulse(false);
            expect(changed).toBe(true);
        });

        expect(SocialService.getInbox).toHaveBeenCalledTimes(1);
        expect(SocialService.getInbox).toHaveBeenCalledWith('feed');
        expect(SocialService.getProfile).not.toHaveBeenCalled();
        expect(SocialService.getFriends).not.toHaveBeenCalled();
        expect(SocialService.getAnalytics).not.toHaveBeenCalled();
    });

    it('refreshes only notifications domain when only notifications version changes', async () => {
        const notificationsOnlyPulse = {
            ...pulseFixture,
            version: 'v-notifications',
            domainVersions: {
                profile: 'same-profile',
                feed: 'same-feed',
                notifications: 'new-notifications',
                friends: 'same-friends',
                leaderboard: 'same-leaderboard',
            },
        };

        (SocialService.getPulse as jest.Mock).mockResolvedValue(notificationsOnlyPulse);
        (SocialService.getInbox as jest.Mock)
            .mockResolvedValueOnce([
                { id: 'notification-new', feedType: 'direct_share', createdAt: '2026-03-30T13:00:00.000Z' },
            ]);

        const { result } = renderHook(() => useSocialStore());

        act(() => {
            useSocialStore.setState({
                lastPulseVersion: 'v-old',
                lastDomainVersions: {
                    profile: 'same-profile',
                    feed: 'same-feed',
                    notifications: 'old-notifications',
                    friends: 'same-friends',
                    leaderboard: 'same-leaderboard',
                },
                inbox: [
                    { id: 'feed-1', feedType: 'activity_log', createdAt: '2026-03-30T09:00:00.000Z' } as any,
                    { id: 'other-2', feedType: 'misc', createdAt: '2026-03-30T08:00:00.000Z' } as any,
                ],
            });
        });

        await act(async () => {
            const changed = await result.current.syncFromPulse(false);
            expect(changed).toBe(true);
        });

        expect(SocialService.getInbox).toHaveBeenCalledTimes(1);
        expect(SocialService.getInbox).toHaveBeenCalledWith('notifications');
        expect(SocialService.getProfile).not.toHaveBeenCalled();
        expect(SocialService.getFriends).not.toHaveBeenCalled();
        expect(SocialService.getAnalytics).not.toHaveBeenCalled();
    });

    it('refreshes profile and leaderboard domains when both versions change', async () => {
        const profileLeaderboardPulse = {
            ...pulseFixture,
            version: 'v-profile-leaderboard',
            domainVersions: {
                profile: 'new-profile',
                feed: 'same-feed',
                notifications: 'same-notifications',
                friends: 'same-friends',
                leaderboard: 'new-leaderboard',
            },
        };

        const nextProfile = { id: 'u1', username: 'updated-user' };
        const nextLeaderboard = [{ id: 'lb-1', score: 999 }];

        (SocialService.getPulse as jest.Mock).mockResolvedValue(profileLeaderboardPulse);
        (SocialService.getProfile as jest.Mock).mockResolvedValue(nextProfile);
        (SocialService.getAnalytics as jest.Mock).mockResolvedValue(nextLeaderboard);

        const { result } = renderHook(() => useSocialStore());

        act(() => {
            useSocialStore.setState({
                profile: { id: 'u1', username: 'old-user' } as any,
                leaderboard: [{ id: 'lb-old', score: 1 } as any],
                lastPulseVersion: 'v-old',
                lastDomainVersions: {
                    profile: 'old-profile',
                    feed: 'same-feed',
                    notifications: 'same-notifications',
                    friends: 'same-friends',
                    leaderboard: 'old-leaderboard',
                },
            });
        });

        await act(async () => {
            const changed = await result.current.syncFromPulse(false);
            expect(changed).toBe(true);
        });

        expect(SocialService.getProfile).toHaveBeenCalledTimes(1);
        expect(SocialService.getAnalytics).toHaveBeenCalledTimes(1);
        expect(SocialService.getFriends).not.toHaveBeenCalled();
        expect(SocialService.getInbox).not.toHaveBeenCalled();
        expect(result.current.profile).toEqual(nextProfile);
        expect(result.current.leaderboard).toEqual(nextLeaderboard);
    });

    it('switches polling cadence to background interval when network goes offline', async () => {
        (SocialService.getToken as jest.Mock).mockResolvedValue(null);

        const { result } = renderHook(() => useSocialStore());

        await act(async () => {
            result.current.startRealtimeSync();
            await flushAsync();
        });

        expect(result.current.realtimeSource).toBe('polling');
        expect(mockNetInfoListener).toBeTruthy();

        const pulseCallsBaseline = (SocialService.getPulse as jest.Mock).mock.calls.length;

        act(() => {
            mockNetInfoListener?.({ isConnected: false, isInternetReachable: false });
        });

        await act(async () => {
            jest.advanceTimersByTime(15000);
            await flushAsync();
        });

        expect((SocialService.getPulse as jest.Mock).mock.calls.length).toBe(pulseCallsBaseline);

        await act(async () => {
            jest.advanceTimersByTime(15000);
            await flushAsync();
        });

        expect((SocialService.getPulse as jest.Mock).mock.calls.length).toBeGreaterThan(pulseCallsBaseline);
    });

    it('forces sync when network comes back online', async () => {
        (SocialService.getToken as jest.Mock).mockResolvedValue(null);

        const { result } = renderHook(() => useSocialStore());

        await act(async () => {
            result.current.startRealtimeSync();
            await flushAsync();
        });

        expect(mockNetInfoListener).toBeTruthy();

        act(() => {
            mockNetInfoListener?.({ isConnected: false, isInternetReachable: false });
        });

        const pulseCallsBeforeReconnect = (SocialService.getPulse as jest.Mock).mock.calls.length;

        await act(async () => {
            mockNetInfoListener?.({ isConnected: true, isInternetReachable: true });
            await flushAsync();
        });

        expect((SocialService.getPulse as jest.Mock).mock.calls.length).toBeGreaterThan(pulseCallsBeforeReconnect);
    });
});
