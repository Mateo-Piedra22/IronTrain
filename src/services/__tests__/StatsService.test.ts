import { statsService } from '../StatsService';
import { dbService } from '../DatabaseService';
import { Workout, WorkoutSet } from '../../types/db';

jest.mock('../DatabaseService', () => ({
    dbService: {
        getWorkoutById: jest.fn(),
        getSetsForWorkout: jest.fn(),
    },
}));

describe('StatsService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('calculateWilks', () => {
        it('should calculate Wilks score for male lifter', () => {
            const bodyWeight = 80;
            const liftedTotal = 200;

            const result = statsService.calculateWilks(bodyWeight, liftedTotal, false);

            expect(result).toBeGreaterThan(0);
            expect(typeof result).toBe('number');
        });

        it('should calculate Wilks score for female lifter', () => {
            const bodyWeight = 60;
            const liftedTotal = 150;

            const result = statsService.calculateWilks(bodyWeight, liftedTotal, true);

            expect(result).toBeGreaterThan(0);
            expect(typeof result).toBe('number');
        });

        it('should return 0 when body weight is 0', () => {
            const result = statsService.calculateWilks(0, 200);

            expect(result).toBe(0);
        });

        it('should return 0 when body weight is negative', () => {
            const result = statsService.calculateWilks(-10, 200);

            expect(result).toBe(0);
        });

        it('should return 0 when lifted total is 0', () => {
            const result = statsService.calculateWilks(80, 0);

            expect(result).toBe(0);
        });

        it('should handle very high body weights', () => {
            const result = statsService.calculateWilks(150, 300);

            expect(result).toBeGreaterThan(0);
            expect(typeof result).toBe('number');
        });

        it('should handle very low body weights', () => {
            const result = statsService.calculateWilks(40, 100);

            expect(result).toBeGreaterThan(0);
            expect(typeof result).toBe('number');
        });

        it('should return different scores for male and female with same inputs', () => {
            const bodyWeight = 70;
            const liftedTotal = 180;

            const maleScore = statsService.calculateWilks(bodyWeight, liftedTotal, false);
            const femaleScore = statsService.calculateWilks(bodyWeight, liftedTotal, true);

            expect(maleScore).not.toBe(femaleScore);
        });
    });

    describe('calculateDOTS', () => {
        it('should calculate DOTS score for male lifter', () => {
            const bodyWeight = 80;
            const liftedTotal = 200;

            const result = statsService.calculateDOTS(bodyWeight, liftedTotal, false);

            expect(result).toBeGreaterThan(0);
            expect(typeof result).toBe('number');
        });

        it('should calculate DOTS score for female lifter', () => {
            const bodyWeight = 60;
            const liftedTotal = 150;

            const result = statsService.calculateDOTS(bodyWeight, liftedTotal, true);

            expect(result).toBeGreaterThan(0);
            expect(typeof result).toBe('number');
        });

        it('should return 0 when body weight is 0', () => {
            const result = statsService.calculateDOTS(0, 200);

            expect(result).toBe(0);
        });

        it('should return 0 when body weight is negative', () => {
            const result = statsService.calculateDOTS(-10, 200);

            expect(result).toBe(0);
        });

        it('should return 0 when lifted total is 0', () => {
            const result = statsService.calculateDOTS(80, 0);

            expect(result).toBe(0);
        });

        it('should handle very high body weights', () => {
            const result = statsService.calculateDOTS(150, 300);

            expect(result).toBeGreaterThan(0);
            expect(typeof result).toBe('number');
        });

        it('should handle very low body weights', () => {
            const result = statsService.calculateDOTS(40, 100);

            expect(result).toBeGreaterThan(0);
            expect(typeof result).toBe('number');
        });

        it('should return different scores for male and female with same inputs', () => {
            const bodyWeight = 70;
            const liftedTotal = 180;

            const maleScore = statsService.calculateDOTS(bodyWeight, liftedTotal, false);
            const femaleScore = statsService.calculateDOTS(bodyWeight, liftedTotal, true);

            expect(maleScore).not.toBe(femaleScore);
        });
    });

    describe('getWorkoutDensity', () => {
        const mockWorkout: Partial<Workout> = {
            id: 'w1',
            start_time: new Date('2026-01-15T10:00:00Z').getTime(),
            end_time: new Date('2026-01-15T11:00:00Z').getTime(),
            duration: 3600,
        };

        const mockSets: any[] = [
            { id: 's1', exercise_type: 'weight_reps', weight: 100, reps: 5 },
            { id: 's2', exercise_type: 'weight_reps', weight: 100, reps: 5 },
            { id: 's3', exercise_type: 'weight_reps', weight: 80, reps: 10 },
        ];

        it('should calculate workout density using persisted duration', async () => {
            (dbService.getWorkoutById as jest.Mock).mockResolvedValue(mockWorkout);
            (dbService.getSetsForWorkout as jest.Mock).mockResolvedValue(mockSets);

            const result = await statsService.getWorkoutDensity('w1');

            // Volume = (100 * 5) + (100 * 5) + (80 * 10) = 500 + 500 + 800 = 1800 kg
            // Duration = 3600 seconds = 60 minutes
            // Density = 1800 / 60 = 30 kg/min
            expect(result).toBe(30);
        });

        it('should fall back to timestamps when duration is not available', async () => {
            const workoutWithoutDuration = { ...mockWorkout, duration: 0 };

            (dbService.getWorkoutById as jest.Mock).mockResolvedValue(workoutWithoutDuration);
            (dbService.getSetsForWorkout as jest.Mock).mockResolvedValue(mockSets);

            const result = await statsService.getWorkoutDensity('w1');

            expect(result).toBe(30);
        });

        it('should fall back to timestamps when duration is null', async () => {
            const workoutWithoutDuration = { ...mockWorkout, duration: null as any };

            (dbService.getWorkoutById as jest.Mock).mockResolvedValue(workoutWithoutDuration);
            (dbService.getSetsForWorkout as jest.Mock).mockResolvedValue(mockSets);

            const result = await statsService.getWorkoutDensity('w1');

            expect(result).toBe(30);
        });

        it('should return 0 when workout is not found', async () => {
            (dbService.getWorkoutById as jest.Mock).mockResolvedValue(null);

            const result = await statsService.getWorkoutDensity('w1');

            expect(result).toBe(0);
        });

        it('should return 0 when workout has no sets', async () => {
            (dbService.getWorkoutById as jest.Mock).mockResolvedValue(mockWorkout);
            (dbService.getSetsForWorkout as jest.Mock).mockResolvedValue([]);

            const result = await statsService.getWorkoutDensity('w1');

            expect(result).toBe(0);
        });

        it('should only count weight_reps exercises in volume calculation', async () => {
            const setsWithMixedTypes: any[] = [
                { id: 's1', exercise_type: 'weight_reps', weight: 100, reps: 5 },
                { id: 's2', exercise_type: 'distance_time', distance: 1000, time: 300 },
                { id: 's3', exercise_type: 'weight_reps', weight: 80, reps: 10 },
            ];

            (dbService.getWorkoutById as jest.Mock).mockResolvedValue(mockWorkout);
            (dbService.getSetsForWorkout as jest.Mock).mockResolvedValue(setsWithMixedTypes);

            const result = await statsService.getWorkoutDensity('w1');

            // Only weight_reps: (100 * 5) + (80 * 10) = 500 + 800 = 1300 kg
            // Density = 1300 / 60 = 21.67 kg/min
            expect(result).toBe(21.67);
        });

        it('should handle sets with null weight or reps', async () => {
            const setsWithNulls: any[] = [
                { id: 's1', exercise_type: 'weight_reps', weight: null, reps: 5 },
                { id: 's2', exercise_type: 'weight_reps', weight: 100, reps: null },
                { id: 's3', exercise_type: 'weight_reps', weight: 80, reps: 10 },
            ];

            (dbService.getWorkoutById as jest.Mock).mockResolvedValue(mockWorkout);
            (dbService.getSetsForWorkout as jest.Mock).mockResolvedValue(setsWithNulls);

            const result = await statsService.getWorkoutDensity('w1');

            // Volume = (0 * 5) + (100 * 0) + (80 * 10) = 0 + 0 + 800 = 800 kg
            // Density = 800 / 60 = 13.33 kg/min
            expect(result).toBe(13.33);
        });

        it('should return 0 when duration is 0 and no timestamps available', async () => {
            const workoutNoDuration = {
                id: 'w1',
                start_time: null,
                end_time: null,
                duration: 0,
            };

            (dbService.getWorkoutById as jest.Mock).mockResolvedValue(workoutNoDuration);
            (dbService.getSetsForWorkout as jest.Mock).mockResolvedValue(mockSets);

            const result = await statsService.getWorkoutDensity('w1');

            expect(result).toBe(0);
        });

        it('should round density to 2 decimal places', async () => {
            const setsForRounding: any[] = [
                { id: 's1', exercise_type: 'weight_reps', weight: 100, reps: 7 },
            ];

            const workoutWithOddDuration = {
                ...mockWorkout,
                duration: 3661, // 61.0167 minutes
            };

            (dbService.getWorkoutById as jest.Mock).mockResolvedValue(workoutWithOddDuration);
            (dbService.getSetsForWorkout as jest.Mock).mockResolvedValue(setsForRounding);

            const result = await statsService.getWorkoutDensity('w1');

            // Volume = 700 kg, Duration = 61.0167 min
            // Density = 700 / 61.0167 = 11.472... -> rounded to 11.47
            expect(result).toBe(11.47);
        });

        it('should handle workout with only end_time (no start_time)', async () => {
            const workoutWithOnlyEnd = {
                id: 'w1',
                start_time: null,
                end_time: new Date('2026-01-15T11:00:00Z').getTime(),
                duration: 3600,
            };

            (dbService.getWorkoutById as jest.Mock).mockResolvedValue(workoutWithOnlyEnd);
            (dbService.getSetsForWorkout as jest.Mock).mockResolvedValue(mockSets);

            const result = await statsService.getWorkoutDensity('w1');

            expect(result).toBe(30);
        });
    });

    describe('Integration: Wilks vs DOTS comparison', () => {
        it('should produce different values for the same input', () => {
            const bodyWeight = 90;
            const liftedTotal = 250;

            const wilksMale = statsService.calculateWilks(bodyWeight, liftedTotal, false);
            const dotsMale = statsService.calculateDOTS(bodyWeight, liftedTotal, false);

            expect(wilksMale).not.toBe(dotsMale);
        });

        it('should scale appropriately with increased weight', () => {
            const bodyWeight = 80;
            const liftedTotal1 = 200;
            const liftedTotal2 = 400;

            const wilks1 = statsService.calculateWilks(bodyWeight, liftedTotal1, false);
            const wilks2 = statsService.calculateWilks(bodyWeight, liftedTotal2, false);

            expect(wilks2).toBeGreaterThan(wilks1);
            expect(wilks2).toBeCloseTo(wilks1 * 2, 1);
        });
    });
});
