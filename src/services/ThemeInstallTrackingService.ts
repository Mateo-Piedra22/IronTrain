import * as analytics from '../utils/analytics';
import { logger } from '../utils/logger';
import { configService } from './ConfigService';
import { SocialApiError, SocialService } from './SocialService';

type ThemeInstallQueueItem = {
    themeId: string;
    appliedLight: boolean;
    appliedDark: boolean;
    source?: string;
    attempts: number;
    queuedAtMs: number;
    lastAttemptAtMs: number;
};

const QUEUE_STORAGE_KEY = 'theme_install_queue_v1';
const MAX_QUEUE_ITEMS = 50;
const MAX_ATTEMPTS = 3;

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const normalizeQueue = (value: unknown): ThemeInstallQueueItem[] => {
    if (!Array.isArray(value)) return [];

    const normalized: ThemeInstallQueueItem[] = [];
    for (const row of value) {
        if (!isRecord(row)) continue;
        const themeId = typeof row.themeId === 'string' ? row.themeId.trim() : '';
        if (!themeId) continue;

        normalized.push({
            themeId,
            appliedLight: row.appliedLight === true,
            appliedDark: row.appliedDark === true,
            source: typeof row.source === 'string' ? row.source : undefined,
            attempts: typeof row.attempts === 'number' && Number.isFinite(row.attempts) ? Math.max(0, Math.floor(row.attempts)) : 0,
            queuedAtMs: typeof row.queuedAtMs === 'number' && Number.isFinite(row.queuedAtMs) ? row.queuedAtMs : Date.now(),
            lastAttemptAtMs: typeof row.lastAttemptAtMs === 'number' && Number.isFinite(row.lastAttemptAtMs) ? row.lastAttemptAtMs : 0,
        });
    }

    if (normalized.length <= MAX_QUEUE_ITEMS) return normalized;
    return normalized.slice(normalized.length - MAX_QUEUE_ITEMS);
};

export class ThemeInstallTrackingService {
    private static flushPromise: Promise<void> | null = null;

    private static getQueue(): ThemeInstallQueueItem[] {
        const current = configService.getThemeSetting<unknown>(QUEUE_STORAGE_KEY, null);
        return normalizeQueue(current);
    }

    private static async setQueue(queue: ThemeInstallQueueItem[]): Promise<void> {
        const bounded = queue.length <= MAX_QUEUE_ITEMS ? queue : queue.slice(queue.length - MAX_QUEUE_ITEMS);
        await configService.setThemeSetting(QUEUE_STORAGE_KEY, bounded);
    }

    private static async enqueue(item: Omit<ThemeInstallQueueItem, 'attempts' | 'queuedAtMs' | 'lastAttemptAtMs'>): Promise<void> {
        const queue = this.getQueue();
        queue.push({
            ...item,
            attempts: 0,
            queuedAtMs: Date.now(),
            lastAttemptAtMs: 0,
        });
        await this.setQueue(queue);
    }

    public static async reportInstall(
        themeId: string,
        options: { appliedLight?: boolean; appliedDark?: boolean; source?: string },
    ): Promise<void> {
        const normalizedThemeId = themeId.trim();
        if (!normalizedThemeId) return;

        const appliedLight = options.appliedLight === true;
        const appliedDark = options.appliedDark === true;

        if (!appliedLight && !appliedDark) return;

        this.flushPending();

        try {
            await SocialService.installMarketplaceTheme(normalizedThemeId, {
                appliedLight,
                appliedDark,
            });

            analytics.capture('theme_install_reported', {
                source: options.source ?? 'unknown',
                themeId: normalizedThemeId,
                appliedLight,
                appliedDark,
            });
        } catch (error) {
            logger.captureException(error, {
                scope: 'ThemeInstallTrackingService.reportInstall',
                themeId: normalizedThemeId,
            });

            await this.enqueue({
                themeId: normalizedThemeId,
                appliedLight,
                appliedDark,
                source: options.source,
            });

            analytics.capture('theme_install_report_failed', {
                source: options.source ?? 'unknown',
                themeId: normalizedThemeId,
                appliedLight,
                appliedDark,
                error: error instanceof Error ? error.message : 'unknown_error',
            });
        }
    }

    public static flushPending(): Promise<void> {
        if (this.flushPromise) return this.flushPromise;

        this.flushPromise = (async () => {
            const queue = this.getQueue();
            if (queue.length === 0) return;

            const nextQueue: ThemeInstallQueueItem[] = [];

            for (const item of queue) {
                if (item.attempts >= MAX_ATTEMPTS) continue;

                try {
                    await SocialService.installMarketplaceTheme(item.themeId, {
                        appliedLight: item.appliedLight,
                        appliedDark: item.appliedDark,
                    });
                } catch (error) {
                    const isRetryable = error instanceof SocialApiError
                        ? error.status === 429 || error.status >= 500
                        : true;

                    if (!isRetryable) continue;

                    nextQueue.push({
                        ...item,
                        attempts: item.attempts + 1,
                        lastAttemptAtMs: Date.now(),
                    });
                }
            }

            await this.setQueue(nextQueue);
        })()
            .catch((error) => {
                logger.captureException(error, { scope: 'ThemeInstallTrackingService.flushPending' });
            })
            .finally(() => {
                this.flushPromise = null;
            });

        return this.flushPromise;
    }
}
