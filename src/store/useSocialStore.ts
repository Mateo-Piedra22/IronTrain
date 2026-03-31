import { Config } from '@/src/constants/Config';
import { locationPermissionsService } from '@/src/services/LocationPermissionsService';
import { SocialFriend, SocialInboxItem, SocialLeaderboardEntry, SocialProfile, SocialService } from '@/src/services/SocialService';
import { useAuthStore } from '@/src/store/authStore';
import { useNotificationStore } from '@/src/store/notificationStore';
import * as analytics from '@/src/utils/analytics';
import { logger } from '@/src/utils/logger';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import { AppState, AppStateStatus } from 'react-native';
import { create } from 'zustand';

type SocialDomainVersions = {
    profile: string;
    feed: string;
    notifications: string;
    friends: string;
    leaderboard: string;
};

const EMPTY_DOMAIN_VERSIONS: SocialDomainVersions = {
    profile: '',
    feed: '',
    notifications: '',
    friends: '',
    leaderboard: '',
};

interface SocialState {
    profile: SocialProfile | null;
    leaderboard: SocialLeaderboardEntry[];
    friends: SocialFriend[];
    inbox: SocialInboxItem[];
    weatherHistory: any[];
    lastFetched: number;
    loading: boolean;
    refreshingLocation: boolean;
    locationPermissionDenied: boolean;
    lastKnownLocation: string | null;
    realtimeConnected: boolean;
    realtimeSource: 'idle' | 'sse' | 'polling';
    lastRealtimeSyncAt: number | null;
    lastPulseVersion: string | null;
    lastDomainVersions: SocialDomainVersions;

