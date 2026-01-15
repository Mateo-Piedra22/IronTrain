import { dbService } from './DatabaseService';
import { DOTS_COEFFS, WILKS_COEFFS } from '../constants/Formulas';

class StatsService {
    // ... (rest of methods)

    public calculateWilks(bodyWeightKg: number, liftedTotalKg: number, isFemale: boolean = false): number {
        if (bodyWeightKg <= 0) return 0;

        if (isFemale) {
            // Placeholder for female coeffs
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


    // --- VOLUME DENSITY ---

    /**
     * Calculate Volume Density (kg / minute) for a specific workout
     */
    public async getWorkoutDensity(workoutId: string): Promise<number> {
        const workout = await dbService.getWorkoutById(workoutId);
        if (!workout || !workout.duration || workout.duration <= 0) return 0;

        const sets = await dbService.getSetsForWorkout(workoutId);
        const totalVolume = sets.reduce((acc, s) => acc + ((s.weight || 0) * (s.reps || 0)), 0);

        // Duration is usually in seconds (from end_time - start_time) or stored as minutes? 
        // Based on previous code, we store start/end timestamps.
        // If duration is stored (in minutes), use it. Else calculate.

        let minutes = workout.duration; // Assuming duration is in minutes based on my intuition of typical field usage
        if (!minutes && workout.end_time && workout.start_time) {
            minutes = (workout.end_time - workout.start_time) / 1000 / 60;
        }

        if (!minutes || minutes <= 0) return 0;

        return parseFloat((totalVolume / minutes).toFixed(2));
    }
}

export const statsService = new StatsService();
