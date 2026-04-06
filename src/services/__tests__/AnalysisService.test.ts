import { AnalysisService } from '../AnalysisService';
import { dbService } from '../DatabaseService';

jest.mock('../DatabaseService', () => ({
  dbService: {
    getAll: jest.fn(),
    getFirst: jest.fn(),
  },
}));

describe('AnalysisService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getWorkoutComparison', () => {
    it('should calculate pct changes when previous has data', async () => {
      const now = new Date(2026, 0, 15, 12, 0, 0).getTime();
      jest.spyOn(Date, 'now').mockReturnValue(now);
      const days = 30;

      (dbService.getAll as jest.Mock)
        .mockResolvedValueOnce([
          { workoutId: 'w1', date: now - 1_000, volume: 600, total_sets: 6, total_reps: 30, durationMin: 60 },
          { workoutId: 'w2', date: now - 2_000, volume: 400, total_sets: 4, total_reps: 20, durationMin: 60 },
        ])
        .mockResolvedValueOnce([
          { workoutId: 'w3', date: now - 35 * 86400 * 1000, volume: 500, total_sets: 5, total_reps: 25, durationMin: 50 },
        ]);

      const result = await AnalysisService.getWorkoutComparison(days);

      expect(result.days).toBe(30);
      expect(result.current.workoutCount).toBe(2);
      expect(result.current.totalVolume).toBe(1000);
      expect(result.previous.workoutCount).toBe(1);
      expect(result.previous.totalVolume).toBe(500);
      expect(result.workoutChangePct).toBe(100);
      expect(result.volumeChangePct).toBe(100);
    });

    it('should return null pct changes when previous is zero', async () => {
      const now = new Date(2026, 0, 15, 12, 0, 0).getTime();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      (dbService.getAll as jest.Mock)
        .mockResolvedValueOnce([
          { workoutId: 'w1', date: now - 1_000, volume: 500, total_sets: 5, total_reps: 20, durationMin: 60 },
          { workoutId: 'w2', date: now - 2_000, volume: 400, total_sets: 4, total_reps: 16, durationMin: null },
        ])
        .mockResolvedValueOnce([]);

      const result = await AnalysisService.getWorkoutComparison(7);

      expect(result.workoutChangePct).toBeNull();
      expect(result.volumeChangePct).toBeNull();
    });
  });

  describe('getVolumeSeries', () => {
    it('should aggregate per day', async () => {
      const d1 = new Date(2026, 0, 1, 12, 0, 0).getTime();
      const d2 = new Date(2026, 0, 2, 12, 0, 0).getTime();

      (dbService.getAll as jest.Mock).mockResolvedValueOnce([
        { date: d1, volume: 100 },
        { date: d1 + 3600 * 1000, volume: 50 },
        { date: d2, volume: 200 },
      ]);

      const points = await AnalysisService.getVolumeSeries(30, 'day');

      expect(points.length).toBe(2);
      expect(points[0].volume).toBe(150);
      expect(points[1].volume).toBe(200);
      expect(points[0].dateMs).toBeLessThan(points[1].dateMs);
    });

    it('should aggregate per week', async () => {
      const monday = new Date(2026, 0, 5, 12, 0, 0).getTime();
      const wednesday = new Date(2026, 0, 7, 12, 0, 0).getTime();

      (dbService.getAll as jest.Mock).mockResolvedValueOnce([
        { date: monday, volume: 100 },
        { date: wednesday, volume: 50 },
      ]);

      const points = await AnalysisService.getVolumeSeries(30, 'week');

      expect(points.length).toBe(1);
      expect(points[0].volume).toBe(150);
    });
  });

  describe('getCategoryVolume', () => {
    it('should round volumes', async () => {
      (dbService.getAll as jest.Mock).mockResolvedValueOnce([
        { categoryId: 'c1', categoryName: 'Pecho', categoryColor: '#fff', volume: 1234.6, total_sets: 12 },
      ]);

      const rows = await AnalysisService.getCategoryVolume(30, 6);

      expect(rows[0].volume).toBe(1235);
      expect(rows[0].setCount).toBe(12);
    });
  });

  describe('getTopExercisesByVolume', () => {
    it('should round volumes and return exercises', async () => {
      (dbService.getAll as jest.Mock).mockResolvedValueOnce([
        { exerciseId: 'e1', exerciseName: 'Bench', categoryName: 'Pecho', categoryColor: '#fff', volume: 1000.4, total_sets: 9 },
      ]);

      const rows = await AnalysisService.getTopExercisesByVolume(30, 8);
      expect(rows[0].exerciseId).toBe('e1');
      expect(rows[0].volume).toBe(1000);
      expect(rows[0].setCount).toBe(9);
    });
  });

  describe('getTop1RMProgress', () => {
    it('should compute progress when both halves exist', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(new Date(2026, 0, 15, 12, 0, 0).getTime());
      const now = Date.now();
      const cutoff = now - (30 * 86400 * 1000);
      const mid = cutoff + Math.floor((now - cutoff) / 2);

      (dbService.getAll as jest.Mock).mockResolvedValueOnce([
        { exerciseId: 'e1', exerciseName: 'Bench', start1RM: 93, end1RM: 105, dateFirst: mid - 1000, dateLast: mid + 1000 },
      ]);

      const rows = await AnalysisService.getTop1RMProgress(30, 6);
      expect(rows.length).toBe(1);
      expect(rows[0].exerciseId).toBe('e1');
      expect(rows[0].delta).toBeGreaterThan(0);
    });
  });
});
