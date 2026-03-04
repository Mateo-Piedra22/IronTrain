import { DOTS_COEFFS, WILKS_COEFFS } from '../constants/Formulas';
import { dbService } from './DatabaseService';

class StatsService {
    public calculateWilks(bodyWeightKg: number, liftedTotalKg: number, isFemale: boolean = false): number {
        if (bodyWeightKg <= 0) return 0;

        if (isFemale) {
            // Placeholder for female coefficients
        }

        const { a, b, c, d, e, f } = WILKS_COEFFS;
        const x = bodyWeightKg;
        const coeff = 500 / (a + b * x + c * Math.pow(x, 2) + d * Math.pow(x, 3) + e * Math.pow(x, 4) + f * Math.pow(x, 5));
        return liftedTotalKg * coeff;
    }

    public calculateDOTS(bodyWeightKg: number, liftedTotalKg: number, isFemale: boolean = false): number {
        if (bodyWeightKg <= 0) return 0;

        const { A, B, C, D, E } = DOTS_COEFFS;
        const w = bodyWeightKg;
        const denominator = A * Math.pow(w, 4) + B * Math.pow(w, 3) + C * Math.pow(w, 2) + D * w + E;
        return (liftedTotalKg * 500) / denominator;
    }

    /**
     * Calculate Volume Density (kg / minute) for a specific workout.
     * Uses persisted duration field, falling back to start_time → end_time.
     */
    public async getWorkoutDensity(workoutId: string): Promise<number> {
        const workout = await dbService.getWorkoutById(workoutId);
        if (!workout) return 0;

        const sets = await dbService.getSetsForWorkout(workoutId);
        const totalVolume = sets
            .filter((s) => (s as any).exercise_type === 'weight_reps')
            .reduce((acc, s) => acc + ((s.weight || 0) * (s.reps || 0)), 0);

        // Use persisted duration (seconds), fall back to timestamps
        let durationSec = workout.duration ?? 0;
        if (durationSec <= 0 && workout.end_time && workout.start_time) {
            durationSec = Math.floor((workout.end_time - workout.start_time) / 1000);
        }

        const minutes = durationSec / 60;
        if (minutes <= 0) return 0;

        return parseFloat((totalVolume / minutes).toFixed(2));
    }
}

export const statsService = new StatsService();
