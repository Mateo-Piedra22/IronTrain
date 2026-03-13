import { dbService } from '../DatabaseService';
import { DuplicateResolutionService } from '../DuplicateResolutionService';

jest.mock('../DatabaseService', () => ({
  dbService: {
    getAll: jest.fn(),
    run: jest.fn(),
    withTransaction: jest.fn(async (cb: () => Promise<void>) => {
      await cb();
    }),
    queueSyncMutation: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    captureException: jest.fn(),
  },
}));

describe('DuplicateResolutionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('scanHardDuplicates', () => {
    it('returns hard duplicate groups for categories, badges, and exercises', async () => {
      (dbService.getAll as jest.Mock)
        .mockResolvedValueOnce([
          { id: 'c1', name: 'Pecho', origin_id: null },
          { id: 'c2', name: '  pecho  ', origin_id: 'remote' },
        ])
        .mockResolvedValueOnce([
          { id: 'b1', name: 'Fuerza', origin_id: null, group_name: 'Tipo' },
          { id: 'b2', name: 'fuerza', origin_id: 'remote', group_name: 'tipo' },
        ])
        .mockResolvedValueOnce([
          { id: 'e1', name: 'Press banca', origin_id: null, category_id: 'c1', type: 'weight_reps' },
          { id: 'e2', name: 'press  banca', origin_id: 'remote', category_id: 'c1', type: 'weight_reps' },
        ])
        .mockResolvedValueOnce([
          { exercise_id: 'e1', badge_id: 'b1' },
          { exercise_id: 'e2', badge_id: 'b1' },
        ]);

      const res = await DuplicateResolutionService.scanHardDuplicates();

      const types = new Set((res.hard ?? []).map((g) => g.type));
      expect(types.has('category')).toBe(true);
      expect(types.has('badge')).toBe(true);
      expect(types.has('exercise')).toBe(true);

      const categoryGroup = (res.hard ?? []).find((g) => g.type === 'category');
      expect(categoryGroup?.candidates.length).toBe(2);

      const badgeGroup = (res.hard ?? []).find((g) => g.type === 'badge');
      expect(badgeGroup?.candidates.length).toBe(2);

      const exerciseGroup = (res.hard ?? []).find((g) => g.type === 'exercise');
      expect(exerciseGroup?.candidates.length).toBe(2);
    });

    it('returns empty on db errors (no throw)', async () => {
      (dbService.getAll as jest.Mock).mockRejectedValueOnce(new Error('db down'));
      const res = await DuplicateResolutionService.scanHardDuplicates();
      expect(res.hard).toEqual([]);
    });
  });

  describe('scanAllDuplicates', () => {
    it('returns both hard and soft duplicates', async () => {
      (dbService.getAll as jest.Mock)
        .mockResolvedValueOnce([
          { id: 'c1', name: 'Press de banca', origin_id: null },
          { id: 'c2', name: 'Banca, press', origin_id: 'remote' },
        ])
        .mockResolvedValueOnce([
          { id: 'b1', name: 'Barra Z', origin_id: null, group_name: 'Equipamiento' },
          { id: 'b2', name: 'Z Barra', origin_id: 'remote', group_name: 'Equipamiento' },
        ])
        .mockResolvedValueOnce([
          { id: 'e1', name: 'Press de banca', origin_id: null, category_id: 'cX', type: 'weight_reps' },
          { id: 'e2', name: 'Banca press', origin_id: 'remote', category_id: 'cX', type: 'weight_reps' },
        ])
        .mockResolvedValueOnce([
          { exercise_id: 'e1', badge_id: 'b1' },
          { exercise_id: 'e2', badge_id: 'b1' },
        ]);

      const res = await DuplicateResolutionService.scanAllDuplicates();
      expect(Array.isArray(res.hard)).toBe(true);
      expect(Array.isArray(res.soft)).toBe(true);

      // These are not strict-equal names, so they should land in soft groups
      expect(res.hard.length).toBe(0);
      expect(res.soft.length).toBeGreaterThan(0);

      const softTypes = new Set(res.soft.map((g) => g.type));
      expect(softTypes.has('category')).toBe(true);
      expect(softTypes.has('badge')).toBe(true);
      expect(softTypes.has('exercise')).toBe(true);
    });

    it('does not create a soft group when the same items already form a hard group', async () => {
      (dbService.getAll as jest.Mock)
        .mockResolvedValueOnce([
          { id: 'c1', name: 'Pecho', origin_id: null },
          { id: 'c2', name: '  pecho  ', origin_id: 'remote' },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const res = await DuplicateResolutionService.scanAllDuplicates();
      expect(res.hard.length).toBe(1);
      expect(res.soft.length).toBe(0);
    });
  });
});
