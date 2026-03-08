import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { Config } from '../constants/Config';
import { useAuthStore } from '../store/authStore';
import { configService } from './ConfigService';
import { dbService } from './DatabaseService';

export type ChangelogRelease = {
    id?: string;
    version: string;
    date: string | null;
    unreleased?: boolean;
    items: string[];
    metadata?: any;
    reactionCount?: number;
};

type ChangelogPayload = {
    generatedAt: string;
    source: string;
    releases: ChangelogRelease[];
};

const BACKEND_URL = Config.API_URL;
const CACHE_FILE = `${FileSystem.cacheDirectory ?? ''}changelog_cache.json`;
const API_URL = `${BACKEND_URL}/api/changelogs`;

let cached: ChangelogPayload | null = null;

async function loadRemote(): Promise<ChangelogPayload | null> {
    try {
        const response = await fetch(`${API_URL}?includeUnreleased=1`);
        if (!response.ok) return null;
        const data = await response.json() as ChangelogPayload;

        // Save to local cache
        if (FileSystem.cacheDirectory) {
            await FileSystem.writeAsStringAsync(CACHE_FILE, JSON.stringify(data));
        }
        cached = data;
        return data;
    } catch (e) {
        console.warn('Failed to fetch remote changelog:', e);
        return null;
    }
}

async function loadLocal(): Promise<ChangelogPayload> {
    if (cached) return cached;

    try {
        // Try file cache first
        if (FileSystem.cacheDirectory) {
            const info = await FileSystem.getInfoAsync(CACHE_FILE);
            if (info.exists) {
                const content = await FileSystem.readAsStringAsync(CACHE_FILE);
                cached = JSON.parse(content);
                return cached!;
            }
        }
    } catch (e) {
        console.warn('Failed to load local changelog cache:', e);
    }

    // Fallback to bundled JSON
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const data = require('../changelog.generated.json') as ChangelogPayload;
        cached = data;
        return data;
    } catch (e) {
        console.error('CRITICAL: No changelog source found', e);
        return { generatedAt: '', source: 'none', releases: [] };
    }
}

export class ChangelogService {
    static async sync(): Promise<void> {
        await loadRemote();
    }

    private static isUnreleased(r: ChangelogRelease): boolean {
        if (r.unreleased === true) return true;
        const d = r.date;
        return typeof d === 'string' && d.trim().toLowerCase() === 'unreleased';
    }

    static getAppVersion(): string {
        const v = (Constants.expoConfig as any)?.version;
        return typeof v === 'string' && v.length > 0 ? v : '0.0.0';
    }

    static async getAllReleases(): Promise<ChangelogRelease[]> {
        const payload = await loadLocal();
        return payload.releases || [];
    }

    static async getReleases(options: { includeUnreleased?: boolean } = {}): Promise<ChangelogRelease[]> {
        const includeUnreleased = options.includeUnreleased === true;
        const all = await this.getAllReleases();
        if (includeUnreleased) return all;
        return all.filter((r) => r.date !== null && !this.isUnreleased(r));
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

    /**
     * Logic to detect if we should show the "What's New" modal.
     */
    static async checkShouldShowWhatsNew(): Promise<ChangelogRelease | null> {
        try {
            const currentVersion = this.getAppVersion();
            const lastSeenVersion = await configService.get('last_seen_changelog_version' as any);

            if (lastSeenVersion !== currentVersion) {
                const release = await this.getInstalledRelease();
                if (release) return release;
            }
        } catch (e) {
            console.error('Error checking whats new:', e);
        }
        return null;
    }

    static async markWhatsNewAsSeen(): Promise<void> {
        await configService.set('last_seen_changelog_version' as any, this.getAppVersion());
    }

    static async getReactionCount(version: string): Promise<number> {
        try {
            // Get local count
            const countRes = await dbService.getFirst<{ count: number }>(
                'SELECT count(*) as count FROM changelog_reactions WHERE changelog_id = ? AND deleted_at IS NULL',
                [version]
            );
            return countRes?.count || 0;
        } catch (e) {
            return 0;
        }
    }

    static async toggleReaction(version: string): Promise<'added' | 'removed' | 'error'> {
        const { user } = useAuthStore.getState();
        if (!user?.id) return 'error';

        try {
            const now = Date.now();
            const existing = await dbService.getFirst<{ id: string }>(
                'SELECT id FROM changelog_reactions WHERE changelog_id = ? AND user_id = ? AND deleted_at IS NULL',
                [version, user.id]
            );

            if (existing) {
                await dbService.run(
                    'UPDATE changelog_reactions SET deleted_at = ?, updated_at = ? WHERE id = ?',
                    [now, now, existing.id]
                );
                await dbService.queueSyncMutation('changelog_reactions', existing.id, 'DELETE');
                return 'removed';
            } else {
                const id = `${version}-${user.id}`;
                // Check if it existed as deleted
                const wasDeleted = await dbService.getFirst<{ id: string }>(
                    'SELECT id FROM changelog_reactions WHERE id = ?',
                    [id]
                );

                if (wasDeleted) {
                    await dbService.run(
                        'UPDATE changelog_reactions SET deleted_at = NULL, updated_at = ? WHERE id = ?',
                        [now, id]
                    );
                    await dbService.queueSyncMutation('changelog_reactions', id, 'UPDATE', { id, deleted_at: null, updated_at: now });
                } else {
                    await dbService.run(
                        'INSERT INTO changelog_reactions (id, changelog_id, user_id, type, updated_at) VALUES (?, ?, ?, ?, ?)',
                        [id, version, user.id, 'kudos', now]
                    );
                    await dbService.queueSyncMutation('changelog_reactions', id, 'INSERT', {
                        id, changelog_id: version, user_id: user.id, type: 'kudos', updated_at: now
                    });
                }
                return 'added';
            }
        } catch (e) {
            console.error('Error toggling changelog reaction:', e);
            return 'error';
        }
    }
}

