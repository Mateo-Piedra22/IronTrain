import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { jwtDecode } from 'jwt-decode';
import { create } from 'zustand';

const TOKEN_KEY = 'irontrain_auth_token';
const WEBSITE_URL = 'https://irontrain.motiona.xyz';

interface UserData {
    id: string;
    email: string;
    exp?: number;
    [key: string]: any;
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

export const useAuthStore = create<AuthState>((set, get) => ({
    token: null,
    user: null,
    isLoading: true,
    error: null,

    initialize: async () => {
        try {
            set({ isLoading: true, error: null });
            const token = await SecureStore.getItemAsync(TOKEN_KEY);
            if (token) {
                const decoded = jwtDecode<UserData>(token);
                // Check if expired
                if (decoded.exp && decoded.exp * 1000 < Date.now()) {
                    await SecureStore.deleteItemAsync(TOKEN_KEY);
                    set({ token: null, user: null, isLoading: false });
                    return;
                }
                set({ token, user: decoded, isLoading: false });
            } else {
                set({ token: null, user: null, isLoading: false });
            }
        } catch (e: any) {
            console.error('Failed to initialize auth:', e);
            set({ token: null, user: null, isLoading: false, error: e.message });
        }
    },

    login: async () => {
        try {
            set({ isLoading: true, error: null });

            // Create deep linking return URL
            const returnUrl = Linking.createURL('auth/callback');

            // Construct auth URL for the website
            const authUrl = `${WEBSITE_URL}/auth/sign-in?redirectUri=${encodeURIComponent(returnUrl)}`;

            // Open browser and wait for redirect back
            const result = await WebBrowser.openAuthSessionAsync(authUrl, returnUrl);

            if (result.type === 'success' && result.url) {
                // Parse the URL to get the token query parameter
                const parsedUrl = Linking.parse(result.url);
                const token = parsedUrl.queryParams?.token as string;

                if (token) {
                    // Valid token received
                    const decoded = jwtDecode<UserData>(token);

                    await SecureStore.setItemAsync(TOKEN_KEY, token);

                    set({
                        token,
                        user: decoded,
                        isLoading: false,
                        error: null
                    });
                } else {
                    throw new Error('No se recibió un token válido.');
                }
            } else if (result.type === 'cancel' || result.type === 'dismiss') {
                set({ isLoading: false, error: 'Login cancelado.' });
            } else {
                throw new Error('Error de autenticación.');
            }
        } catch (e: any) {
            console.error('Login error:', e);
            set({ isLoading: false, error: e.message || 'Error desconocido' });
        }
    },

    logout: async () => {
        try {
            set({ isLoading: true });
            await SecureStore.deleteItemAsync(TOKEN_KEY);
            set({ token: null, user: null, isLoading: false });
        } catch (e: any) {
            console.error('Logout error:', e);
            set({ isLoading: false, error: e.message });
        }
    }
}));
