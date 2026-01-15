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

      (dbService.getSetsForWorkout as jest.Mock).mockResolvedValue([]);
      (dbService.getLastSetForExercise as jest.Mock).mockResolvedValue(null);

      await workoutService.addSet(workoutId, exerciseId);

      expect(dbService.addSet).toHaveBeenCalledWith(expect.objectContaining({
        weight: 0,
        reps: 0
      }));
    });
  });

  describe('updateSet', () => {
    it('should throw error for negative values', async () => {
      await expect(workoutService.updateSet('s1', { weight: -10 }))
        .rejects.toThrow('Weight cannot be negative');

      await expect(workoutService.updateSet('s1', { reps: -5 }))
        .rejects.toThrow('Reps cannot be negative');
    });

    it('should call dbService.updateSet for valid values', async () => {
      await workoutService.updateSet('s1', { weight: 100 });
      expect(dbService.updateSet).toHaveBeenCalledWith('s1', { weight: 100 });
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
});
