import { describe, expect, it } from 'vitest';
import { shouldDeferWorkoutSetUpsert } from './sync-push-defer';

describe('Sync Push Defer Logic', () => {
    it('defers workout_set if parent does not exist in DB but is in incoming payload', () => {
        const incomingWorkouts = new Set(['workout-1']);
        const result = shouldDeferWorkoutSetUpsert({
            workoutId: 'workout-1',
            parentExistsInDb: false,
            incomingWorkouts
        });
        expect(result).toBe(true);
    });

    it('does not defer if parent already exists in DB', () => {
        const incomingWorkouts = new Set<string>();
        const result = shouldDeferWorkoutSetUpsert({
            workoutId: 'workout-1',
            parentExistsInDb: true,
            incomingWorkouts
        });
        expect(result).toBe(false);
    });

    it('does not defer if parent neither exists in DB nor in incoming payload (orphan error case)', () => {
        const incomingWorkouts = new Set<string>();
        const result = shouldDeferWorkoutSetUpsert({
            workoutId: 'workout-unknown',
            parentExistsInDb: false,
            incomingWorkouts
        });
        expect(result).toBe(false);
    });
});
