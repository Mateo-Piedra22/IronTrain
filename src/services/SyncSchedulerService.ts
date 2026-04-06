import NetInfo from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { logger } from '../utils/logger';
import { isOptimizationFlagEnabled } from '../utils/optimizationFlags';
import { captureOptimizationMetric } from '../utils/optimizationMetrics';
import { dataEventService } from './DataEventService';
import { dbService } from './DatabaseService';
import { syncService } from './SyncService';

type SyncReason = 'queue' | 'resume' | 'net_reconnect' | 'periodic' | 'manual';

type Timer = ReturnType<typeof setTimeout>;

type SyncSchedulerOptions = {
    debounceMs: number;
    minIntervalMs: number;
    resumeDelayMs: number;
    periodicMs: number;
    periodicMaxStaleMs: number;
    maxBackoffMs: number;
    remoteHintCooldownMs: number;
};

const DEFAULT_OPTIONS: SyncSchedulerOptions = {
    debounceMs: 5000,
    minIntervalMs: 10_000,
    resumeDelayMs: 2000,
    periodicMs: 5 * 60_000,
    periodicMaxStaleMs: 30 * 60_000,
    maxBackoffMs: 10 * 60_000,
    remoteHintCooldownMs: 30_000,
};

export class SyncSchedulerService {
    private initialized = false;
    private currentAppState: AppStateStatus = AppState.currentState;

    private appStateSubscription: { remove: () => void } | null = null;

    private debounceTimer: Timer | null = null;
    private backoffTimer: Timer | null = null;
    private periodicTimer: ReturnType<typeof setInterval> | null = null;

    private lastSuccessAt = 0;
    private lastAttemptAt = 0;
    private backoffMs = 0;
    private lastRemoteHintAt = 0;
    private readonly pendingReasons = new Set<SyncReason>();

    private unsubscribeNetInfo: (() => void) | null = null;
    private unsubscribeQueue: (() => void) | null = null;
    private unsubscribeAuth: (() => void) | null = null;
    private lastToken: string | null = null;

    private readonly options: SyncSchedulerOptions;

    public constructor(options?: Partial<SyncSchedulerOptions>) {
        this.options = { ...DEFAULT_OPTIONS, ...(options ?? {}) };
    }

