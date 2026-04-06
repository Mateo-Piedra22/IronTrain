import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';
export type BannerType = 'info' | 'warning' | 'error' | 'success';

export interface ToastMessage {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration: number;
    createdAtMs: number;
    expiresAtMs: number;
    onPress?: () => void;
}

export interface BannerMessage {
    id: string;
    type: BannerType;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
    dismissible: boolean;
}

export interface NotificationState {
    toasts: ToastMessage[];
    globalBanner: BannerMessage | null;

    addToast: (toast: Omit<ToastMessage, 'id' | 'duration' | 'createdAtMs' | 'expiresAtMs'> & { duration?: number }) => string;
    removeToast: (id: string) => void;
    sweepExpiredToasts: () => void;

    setGlobalBanner: (banner: Omit<BannerMessage, 'id' | 'dismissible'> & { dismissible?: boolean } | null) => void;
    clearGlobalBanner: () => void;
    clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
    toasts: [],
    globalBanner: null,

    addToast: (toast) => {
        const id = Math.random().toString(36).substring(2, 9);
        const duration = toast.duration ?? 3000;
        const nowMs = Date.now();
        const effectiveDuration = duration > 0 ? duration : 60_000;
        const newToast: ToastMessage = { ...toast, id, duration, createdAtMs: nowMs, expiresAtMs: nowMs + effectiveDuration };

        set((state) => {
            // Maximum 3 toasts at a time, FIFO
            const updatedToasts = [...state.toasts, newToast];
            if (updatedToasts.length > 3) {
                updatedToasts.shift();
            }
            return { toasts: updatedToasts };
        });

        // Auto remove
        if (duration > 0) {
            setTimeout(() => {
                get().removeToast(id);
            }, duration);
        }

        return id;
    },

    removeToast: (id) => {
        set((state) => {
            const filteredToasts = state.toasts.filter((t) => t.id !== id);
            if (filteredToasts.length === state.toasts.length) {
                return state;
            }
            return { toasts: filteredToasts };
        });
    },

    sweepExpiredToasts: () => {
        const nowMs = Date.now();
        set((state) => {
            const filteredToasts = state.toasts.filter((t) => t.expiresAtMs > nowMs);
            if (filteredToasts.length === state.toasts.length) {
                return state;
            }
            return { toasts: filteredToasts };
        });
    },

    setGlobalBanner: (banner) => {
        if (!banner) {
            set({ globalBanner: null });
            return;
        }
        set({
            globalBanner: {
                ...banner,
                id: Math.random().toString(36).substring(2, 9),
                dismissible: banner.dismissible ?? true
            }
        });
    },

    clearGlobalBanner: () => {
        set({ globalBanner: null });
    },
    clearAll: () => {
        set({ toasts: [], globalBanner: null });
    },
}));
