import { dbService } from '../DatabaseService';
import { NameNormalizationService } from '../NameNormalizationService';

jest.mock('../DatabaseService', () => ({
  dbService: {
    getAll: jest.fn(),
    run: jest.fn(),
    queueSyncMutation: jest.fn(),
    withTransaction: jest.fn(async (cb: () => Promise<void>) => { await cb(); }),
  },
}));

describe('NameNormalizationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('previewTitleCaseNormalization', () => {
    it('returns counts and samples for rows that would change', async () => {
      (dbService.getAll as jest.Mock)
        .mockResolvedValueOnce([{ id: 'e1', name: 'press de banca' }])
        .mockResolvedValueOnce([{ id: 'c1', name: 'pecho' }])
        .mockResolvedValueOnce([{ id: 'b1', name: 'barra z' }])
        .mockResolvedValueOnce([{ id: 'r1', name: 'push pull legs' }])
        .mockResolvedValueOnce([{ id: 'd1', name: 'dia 1' }]);

      const res = await NameNormalizationService.previewTitleCaseNormalization(2);

      expect(res.total).toBe(5);
      expect(res.exercises.count).toBe(1);
      expect(res.categories.count).toBe(1);
      expect(res.badges.count).toBe(1);
      expect(res.routines.count).toBe(1);
      expect(res.routineDays.count).toBe(1);

      expect(res.exercises.samples[0]).toEqual({
        id: 'e1',
        before: 'press de banca',
        after: 'Press de Banca',
      });
    });

    it('does not count rows that are already normalized', async () => {
      (dbService.getAll as jest.Mock)
        .mockResolvedValueOnce([{ id: 'e1', name: 'Press de Banca' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const res = await NameNormalizationService.previewTitleCaseNormalization(4);
      expect(res.total).toBe(0);
      expect(res.exercises.count).toBe(0);
    });
  });

  describe('applyTitleCaseNormalization', () => {
    it('updates changed rows and queues sync mutations', async () => {
      (dbService.getAll as jest.Mock)
        // preview call inside apply
        .mockResolvedValueOnce([{ id: 'e1', name: 'press de banca' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        // fetchDiff calls inside transaction
        .mockResolvedValueOnce([{ id: 'e1', name: 'press de banca' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        // final preview call
        .mockResolvedValueOnce([{ id: 'e1', name: 'Press de Banca' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await NameNormalizationService.applyTitleCaseNormalization();

      expect(dbService.run).toHaveBeenCalledWith(
        'UPDATE exercises SET name = ?, updated_at = ? WHERE id = ?',
        ['Press de Banca', expect.any(Number), 'e1']
      );

      expect(dbService.queueSyncMutation).toHaveBeenCalledWith(
        'exercises',
        'e1',
        'UPDATE',
        expect.objectContaining({ name: 'Press de Banca', updated_at: expect.any(Number) })
      );
    });
  });
});
