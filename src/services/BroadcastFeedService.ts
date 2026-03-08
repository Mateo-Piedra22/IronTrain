import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { Config } from '../constants/Config';
import { useAuthStore } from '../store/authStore';
import { ChangelogService } from './ChangelogService';

export type BroadcastKind = 'changelog' | 'announcement' | 'global_event';
export type BroadcastUiType = 'toast' | 'modal' | 'system' | null;
export type BroadcastDisplayMode = 'once' | 'always' | 'until_closed' | null;

export type BroadcastItem = {
    id: string;
    kind: BroadcastKind;
    uiType: BroadcastUiType;
    title: string;
    body: string;
    priority: number;
    displayMode: BroadcastDisplayMode;
    actionUrl: string | null;
    lifecycle: {
        startsAt: string | null;
        endsAt: string | null;
        isActive: boolean;
    };
    engagement: {
        reactionCount: number;
        userReacted: boolean | null;
    };
    targeting: {
        platform: 'android' | 'ios' | 'all' | null;
        version: string | null;
        segment: 'all' | 'new' | 'active' | 'inactive' | 'premium' | null;
    };
    createdAt: string;
};

export type BroadcastFeedResponse = {
    generatedAt: string;
    items: BroadcastItem[];
};

const CACHE_FILE = `${FileSystem.cacheDirectory ?? ''}broadcast_feed_cache.json`;

function normalizePlatform(): 'android' | 'ios' | null {
    const os = Platform.OS;
    if (os === 'android' || os === 'ios') return os;
    return null;
}

function buildFeedUrl(params: { isFeed: boolean; includeUnreleased: boolean }): string {
    const version = ChangelogService.getAppVersion();
    const platform = normalizePlatform();

    const url = new URL('/api/broadcast/feed', Config.API_URL);
    url.searchParams.set('feed', params.isFeed ? 'true' : 'false');
    url.searchParams.set('includeUnreleased', params.includeUnreleased ? 'true' : 'false');

    if (platform) url.searchParams.set('platform', platform);
    if (version) url.searchParams.set('version', version);

    return url.toString();
}

export class BroadcastFeedService {
    private static async loadLocal(): Promise<BroadcastFeedResponse | null> {
        try {
            if (FileSystem.cacheDirectory) {
                const info = await FileSystem.getInfoAsync(CACHE_FILE);
                if (info.exists) {
                    const content = await FileSystem.readAsStringAsync(CACHE_FILE);
                    return JSON.parse(content) as BroadcastFeedResponse;
                }
            }
        } catch { }
        return null;
    }

    private static async saveLocal(data: BroadcastFeedResponse): Promise<void> {
        try {
            if (FileSystem.cacheDirectory) {
                await FileSystem.writeAsStringAsync(CACHE_FILE, JSON.stringify(data));
            }
        } catch { }
    }

    static async getFeed(params: { isFeed?: boolean; includeUnreleased?: boolean } = {}): Promise<BroadcastFeedResponse> {
        const isFeed = params.isFeed === true;
        const includeUnreleased = params.includeUnreleased === true;

        const url = buildFeedUrl({ isFeed, includeUnreleased });

        try {
            const { token } = useAuthStore.getState();
            const headers: Record<string, string> = {};
            if (token) headers.Authorization = `Bearer ${token}`;

            const res = await fetch(url, {
                headers,
            });

            if (res.ok) {
                const data = (await res.json()) as BroadcastFeedResponse;
                if (data && Array.isArray(data.items)) {
                    await this.saveLocal(data);
                    return data;
                }
            }
        } catch (error) {
            // Silently fail and fallback to cache
        }

        // FALLBACK TO CACHE
        const cached = await this.loadLocal();
        if (cached) return cached;

        return { generatedAt: new Date().toISOString(), items: [] };
    }
}
