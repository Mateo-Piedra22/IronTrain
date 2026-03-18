import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { jwtDecode } from 'jwt-decode';
import { create } from 'zustand';
import { Config } from '../constants/Config';
import * as analytics from '../utils/analytics';

const TOKEN_KEY = 'irontrain_auth_token';
const WEBSITE_URL = Config.API_URL;

interface UserData {
    id: string;
    email?: string;
    exp?: number;
}

interface AuthState {
    token: string | null;
    user: UserData | null;
    isLoading: boolean;
    error: string | null;

    initialize: () => Promise<void>;
    login: () => Promise<void>;
    logout: () => Promise<void>;
}

WebBrowser.maybeCompleteAuthSession();

type TokenPayload = {
    id?: string;
    sub?: string;
    email?: string;
    exp?: number;
};

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return fallback;
};

const normalizeUserData = (payload: TokenPayload): UserData | null => {
    const userId = payload.id ?? payload.sub;
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) return null;
    const email = typeof payload.email === 'string' ? payload.email : undefined;
    return { id: userId, email, exp: payload.exp };
};

const isExpired = (exp?: number) => (typeof exp === 'number' ? exp * 1000 < Date.now() : false);

export const useAuthStore = create<AuthState>((set) => ({
    token: null,
    user: null,
    isLoading: true,
    error: null,

    initialize: async () => {
        try {
            set({ isLoading: true, error: null });
            const token = await SecureStore.getItemAsync(TOKEN_KEY);
            if (token) {
                const decoded = jwtDecode<TokenPayload>(token);
                const userData = normalizeUserData(decoded);
                if (!userData || isExpired(userData.exp)) {
                    await SecureStore.deleteItemAsync(TOKEN_KEY);
                    set({ token: null, user: null, isLoading: false });
                    return;
                }
                set({ token, user: userData, isLoading: false });

                // Identify user in PostHog
                analytics.identify(userData.id, {
                    email: userData.email
                });
            } else {
                set({ token: null, user: null, isLoading: false });
            }
        } catch (e: unknown) {
            set({ token: null, user: null, isLoading: false, error: getErrorMessage(e, 'Error desconocido') });
        }
    },

    login: async () => {
        try {
            set({ isLoading: true, error: null });

            // Using just 'callback' as the path which resolves to app/callback.tsx
            const returnUrl = Linking.createURL('callback');

            const authUrl = `${WEBSITE_URL}/auth/sign-in?redirectUri=${encodeURIComponent(returnUrl)}`;

            // Using dismissed condition for better transition
            const result = await WebBrowser.openAuthSessionAsync(authUrl, returnUrl);

            // If the browser session completes and returns a result with a URL
            // we handle it here as a fallback, although callback.tsx should handle it too.
            if (result.type === 'success' && result.url) {
                const parsedUrl = Linking.parse(result.url);
                const rawToken = parsedUrl.queryParams?.token;
                const token = typeof rawToken === 'string' ? rawToken : Array.isArray(rawToken) ? rawToken[0] : undefined;

                if (token) {
                    const decoded = jwtDecode<TokenPayload>(token);
                    const userData = normalizeUserData(decoded);
                    if (!userData || isExpired(userData.exp)) {
                        throw new Error('Token inválido o expirado.');
                    }

                    await SecureStore.setItemAsync(TOKEN_KEY, token);

                    // Alias the anonymous ID with the user ID on first login
                    analytics.alias(userData.id);

                    await useAuthStore.getState().initialize();
                }
            } else if (result.type === 'cancel' || result.type === 'dismiss') {
                // If it's dismissed, we wait a bit to see if we were already redirected to callback.tsx
                setTimeout(() => {
                    set({ isLoading: false });
                }, 2000);
            }
        } catch (e: unknown) {
            set({ isLoading: false, error: getErrorMessage(e, 'Error desconocido') });
        }
    },

    logout: async () => {
        try {
            set({ isLoading: true });
            await SecureStore.deleteItemAsync(TOKEN_KEY);

            // Reset PostHog user state
            analytics.reset();

            set({ token: null, user: null, isLoading: false });
        } catch (e: unknown) {
            set({ isLoading: false, error: getErrorMessage(e, 'Error desconocido') });
        }
    }
}));
