import { describe, expect, it } from 'vitest';
import { coalescePushOperations } from './sync-push-coalesce';
import type { PushOperation } from './sync-push-defer';

describe('coalescePushOperations', () => {
    it('merges INSERT + UPDATE into a single INSERT with merged payload', () => {
        const ops: PushOperation[] = [
            {
                id: '1',
                table: 'workouts',
                operation: 'INSERT',
                recordId: 'w1',
                payload: { id: 'w1', status: 'in_progress', duration: 0 },
            },
            {
                id: '2',
                table: 'workouts',
                operation: 'UPDATE',
                recordId: 'w1',
                payload: { duration: 120, status: 'completed' },
            },
        ];

        const out = coalescePushOperations(ops);
        expect(out).toHaveLength(1);
        expect(out[0].operation).toBe('INSERT');
        expect(out[0].payload).toMatchObject({ id: 'w1', duration: 120, status: 'completed' });
    });

    it('drops INSERT followed by DELETE for same record', () => {
        const ops: PushOperation[] = [
            { id: '1', table: 'workouts', operation: 'INSERT', recordId: 'w1', payload: { id: 'w1' } },
            { id: '2', table: 'workouts', operation: 'DELETE', recordId: 'w1' },
        ];

        const out = coalescePushOperations(ops);
        expect(out).toHaveLength(0);
    });

    it('coalesces multiple UPDATE operations into one', () => {
        const ops: PushOperation[] = [
            { id: '1', table: 'workouts', operation: 'UPDATE', recordId: 'w1', payload: { name: 'A' } },
            { id: '2', table: 'workouts', operation: 'UPDATE', recordId: 'w1', payload: { duration: 100 } },
            { id: '3', table: 'workouts', operation: 'UPDATE', recordId: 'w1', payload: { status: 'completed' } },
        ];

        const out = coalescePushOperations(ops);
        expect(out).toHaveLength(1);
        expect(out[0].operation).toBe('UPDATE');
        expect(out[0].payload).toMatchObject({ name: 'A', duration: 100, status: 'completed' });
    });

    it('uses settings key identity when recordId is missing', () => {
        const ops: PushOperation[] = [
            { id: '1', table: 'settings', operation: 'UPDATE', payload: { key: 'training_days', value: '[1,2,3]' } },
            { id: '2', table: 'settings', operation: 'UPDATE', payload: { key: 'training_days', value: '[1,2,3,4]' } },
        ];

        const out = coalescePushOperations(ops);
        expect(out).toHaveLength(1);
        expect(out[0].payload).toMatchObject({ key: 'training_days', value: '[1,2,3,4]' });
    });
});
