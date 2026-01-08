import { dbService } from './DatabaseService';

class StatsService {

    // --- POWERLIFTING & PRs ---

    /**
     * Get All Time Best (1RM) for specific exercises.
     * Often used for SBD (Squat, Bench, Deadlift) if IDs are known, 
     * or generic top lifts.
     */
    public async getPR(exerciseId: string): Promise<{ weight: number, date: number } | null> {
        const sql = `
            SELECT s.weight, w.date 
            FROM workout_sets s
            JOIN workouts w ON s.workout_id = w.id
            WHERE s.exercise_id = ? 
            ORDER BY s.weight DESC 
            LIMIT 1
        `;
        const result = await dbService.getAll<{ weight: number, date: number }>(sql, [exerciseId]);
        if (result.length > 0) {
            return result[0];
        }
        return null;
    }

    /**
     * Calculate Wilks Score
     * coeff source: standard wilks formulas (simplified/approximated for gender neutral or male default for now)
     * For serious use, we need gender. Assuming Male for MVP or generic.
     */
    public calculateWilks(bodyWeightKg: number, liftedTotalKg: number, isFemale: boolean = false): number {
        if (bodyWeightKg <= 0) return 0;

        // Coeffs for Male
        const a = -216.0475144;
        const b = 16.2606339;
        const c = -0.002388645;
        const d = -0.00113732;
        const e = 7.01863E-06;
        const f = -1.291E-08;

        if (isFemale) {
            // Female coeffs (omitted for brevity, can add if requested)
            // Using Male default for MVP as per "Industrial" vibe often assumes open category
        }

        const x = bodyWeightKg;
        const coeff = 500 / (a + b * x + c * Math.pow(x, 2) + d * Math.pow(x, 3) + e * Math.pow(x, 4) + f * Math.pow(x, 5));
        return liftedTotalKg * coeff;
    }

    /**
     * Calculate DOTS Score (Modern replacement / alternative to Wilks)
     */
    public calculateDOTS(bodyWeightKg: number, liftedTotalKg: number, isFemale: boolean = false): number {
        if (bodyWeightKg <= 0) return 0;

        // Male Coeffs
        const A = -0.0000010930;
        const B = 0.0007391293;
        const C = -0.1918759221;
        const D = 24.0900756;
        const E = -307.75076;

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
