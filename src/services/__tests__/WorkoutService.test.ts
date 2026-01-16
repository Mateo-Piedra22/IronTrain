import { dbService } from '../DatabaseService';
import { workoutService } from '../WorkoutService';

// Mock dependencies
jest.mock('../DatabaseService', () => ({
  dbService: {
    run: jest.fn(),
    getAll: jest.fn(),
    getWorkoutById: jest.fn(),
    getWorkoutByDate: jest.fn(),
    createWorkout: jest.fn(),
    addSet: jest.fn(),
    updateSet: jest.fn(),
    deleteSet: jest.fn(),
    getSetsForWorkout: jest.fn(),
    getLastSetForExercise: jest.fn(),
    getSetById: jest.fn(),
    getExerciseById: jest.fn(),
  },
}));

describe('WorkoutService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (workoutService as any).calendarEventsCache = null;
    if ((workoutService as any).exerciseHistoryCache?.clear) {
      (workoutService as any).exerciseHistoryCache.clear();
    }
  });

  describe('getCalendarEvents', () => {
    it('should build events map from grouped query rows', async () => {
      const d1 = Date.UTC(2026, 0, 2, 12, 0, 0);
      const d2 = Date.UTC(2026, 0, 3, 12, 0, 0);

      (dbService.getAll as jest.Mock).mockResolvedValue([
        { id: 'w1', date: d1, status: 'completed', colors: '#111111,#222222' },
        { id: 'w2', date: d2, status: 'in_progress', colors: null },
      ]);

      const events = await workoutService.getCalendarEvents();

      expect(events['2026-01-02']).toEqual({ status: 'completed', colors: ['#111111', '#222222'] });
      expect(events['2026-01-03']).toEqual({ status: 'in_progress', colors: [] });
    });

    it('should cache events briefly to avoid repeated queries', async () => {
      const d1 = Date.UTC(2026, 0, 2, 12, 0, 0);
      (dbService.getAll as jest.Mock).mockResolvedValue([
        { id: 'w1', date: d1, status: 'completed', colors: '#111111' },
      ]);

      await workoutService.getCalendarEvents();
      await workoutService.getCalendarEvents();

      expect(dbService.getAll).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cache after workout mutation', async () => {
      const d1 = Date.UTC(2026, 0, 2, 12, 0, 0);
      (dbService.getAll as jest.Mock).mockResolvedValue([
        { id: 'w1', date: d1, status: 'completed', colors: '#111111' },
      ]);

      // @ts-ignore
      (dbService.getWorkoutById as jest.Mock).mockResolvedValue({ id: 'w1', status: 'in_progress' });

      await workoutService.getCalendarEvents();
      await workoutService.finishWorkout('w1');
      await workoutService.getCalendarEvents();

      expect(dbService.getAll).toHaveBeenCalledTimes(2);
    });
  });

  describe('addSet (Ghost Logic)', () => {
    it('should copy values from the previous set in the SAME workout if available', async () => {
      const workoutId = 'w1';
      const exerciseId = 'e1';

      (dbService.getExerciseById as jest.Mock).mockResolvedValue({ id: 'e1', type: 'weight_reps' });

      // Mock current sets: one set already exists
      (dbService.getSetsForWorkout as jest.Mock).mockResolvedValue([
        { id: 's1', exercise_id: 'e1', weight: 100, reps: 5, order_index: 0 }
      ]);

      await workoutService.addSet(workoutId, exerciseId);

      expect(dbService.addSet).toHaveBeenCalledWith(expect.objectContaining({
        weight: 100,
        reps: 5,
        order_index: 1
      }));
    });

    it('should fetch from HISTORY if no set exists in current workout', async () => {
      const workoutId = 'w1';
      const exerciseId = 'e1';

      (dbService.getExerciseById as jest.Mock).mockResolvedValue({ id: 'e1', type: 'weight_reps' });

      // No current sets
      (dbService.getSetsForWorkout as jest.Mock).mockResolvedValue([]);

      // History set exists
      (dbService.getLastSetForExercise as jest.Mock).mockResolvedValue({
        weight: 90,
        reps: 8
      });

      await workoutService.addSet(workoutId, exerciseId);

      expect(dbService.addSet).toHaveBeenCalledWith(expect.objectContaining({
        weight: 90,
        reps: 8,
        order_index: 0
      }));
    });

    it('should default to 0 if no history exists', async () => {
      const workoutId = 'w1';
      const exerciseId = 'e1';

      (dbService.getExerciseById as jest.Mock).mockResolvedValue({ id: 'e1', type: 'weight_reps' });

      (dbService.getSetsForWorkout as jest.Mock).mockResolvedValue([]);
      (dbService.getLastSetForExercise as jest.Mock).mockResolvedValue(null);

      await workoutService.addSet(workoutId, exerciseId);

      expect(dbService.addSet).toHaveBeenCalledWith(expect.objectContaining({
        weight: 0,
        reps: 0
      }));
    });

    it('should create distance/time set without weight/reps for distance_time exercises', async () => {
      const workoutId = 'w1';
      const exerciseId = 'bike';

      (dbService.getExerciseById as jest.Mock).mockResolvedValue({ id: 'bike', type: 'distance_time' });
      (dbService.getSetsForWorkout as jest.Mock).mockResolvedValue([]);
      (dbService.getLastSetForExercise as jest.Mock).mockResolvedValue({ distance: 2500, time: 600 });

      await workoutService.addSet(workoutId, exerciseId);

      expect(dbService.addSet).toHaveBeenCalledWith(expect.objectContaining({
        workout_id: workoutId,
        exercise_id: exerciseId,
        weight: null,
        reps: null,
      }));
    });
  });

  describe('updateSet', () => {
    it('should throw error for negative values', async () => {
      (dbService.getSetById as jest.Mock).mockResolvedValue({ id: 's1', exercise_id: 'e1' });
      (dbService.getExerciseById as jest.Mock).mockResolvedValue({ id: 'e1', type: 'weight_reps' });
      await expect(workoutService.updateSet('s1', { weight: -10 }))
        .rejects.toThrow('Weight cannot be negative');

      (dbService.getSetById as jest.Mock).mockResolvedValue({ id: 's1', exercise_id: 'e1' });
      (dbService.getExerciseById as jest.Mock).mockResolvedValue({ id: 'e1', type: 'weight_reps' });
      await expect(workoutService.updateSet('s1', { reps: -5 }))
        .rejects.toThrow('Reps cannot be negative');
    });

    it('should call dbService.updateSet for valid values', async () => {
      (dbService.getSetById as jest.Mock).mockResolvedValue({ id: 's1', exercise_id: 'e1' });
      (dbService.getExerciseById as jest.Mock).mockResolvedValue({ id: 'e1', type: 'weight_reps' });
      await workoutService.updateSet('s1', { weight: 100 });
      expect(dbService.updateSet).toHaveBeenCalledWith('s1', expect.objectContaining({ weight: 100 }));
    });

    it('should ignore weight/reps updates for distance_time exercises and allow distance/time', async () => {
      (dbService.getSetById as jest.Mock).mockResolvedValue({ id: 's1', exercise_id: 'bike' });
      (dbService.getExerciseById as jest.Mock).mockResolvedValue({ id: 'bike', type: 'distance_time' });

      await workoutService.updateSet('s1', { weight: 100, reps: 10, distance: 1500, time: 300 });

      expect(dbService.updateSet).toHaveBeenCalledWith('s1', expect.objectContaining({
        weight: null,
        reps: null,
        distance: 1500,
        time: 300,
      }));
    });
  });

  describe('finishWorkout', () => {
    it('should mark workout as completed and set end_time', async () => {
        // @ts-ignore
      (dbService.getWorkoutById as jest.Mock).mockResolvedValue({ id: 'w1', status: 'in_progress' });

      await workoutService.finishWorkout('w1');

      expect(dbService.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE workouts SET status = ?, end_time = ?'),
        expect.arrayContaining(['completed'])
      );
    });

    it('should do nothing if already completed', async () => {
        // @ts-ignore
      (dbService.getWorkoutById as jest.Mock).mockResolvedValue({ id: 'w1', status: 'completed' });

      await workoutService.finishWorkout('w1');

      expect(dbService.run).not.toHaveBeenCalled();
    });
  });

  describe('getExerciseHistory', () => {
    it('should include cutoff when days is provided', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(new Date(2026, 0, 15, 12, 0, 0).getTime());
      (dbService.getAll as jest.Mock).mockResolvedValueOnce([{ id: 'w1', date: Date.now() - 1000 }]);
      (dbService.getAll as jest.Mock).mockResolvedValueOnce([]);

      await workoutService.getExerciseHistory('e1', 10, 30);

      expect(dbService.getAll).toHaveBeenCalledWith(
        expect.stringContaining('AND w.date > ?'),
        expect.arrayContaining(['e1'])
      );
    });
  });

  describe('copyWorkoutToWorkout / copyWorkoutToWorkoutAdvanced', () => {
    it('should copy sets into existing target workout (transactional) and normalize order', async () => {
      (dbService.getWorkoutById as jest.Mock)
        .mockResolvedValueOnce({ id: 'source', name: 'Pecho', status: 'completed' })
        .mockResolvedValueOnce({ id: 'target', name: null, status: 'in_progress' });

      (dbService.getAll as jest.Mock).mockResolvedValueOnce([{ id: 'e1' }, { id: 'e2' }]);

      (dbService.getSetsForWorkout as jest.Mock)
        .mockResolvedValueOnce([]) // target sets
        .mockResolvedValueOnce([
          { id: 's2', workout_id: 'source', exercise_id: 'e2', type: 'normal', order_index: 5, weight: 20, reps: 10, distance: null, time: null, rpe: 8, notes: 'ok', superset_id: 'sup1' },
          { id: 's1', workout_id: 'source', exercise_id: 'e1', type: 'warmup', order_index: 0, weight: 10, reps: 5, distance: null, time: null, rpe: null, notes: null, superset_id: 'sup1' },
        ]);

      await workoutService.copyWorkoutToWorkout('source', 'target');

      expect(dbService.run).toHaveBeenCalledWith('BEGIN TRANSACTION');
      expect(dbService.run).toHaveBeenCalledWith(expect.stringContaining('UPDATE workouts SET name = ?'), expect.any(Array));
      expect(dbService.addSet).toHaveBeenCalledTimes(2);

      const firstAdd = (dbService.addSet as jest.Mock).mock.calls[0][0];
      const secondAdd = (dbService.addSet as jest.Mock).mock.calls[1][0];
      expect(firstAdd.workout_id).toBe('target');
      expect(firstAdd.order_index).toBe(0);
      expect(secondAdd.order_index).toBe(1);
      expect(firstAdd.superset_id).toBeTruthy();
      expect(secondAdd.superset_id).toBe(firstAdd.superset_id);
      expect(dbService.run).toHaveBeenCalledWith('COMMIT');
    });

    it('should replace existing target sets by default (no duplicate workouts)', async () => {
      (dbService.getWorkoutById as jest.Mock)
        .mockResolvedValueOnce({ id: 'source', name: 'Pecho', status: 'completed' })
        .mockResolvedValueOnce({ id: 'target', name: 'Día', status: 'in_progress' });

      (dbService.getAll as jest.Mock).mockResolvedValueOnce([{ id: 'e1' }]);

      (dbService.getSetsForWorkout as jest.Mock)
        .mockResolvedValueOnce([{ id: 'existing', order_index: 0 }]) // target sets
        .mockResolvedValueOnce([{ id: 's1', workout_id: 'source', exercise_id: 'e1', type: 'normal', order_index: 0 }]); // source sets

      await workoutService.copyWorkoutToWorkout('source', 'target');

      expect(dbService.run).toHaveBeenCalledWith('BEGIN TRANSACTION');
      expect(dbService.run).toHaveBeenCalledWith('DELETE FROM workout_sets WHERE workout_id = ?', ['target']);
      expect(dbService.addSet).toHaveBeenCalledTimes(1);
      expect(dbService.run).toHaveBeenCalledWith('COMMIT');
    });

    it('should append sets at the end when mode is append', async () => {
      (dbService.getWorkoutById as jest.Mock)
        .mockResolvedValueOnce({ id: 'source', name: 'Pecho', status: 'completed' })
        .mockResolvedValueOnce({ id: 'target', name: 'Día', status: 'in_progress' });

      (dbService.getAll as jest.Mock).mockResolvedValueOnce([{ id: 'e1' }]);

      (dbService.getSetsForWorkout as jest.Mock)
        .mockResolvedValueOnce([{ id: 't1', order_index: 0 }, { id: 't2', order_index: 2 }]) // target sets (gap)
        .mockResolvedValueOnce([{ id: 's1', workout_id: 'source', exercise_id: 'e1', type: 'normal', order_index: 0 }]); // source sets

      await workoutService.copyWorkoutToWorkoutAdvanced('source', 'target', { mode: 'append' });

      expect(dbService.run).toHaveBeenCalledWith('BEGIN TRANSACTION');
      expect(dbService.run).not.toHaveBeenCalledWith('DELETE FROM workout_sets WHERE workout_id = ?', expect.anything());
      expect(dbService.addSet).toHaveBeenCalledTimes(1);
      const add = (dbService.addSet as jest.Mock).mock.calls[0][0];
      expect(add.order_index).toBe(3);
      expect(dbService.run).toHaveBeenCalledWith('COMMIT');
    });

    it('should require resume or fail when target is completed', async () => {
      (dbService.getWorkoutById as jest.Mock)
        .mockResolvedValueOnce({ id: 'source', name: 'Pecho', status: 'completed' })
        .mockResolvedValueOnce({ id: 'target', name: 'Día', status: 'completed' });

      await expect(
        workoutService.copyWorkoutToWorkoutAdvanced('source', 'target', { mode: 'append' })
      ).rejects.toThrow('El día destino está finalizado');

      (dbService.getWorkoutById as jest.Mock)
        .mockResolvedValueOnce({ id: 'source', name: 'Pecho', status: 'completed' })
        .mockResolvedValueOnce({ id: 'target', name: 'Día', status: 'completed' });

      (dbService.getAll as jest.Mock).mockResolvedValueOnce([{ id: 'e1' }]);

      (dbService.getSetsForWorkout as jest.Mock)
        .mockResolvedValueOnce([]) // target sets
        .mockResolvedValueOnce([{ id: 's1', workout_id: 'source', exercise_id: 'e1', type: 'normal', order_index: 0 }]); // source sets

      await workoutService.copyWorkoutToWorkoutAdvanced('source', 'target', { mode: 'replace', resumeTargetIfCompleted: true });

      expect(dbService.run).toHaveBeenCalledWith(
        'UPDATE workouts SET status = ?, end_time = NULL WHERE id = ?',
        ['in_progress', 'target']
      );
    });

    it('should copy structure without values when content is structure', async () => {
      (dbService.getWorkoutById as jest.Mock)
        .mockResolvedValueOnce({ id: 'source', name: 'Pecho', status: 'completed' })
        .mockResolvedValueOnce({ id: 'target', name: 'Día', status: 'in_progress' });

      (dbService.getAll as jest.Mock).mockResolvedValueOnce([{ id: 'e1' }]);

      (dbService.getSetsForWorkout as jest.Mock)
        .mockResolvedValueOnce([]) // target sets
        .mockResolvedValueOnce([{ id: 's1', workout_id: 'source', exercise_id: 'e1', type: 'warmup', order_index: 0, weight: 50, reps: 5 }]); // source sets

      await workoutService.copyWorkoutToWorkoutAdvanced('source', 'target', { mode: 'replace', content: 'structure' });

      const add = (dbService.addSet as jest.Mock).mock.calls[0][0];
      expect(add.weight).toBeNull();
      expect(add.reps).toBeNull();
      expect(add.type).toBe('warmup');
    });

    it('should copy only unique exercises when content is exercises_only', async () => {
      (dbService.getWorkoutById as jest.Mock)
        .mockResolvedValueOnce({ id: 'source', name: 'Pecho', status: 'completed' })
        .mockResolvedValueOnce({ id: 'target', name: 'Día', status: 'in_progress' });

      (dbService.getAll as jest.Mock).mockResolvedValueOnce([{ id: 'e1' }, { id: 'e2' }]);

      (dbService.getSetsForWorkout as jest.Mock)
        .mockResolvedValueOnce([]) // target sets
        .mockResolvedValueOnce([
          { id: 's1', workout_id: 'source', exercise_id: 'e1', type: 'warmup', order_index: 0 },
          { id: 's2', workout_id: 'source', exercise_id: 'e1', type: 'normal', order_index: 1 },
          { id: 's3', workout_id: 'source', exercise_id: 'e2', type: 'normal', order_index: 2 },
        ]);

      await workoutService.copyWorkoutToWorkoutAdvanced('source', 'target', { mode: 'replace', content: 'exercises_only' });

      expect(dbService.addSet).toHaveBeenCalledTimes(2);
      const first = (dbService.addSet as jest.Mock).mock.calls[0][0];
      expect(first.type).toBe('normal');
      expect(first.weight).toBeNull();
    });

    it('should dedupe by exercise when appending with dedupeByExercise', async () => {
      (dbService.getWorkoutById as jest.Mock)
        .mockResolvedValueOnce({ id: 'source', name: 'Pecho', status: 'completed' })
        .mockResolvedValueOnce({ id: 'target', name: 'Día', status: 'in_progress' });

      (dbService.getAll as jest.Mock).mockResolvedValueOnce([{ id: 'e1' }, { id: 'e2' }]);

      (dbService.getSetsForWorkout as jest.Mock)
        .mockResolvedValueOnce([{ id: 't1', exercise_id: 'e1', order_index: 0 }]) // target sets
        .mockResolvedValueOnce([
          { id: 's1', workout_id: 'source', exercise_id: 'e1', type: 'normal', order_index: 0 },
          { id: 's2', workout_id: 'source', exercise_id: 'e2', type: 'normal', order_index: 1 },
        ]);

      const res = await workoutService.copyWorkoutToWorkoutAdvanced('source', 'target', { mode: 'append', dedupeByExercise: true });

      expect(res.skippedExistingExercises).toBe(1);
      expect(dbService.addSet).toHaveBeenCalledTimes(1);
      const add = (dbService.addSet as jest.Mock).mock.calls[0][0];
      expect(add.exercise_id).toBe('e2');
    });

    it('should skip sets with missing exercises and fail if nothing remains', async () => {
      (dbService.getWorkoutById as jest.Mock)
        .mockResolvedValueOnce({ id: 'source', name: 'Pecho', status: 'completed' })
        .mockResolvedValueOnce({ id: 'target', name: 'Día', status: 'in_progress' });

      (dbService.getAll as jest.Mock).mockResolvedValueOnce([{ id: 'e1' }]);

      (dbService.getSetsForWorkout as jest.Mock)
        .mockResolvedValueOnce([]) // target sets
        .mockResolvedValueOnce([
          { id: 's1', workout_id: 'source', exercise_id: 'e2', type: 'normal', order_index: 0 },
        ]);

      await expect(
        workoutService.copyWorkoutToWorkoutAdvanced('source', 'target', { mode: 'replace' })
      ).rejects.toThrow('faltan ejercicios');
    });
  });
});
