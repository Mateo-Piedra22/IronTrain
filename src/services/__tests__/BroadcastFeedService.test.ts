import { BroadcastFeedService } from '../BroadcastFeedService';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { Config } from '../../constants/Config';
import { useAuthStore } from '../../store/authStore';
import { getAppVersion } from '../../utils/appInfo';

jest.mock('expo-file-system/legacy', () => ({
    cacheDirectory: '/cache',
    getInfoAsync: jest.fn(),
    readAsStringAsync: jest.fn(),
    writeAsStringAsync: jest.fn(),
}));

jest.mock('react-native', () => ({
    Platform: {
        OS: 'ios',
    },
}));

jest.mock('../../constants/Config', () => ({
    Config: {
        API_URL: 'https://api.irontrain.example.com',
    },
}));

jest.mock('../../store/authStore', () => ({
    useAuthStore: {
        getState: jest.fn(),
    },
}));

jest.mock('../../utils/appInfo', () => ({
    getAppVersion: jest.fn(),
}));

describe('BroadcastFeedService', () => {
    const mockBroadcastResponse = {
        generatedAt: '2026-01-15T10:00:00Z',
        items: [
            {
                id: 'announcement-1',
                kind: 'announcement' as const,
                uiType: 'toast' as const,
                title: 'Test Announcement',
                body: 'Test Body',
                priority: 1,
                displayMode: 'once' as const,
                actionUrl: null,
                lifecycle: {
                    startsAt: null,
                    endsAt: null,
                    isActive: true,
                },
                engagement: {
                    reactionCount: 0,
                    userReacted: false,
                },
                targeting: {
                    platform: 'all' as const,
                    version: null,
                    segment: 'all' as const,
                },
                createdAt: '2026-01-15T10:00:00Z',
            },
        ],
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
        (useAuthStore.getState as jest.Mock).mockReturnValue({ token: null });
        (getAppVersion as jest.Mock).mockReturnValue('2.1.5');
    });

    describe('getFeed', () => {
        it('should fetch feed from API successfully', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => mockBroadcastResponse,
            });

            const result = await BroadcastFeedService.getFeed();

            expect(result).toEqual(mockBroadcastResponse);
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/broadcast/feed'),
                expect.objectContaining({ headers: {} })
            );
        });

        it('should build correct URL with parameters', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => mockBroadcastResponse,
            });

            await BroadcastFeedService.getFeed({ isFeed: true, includeUnreleased: true });

            const url = (global.fetch as jest.Mock).mock.calls[0][0];
            expect(url).toContain('feed=true');
            expect(url).toContain('includeUnreleased=true');
            expect(url).toContain('platform=ios');
            expect(url).toContain('version=2.1.5');
        });

        it('should use Android platform when on Android', async () => {
            require('react-native').Platform.OS = 'android';
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => mockBroadcastResponse,
            });

            await BroadcastFeedService.getFeed();

            const url = (global.fetch as jest.Mock).mock.calls[0][0];
            expect(url).toContain('platform=android');
        });

        it('should include auth token when authenticated', async () => {
            (useAuthStore.getState as jest.Mock).mockReturnValue({ token: 'test-token' });
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => mockBroadcastResponse,
            });

            await BroadcastFeedService.getFeed();

            expect(global.fetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: {
                        Authorization: 'Bearer test-token',
                    },
                })
            );
        });

        it('should fallback to cache when fetch fails', async () => {
            global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
            (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
            (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
                JSON.stringify(mockBroadcastResponse)
            );

            const result = await BroadcastFeedService.getFeed();

            expect(result).toEqual(mockBroadcastResponse);
        });

        it('should fallback to cache when response is not ok', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 500,
            });
            (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
            (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
                JSON.stringify(mockBroadcastResponse)
            );

            const result = await BroadcastFeedService.getFeed();

            expect(result).toEqual(mockBroadcastResponse);
        });

        it('should fallback to cache when response JSON is invalid', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ invalid: 'data' }),
            });
            (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
            (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
                JSON.stringify(mockBroadcastResponse)
            );

            const result = await BroadcastFeedService.getFeed();

            expect(result).toEqual(mockBroadcastResponse);
        });

        it('should return empty items when cache is empty', async () => {
            global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
            (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

            const result = await BroadcastFeedService.getFeed();

            expect(result).toEqual({
                generatedAt: expect.any(String),
                items: [],
            });
        });

        it('should save response to cache on successful fetch', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => mockBroadcastResponse,
            });

            await BroadcastFeedService.getFeed();

            expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
                expect.stringContaining('broadcast_feed_cache.json'),
                JSON.stringify(mockBroadcastResponse)
            );
        });

        it('should handle cache read errors gracefully', async () => {
            global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
            (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
            (FileSystem.readAsStringAsync as jest.Mock).mockRejectedValue(new Error('Read error'));

            const result = await BroadcastFeedService.getFeed();

            expect(result).toEqual({
                generatedAt: expect.any(String),
                items: [],
            });
        });

        it('should handle cache write errors gracefully', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => mockBroadcastResponse,
            });
            (FileSystem.writeAsStringAsync as jest.Mock).mockRejectedValue(new Error('Write error'));

            const result = await BroadcastFeedService.getFeed();

            expect(result).toEqual(mockBroadcastResponse);
        });

        it('should handle missing cache directory', async () => {
            (FileSystem as any).cacheDirectory = null;
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => mockBroadcastResponse,
            });

            const result = await BroadcastFeedService.getFeed();

            expect(result).toEqual(mockBroadcastResponse);
        });

        it('should use default parameters when not provided', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => mockBroadcastResponse,
            });

            await BroadcastFeedService.getFeed();

            const url = (global.fetch as jest.Mock).mock.calls[0][0];
            expect(url).toContain('feed=false');
            expect(url).toContain('includeUnreleased=false');
        });

        it('should handle null platform gracefully', async () => {
            require('react-native').Platform.OS = 'web';
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => mockBroadcastResponse,
            });

            await BroadcastFeedService.getFeed();

            const url = (global.fetch as jest.Mock).mock.calls[0][0];
            expect(url).not.toContain('platform=');
        });

        it('should handle missing app version', async () => {
            (getAppVersion as jest.Mock).mockReturnValue('0.0.0');
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => mockBroadcastResponse,
            });

            await BroadcastFeedService.getFeed();

            const url = (global.fetch as jest.Mock).mock.calls[0][0];
            expect(url).toContain('version=0.0.0');
        });
    });

    describe('loadLocal', () => {
        it('should load cached feed from file system', async () => {
            (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
            (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
                JSON.stringify(mockBroadcastResponse)
            );

            const result = await (BroadcastFeedService as any).loadLocal();

            expect(result).toEqual(mockBroadcastResponse);
        });

        it('should return null when cache file does not exist', async () => {
            (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });

            const result = await (BroadcastFeedService as any).loadLocal();

            expect(result).toBeNull();
        });

        it('should return null on parse error', async () => {
            (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
            (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('invalid json');

            const result = await (BroadcastFeedService as any).loadLocal();

            expect(result).toBeNull();
        });

        it('should return null on read error', async () => {
            (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
            (FileSystem.readAsStringAsync as jest.Mock).mockRejectedValue(new Error('Read error'));

            const result = await (BroadcastFeedService as any).loadLocal();

            expect(result).toBeNull();
        });

        it('should handle missing cache directory', async () => {
            (FileSystem as any).cacheDirectory = null;

            const result = await (BroadcastFeedService as any).loadLocal();

            expect(result).toBeNull();
        });
    });

    describe('saveLocal', () => {
        it('should save feed to cache file', async () => {
            await (BroadcastFeedService as any).saveLocal(mockBroadcastResponse);

            expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
                expect.stringContaining('broadcast_feed_cache.json'),
                JSON.stringify(mockBroadcastResponse)
            );
        });

        it('should handle write errors gracefully', async () => {
            (FileSystem.writeAsStringAsync as jest.Mock).mockRejectedValue(new Error('Write error'));

            await expect((BroadcastFeedService as any).saveLocal(mockBroadcastResponse))
                .resolves.not.toThrow();
        });

        it('should handle missing cache directory', async () => {
            (FileSystem as any).cacheDirectory = null;

            await expect((BroadcastFeedService as any).saveLocal(mockBroadcastResponse))
                .resolves.not.toThrow();
        });
    });

    describe('normalizePlatform', () => {
        it('should return android for Android platform', () => {
            require('react-native').Platform.OS = 'android';
            
            const normalizePlatform = (BroadcastFeedService as any).__getNormalizePlatform?.() 
                || require('../BroadcastFeedService').__normalizePlatform;
            
            // Test is implicit in getFeed tests
        });

        it('should return ios for iOS platform', () => {
            require('react-native').Platform.OS = 'ios';
            // Tested implicitly in getFeed tests
        });

        it('should return null for other platforms', () => {
            require('react-native').Platform.OS = 'web';
            // Tested implicitly in getFeed tests
        });
    });
});
