import { MetricsAndFeedbackService } from '../MetricsAndFeedbackService';

jest.mock('expo-secure-store');
jest.mock('expo-application', () => ({
    nativeApplicationVersion: '1.0.0',
    nativeBuildVersion: '1'
}));
jest.mock('expo-device', () => ({
    osVersion: '15.0',
    modelName: 'iPhone 13'
}));
jest.mock('../../utils/analytics', () => ({
    posthog: {
        capture: jest.fn()
    }
}));

describe('MetricsAndFeedbackService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should capture feedback in posthog', async () => {
        const { posthog } = require('../../utils/analytics');

        const result = await MetricsAndFeedbackService.submitFeedback('bug', 'Test message');

        expect(result).toBe(true);
        expect(posthog.capture).toHaveBeenCalledWith('user_feedback', expect.objectContaining({
            message: 'Test message',
            feedbackType: 'bug',
            platform: 'ios' // default in jest-expo
        }));
    });
});
