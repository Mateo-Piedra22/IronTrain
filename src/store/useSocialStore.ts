import { locationPermissionsService } from '@/src/services/LocationPermissionsService';
import { SocialFriend, SocialInboxItem, SocialLeaderboardEntry, SocialProfile, SocialService } from '@/src/services/SocialService';
import { useNotificationStore } from '@/src/store/notificationStore';
import { logger } from '@/src/utils/logger';
import * as Location from 'expo-location';
import { create } from 'zustand';

interface SocialState {
    profile: SocialProfile | null;
    leaderboard: SocialLeaderboardEntry[];
    friends: SocialFriend[];
    inbox: SocialInboxItem[];
    lastFetched: number;
    loading: boolean;
    refreshingLocation: boolean;
    locationPermissionDenied: boolean;
    lastKnownLocation: string | null;

    loadData: (force?: boolean, silent?: boolean) => Promise<void>;
    refreshLocation: (silent?: boolean) => Promise<void>;
    setProfile: (profile: SocialProfile | null) => void;
    setInbox: (inbox: SocialInboxItem[] | ((prev: SocialInboxItem[]) => SocialInboxItem[])) => void;
    setFriends: (friends: SocialFriend[] | ((prev: SocialFriend[]) => SocialFriend[])) => void;
    setLeaderboard: (leaderboard: SocialLeaderboardEntry[]) => void;
    clearData: () => void;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const useSocialStore = create<SocialState>((set, get) => ({
    profile: null,
    leaderboard: [],
    friends: [],
    inbox: [],
    lastFetched: 0,
    loading: false,
    refreshingLocation: false,
    locationPermissionDenied: false,
    lastKnownLocation: null,

    loadData: async (force = false, silent = false) => {
        const { lastFetched } = get();
        const now = Date.now();

        if (!force && now - lastFetched < CACHE_TTL) {
            return; // Use cached data
        }

        if (!silent) set({ loading: true });

        try {
            const [p, l, f, i] = await Promise.all([
                SocialService.getProfile(),
                SocialService.getAnalytics(),
                SocialService.getFriends(),
                SocialService.getInbox()
            ]);

            set((state) => {
                let mergedProfile = p;

                // Keep visually optimistic location if backend didn't return one right away
                if (p && !p.weatherBonus?.location && state.lastKnownLocation) {
                    mergedProfile = {
                        ...p,
                        weatherBonus: {
                            ...(p.weatherBonus || { condition: 'Desconocido', temperature: 20, multiplier: 1, isActive: false }),
                            location: state.lastKnownLocation
                        }
                    };
                }

                return {
                    profile: mergedProfile,
                    leaderboard: l,
                    friends: f,
                    inbox: i,
                    lastFetched: now,
                };
            });
        } catch (err) {
            logger.captureException(err, { scope: 'useSocialStore.loadData' });
        } finally {
            set({ loading: false });
        }
    },

    refreshLocation: async (silent = false) => {
        set({ refreshingLocation: true });
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
            set({ refreshingLocation: false });
        }
    },

    setProfile: (profile) => set({ profile }),
    setInbox: (inbox) => set((state) => ({ inbox: typeof inbox === 'function' ? inbox(state.inbox) : inbox })),
    setFriends: (friends) => set((state) => ({ friends: typeof friends === 'function' ? friends(state.friends) : friends })),
    setLeaderboard: (leaderboard) => set({ leaderboard }),
    clearData: () => set({ profile: null, leaderboard: [], friends: [], inbox: [], lastFetched: 0, lastKnownLocation: null }),
}));
