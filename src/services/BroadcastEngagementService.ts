import { Config } from '../constants/Config';
import { useAuthStore } from '../store/authStore';

export class BroadcastEngagementService {
    static async toggleAnnouncementReaction(notificationId: string): Promise<'added' | 'removed' | 'error'> {
        const { token } = useAuthStore.getState();
        if (!token) return 'error';

        try {
            const response = await fetch(`${Config.API_URL}/api/notifications/react`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ notificationId }),
            });

            if (!response.ok) return 'error';
            const data = (await response.json()) as { action?: 'added' | 'removed' };
            return data.action === 'added' || data.action === 'removed' ? data.action : 'error';
        } catch {
            return 'error';
        }
    }

    static async toggleChangelogReaction(changelogId: string): Promise<'added' | 'removed' | 'error'> {
        const { token } = useAuthStore.getState();
        if (!token) return 'error';

        try {
            const response = await fetch(`${Config.API_URL}/api/changelogs/${encodeURIComponent(changelogId)}/react`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ type: 'kudos' }),
            });

            if (!response.ok) return 'error';
            const data = (await response.json()) as { status?: 'added' | 'removed' };
            return data.status === 'added' || data.status === 'removed' ? data.status : 'error';
        } catch {
            return 'error';
        }
    }
}
