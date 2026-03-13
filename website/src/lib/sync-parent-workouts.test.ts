import { describe, expect, it } from 'vitest';
import {
    collectMissingParentIdsFromChanges,
    collectMissingWorkoutIdsFromChanges,
    type SyncChange,
    type SyncParentRelation,
} from './sync-parent-workouts';

describe('collectMissingWorkoutIdsFromChanges', () => {
    it('returns empty when there are no workout_sets', () => {
        const changes: SyncChange[] = [
            { table: 'workouts', operation: 'UPDATE', payload: { id: 'w1' } },
        ];
        expect(collectMissingWorkoutIdsFromChanges(changes)).toEqual([]);
    });

    it('returns missing parent workout ids referenced by workout_sets', () => {
        const changes: SyncChange[] = [
            { table: 'workout_sets', operation: 'UPDATE', payload: { id: 's1', workout_id: 'w1' } },
            { table: 'workout_sets', operation: 'UPDATE', payload: { id: 's2', workout_id: 'w2' } },
            { table: 'workouts', operation: 'UPDATE', payload: { id: 'w2' } },
        ];
        expect(collectMissingWorkoutIdsFromChanges(changes)).toEqual(['w1']);
    });

    it('ignores invalid payloads and non-string workout_id', () => {
        const changes: SyncChange[] = [
            { table: 'workout_sets', operation: 'UPDATE', payload: null },
            { table: 'workout_sets', operation: 'UPDATE', payload: { workout_id: 123 } },
            { table: 'workout_sets', operation: 'UPDATE', payload: { workout_id: '' } },
        ];
        expect(collectMissingWorkoutIdsFromChanges(changes)).toEqual([]);
    });
});

describe('collectMissingParentIdsFromChanges', () => {
    it('collects missing parents across multiple relations', () => {
        const relations: SyncParentRelation[] = [
            { childTable: 'workout_sets', parentTable: 'workouts', fkField: 'workout_id' },
            { childTable: 'workout_sets', parentTable: 'exercises', fkField: 'exercise_id' },
        ];
        const changes: SyncChange[] = [
            { table: 'workout_sets', operation: 'UPDATE', payload: { id: 's1', workout_id: 'w1', exercise_id: 'e1' } },
            { table: 'workout_sets', operation: 'UPDATE', payload: { id: 's2', workout_id: 'w1', exercise_id: 'e2' } },
            { table: 'workouts', operation: 'UPDATE', payload: { id: 'w1' } },
            { table: 'exercises', operation: 'UPDATE', payload: { id: 'e2' } },
        ];

        expect(collectMissingParentIdsFromChanges(changes, relations)).toEqual({
            exercises: ['e1'],
        });
    });

    it('ignores invalid tables, payloads, and empty ids', () => {
        const relations: SyncParentRelation[] = [
            { childTable: 'routine_exercises', parentTable: 'routine_days', fkField: 'routine_day_id' },
        ];
        const changes: SyncChange[] = [
            { table: '', operation: 'UPDATE', payload: { id: 'x', routine_day_id: 'rd1' } },
            { table: 'routine_exercises', operation: 'UPDATE', payload: null },
            { table: 'routine_exercises', operation: 'UPDATE', payload: { id: 're1', routine_day_id: '' } },
        ];

        expect(collectMissingParentIdsFromChanges(changes, relations)).toEqual({});
    });
});
