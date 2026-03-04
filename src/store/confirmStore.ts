import { create } from 'zustand';

type ModalVariant = 'info' | 'warning' | 'error' | 'success' | 'destructive';

interface ConfirmButton {
    label: string;
    onPress?: () => void;
    variant?: 'solid' | 'outline' | 'ghost';
    destructive?: boolean;
}

interface ConfirmConfig {
    title: string;
    message?: string;
    variant?: ModalVariant;
    buttons?: ConfirmButton[];
}

interface ConfirmStoreState {
    visible: boolean;
    config: ConfirmConfig;
    show: (config: ConfirmConfig) => void;
    hide: () => void;
}

/**
 * Global confirm modal store — call `useConfirmStore.getState().show({...})`
 * from anywhere to display the in-app confirm modal.
 *
 * This is a drop-in replacement for `Alert.alert`.
 */
export const useConfirmStore = create<ConfirmStoreState>((set) => ({
    visible: false,
    config: { title: '' },
    show: (config) => set({ visible: true, config }),
    hide: () => set({ visible: false }),
}));

/**
 * Imperative helper — use instead of `Alert.alert`.
 *
 * @example
 * confirm.info('Entrenamiento finalizado', 'Este entrenamiento está finalizado.');
 * confirm.ask('¿Eliminar?', 'Se eliminará el ejercicio.', () => { ... });
 * confirm.destructive('¿Eliminar?', 'Esta acción no se puede deshacer.', () => { ... });
 */
export const confirm = {
    /**
     * Show an info-only modal (single "Entendido" button).
     */
    info: (title: string, message?: string) => {
        const { show, hide } = useConfirmStore.getState();
        show({
            title,
            message,
            variant: 'info',
            buttons: [{ label: 'Entendido', onPress: hide, variant: 'solid' }],
        });
    },

    /**
     * Show a warning modal (single "Entendido" button).
     */
    warning: (title: string, message?: string) => {
        const { show, hide } = useConfirmStore.getState();
        show({
            title,
            message,
            variant: 'warning',
            buttons: [{ label: 'Entendido', onPress: hide, variant: 'solid' }],
        });
    },

    /**
     * Show an error modal (single "Entendido" button).
     */
    error: (title: string, message?: string) => {
        const { show, hide } = useConfirmStore.getState();
        show({
            title,
            message,
            variant: 'error',
            buttons: [{ label: 'Entendido', onPress: hide, variant: 'solid' }],
        });
    },

    /**
     * Show a success modal.
     */
    success: (title: string, message?: string) => {
        const { show, hide } = useConfirmStore.getState();
        show({
            title,
            message,
            variant: 'success',
            buttons: [{ label: 'Entendido', onPress: hide, variant: 'solid' }],
        });
    },

    /**
     * Confirmation dialog — Cancel + Confirm.
     */
    ask: (title: string, message: string, onConfirm: () => void, confirmLabel = 'Confirmar') => {
        const { show, hide } = useConfirmStore.getState();
        show({
            title,
            message,
            variant: 'info',
            buttons: [
                { label: 'Cancelar', onPress: hide, variant: 'ghost' },
                { label: confirmLabel, onPress: () => { hide(); onConfirm(); }, variant: 'solid' },
            ],
        });
    },

    /**
     * Destructive confirmation — Cancel + Red destructive button.
     */
    destructive: (title: string, message: string, onConfirm: () => void, confirmLabel = 'Eliminar') => {
        const { show, hide } = useConfirmStore.getState();
        show({
            title,
            message,
            variant: 'destructive',
            buttons: [
                { label: 'Cancelar', onPress: hide, variant: 'ghost' },
                { label: confirmLabel, onPress: () => { hide(); onConfirm(); }, destructive: true },
            ],
        });
    },

    /**
     * Custom modal — full control.
     */
    custom: (config: ConfirmConfig) => {
        useConfirmStore.getState().show(config);
    },

    /** Hide the modal programmatically. */
    hide: () => {
        useConfirmStore.getState().hide();
    },
};
