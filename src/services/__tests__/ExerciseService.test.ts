import { dbService } from '../DatabaseService';
import { ExerciseService } from '../ExerciseService';

// Mock dependencies
jest.mock('../DatabaseService', () => ({
  dbService: {
    run: jest.fn(),
    getAll: jest.fn(),
    getFirst: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    withTransaction: jest.fn(async (cb: () => Promise<void>) => { await cb(); }),
    queueSyncMutation: jest.fn(),
  },
}));

describe('ExerciseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('delete', () => {
    it('should throw error if exercise is system', async () => {
      (dbService.getFirst as jest.Mock)
        .mockResolvedValueOnce({ is_system: 1 });

      await expect(ExerciseService.delete('ex1'))
        .rejects.toThrow('Cannot delete system exercise');

      expect(dbService.delete).not.toHaveBeenCalled();
    });

    it('should throw error if exercise has existing history (Integrity Check)', async () => {
      // Mock that sets exist
      (dbService.getFirst as jest.Mock)
        .mockResolvedValueOnce({ is_system: 0 })
        .mockResolvedValueOnce({ count: 5 });

      await expect(ExerciseService.delete('ex1'))
        .rejects.toThrow('Cannot delete exercise with existing history');

      expect(dbService.delete).not.toHaveBeenCalled();
    });

    it('should delete exercise if no history exists', async () => {
      // Mock 0 sets
      (dbService.getFirst as jest.Mock)
        .mockResolvedValueOnce({ is_system: 0 })
        .mockResolvedValueOnce({ count: 0 });

      (dbService.getAll as jest.Mock).mockResolvedValueOnce([{ id: 're1' }]);
      await ExerciseService.delete('ex1');

      expect(dbService.delete).toHaveBeenCalledWith(
        'routine_exercises',
        're1'
      );
      expect(dbService.delete).toHaveBeenCalledWith(
        'exercises',
        'ex1'
      );
    });

    it('should auto-unlink routine references before deleting exercise (transactional)', async () => {
      (dbService.getFirst as jest.Mock)
        .mockResolvedValueOnce({ is_system: 0 })
        .mockResolvedValueOnce({ count: 0 });

      (dbService.getAll as jest.Mock).mockResolvedValueOnce([{ id: 're1' }, { id: 're2' }]);

      await ExerciseService.delete('ex1');

      expect(dbService.withTransaction).toHaveBeenCalledTimes(1);
      expect(dbService.delete).toHaveBeenCalledWith(
        'routine_exercises',
        're1'
      );
      expect(dbService.delete).toHaveBeenCalledWith(
        'routine_exercises',
        're2'
      );
      expect(dbService.delete).toHaveBeenCalledWith(
        'exercises',
        'ex1'
      );
    });
  });

  describe('create', () => {
    it('should insert new exercise', async () => {
      await ExerciseService.create({
        category_id: 'c1',
        name: 'new exercise',
        type: 'weight_reps'
      });

      expect(dbService.insert).toHaveBeenCalledWith(
        'exercises',
        expect.objectContaining({ category_id: 'c1', name: 'New Exercise' })
      );


    });
  });
});
