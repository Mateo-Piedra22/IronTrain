import { Config } from '../constants/Config';
import { useAuthStore } from '../store/authStore';
import { logger } from '../utils/logger';
import { BroadcastFeedService } from './BroadcastFeedService';
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
    userReacted?: boolean | null;
    createdAt?: string | Date;
};

const BACKEND_URL = Config.API_URL;

export class AppNotificationService {
    static async getActiveNotifications(isFeed = false): Promise<AppNotification[]> {
        try {
            // Usamos el nuevo servicio unificado que ya maneja caché, filtrado y autenticación
            const response = await BroadcastFeedService.getFeed({ isFeed });

            // Filtramos solo los anuncios (announcements) para mantener compatibilidad con este servicio
            const announcements = response.items.filter(i => i.kind === 'announcement');

            return announcements.map(i => ({
                id: i.id,
                title: i.title,
                message: i.body,
                type: (i.uiType as any) || 'toast',
                displayMode: (i.displayMode as any) || 'once',
                priority: i.priority,
                metadata: { actionUrl: i.actionUrl },
                reactionCount: i.engagement.reactionCount,
                userReacted: i.engagement.userReacted,
                createdAt: i.createdAt
            }));
        } catch (e) {
            logger.captureException(e, { scope: 'AppNotificationService.getActiveNotifications' });
            return [];
        }
    }

    static async markAsSeen(id: string): Promise<void> {
        const seenStr = await configService.get('seen_notifications' as any);
        const seen = seenStr ? JSON.parse(seenStr as string) : [];
        if (!seen.includes(id)) {
            seen.push(id);
            await configService.set('seen_notifications' as any, JSON.stringify(seen));

            // Notify backend analytics
            try {
                const { token } = useAuthStore.getState();
                const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;

                fetch(`${BACKEND_URL}/api/notifications/log`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ id, action: 'seen' })
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
                body: JSON.stringify({ pushToken, ...metadata })
            });
        } catch (e) {
            logger.captureException(e, { scope: 'AppNotificationService.registerPushToken' });
        }
    }

    static async unregisterPushToken(): Promise<void> {
        const { user, token } = useAuthStore.getState();
        if (!user?.id) return;

        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            await fetch(`${BACKEND_URL}/api/notifications/register-token`, {
                method: 'DELETE',
                headers,
            });
        } catch (e) {
            logger.captureException(e, { scope: 'AppNotificationService.unregisterPushToken' });
        }
    }

    static async toggleReaction(notificationId: string): Promise<'added' | 'removed' | 'error'> {
        const { token } = useAuthStore.getState();
        if (!token) return 'error';

        try {
            const response = await fetch(`${BACKEND_URL}/api/notifications/react`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ notificationId })
            });
            if (response.ok) {
                const data = await response.json();
                return data.action; // 'added' or 'removed'
            }
            return 'error';
        } catch (e) {
            logger.captureException(e, { scope: 'AppNotificationService.toggleReaction' });
            return 'error';
        }
    }
}
