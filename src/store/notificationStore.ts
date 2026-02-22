import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';
export type BannerType = 'info' | 'warning' | 'error' | 'success';

export interface ToastMessage {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration: number;
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

    addToast: (toast: Omit<ToastMessage, 'id' | 'duration'> & { duration?: number }) => string;
    removeToast: (id: string) => void;

    setGlobalBanner: (banner: Omit<BannerMessage, 'id' | 'dismissible'> & { dismissible?: boolean } | null) => void;
    clearGlobalBanner: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
    toasts: [],
    globalBanner: null,

    addToast: (toast) => {
        const id = Math.random().toString(36).substring(2, 9);
        const duration = toast.duration ?? 3000;
        const newToast = { ...toast, id, duration };

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
        set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
        }));
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
}));
