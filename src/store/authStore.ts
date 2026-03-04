import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { jwtDecode } from 'jwt-decode';
import { create } from 'zustand';

const TOKEN_KEY = 'irontrain_auth_token';
const WEBSITE_URL = 'https://irontrain.motiona.xyz';

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

            const returnUrl = Linking.createURL('auth/callback');

            const authUrl = `${WEBSITE_URL}/auth/sign-in?redirectUri=${encodeURIComponent(returnUrl)}`;

            const result = await WebBrowser.openAuthSessionAsync(authUrl, returnUrl);

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

                    set({
                        token,
                        user: userData,
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
        } catch (e: unknown) {
            set({ isLoading: false, error: getErrorMessage(e, 'Error desconocido') });
        }
    },

    logout: async () => {
        try {
            set({ isLoading: true });
            await SecureStore.deleteItemAsync(TOKEN_KEY);
            set({ token: null, user: null, isLoading: false });
        } catch (e: unknown) {
            set({ isLoading: false, error: getErrorMessage(e, 'Error desconocido') });
        }
    }
}));
