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
    reactionCount?: number;
    createdAt?: string | Date;
};

const BACKEND_URL = Config.API_URL;
const API_URL = `${BACKEND_URL}/api/notifications`;

export class AppNotificationService {
    static async getActiveNotifications(isFeed = false): Promise<AppNotification[]> {
        try {
            const version = ChangelogService.getAppVersion();
            const { user, token } = useAuthStore.getState();
            const platform = Platform.OS;

            let url = `${API_URL}?version=${version}&platform=${platform}`;
            if (user?.id) url += `&userId=${user.id}`;
            if (isFeed) url += `&feed=true`;

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

            await fetch(`${BACKEND_URL}/api/notifications/register-token`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ userId: user.id, pushToken, ...metadata })
            });
        } catch (e) {
            console.error('Failed to register push token:', e);
        }
    }

    static async getReactionCount(notificationId: string): Promise<number> {
        try {
            const countStr = await configService.get(`notif_reaction_count_${notificationId}` as any);
            return countStr ? parseInt(countStr as string, 10) : 0;
        } catch (e) {
            return 0;
        }
    }

    static async toggleReaction(notificationId: string): Promise<'added' | 'removed' | 'error'> {
        const { user, token } = useAuthStore.getState();
        if (!user?.id || !token) return 'error';

        try {
            const response = await fetch(`${BACKEND_URL}/api/notifications/react`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ notificationId, userId: user.id })
            });
            if (response.ok) {
                const data = await response.json();
                if (typeof data.reactionCount === 'number') {
                    await configService.set(`notif_reaction_count_${notificationId}` as any, data.reactionCount.toString());
                }
                return data.action; // 'added' or 'removed'
            }
            return 'error';
        } catch (e) {
            console.error('Error toggling notification reaction:', e);
            return 'error';
        }
    }
}
