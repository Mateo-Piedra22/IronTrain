import { notify } from '@/src/utils/notify';
import * as Haptics from 'expo-haptics';

function fireSelection() {
    void Haptics.selectionAsync().catch(() => undefined);
}

function fireSuccess() {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

function fireError() {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
}

export const workspaceFeedback = {
    openHub() {
        fireSelection();
    },
    selection() {
        fireSelection();
    },
    success(title: string, message?: string) {
        fireSuccess();
        notify.success(title, message);
    },
    error(title: string, message?: string) {
        fireError();
        notify.error(title, message);
    },
};