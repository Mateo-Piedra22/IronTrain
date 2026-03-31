import { describe, expect, it } from 'vitest';
import { diffSharedRoutinePayload, summarizeSharedRoutinePayload } from './shared-routine-diff';

describe('shared-routine-diff', () => {
    it('summarizes payload entities correctly', () => {
        const summary = summarizeSharedRoutinePayload({
            routine_days: [{ id: 'd1' }, { id: 'd2' }],
            routine_exercises: [{ id: 're1' }, { id: 're2' }, { id: 're3' }],
            exercises: [{ id: 'e1' }, { id: 'e2' }],
            categories: [{ id: 'c1' }],
            badges: [{ id: 'b1' }, { id: 'b2' }],
            exercise_badges: [{ id: 'eb1' }],
        });

        expect(summary).toEqual({
            routineDays: 2,
            routineExercises: 3,
            exercises: 2,
            categories: 1,
            badges: 2,
            exerciseBadges: 1,
        });
    });

    it('computes per-entity added/removed deltas', () => {
        const result = diffSharedRoutinePayload(
            {
                routine_days: [{ id: 'd1' }],
                routine_exercises: [{ id: 're1' }, { id: 're2' }],
                exercises: [{ id: 'e1' }],
                categories: [{ id: 'c1' }],
                badges: [{ id: 'b1' }],
                exercise_badges: [{ id: 'eb1' }],
            },
            {
                routine_days: [{ id: 'd1' }, { id: 'd2' }],
                routine_exercises: [{ id: 're2' }, { id: 're3' }],
                exercises: [{ id: 'e1' }, { id: 'e2' }],
                categories: [{ id: 'c1' }, { id: 'c2' }],
                badges: [{ id: 'b1' }],
                exercise_badges: [{ id: 'eb2' }],
            },
        );

        expect(result.delta.routineDays).toEqual({ added: 1, removed: 0, net: 1 });
        expect(result.delta.routineExercises).toEqual({ added: 1, removed: 1, net: 0 });
        expect(result.delta.exercises).toEqual({ added: 1, removed: 0, net: 1 });
        expect(result.delta.categories).toEqual({ added: 1, removed: 0, net: 1 });
        expect(result.delta.badges).toEqual({ added: 0, removed: 0, net: 0 });
        expect(result.delta.exerciseBadges).toEqual({ added: 1, removed: 1, net: 0 });
    });
});
