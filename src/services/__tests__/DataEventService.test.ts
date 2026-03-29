import { logger } from '../../utils/logger';
import { dataEventService } from '../DataEventService';

jest.mock('../../utils/logger', () => ({
    logger: {
        captureException: jest.fn(),
    },
}));

describe('DataEventService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset internal state by recreating the service
        jest.isolateModules(() => {
            jest.requireMock('../DataEventService');
        });
    });

    describe('emit', () => {
        it('should call all listeners for an event', () => {
            const listener1 = jest.fn();
            const listener2 = jest.fn();

            dataEventService.subscribe('DATA_UPDATED', listener1);
            dataEventService.subscribe('DATA_UPDATED', listener2);

            const payload = { key: 'test', value: 'data' };
            dataEventService.emit('DATA_UPDATED', payload);

            expect(listener1).toHaveBeenCalledWith(payload);
            expect(listener2).toHaveBeenCalledWith(payload);
        });

        it('should not call listeners for other events', () => {
            const listener = jest.fn();

            dataEventService.subscribe('DATA_UPDATED', listener);
            dataEventService.emit('SYNC_COMPLETED', { data: 'test' });

            expect(listener).not.toHaveBeenCalled();
        });

        it('should handle emit without payload', () => {
            const listener = jest.fn();

            dataEventService.subscribe('DATA_UPDATED', listener);
            dataEventService.emit('DATA_UPDATED');

            expect(listener).toHaveBeenCalledWith(undefined);
        });

        it('should handle errors in listeners without crashing', () => {
            const errorListener = jest.fn(() => {
                throw new Error('Listener error');
            });
            const goodListener = jest.fn();

            dataEventService.subscribe('DATA_UPDATED', errorListener);
            dataEventService.subscribe('DATA_UPDATED', goodListener);

            expect(() => {
                dataEventService.emit('DATA_UPDATED', {});
            }).not.toThrow();

            expect(errorListener).toHaveBeenCalled();
            expect(goodListener).toHaveBeenCalled();
            expect(logger.captureException).toHaveBeenCalled();
        });

        it('should handle emit when no listeners are registered', () => {
            expect(() => {
                dataEventService.emit('DATA_UPDATED', {});
            }).not.toThrow();
        });
    });

    describe('subscribe', () => {
        it('should register a listener and return unsubscribe function', () => {
            const listener = jest.fn();

            const unsubscribe = dataEventService.subscribe('DATA_UPDATED', listener);

            dataEventService.emit('DATA_UPDATED', {});
            expect(listener).toHaveBeenCalledTimes(1);

            unsubscribe();

            dataEventService.emit('DATA_UPDATED', {});
            expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called again
        });

        it('should allow multiple subscriptions to the same event', () => {
            const listener1 = jest.fn();
            const listener2 = jest.fn();

            const unsubscribe1 = dataEventService.subscribe('DATA_UPDATED', listener1);
            const unsubscribe2 = dataEventService.subscribe('DATA_UPDATED', listener2);

            dataEventService.emit('DATA_UPDATED', {});

            expect(listener1).toHaveBeenCalledTimes(1);
            expect(listener2).toHaveBeenCalledTimes(1);

            unsubscribe1();

            dataEventService.emit('DATA_UPDATED', {});

            expect(listener1).toHaveBeenCalledTimes(1);
            expect(listener2).toHaveBeenCalledTimes(2);
        });

        it('should allow subscribing to multiple different events', () => {
            const dataListener = jest.fn();
            const syncListener = jest.fn();

            dataEventService.subscribe('DATA_UPDATED', dataListener);
            dataEventService.subscribe('SYNC_COMPLETED', syncListener);

            dataEventService.emit('DATA_UPDATED', {});
            dataEventService.emit('SYNC_COMPLETED', {});

            expect(dataListener).toHaveBeenCalledTimes(1);
            expect(syncListener).toHaveBeenCalledTimes(1);
        });

        it('should handle unsubscribe when listener was already removed', () => {
            const listener = jest.fn();

            const unsubscribe = dataEventService.subscribe('DATA_UPDATED', listener);

            // Call unsubscribe twice should not throw
            unsubscribe();
            unsubscribe();

            expect(() => unsubscribe()).not.toThrow();
        });

        it('should create new Set for each event type', () => {
            const listener1 = jest.fn();
            const listener2 = jest.fn();

            dataEventService.subscribe('DATA_UPDATED', listener1);
            dataEventService.subscribe('SYNC_COMPLETED', listener2);

            dataEventService.emit('DATA_UPDATED', {});

            expect(listener1).toHaveBeenCalledTimes(1);
            expect(listener2).not.toHaveBeenCalled();
        });
    });

    describe('Event Types', () => {
        it('should handle DATA_UPDATED event', () => {
            const listener = jest.fn();
            dataEventService.subscribe('DATA_UPDATED', listener);

            const payload = { table: 'workouts', action: 'insert' };
            dataEventService.emit('DATA_UPDATED', payload);

            expect(listener).toHaveBeenCalledWith(payload);
        });

        it('should handle SETTINGS_UPDATED event', () => {
            const listener = jest.fn();
            dataEventService.subscribe('SETTINGS_UPDATED', listener);

            const payload = { key: 'themeMode', value: 'dark' };
            dataEventService.emit('SETTINGS_UPDATED', payload);

            expect(listener).toHaveBeenCalledWith(payload);
        });

        it('should handle SYNC_COMPLETED event', () => {
            const listener = jest.fn();
            dataEventService.subscribe('SYNC_COMPLETED', listener);

            const payload = { success: true, synced: 10 };
            dataEventService.emit('SYNC_COMPLETED', payload);

            expect(listener).toHaveBeenCalledWith(payload);
        });

        it('should handle SOCIAL_UPDATED event', () => {
            const listener = jest.fn();
            dataEventService.subscribe('SOCIAL_UPDATED', listener);

            const payload = { feed: [], friends: [] };
            dataEventService.emit('SOCIAL_UPDATED', payload);

            expect(listener).toHaveBeenCalledWith(payload);
        });

        it('should handle SYNC_QUEUE_ENQUEUED event', () => {
            const listener = jest.fn();
            dataEventService.subscribe('SYNC_QUEUE_ENQUEUED', listener);

            const payload = { queueLength: 5 };
            dataEventService.emit('SYNC_QUEUE_ENQUEUED', payload);

            expect(listener).toHaveBeenCalledWith(payload);
        });
    });

    describe('Edge Cases', () => {
        it('should handle null payload', () => {
            const listener = jest.fn();
            dataEventService.subscribe('DATA_UPDATED', listener);

            dataEventService.emit('DATA_UPDATED', null);

            expect(listener).toHaveBeenCalledWith(null);
        });

        it('should handle undefined payload', () => {
            const listener = jest.fn();
            dataEventService.subscribe('DATA_UPDATED', listener);

            dataEventService.emit('DATA_UPDATED', undefined);

            expect(listener).toHaveBeenCalledWith(undefined);
        });

        it('should handle complex payload objects', () => {
            const listener = jest.fn();
            dataEventService.subscribe('DATA_UPDATED', listener);

            const complexPayload = {
                nested: { data: 'value' },
                array: [1, 2, 3],
                fn: () => 'test',
            };

            dataEventService.emit('DATA_UPDATED', complexPayload);

            expect(listener).toHaveBeenCalledWith(complexPayload);
        });

        it('should maintain listener order', () => {
            const callOrder: string[] = [];
            const listener1 = jest.fn(() => callOrder.push('1'));
            const listener2 = jest.fn(() => callOrder.push('2'));
            const listener3 = jest.fn(() => callOrder.push('3'));

            dataEventService.subscribe('DATA_UPDATED', listener1);
            dataEventService.subscribe('DATA_UPDATED', listener2);
            dataEventService.subscribe('DATA_UPDATED', listener3);

            dataEventService.emit('DATA_UPDATED', {});

            expect(callOrder).toEqual(['1', '2', '3']);
        });
    });

    describe('Memory Management', () => {
        it('should remove listener from Set on unsubscribe', () => {
            const listener = jest.fn();
            const unsubscribe = dataEventService.subscribe('DATA_UPDATED', listener);

            unsubscribe();

            // Force garbage collection simulation by emitting
            dataEventService.emit('DATA_UPDATED', {});

            expect(listener).not.toHaveBeenCalled();
        });

        it('should allow re-subscription after unsubscribe', () => {
            const listener = jest.fn();

            const unsubscribe = dataEventService.subscribe('DATA_UPDATED', listener);
            unsubscribe();

            const newUnsubscribe = dataEventService.subscribe('DATA_UPDATED', listener);

            dataEventService.emit('DATA_UPDATED', {});
            expect(listener).toHaveBeenCalledTimes(1);

            newUnsubscribe();
        });
    });
});
