import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { logger } from '../utils/logger';

/**
 * Modernized Service for User Feedback.
 * Integrated with PostHog for centralized tracking.
 */
export class MetricsAndFeedbackService {
    /**
     * Submits user feedback directly to PostHog.
     * This avoids maintaining a custom feedback table in the database.
     */
    static async submitFeedback(
        type: 'bug' | 'feature_request' | 'review' | 'other',
        message: string,
        extras?: { subject?: string; contactEmail?: string; context?: string }
    ): Promise<boolean> {
        try {
            const metadata = {
                appVersion: Application.nativeApplicationVersion || '1.0.0',
                appBuild: Application.nativeBuildVersion || '0',
                platform: Platform.OS,
                osVersion: Device.osVersion,
                deviceModel: Device.modelName || null,
                context: extras?.context || 'feedback_screen',
                subject: extras?.subject || null,
                contactEmail: extras?.contactEmail || null,
                feedbackType: type,
            };

            // Capture event in PostHog
            const { posthog } = require('../utils/analytics');
            posthog.capture('user_feedback', {
                message,
                ...metadata
            });

            return true;
        } catch (e) {
            logger.captureException(e, { scope: 'MetricsAndFeedbackService.submitFeedback' });
            throw e;
        }
    }
}
