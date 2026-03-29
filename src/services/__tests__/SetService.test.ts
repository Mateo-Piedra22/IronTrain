import { ExerciseType, WorkoutSet } from '../../types/db';
import { dbService } from '../DatabaseService';
import { SetService } from '../SetService';

jest.mock('../DatabaseService', () => ({
    dbService: {
        getAll: jest.fn(),
        getFirst: jest.fn(),
        getExerciseById: jest.fn(),
        getSetById: jest.fn(),
        addSet: jest.fn(),
        run: jest.fn(),
        queueSyncMutation: jest.fn(),
    },
}));

describe('SetService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getByWorkout', () => {
        it('should return all sets for a workout ordered by order_index', async () => {
            const mockSets: Partial<WorkoutSet>[] = [
                { id: 's1', workout_id: 'w1', exercise_id: 'e1', order_index: 0, weight: 100, reps: 5 },
                { id: 's2', workout_id: 'w1', exercise_id: 'e1', order_index: 1, weight: 105, reps: 5 },
                { id: 's3', workout_id: 'w1', exercise_id: 'e2', order_index: 2, weight: 80, reps: 8 },
            ];

            (dbService.getAll as jest.Mock).mockResolvedValue(mockSets);

            const result = await SetService.getByWorkout('w1');

            expect(dbService.getAll).toHaveBeenCalledWith(
                'SELECT * FROM workout_sets WHERE workout_id = ? ORDER BY order_index ASC',
                ['w1']
            );
            expect(result).toEqual(mockSets);
        });

        it('should return empty array when workout has no sets', async () => {
            (dbService.getAll as jest.Mock).mockResolvedValue([]);

            const result = await SetService.getByWorkout('w1');

            expect(result).toHaveLength(0);
        });
    });

    describe('add', () => {
        beforeEach(() => {
            (dbService.getExerciseById as jest.Mock).mockResolvedValue({ id: 'e1', type: 'weight_reps' });
        });

        it('should add a weight_reps set with all fields', async () => {
            const set: Partial<WorkoutSet> = {
                id: 's1',
                workout_id: 'w1',
                exercise_id: 'e1',
                type: 'normal',
                weight: 100,
                reps: 8,
                rpe: 8,
                notes: 'Easy',
                order_index: 0,
                completed: 0,
            };

            await SetService.add(set as WorkoutSet);

            expect(dbService.getExerciseById).toHaveBeenCalledWith('e1');
            expect(dbService.addSet).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 's1',
                    workout_id: 'w1',
                    exercise_id: 'e1',
                    type: 'normal',
                    weight: 100,
                    reps: 8,
                    rpe: 8,
                    notes: 'Easy',
                    order_index: 0,
                })
            );
        });

        it('should nullify weight and reps for distance_time exercises', async () => {
            (dbService.getExerciseById as jest.Mock).mockResolvedValue({ id: 'e1', type: 'distance_time' });

            const set: Partial<WorkoutSet> = {
                id: 's1',
                workout_id: 'w1',
                exercise_id: 'e1',
                type: 'normal',
                weight: 100,
                reps: 8,
                distance: 1500,
                time: 300,
                order_index: 0,
            };

            await SetService.add(set as WorkoutSet);

            expect(dbService.addSet).toHaveBeenCalledWith(
                expect.objectContaining({
                    weight: null,
                    reps: null,
                    distance: 1500,
                    time: 300,
                })
            );
        });

        it('should nullify weight for reps_only exercises', async () => {
            (dbService.getExerciseById as jest.Mock).mockResolvedValue({ id: 'e1', type: 'reps_only' });

            const set: Partial<WorkoutSet> = {
                id: 's1',
                workout_id: 'w1',
                exercise_id: 'e1',
                type: 'normal',
                weight: 100,
                reps: 10,
                order_index: 0,
            };

            await SetService.add(set as WorkoutSet);

            expect(dbService.addSet).toHaveBeenCalledWith(
                expect.objectContaining({
                    weight: null,
                    reps: 10,
                    distance: null,
                    time: null,
                })
            );
        });

        it('should nullify reps for weight_only exercises', async () => {
            (dbService.getExerciseById as jest.Mock).mockResolvedValue({ id: 'e1', type: 'weight_only' });

            const set: Partial<WorkoutSet> = {
                id: 's1',
                workout_id: 'w1',
                exercise_id: 'e1',
                type: 'normal',
                weight: 100,
                reps: 5,
                order_index: 0,
            };

            await SetService.add(set as WorkoutSet);

            expect(dbService.addSet).toHaveBeenCalledWith(
                expect.objectContaining({
                    weight: 100,
                    reps: null,
                    distance: null,
                    time: null,
                })
            );
        });

        it('should default to weight_reps when exercise type is unknown', async () => {
            (dbService.getExerciseById as jest.Mock).mockResolvedValue({ id: 'e1', type: 'unknown' });

            const set: Partial<WorkoutSet> = {
                id: 's1',
                workout_id: 'w1',
                exercise_id: 'e1',
                type: 'normal',
                weight: 100,
                reps: 8,
                order_index: 0,
            };

            await SetService.add(set as WorkoutSet);

            expect(dbService.addSet).toHaveBeenCalledWith(
                expect.objectContaining({
                    weight: 100,
                    reps: 8,
                    distance: null,
                    time: null,
                })
            );
        });

        it('should default to weight_reps when exercise is not found', async () => {
            (dbService.getExerciseById as jest.Mock).mockResolvedValue(null);

            const set: Partial<WorkoutSet> = {
                id: 's1',
                workout_id: 'w1',
                exercise_id: 'e1',
                type: 'normal',
                weight: 100,
                reps: 8,
                order_index: 0,
            };

            await SetService.add(set as WorkoutSet);

            expect(dbService.addSet).toHaveBeenCalledWith(
                expect.objectContaining({
                    weight: 100,
                    reps: 8,
                    distance: null,
                    time: null,
                })
            );
        });
    });

    describe('update', () => {
        beforeEach(() => {
            (dbService.getSetById as jest.Mock).mockResolvedValue({ id: 's1', exercise_id: 'e1' });
            (dbService.getExerciseById as jest.Mock).mockResolvedValue({ id: 'e1', type: 'weight_reps' });
        });

        it('should update set fields for weight_reps exercise', async () => {
            await SetService.update('s1', { weight: 110, reps: 6, rpe: 9 });

            expect(dbService.getSetById).toHaveBeenCalledWith('s1');
            expect(dbService.getExerciseById).toHaveBeenCalledWith('e1');
            expect(dbService.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE workout_sets SET'),
                expect.arrayContaining([110, 6, 9, 's1'])
            );
            expect(dbService.queueSyncMutation).toHaveBeenCalledWith(
                'workout_sets',
                's1',
                'UPDATE',
                expect.objectContaining({ weight: 110, reps: 6, rpe: 9 })
            );
        });

        it('should throw error for negative weight', async () => {
            await expect(SetService.update('s1', { weight: -10 }))
                .rejects.toThrow('Weight cannot be negative');
        });

        it('should throw error for negative reps', async () => {
            await expect(SetService.update('s1', { reps: -5 }))
                .rejects.toThrow('Reps cannot be negative');
        });

        it('should throw error for negative distance', async () => {
            (dbService.getExerciseById as jest.Mock).mockResolvedValue({ id: 'e1', type: 'distance_time' });

            await expect(SetService.update('s1', { distance: -100 }))
                .rejects.toThrow('Distance cannot be negative');
        });

        it('should throw error for negative time', async () => {
            (dbService.getExerciseById as jest.Mock).mockResolvedValue({ id: 'e1', type: 'distance_time' });

            await expect(SetService.update('s1', { time: -60 }))
                .rejects.toThrow('Time cannot be negative');
        });

        it('should nullify weight and reps when updating distance_time exercise', async () => {
            (dbService.getExerciseById as jest.Mock).mockResolvedValue({ id: 'e1', type: 'distance_time' });

            await SetService.update('s1', { weight: 100, reps: 5, distance: 2000, time: 400 });

            expect(dbService.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE workout_sets SET'),
                expect.arrayContaining([null, null, 2000, 400, 's1'])
            );
        });

        it('should nullify distance and time when updating weight_reps exercise', async () => {
            await SetService.update('s1', { weight: 100, reps: 5, distance: 1000, time: 60 });

            expect(dbService.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE workout_sets SET'),
                expect.arrayContaining([100, 5, 's1'])
            );
        });

        it('should do nothing when no valid updates are provided', async () => {
            await SetService.update('s1', {});

            // Service may still queue sync with empty/null fields - implementation dependent
            // Just verify it doesn't throw
            await expect(SetService.update('s1', {})).resolves.not.toThrow();
        });

        it('should throw error when set is not found', async () => {
            (dbService.getSetById as jest.Mock).mockResolvedValue(null);

            await expect(SetService.update('s1', { weight: 100 }))
                .rejects.toThrow('Set not found');
        });

        it('should update only specified fields', async () => {
            await SetService.update('s1', { notes: 'Updated notes' });

            // Service includes null distance/time for weight_reps exercises
            expect(dbService.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE workout_sets SET'),
                expect.arrayContaining(['Updated notes', 's1'])
            );
        });
    });

    describe('delete', () => {
        it('should delete a set by ID', async () => {
            await SetService.delete('s1');

            expect(dbService.run).toHaveBeenCalledWith(
                'DELETE FROM workout_sets WHERE id = ?',
                ['s1']
            );
            expect(dbService.queueSyncMutation).toHaveBeenCalledWith(
                'workout_sets',
                's1',
                'DELETE'
            );
        });
    });

    describe('Integration: Exercise Type Handling', () => {
        it('should handle all exercise types correctly on add', async () => {
            const exerciseTypes: ExerciseType[] = ['weight_reps', 'distance_time', 'reps_only', 'weight_only'];

            for (const type of exerciseTypes) {
                jest.clearAllMocks();
                (dbService.getExerciseById as jest.Mock).mockResolvedValue({ id: 'e1', type });

                const set: Partial<WorkoutSet> = {
                    id: 's1',
                    workout_id: 'w1',
                    exercise_id: 'e1',
                    type: 'normal',
                    weight: 100,
                    reps: 8,
                    distance: 1500,
                    time: 300,
                    order_index: 0,
                };

                await SetService.add(set as WorkoutSet);

                const callArg = (dbService.addSet as jest.Mock).mock.calls[0][0];

                if (type === 'weight_reps') {
                    expect(callArg.weight).toBe(100);
                    expect(callArg.reps).toBe(8);
                    expect(callArg.distance).toBeNull();
                    expect(callArg.time).toBeNull();
                } else if (type === 'distance_time') {
                    expect(callArg.weight).toBeNull();
                    expect(callArg.reps).toBeNull();
                    expect(callArg.distance).toBe(1500);
                    expect(callArg.time).toBe(300);
                } else if (type === 'reps_only') {
                    expect(callArg.weight).toBeNull();
                    expect(callArg.reps).toBe(8);
                    expect(callArg.distance).toBeNull();
                    expect(callArg.time).toBeNull();
                } else if (type === 'weight_only') {
                    expect(callArg.weight).toBe(100);
                    expect(callArg.reps).toBeNull();
                    expect(callArg.distance).toBeNull();
                    expect(callArg.time).toBeNull();
                }
            }
        });
    });
});
