import NetInfo from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { logger } from '../utils/logger';
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
};

const DEFAULT_OPTIONS: SyncSchedulerOptions = {
    debounceMs: 1500,
    minIntervalMs: 20_000,
    resumeDelayMs: 2000,
    periodicMs: 5 * 60_000,
    periodicMaxStaleMs: 30 * 60_000,
    maxBackoffMs: 10 * 60_000,
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

    private unsubscribeNetInfo: (() => void) | null = null;
    private unsubscribeQueue: (() => void) | null = null;

    private readonly options: SyncSchedulerOptions;

    public constructor(options?: Partial<SyncSchedulerOptions>) {
        this.options = { ...DEFAULT_OPTIONS, ...(options ?? {}) };
    }

    public init(): void {
        if (this.initialized) return;
        this.initialized = true;

        this.unsubscribeQueue = dataEventService.subscribe('SYNC_QUEUE_ENQUEUED', () => {
            this.requestSync('queue');
        });

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
        this.unsubscribeNetInfo = null;
        this.unsubscribeQueue = null;

        if (this.appStateSubscription) this.appStateSubscription.remove();
        this.appStateSubscription = null;

        this.initialized = false;
    }

    public requestSync(reason: SyncReason): void {
        if (!this.initialized) return;
        if (!this.canAttemptNow(reason)) return;

        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.debounceTimer = null;
            this.run(reason).catch(() => {
                return;
            });
        }, this.options.debounceMs);
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

    private canAttemptNow(reason: SyncReason): boolean {
        const token = useAuthStore.getState().token;
        if (!token) return false;

        const now = Date.now();
        const sinceAttempt = now - this.lastAttemptAt;
        if (sinceAttempt < this.options.minIntervalMs && reason !== 'manual') return false;

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

        try {
            if (reason === 'periodic') {
                const hasOutstanding = await this.hasOutstandingQueue();
                const staleFor = this.lastSuccessAt ? now - this.lastSuccessAt : Number.POSITIVE_INFINITY;
                if (!hasOutstanding && staleFor < this.options.periodicMaxStaleMs) {
                    return;
                }
            }

            await syncService.syncBidirectional();
            this.lastSuccessAt = Date.now();
            this.backoffMs = 0;
            dataEventService.emit('SYNC_COMPLETED');
        } catch (e: any) {
            const code = e?.code as string | undefined;
            if (code === 'ALREADY_SYNCING' || code === 'OFFLINE' || code === 'UNAUTHENTICATED') {
                return;
            }

            this.backoffMs = this.backoffMs ? Math.min(this.backoffMs * 2, this.options.maxBackoffMs) : 10_000;
            if (this.backoffTimer) clearTimeout(this.backoffTimer);
            this.backoffTimer = setTimeout(() => {
                this.backoffTimer = null;
                this.requestSync(reason);
            }, this.backoffMs);

            logger.captureException(e, { scope: 'SyncSchedulerService.run', reason, backoffMs: this.backoffMs });
        }
    }
}

export const syncScheduler = new SyncSchedulerService();
