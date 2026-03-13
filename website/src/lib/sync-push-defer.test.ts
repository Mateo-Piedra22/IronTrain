import { describe, expect, it } from 'vitest';
import {
    collectIncomingRecordIdsByTable,
    shouldDeferWorkoutSetUpsert,
    type PushOperation,
} from './sync-push-defer';

describe('collectIncomingRecordIdsByTable', () => {
    it('collects ids from payload.id and recordId, ignoring deletes', () => {
        const ops: PushOperation[] = [
            { id: '1', table: 'workouts', operation: 'INSERT', payload: { id: 'w1' } },
            { id: '2', table: 'workouts', operation: 'UPDATE', recordId: 'w2', payload: {} },
            { id: '3', table: 'workouts', operation: 'DELETE', recordId: 'w3' },
        ];

        const m = collectIncomingRecordIdsByTable(ops);
        expect(Array.from(m.get('workouts') ?? [])).toEqual(['w1', 'w2']);
    });

    it('ignores invalid tables and missing ids', () => {
        const ops: PushOperation[] = [
            { id: '1', table: '', operation: 'INSERT', payload: { id: 'x' } },
            { id: '2', table: 'workouts', operation: 'INSERT', payload: {} },
        ];

        const m = collectIncomingRecordIdsByTable(ops);
        expect(m.size).toBe(0);
    });
});

describe('shouldDeferWorkoutSetUpsert', () => {
    it('does not defer when parent already exists', () => {
        expect(shouldDeferWorkoutSetUpsert({
            workoutId: 'w1',
            parentExistsInDb: true,
            incomingWorkouts: new Set(['w1']),
        })).toBe(false);
    });

    it('defers only when parent is missing in DB but included in incoming batch', () => {
        expect(shouldDeferWorkoutSetUpsert({
            workoutId: 'w1',
            parentExistsInDb: false,
            incomingWorkouts: new Set(['w1']),
        })).toBe(true);

        expect(shouldDeferWorkoutSetUpsert({
            workoutId: 'w1',
            parentExistsInDb: false,
            incomingWorkouts: new Set(['w2']),
        })).toBe(false);
    });
});
