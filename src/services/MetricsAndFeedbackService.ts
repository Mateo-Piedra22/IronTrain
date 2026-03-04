import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://irontrain.motiona.xyz';
const INSTALL_TRACKED_KEY = 'irontrain_install_tracked';

export class MetricsAndFeedbackService {
    static async getToken(): Promise<string | null> {
        return await SecureStore.getItemAsync('irontrain_auth_token');
    }

    static async trackInstallIfNeeded(): Promise<void> {
        try {
            const hasTracked = await SecureStore.getItemAsync(INSTALL_TRACKED_KEY);
            if (hasTracked) return;

            // Generate a stable installation ID for analytics
            let installId = await SecureStore.getItemAsync('irontrain_install_id');
            if (!installId) {
                installId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                await SecureStore.setItemAsync('irontrain_install_id', installId);
            }

            const metadata = {
                modelName: Device.modelName,
                osName: Device.osName,
                osVersion: Device.osVersion,
            };

            const body = {
                id: installId,
                platform: Platform.OS,
                version: Application.nativeApplicationVersion || '1.0.0',
                metadata,
            };

            const res = await fetch(`${API_URL}/api/metrics/install`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                await SecureStore.setItemAsync(INSTALL_TRACKED_KEY, 'true');
            }
        } catch (e) {
            console.warn('[Metrics] Failed to track install (Offline or block)', e);
        }
    }

    static async submitFeedback(type: 'bug' | 'feature_request' | 'review' | 'other', message: string): Promise<boolean> {
        try {
            const token = await this.getToken();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const metadata = {
                appVersion: Application.nativeApplicationVersion || '1.0.0',
                platform: Platform.OS,
                osVersion: Device.osVersion,
            };

            const res = await fetch(`${API_URL}/api/feedback`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ type, message, metadata }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Server Error');

            return data.success;
        } catch (e) {
            console.error('[Feedback] Submit error:', e);
            throw e;
        }
    }
}
