import { triggerSensoryFeedback } from '../utils/sensoryFeedback';

export const feedbackSelection = () => {
    void triggerSensoryFeedback('selection');
};

export const feedbackSuccess = () => {
    void triggerSensoryFeedback('success');
};

export const feedbackWarning = () => {
    void triggerSensoryFeedback('warning');
};

export const feedbackError = () => {
    void triggerSensoryFeedback('error');
};

export const feedbackSoftImpact = () => {
    void triggerSensoryFeedback('tapLight');
};
