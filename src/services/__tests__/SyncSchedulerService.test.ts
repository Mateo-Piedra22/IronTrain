import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

jest.mock('../SyncService', () => {
    return {
        syncService: {
            syncBidirectional: jest.fn(async () => undefined),
        }
    };
});

jest.mock('../DatabaseService', () => {
    return {
        dbService: {
            getFirst: jest.fn(async () => ({ count: 1 })),
        }
    };
});

jest.mock('../DataEventService', () => {
    const listeners = new Map<string, Set<(p?: unknown) => void>>();
    return {
        dataEventService: {
            emit: (evt: string, payload?: unknown) => {
                (listeners.get(evt) ?? new Set()).forEach((cb) => cb(payload));
            },
            subscribe: (evt: string, cb: (p?: unknown) => void) => {
                if (!listeners.has(evt)) listeners.set(evt, new Set());
                listeners.get(evt)!.add(cb);
                return () => listeners.get(evt)!.delete(cb);
            }
        }
    };
});

jest.mock('../../store/authStore', () => {
    return {
        useAuthStore: {
            getState: () => ({ token: 't' }),
            subscribe: jest.fn(() => () => undefined),
        }
    };
});

jest.mock('@react-native-community/netinfo', () => {
    return {
        __esModule: true,
        default: {
            addEventListener: () => () => undefined,
        }
    };
});

jest.mock('react-native', () => {
    return {
        AppState: {
            currentState: 'active',
            addEventListener: () => ({ remove: () => undefined }),
        }
    };
});

import { dataEventService } from '../DataEventService';
import { SyncSchedulerService } from '../SyncSchedulerService';
import { syncService } from '../SyncService';

describe('SyncSchedulerService', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('debounces multiple queue events into a single sync', async () => {
        const s = new SyncSchedulerService({ debounceMs: 100, minIntervalMs: 0, periodicMs: 60_000 });
        s.init();

        dataEventService.emit('SYNC_QUEUE_ENQUEUED');
        dataEventService.emit('SYNC_QUEUE_ENQUEUED');
        dataEventService.emit('SYNC_QUEUE_ENQUEUED');

        expect(syncService.syncBidirectional).toHaveBeenCalledTimes(0);

        jest.advanceTimersByTime(150);
        await Promise.resolve();

        expect(syncService.syncBidirectional).toHaveBeenCalledTimes(1);
        s.dispose();
    });

    test('respects minIntervalMs for non-manual reasons', async () => {
        const s = new SyncSchedulerService({ debounceMs: 50, minIntervalMs: 10_000, periodicMs: 60_000 });
        s.init();

        dataEventService.emit('SYNC_QUEUE_ENQUEUED');
        jest.advanceTimersByTime(60);
        await Promise.resolve();
        expect(syncService.syncBidirectional).toHaveBeenCalledTimes(1);

        dataEventService.emit('SYNC_QUEUE_ENQUEUED');
        jest.advanceTimersByTime(60);
        await Promise.resolve();
        expect(syncService.syncBidirectional).toHaveBeenCalledTimes(1);

        s.dispose();
    });
});