    public init(): void {
        if (this.initialized) return;
        this.initialized = true;

        captureOptimizationMetric('opt_sync_scheduler_init', {
            reason: 'service_init',
            scheduler_v2_enabled: isOptimizationFlagEnabled('syncSchedulerV2'),
            periodic_ms: this.options.periodicMs,
            min_interval_ms: this.options.minIntervalMs,
        }, 2000);

        this.unsubscribeQueue = dataEventService.subscribe('SYNC_QUEUE_ENQUEUED', () => {
            this.requestSync('queue');
        });

        this.unsubscribeAuth = useAuthStore.subscribe((state) => {
            const token = state.token;
            const transitionedToAuth = token && !this.lastToken;
            this.lastToken = token;

            if (transitionedToAuth) {
                this.requestSync('manual');
            }
        });
        this.lastToken = useAuthStore.getState().token;

        this.unsubscribeNetInfo = NetInfo.addEventListener((state) => {
            if (state.isConnected && state.isInternetReachable) {
                this.requestSync('net_reconnect');
            }
        });

        this.appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
            if (this.currentAppState.match(/inactive|background/) && nextAppState === 'active') {
                setTimeout(() => this.requestSync('resume'), this.options.resumeDelayMs);
            }
            this.currentAppState = nextAppState;
        });

        if (this.periodicTimer) clearInterval(this.periodicTimer);
        this.periodicTimer = setInterval(() => {
            if (this.currentAppState !== 'active') return;
            this.requestSync('periodic');
        }, this.options.periodicMs);

        // Proactive check on init: if logged in, attempt a sync
        if (useAuthStore.getState().token) {
            this.requestSync('resume');
        }
    }

    public dispose(): void {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        if (this.backoffTimer) clearTimeout(this.backoffTimer);
        if (this.periodicTimer) clearInterval(this.periodicTimer);
        this.debounceTimer = null;
        this.backoffTimer = null;
        this.periodicTimer = null;

        if (this.unsubscribeNetInfo) this.unsubscribeNetInfo();
        if (this.unsubscribeQueue) this.unsubscribeQueue();
        if (this.unsubscribeAuth) this.unsubscribeAuth();
        this.unsubscribeNetInfo = null;
        this.unsubscribeQueue = null;
        this.unsubscribeAuth = null;

        if (this.appStateSubscription) this.appStateSubscription.remove();
        this.appStateSubscription = null;

        this.initialized = false;
    }

    public requestSync(reason: SyncReason): void {
        if (!this.initialized) return;

        this.pendingReasons.add(reason);

        const now = Date.now();
        const sinceAttempt = now - this.lastAttemptAt;
        const bypassMinInterval = ['manual', 'net_reconnect'].includes(reason);
        const minIntervalMs = this.resolveMinIntervalMs(reason);

        let waitMs = this.options.debounceMs;
        if (sinceAttempt < minIntervalMs && !bypassMinInterval) {
            waitMs = Math.max(waitMs, minIntervalMs - sinceAttempt);
        }

        if (this.debounceTimer) clearTimeout(this.debounceTimer);

        captureOptimizationMetric('opt_sync_scheduler_request', {
            reason,
            since_attempt_ms: sinceAttempt,
            wait_ms: waitMs,
            bypass_min_interval: bypassMinInterval,
        });

        this.debounceTimer = setTimeout(() => {
            this.debounceTimer = null;
            this.pendingReasons.delete(reason);
            this.run(reason).catch(() => {
                return;
            });
        }, waitMs);
    }

    public async syncNow(): Promise<void> {
        if (!this.initialized) return;
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        if (this.backoffTimer) {
            clearTimeout(this.backoffTimer);
            this.backoffTimer = null;
        }
        await this.run('manual');
    }

    public async requestRemoteHintSync(): Promise<void> {
        if (!this.initialized) return;
        if (!useAuthStore.getState().token) return;

        const now = Date.now();
        const sinceLastHint = now - this.lastRemoteHintAt;
        if (sinceLastHint < this.options.remoteHintCooldownMs) {
            return;
        }

        this.lastRemoteHintAt = now;

        if (this.currentAppState === 'active') {
            await this.syncNow();
            return;
        }

        this.requestSync('resume');
    }

    private canAttemptNow(reason: SyncReason): boolean {
        const token = useAuthStore.getState().token;
        if (!token) return false;

        const now = Date.now();
        const sinceAttempt = now - this.lastAttemptAt;
        const minIntervalMs = this.resolveMinIntervalMs(reason);

        const bypassMinInterval = ['manual', 'net_reconnect'].includes(reason);
        if (sinceAttempt < minIntervalMs && !bypassMinInterval) return false;

        if (this.backoffTimer) return false;

        if (reason === 'periodic') {
            const staleFor = this.lastSuccessAt ? now - this.lastSuccessAt : Number.POSITIVE_INFINITY;
            if (staleFor < this.options.periodicMaxStaleMs) {
                void this.hasOutstandingQueue().then((hasOutstanding) => {
                    if (hasOutstanding) this.requestSync('queue');
                });
                return false;
            }
        }

        return true;
    }

    private async hasOutstandingQueue(): Promise<boolean> {
        try {
            const row = await dbService.getFirst<{ count: number }>(
                "SELECT COUNT(*) as count FROM sync_queue WHERE status IN ('pending','failed','processing')"
            );
            return Number(row?.count ?? 0) > 0;
        } catch (e) {
            logger.captureException(e, { scope: 'SyncSchedulerService.hasOutstandingQueue' });
            return false;
        }
    }

    private async run(reason: SyncReason): Promise<void> {
        const now = Date.now();
        this.lastAttemptAt = now;

        captureOptimizationMetric('opt_sync_scheduler_run_started', {
            reason,
            scheduler_v2_enabled: isOptimizationFlagEnabled('syncSchedulerV2'),
            backoff_ms: this.backoffMs,
        });

        try {
            if (reason === 'periodic') {
                const hasOutstanding = await this.hasOutstandingQueue();
                const staleFor = this.lastSuccessAt ? now - this.lastSuccessAt : Number.POSITIVE_INFINITY;
                if (!hasOutstanding && staleFor < this.options.periodicMaxStaleMs) {
                    return;
                }
            }

            // Check if this is a fresh login/sync by looking at the last pull timestamp
            const userId = useAuthStore.getState().user?.id;
            const syncKey = userId ? `last_pull_sync_${userId}` : 'last_pull_sync';
            const lastSyncRow = await dbService.getFirst<{ value: string }>('SELECT value FROM settings WHERE key = ?', [syncKey]);
            const isFirstSync = !lastSyncRow || lastSyncRow.value === '0' || lastSyncRow.value === '';

            // Perform bidirectional sync with verification if triggered manually, on resume, or if it's the first sync
            // The user requested that everything stays "matched correctly", so we enforce verification on manual and first syncs.
            await syncService.syncBidirectional({
                forcePull: isFirstSync,
                verify: reason === 'manual' || isFirstSync
            });

            this.lastSuccessAt = Date.now();
            this.backoffMs = 0;
            dataEventService.emit('SYNC_COMPLETED');

            captureOptimizationMetric('opt_sync_scheduler_run_succeeded', {
                reason,
                first_sync: isFirstSync,
                elapsed_ms: Date.now() - now,
            }, 5000);

            // After a successful sync, if we just logged in or resumed, we double check if there's anything else pending
            // to fulfill the "automatic re-check" requirement.
            if (reason === 'manual' || reason === 'resume') {
                const hasMore = await this.hasOutstandingQueue();
                if (hasMore) {
                    this.requestSync('queue');
                }
            }
        } catch (e: any) {
            const code = e?.code as string | undefined;
            if (code === 'ALREADY_SYNCING' || code === 'OFFLINE' || code === 'UNAUTHENTICATED' || code === 'OFFLINE_MODE_ACTIVE') {
                captureOptimizationMetric('opt_sync_scheduler_run_skipped', {
                    reason,
                    skip_code: code,
                }, 3000);
                return;
            }

            this.backoffMs = this.backoffMs ? Math.min(this.backoffMs * 2, this.options.maxBackoffMs) : 10_000;
            const jitterMs = Math.min(5000, Math.floor(this.backoffMs * 0.2 * Math.random()));
            if (this.backoffTimer) clearTimeout(this.backoffTimer);
            this.backoffTimer = setTimeout(() => {
                this.backoffTimer = null;
                this.requestSync(reason);
            }, this.backoffMs + jitterMs);

            captureOptimizationMetric('opt_sync_scheduler_run_failed', {
                reason,
                backoff_ms: this.backoffMs,
                jitter_ms: jitterMs,
                error_code: code || 'unknown',
            }, 3000);

            logger.captureException(e, { scope: 'SyncSchedulerService.run', reason, backoffMs: this.backoffMs });
        }
    }

    private resolveMinIntervalMs(reason: SyncReason): number {
        if (!isOptimizationFlagEnabled('syncSchedulerV2')) return this.options.minIntervalMs;
        if (reason === 'manual' || reason === 'net_reconnect') return this.options.minIntervalMs;
        if (this.currentAppState !== 'active') return Math.max(this.options.minIntervalMs, 30_000);
        return this.options.minIntervalMs;
    }
}

export const syncScheduler = new SyncSchedulerService();