    loadData: (force?: boolean, silent?: boolean) => Promise<void>;
    syncFromPulse: (force?: boolean) => Promise<boolean>;
    startRealtimeSync: () => void;
    stopRealtimeSync: () => void;
    refreshLocation: (silent?: boolean) => Promise<void>;
    setProfile: (profile: SocialProfile | null) => void;
    setInbox: (inbox: SocialInboxItem[] | ((prev: SocialInboxItem[]) => SocialInboxItem[])) => void;
    setFriends: (friends: SocialFriend[] | ((prev: SocialFriend[]) => SocialFriend[])) => void;
    setLeaderboard: (leaderboard: SocialLeaderboardEntry[]) => void;
    loadWeatherHistory: () => Promise<void>;
    clearData: () => void;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const SOCIAL_REALTIME_INTERVAL_MS = 15000;
const SOCIAL_REALTIME_BG_INTERVAL_MS = 30000;
const SOCIAL_REALTIME_STALE_MS = 45000;
const SOCIAL_SSE_RETRY_UPGRADE_MS = 60000;
const SOCIAL_SSE_CONNECT_TIMEOUT_MS = 15000;
const SOCIAL_METRIC_THROTTLE_MS = 60000;
let socialRealtimeTimer: ReturnType<typeof setInterval> | null = null;
let socialRealtimeHealthTimer: ReturnType<typeof setInterval> | null = null;
let socialPulseInFlight = false;
let socialStreamAbortController: AbortController | null = null;
let socialStreamConnecting = false;
let socialSseUpgradeTimer: ReturnType<typeof setTimeout> | null = null;
let socialAppState: AppStateStatus = AppState.currentState;
let socialAppStateSubscription: { remove: () => void } | null = null;
let socialNetInfoUnsubscribe: (() => void) | null = null;
let socialIsOnline = true;
let socialPollingIntervalMs = SOCIAL_REALTIME_INTERVAL_MS;
const socialMetricLastSentAt = new Map<string, number>();

const trackSocialMetric = (
    eventName: string,
    properties: Record<string, unknown> = {},
    throttleMs: number = SOCIAL_METRIC_THROTTLE_MS
) => {
    try {
        const throttleKey = `${eventName}:${String(properties.reason || 'default')}`;
        const now = Date.now();
        const previous = socialMetricLastSentAt.get(throttleKey) || 0;
        if (now - previous < throttleMs) return;
        socialMetricLastSentAt.set(throttleKey, now);

        const authState = useAuthStore.getState();
        analytics.capture(eventName, {
            ...properties,
            user_id: authState.user?.id || null,
            has_token: !!authState.token,
            platform: 'mobile',
            ts_ms: now,
        });
    } catch {
        // no-op
    }
};

const resolveInboxDomain = (item: SocialInboxItem): 'activity_log' | 'direct_share' | 'other' => {
    // Prefer explicit feedType when available
    if (item.feedType === 'activity_log') return 'activity_log';
    if (item.feedType === 'direct_share' || item.type === 'routine') return 'direct_share';

    // Fallback: only treat specific actionType values as activity_log
    if (item.actionType === 'activity_log') return 'activity_log';
    if (item.feedType === 'direct_share' || item.type === 'routine' || item.status) return 'direct_share';
    return 'other';
};

const extractSseEvents = (buffer: string): { events: Array<{ event: string; data: string }>; rest: string } => {
    const events: Array<{ event: string; data: string }> = [];
    const blocks = buffer.split('\n\n');
    const rest = blocks.pop() ?? '';

    for (const block of blocks) {
        const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
        if (lines.length === 0) continue;

        let eventName = 'message';
        const dataParts: string[] = [];

        for (const line of lines) {
            if (line.startsWith('event:')) {
                eventName = line.slice(6).trim() || 'message';
            } else if (line.startsWith('data:')) {
                dataParts.push(line.slice(5).trim());
            }
        }

        events.push({ event: eventName, data: dataParts.join('\n') });
    }

    return { events, rest };
};

const resolvePollingInterval = (): number => {
    if (!socialIsOnline) return SOCIAL_REALTIME_BG_INTERVAL_MS;
    if (socialAppState !== 'active') return SOCIAL_REALTIME_BG_INTERVAL_MS;
    return SOCIAL_REALTIME_INTERVAL_MS;
};

export const useSocialStore = create<SocialState>((set, get) => ({
    profile: null,
    leaderboard: [],
    friends: [],
    inbox: [],
    weatherHistory: [],
    lastFetched: 0,
    loading: false,
    refreshingLocation: false,
    locationPermissionDenied: false,
    lastKnownLocation: null,
    realtimeConnected: false,
    realtimeSource: 'idle',
    lastRealtimeSyncAt: null,
    lastPulseVersion: null,
    lastDomainVersions: EMPTY_DOMAIN_VERSIONS,

    loadData: async (force = false, silent = false) => {
        const { lastFetched } = get();
        const now = Date.now();

        if (!force && now - lastFetched < CACHE_TTL) {
            return; // Use cached data
        }

        if (!silent) set({ loading: true });

        try {
            const [profile, leaderboard, friends, feedInbox, notificationInbox] = await Promise.all([
                SocialService.getProfile(),
                SocialService.getAnalytics(),
                SocialService.getFriends(),
                SocialService.getInbox('feed'),
                SocialService.getInbox('notifications'),
            ]);

            const inboxMap = new Map<string, SocialInboxItem>();
            for (const item of [...feedInbox, ...notificationInbox]) {
                const dedupeKey = `${resolveInboxDomain(item)}:${item.id}`;
                inboxMap.set(dedupeKey, item);
            }
            const mergedInbox = Array.from(inboxMap.values()).sort(
                (a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime()
            );

            set((state) => {
                let mergedProfile = profile;

                if (profile && !profile.weatherBonus?.location && state.lastKnownLocation) {
                    mergedProfile = {
                        ...profile,
                        weatherBonus: {
                            ...(profile.weatherBonus || { condition: 'Desconocido', temperature: 20, multiplier: 1, isActive: false }),
                            location: state.lastKnownLocation
                        }
                    };
                }

                return {
                    profile: mergedProfile,
                    leaderboard,
                    friends,
                    inbox: mergedInbox,
                    lastFetched: now,
                    realtimeConnected: true,
                    lastRealtimeSyncAt: now,
                };
            });
        } catch (err) {
            logger.captureException(err, { scope: 'useSocialStore.loadData' });
            set({ realtimeConnected: false });
        } finally {
            if (!silent) set({ loading: false });
        }
    },

    syncFromPulse: async (force = false) => {
        if (socialPulseInFlight) return false;

        socialPulseInFlight = true;
        try {
            const pulse = await SocialService.getPulse();
            const state = get();
            const hasChanges = force || !state.lastPulseVersion || state.lastPulseVersion !== pulse.version;
            const domainVersions: SocialDomainVersions = pulse.domainVersions ?? {
                profile: `${pulse.profileUpdatedAtMs}`,
                feed: `${pulse.latestActivityAtMs}`,
                notifications: `${pulse.latestShareAtMs}:${pulse.pendingShareCount}`,
                friends: `${pulse.latestFriendAtMs}:${pulse.pendingFriendRequestCount}`,
                leaderboard: `${pulse.latestLeaderboardAtMs ?? Math.max(pulse.latestScoreAtMs || 0, pulse.latestFriendProfileAtMs || 0)}:${state.friends.length}`,
            };

            const shouldRefreshProfile = force || state.lastDomainVersions.profile !== domainVersions.profile;
            const shouldRefreshFeed = force || state.lastDomainVersions.feed !== domainVersions.feed;
            const shouldRefreshNotifications = force || state.lastDomainVersions.notifications !== domainVersions.notifications;
            const shouldRefreshFriends = force || state.lastDomainVersions.friends !== domainVersions.friends;
            const shouldRefreshLeaderboard = force || state.lastDomainVersions.leaderboard !== domainVersions.leaderboard;
            const shouldRefreshAnyDomain = shouldRefreshProfile || shouldRefreshFeed || shouldRefreshNotifications || shouldRefreshFriends || shouldRefreshLeaderboard;

            set({
                realtimeConnected: true,
                lastPulseVersion: pulse.version,
                lastDomainVersions: domainVersions,
                lastRealtimeSyncAt: pulse.serverTimeMs || Date.now(),
            });

            if (!state.realtimeConnected) {
                trackSocialMetric('social_realtime_recovered', {
                    source: state.realtimeSource,
                    force,
                }, 15000);
            }

            if (!hasChanges || !shouldRefreshAnyDomain) return false;

            let nextProfile = state.profile;
            let nextFriends = state.friends;
            let nextLeaderboard = state.leaderboard;
            let nextFeedInbox: SocialInboxItem[] | null = null;
            let nextNotificationInbox: SocialInboxItem[] | null = null;

            const tasks: Promise<void>[] = [];

            if (shouldRefreshProfile) {
                tasks.push(SocialService.getProfile().then((profile) => {
                    nextProfile = profile;
                }));
            }

            if (shouldRefreshFriends) {
                tasks.push(SocialService.getFriends().then((friends) => {
                    nextFriends = friends;
                }));
            }

            if (shouldRefreshLeaderboard) {
                tasks.push(SocialService.getAnalytics().then((leaderboard) => {
                    nextLeaderboard = leaderboard;
                }));
            }

            if (shouldRefreshFeed) {
                tasks.push(SocialService.getInbox('feed').then((items) => {
                    nextFeedInbox = items;
                }));
            }

            if (shouldRefreshNotifications) {
                tasks.push(SocialService.getInbox('notifications').then((items) => {
                    nextNotificationInbox = items;
                }));
            }

            await Promise.all(tasks);

            const currentInbox = state.inbox;
            const feedBase = nextFeedInbox ?? currentInbox.filter((item) => resolveInboxDomain(item) === 'activity_log');
            const notificationsBase = nextNotificationInbox ?? currentInbox.filter((item) => resolveInboxDomain(item) === 'direct_share');
            const remainingItems = currentInbox.filter((item) => resolveInboxDomain(item) === 'other');

            const inboxMap = new Map<string, SocialInboxItem>();
            for (const item of [...feedBase, ...notificationsBase, ...remainingItems]) {
                const dedupeKey = `${resolveInboxDomain(item)}:${item.id}`;
                inboxMap.set(dedupeKey, item);
            }
            const mergedInbox = Array.from(inboxMap.values()).sort(
                (a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime()
            );

            if (nextProfile && !nextProfile.weatherBonus?.location && state.lastKnownLocation) {
                nextProfile = {
                    ...nextProfile,
                    weatherBonus: {
                        ...(nextProfile.weatherBonus || { condition: 'Desconocido', temperature: 20, multiplier: 1, isActive: false }),
                        location: state.lastKnownLocation,
                    }
                };
            }

            set({
                profile: nextProfile,
                friends: nextFriends,
                leaderboard: nextLeaderboard,
                inbox: mergedInbox,
                lastFetched: Date.now(),
                realtimeConnected: true,
            });

            return true;
        } catch (err) {
            logger.captureException(err, { scope: 'useSocialStore.syncFromPulse' });
            trackSocialMetric('social_realtime_sync_error', {
                source: get().realtimeSource,
                force,
            });
            set({ realtimeConnected: false });
            return false;
        } finally {
            socialPulseInFlight = false;
        }
    },

    startRealtimeSync: () => {
        if (socialRealtimeTimer || socialStreamAbortController || socialStreamConnecting) return;
        trackSocialMetric('social_realtime_started', {
            app_state: socialAppState,
            online: socialIsOnline,
        }, 10000);

        const clearPollingTimer = () => {
            if (socialRealtimeTimer) {
                clearInterval(socialRealtimeTimer);
                socialRealtimeTimer = null;
            }
        };

        const startPollingFallback = (forceIntervalMs?: number, reason: string = 'fallback') => {
            if (socialRealtimeTimer) return;
            socialPollingIntervalMs = forceIntervalMs ?? resolvePollingInterval();
            set({ realtimeSource: 'polling' });
            trackSocialMetric('social_realtime_transport_changed', {
                transport: 'polling',
                reason,
                interval_ms: socialPollingIntervalMs,
            }, 10000);
            socialRealtimeTimer = setInterval(() => {
                get().syncFromPulse(false).catch(() => undefined);
            }, socialPollingIntervalMs);
        };

        const stopEnvironmentWatchers = () => {
            if (socialAppStateSubscription) {
                socialAppStateSubscription.remove();
                socialAppStateSubscription = null;
            }
            if (socialNetInfoUnsubscribe) {
                socialNetInfoUnsubscribe();
                socialNetInfoUnsubscribe = null;
            }
            if (socialRealtimeHealthTimer) {
                clearInterval(socialRealtimeHealthTimer);
                socialRealtimeHealthTimer = null;
            }
            if (socialSseUpgradeTimer) {
                clearTimeout(socialSseUpgradeTimer);
                socialSseUpgradeTimer = null;
            }
        };

        const setupEnvironmentWatchers = () => {
            if (!socialAppStateSubscription) {
                socialAppStateSubscription = AppState.addEventListener('change', (nextState) => {
                    socialAppState = nextState;
                    if (get().realtimeSource === 'polling') {
                        const nextInterval = resolvePollingInterval();
                        if (nextInterval !== socialPollingIntervalMs) {
                            clearPollingTimer();
                            startPollingFallback(nextInterval, 'app_state_change');
                        }
                    }
                    if (nextState === 'active') {
                        get().syncFromPulse(true).catch(() => undefined);
                    }
                });
            }

            if (!socialNetInfoUnsubscribe) {
                socialNetInfoUnsubscribe = NetInfo.addEventListener((state) => {
                    const online = !!(state.isConnected && state.isInternetReachable !== false);
                    const wasOnline = socialIsOnline;
                    socialIsOnline = online;

                    if (get().realtimeSource === 'polling') {
                        const nextInterval = resolvePollingInterval();
                        if (nextInterval !== socialPollingIntervalMs) {
                            clearPollingTimer();
                            startPollingFallback(nextInterval, 'network_change');
                        }
                    }

                    if (!wasOnline && online) {
                        get().syncFromPulse(true).catch(() => undefined);
                    }
                });
            }

            if (!socialRealtimeHealthTimer) {
                socialRealtimeHealthTimer = setInterval(() => {
                    const state = get();
                    const last = state.lastRealtimeSyncAt;
                    if (!last) return;
                    const staleMs = Date.now() - last;
                    if (staleMs <= SOCIAL_REALTIME_STALE_MS) return;

                    set({ realtimeConnected: false });
                    trackSocialMetric('social_realtime_stale_detected', {
                        source: state.realtimeSource,
                        stale_ms: staleMs,
                    }, 15000);

                    if (state.realtimeSource === 'sse' && socialStreamAbortController) {
                        socialStreamAbortController.abort();
                        socialStreamAbortController = null;
                    }

                    if (state.realtimeSource === 'polling') {
                        get().syncFromPulse(true).catch(() => undefined);
                    }
                }, 10000);
            }

            if (!socialSseUpgradeTimer) {
                socialSseUpgradeTimer = setTimeout(() => {
                    socialSseUpgradeTimer = null;
                    if (get().realtimeSource === 'polling') {
                        clearPollingTimer();
                        trackSocialMetric('social_realtime_sse_upgrade_attempt', {
                            from: 'polling',
                        }, 10000);
                        get().startRealtimeSync();
                    }
                }, SOCIAL_SSE_RETRY_UPGRADE_MS);
            }

            return stopEnvironmentWatchers;
        };

        const stopWatchers = setupEnvironmentWatchers();

        get().syncFromPulse(true).catch(() => undefined);

        socialStreamConnecting = true;

        (async () => {
            let streamEndedUnexpectedly = false;
            let connectTimedOut = false;
            try {
                const token = await SocialService.getToken();
                if (!token) {
                    startPollingFallback(undefined, 'missing_token');
                    return;
                }

                const controller = new AbortController();
                socialStreamAbortController = controller;
                const connectTimeout = setTimeout(() => {
                    connectTimedOut = true;
                    controller.abort();
                }, SOCIAL_SSE_CONNECT_TIMEOUT_MS);

                const response = await fetch(`${Config.API_URL}/api/social/stream`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'text/event-stream',
                    },
                    signal: controller.signal,

                }).finally(() => {
                    clearTimeout(connectTimeout);
                });

                if (!response.ok) {
                    let responseSnippet = '';
                    try {
                        responseSnippet = (await response.text()).slice(0, 300);
                    } catch {
                        responseSnippet = '';
                    }
                    const detail = responseSnippet ? ` - ${responseSnippet}` : '';
                    throw new Error(`SSE not available (${response.status} ${response.statusText})${detail}`);
                }

                if (!response.body || typeof response.body.getReader !== 'function') {
                    throw new Error(`SSE stream body unavailable (${response.status} ${response.statusText})`);
                }

                set({
                    realtimeConnected: true,
                    realtimeSource: 'sse',
                    lastRealtimeSyncAt: Date.now(),
                });
                trackSocialMetric('social_realtime_transport_changed', {
                    transport: 'sse',
                    reason: 'stream_connected',
                }, 10000);

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { value, done } = await reader.read();
                    if (done) {
                        streamEndedUnexpectedly = !controller.signal.aborted;
                        break;
                    }

                    buffer += decoder.decode(value, { stream: true });
                    const parsed = extractSseEvents(buffer);
                    buffer = parsed.rest;

                    for (const event of parsed.events) {
                        if (event.event === 'pulse') {
                            let versionFromEvent: string | null = null;
                            try {
                                const payload = JSON.parse(event.data) as { version?: string };
                                versionFromEvent = payload.version ?? null;
                            } catch {
                                versionFromEvent = null;
                            }

                            set({
                                realtimeConnected: true,
                                lastRealtimeSyncAt: Date.now(),
                            });

                            if (!versionFromEvent || versionFromEvent !== get().lastPulseVersion) {
                                await get().syncFromPulse(false);
                            }
                        } else if (event.event === 'heartbeat' || event.event === 'ready') {
                            set({
                                realtimeConnected: true,
                                lastRealtimeSyncAt: Date.now(),
                            });
                        }
                    }
                }
            } catch (error) {
                if (!socialRealtimeTimer) {
                    startPollingFallback(undefined, 'stream_error');
                }
                trackSocialMetric('social_realtime_stream_error', {
                    source: get().realtimeSource,
                    message: connectTimedOut
                        ? 'sse_connect_timeout'
                        : error instanceof Error
                            ? error.message
                            : 'unknown_error',
                }, 15000);
                set({ realtimeConnected: false });
            } finally {
                socialStreamConnecting = false;
                socialStreamAbortController = null;
                if (streamEndedUnexpectedly && !socialRealtimeTimer) {
                    startPollingFallback(undefined, 'stream_closed_unexpected');
                }
                if (!socialRealtimeTimer) {
                    set({ realtimeSource: 'idle' });
                    stopWatchers();
                }
            }
        })();
    },

    stopRealtimeSync: () => {
        if (socialStreamAbortController) {
            socialStreamAbortController.abort();
            socialStreamAbortController = null;
        }
        socialStreamConnecting = false;
        if (socialRealtimeTimer) {
            clearInterval(socialRealtimeTimer);
            socialRealtimeTimer = null;
        }
        if (socialRealtimeHealthTimer) {
            clearInterval(socialRealtimeHealthTimer);
            socialRealtimeHealthTimer = null;
        }
        if (socialSseUpgradeTimer) {
            clearTimeout(socialSseUpgradeTimer);
            socialSseUpgradeTimer = null;
        }
        if (socialAppStateSubscription) {
            socialAppStateSubscription.remove();
            socialAppStateSubscription = null;
        }
        if (socialNetInfoUnsubscribe) {
            socialNetInfoUnsubscribe();
            socialNetInfoUnsubscribe = null;
        }
        trackSocialMetric('social_realtime_stopped', {
            source: get().realtimeSource,
        }, 5000);
        set({ realtimeConnected: false, realtimeSource: 'idle' });
    },

    refreshLocation: async (silent = false) => {
        if (!silent) set({ refreshingLocation: true });
        const { addToast } = useNotificationStore.getState();

        try {
            const location = await locationPermissionsService.getCurrentLocation(silent);

            if (location) {
                set({
                    locationPermissionDenied: false,
                    lastKnownLocation: location.city || 'Tu ubicación'
                });

                // Optimistic UI update
                set((state) => ({
                    profile: state.profile ? {
                        ...state.profile,
                        weatherBonus: {
                            ...(state.profile.weatherBonus || {
                                condition: 'Sincronizando...',
                                temperature: 20,
                                multiplier: 1.0,
                                isActive: false,
                            }),
                            location: location.city || 'Tu ubicación',
                        },
                    } : null
                }));

                try {
                    const updatedBonus = await SocialService.updateWeatherBonus(location.lat, location.lon, location.city);
                    if (updatedBonus) {
                        set((state) => ({
                            profile: state.profile ? { ...state.profile, weatherBonus: updatedBonus } : null
                        }));
                        if (!silent) addToast({ type: 'success', title: 'Ubicación actualizada', message: `Se detectó: ${location.city || 'Tu ubicación'}` });
                    }
                } catch (err) {
                    if (!silent) addToast({ type: 'error', title: 'Servicio de clima', message: 'No pudimos verificar bonificaciones climáticas, pero detectamos tu ubicación.' });
                }
            } else {
                const status = await Location.getForegroundPermissionsAsync();
                set({ locationPermissionDenied: status.status === 'denied' });
                if (!silent && status.status === 'denied') {
                    addToast({ type: 'info', title: 'Ubicación desactivada', message: 'Habilitá ubicación en uso para bonos climáticos.' });
                }
            }
        } catch (err) {
            logger.captureException(err, { scope: 'useSocialStore.refreshLocation' });
        } finally {
            if (!silent) set({ refreshingLocation: false });
        }
    },

    setProfile: (profile) => set({ profile }),
    setInbox: (inbox) => set((state) => ({ inbox: typeof inbox === 'function' ? inbox(state.inbox) : inbox })),
    setFriends: (friends) => set((state) => ({ friends: typeof friends === 'function' ? friends(state.friends) : friends })),
    setLeaderboard: (leaderboard) => set({ leaderboard }),
    loadWeatherHistory: async () => {
        try {
            const history = await SocialService.getWeatherHistory();
            set({ weatherHistory: history });
        } catch (err) {
            logger.captureException(err, { scope: 'useSocialStore.loadWeatherHistory' });
        }
    },
    clearData: () => {
        if (socialRealtimeTimer) {
            clearInterval(socialRealtimeTimer);
            socialRealtimeTimer = null;
        }
        if (socialRealtimeHealthTimer) {
            clearInterval(socialRealtimeHealthTimer);
            socialRealtimeHealthTimer = null;
        }
        if (socialSseUpgradeTimer) {
            clearTimeout(socialSseUpgradeTimer);
            socialSseUpgradeTimer = null;
        }
        if (socialStreamAbortController) {
            socialStreamAbortController.abort();
            socialStreamAbortController = null;
        }
        if (socialAppStateSubscription) {
            socialAppStateSubscription.remove();
            socialAppStateSubscription = null;
        }
        if (socialNetInfoUnsubscribe) {
            socialNetInfoUnsubscribe();
            socialNetInfoUnsubscribe = null;
        }
        set({
            profile: null,
            leaderboard: [],
            friends: [],
            inbox: [],
            weatherHistory: [],
            lastFetched: 0,
            lastKnownLocation: null,
            realtimeConnected: false,
            realtimeSource: 'idle',
            lastRealtimeSyncAt: null,
            lastPulseVersion: null,
            lastDomainVersions: EMPTY_DOMAIN_VERSIONS,
        });
    },
}));
