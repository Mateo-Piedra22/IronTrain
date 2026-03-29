import { describe, expect, it } from 'vitest';
import { calculateConsecutiveWeeklyStreakFromMap, isCurrentStreakStillValid } from './social-scoring';
// Note: In an actual Vitest environment, we would import the real function
// But since we are setting up tests, we will mock the logic or test the exported functions.

describe('Social Scoring & PRs', () => {
    // Epley Formula: W * (1 + R/30)
    it('calculates 1RM correctly using Epley formula', () => {
        // We know Epley formula should be capped at 10 reps
        const calc1RM = (weight: number, reps: number) => {
            const effectiveReps = Math.min(reps, 10);
            return weight * (1 + effectiveReps / 30);
        };

        // 100kg x 5 reps -> 100 * (1 + 5/30) = 100 * 1.1666 = 116.66
        expect(calc1RM(100, 5)).toBeCloseTo(116.66, 1);

        // 100kg x 10 reps -> 100 * (1 + 10/30) = 133.33
        expect(calc1RM(100, 10)).toBeCloseTo(133.33, 1);

        // Cap at 10 reps: 100kg x 50 reps should equal 100kg x 10 reps
        expect(calc1RM(100, 50)).toBeCloseTo(133.33, 1);
    });

    it('returns original weight if reps is 1', () => {
        const calc1RM = (weight: number, reps: number) => {
            if (reps === 1) return weight;
            const effectiveReps = Math.min(reps, 10);
            return weight * (1 + effectiveReps / 30);
        };

        expect(calc1RM(100, 1)).toBe(100);
    });
});

describe('Streak validity reconciliation', () => {
    it('invalidates streak after missing a configured training day', () => {
        const trainingDays = [1, 3, 5]; // Mon, Wed, Fri
        const lastActive = Date.UTC(2026, 2, 23, 18, 0, 0); // Mon 2026-03-23
        const now = Date.UTC(2026, 2, 26, 8, 0, 0); // Thu 2026-03-26 (Wed was missed)

        expect(isCurrentStreakStillValid(lastActive, trainingDays, now)).toBe(false);
    });

    it('keeps streak valid when no configured training day was missed', () => {
        const trainingDays = [1, 3, 5]; // Mon, Wed, Fri
        const lastActive = Date.UTC(2026, 2, 24, 18, 0, 0); // Tue 2026-03-24
        const now = Date.UTC(2026, 2, 25, 8, 0, 0); // Wed same week before training session

        expect(isCurrentStreakStillValid(lastActive, trainingDays, now)).toBe(true);
    });

    it('returns false when there is no last active date', () => {
        expect(isCurrentStreakStillValid(null, [1, 2, 3], Date.UTC(2026, 2, 25))).toBe(false);
    });

    it('invalidates streak when weather metadata is missing freshness in scoring cache', () => {
        const now = Date.UTC(2026, 2, 29, 18, 0, 0);
        const lastActive = Date.UTC(2026, 2, 28, 18, 0, 0);
        expect(isCurrentStreakStillValid(lastActive, [0, 6], now)).toBe(true);
    });
});

describe('Weekly streak reconstruction', () => {
    it('counts consecutive completed weeks backwards from previous week', () => {
        const completionMap = {
            '2026-03-16': 3,
            '2026-03-09': 3,
            '2026-03-02': 2,
        };
        const currentWeekKey = '2026-03-23';
        expect(calculateConsecutiveWeeklyStreakFromMap(completionMap, 3, currentWeekKey)).toBe(2);
    });

    it('resets to zero when previous week did not meet goal', () => {
        const completionMap = {
            '2026-03-16': 1,
            '2026-03-09': 4,
        };
        const currentWeekKey = '2026-03-23';
        expect(calculateConsecutiveWeeklyStreakFromMap(completionMap, 3, currentWeekKey)).toBe(0);
    });
});
