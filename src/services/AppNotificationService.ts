import { Platform } from 'react-native';
import { Config } from '../constants/Config';
import { useAuthStore } from '../store/authStore';
import { ChangelogService } from './ChangelogService';
import { configService } from './ConfigService';

export type AppNotification = {
    id: string;
    title: string;
    message: string;
    type: 'toast' | 'modal' | 'system';
    displayMode: 'once' | 'always' | 'until_closed';
    priority: number;
    metadata?: any;
};

const BACKEND_URL = Config.API_URL;
const API_URL = `${BACKEND_URL}/api/notifications`;

export class AppNotificationService {
    static async getActiveNotifications(): Promise<AppNotification[]> {
        try {
            const version = ChangelogService.getAppVersion();
            const { user, token } = useAuthStore.getState();
            const platform = Platform.OS;

            let url = `${API_URL}?version=${version}&platform=${platform}`;
            if (user?.id) url += `&userId=${user.id}`;

            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(url, { headers });
            if (!response.ok) return [];
            const data = await response.json();
            return data.notifications || [];
        } catch (e) {
            console.warn('Failed to fetch notifications:', e);
            return [];
        }
    }

    static async markAsSeen(id: string): Promise<void> {
        const userId = useAuthStore.getState().user?.id;
        const seenStr = await configService.get('seen_notifications' as any);
        const seen = seenStr ? JSON.parse(seenStr as string) : [];
        if (!seen.includes(id)) {
            seen.push(id);
            await configService.set('seen_notifications' as any, JSON.stringify(seen));

            // Notify backend analytics
            try {
                const { user, token } = useAuthStore.getState();
                const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;

                fetch(`${BACKEND_URL}/api/notifications/log`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ id, action: 'seen', userId: user?.id })
                });
            } catch { }
        }
    }

    static async isSeen(id: string): Promise<boolean> {
        const seenStr = await configService.get('seen_notifications' as any);
        const seen = seenStr ? JSON.parse(seenStr as string) : [];
        return seen.includes(id);
    }

    static async registerPushToken(pushToken: string, metadata?: { platform?: string; tokenType?: string }): Promise<void> {
        const { user, token } = useAuthStore.getState();
        if (!user?.id || !pushToken) return;

        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`${BACKEND_URL}/api/notifications/register-token`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ userId: user.id, pushToken, ...metadata })
            });
        } catch (e) {
            console.error('Failed to register push token:', e);
        }
    }
}

