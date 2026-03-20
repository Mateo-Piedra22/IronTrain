import * as FileSystem from 'expo-file-system/legacy';
import { useAuthStore } from '../store/authStore';
import { getAppVersion } from '../utils/appInfo';
import { logger } from '../utils/logger';
import { BroadcastFeedService, type BroadcastItem } from './BroadcastFeedService';
import { configService } from './ConfigService';

export type ChangelogRelease = {
    id?: string;
    version: string;
    date: string | null;
    unreleased?: boolean;
    items: string[];
    metadata?: any;
    reactionCount?: number;
    userReacted?: boolean | null;
};

const CACHE_FILE = `${FileSystem.cacheDirectory ?? ''}changelog_cache.json`;

// Fallback estático para primer inicio sin internet
const STATIC_CHANGELOG = require('../changelog.generated.json');

export class ChangelogService {
    static async sync(): Promise<void> {
        // Al llamar a getFeed con includeUnreleased, ya estamos sincronizando changelogs
        await BroadcastFeedService.getFeed({ includeUnreleased: true });
    }

    static getAppVersion(): string {
        return getAppVersion();
    }

    private static mapToRelease(i: BroadcastItem): ChangelogRelease {
        return {
            id: i.id,
            version: i.targeting.version || '0.0.0',
            date: i.createdAt,
            unreleased: i.lifecycle.isActive === false, // Opcional: lógica de negocio
            items: i.body.split('\n').map(s => s.trim()).filter(s => s.length > 0),
            metadata: { actionUrl: i.actionUrl },
            reactionCount: i.engagement.reactionCount,
            userReacted: i.engagement.userReacted
        };
    }

    static async getAllReleases(): Promise<ChangelogRelease[]> {
        const feed = await BroadcastFeedService.getFeed({ includeUnreleased: true });

        // Si el feed está vacío (ej: primer inicio offline), usamos el fallback estático
        if (feed.items.length === 0 && STATIC_CHANGELOG?.releases) {
            return STATIC_CHANGELOG.releases;
        }

        return feed.items
            .filter(i => i.kind === 'changelog')
            .map(this.mapToRelease);
    }

    static async getReleases(options: { includeUnreleased?: boolean } = {}): Promise<ChangelogRelease[]> {
        const includeUnreleased = options.includeUnreleased === true;
        const all = await this.getAllReleases();
        if (includeUnreleased) return all;
        return all.filter((r) => r.date !== null && r.unreleased !== true);
    }

    static async getLatestRelease(): Promise<ChangelogRelease | null> {
        const released = await this.getReleases();
        return released.length > 0 ? released[0] : null;
    }

    static async getInstalledRelease(): Promise<ChangelogRelease | null> {
        const v = this.getAppVersion();
        const all = await this.getAllReleases();
        return all.find((r) => String(r.version).trim() === String(v).trim()) ?? null;
    }

    static async checkShouldShowWhatsNew(): Promise<ChangelogRelease | null> {
        try {
            const currentVersion = this.getAppVersion();
            const lastSeenVersion = await configService.get('last_seen_changelog_version' as any);

            if (lastSeenVersion !== currentVersion) {
                const release = await this.getInstalledRelease();
                if (release) return release;
            }
        } catch (e) {
            logger.captureException(e, { scope: 'ChangelogService.checkShouldShowWhatsNew' });
        }
        return null;
    }

    static async markWhatsNewAsSeen(): Promise<void> {
        await configService.set('last_seen_changelog_version' as any, this.getAppVersion());
    }

    static async toggleReaction(version: string): Promise<'added' | 'removed' | 'error'> {
        // Nota: El backend ahora maneja esto a través de /api/changelogs/[id]/react
        // Pero para mantener compatibilidad con el código existente, llamamos al nuevo engagement service
        // O lo implementamos aquí directamente si es necesario.
        // Dado que ya tenemos BroadcastEngagementService en la web, pero en la app lo estamos unificando.

        const { token } = useAuthStore.getState();
        if (!token) return 'error';

        try {
            // Buscamos el ID real del changelog para esa versión en el feed
            const feed = await this.getAllReleases();
            const rel = feed.find(r => r.version === version);
            if (!rel?.id) return 'error';

            const { Config } = require('../constants/Config');
            const response = await fetch(`${Config.API_URL}/api/changelogs/${rel.id}/react`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                const result = data.action || data.status;
                return result === 'added' || result === 'removed' ? result : 'error';
            }
            return 'error';
        } catch (e) {
            logger.captureException(e, { scope: 'ChangelogService.toggleReaction' });
            return 'error';
        }
    }
}
