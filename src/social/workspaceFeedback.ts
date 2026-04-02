import { notify } from '@/src/utils/notify';
import { triggerSensoryFeedback } from '@/src/utils/sensoryFeedback';

function fireSelection() {
    void triggerSensoryFeedback('selection');
}

function fireSuccess() {
    void triggerSensoryFeedback('success');
}

function fireError() {
    void triggerSensoryFeedback('error');
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