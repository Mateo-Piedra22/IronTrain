import { dbService } from '../DatabaseService';
import { ExerciseService } from '../ExerciseService';

// Mock dependencies
jest.mock('../DatabaseService', () => ({
  dbService: {
    run: jest.fn(),
    getAll: jest.fn(),
    getFirst: jest.fn(),
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

      expect(dbService.run).not.toHaveBeenCalledWith(expect.stringContaining('DELETE FROM exercises'), expect.anything());
    });

    it('should throw error if exercise has existing history (Integrity Check)', async () => {
      // Mock that sets exist
      (dbService.getFirst as jest.Mock)
        .mockResolvedValueOnce({ is_system: 0 })
        .mockResolvedValueOnce({ count: 5 });

      await expect(ExerciseService.delete('ex1'))
        .rejects.toThrow('Cannot delete exercise with existing history');

      expect(dbService.run).not.toHaveBeenCalledWith(expect.stringContaining('DELETE FROM exercises'), expect.anything());
    });

    it('should delete exercise if no history exists', async () => {
      // Mock 0 sets
      (dbService.getFirst as jest.Mock)
        .mockResolvedValueOnce({ is_system: 0 })
        .mockResolvedValueOnce({ count: 0 });

      (dbService.getAll as jest.Mock).mockResolvedValueOnce([]);

      await ExerciseService.delete('ex1');

      expect(dbService.run).toHaveBeenCalledWith(
        'DELETE FROM routine_exercises WHERE exercise_id = ?',
        ['ex1']
      );
      expect(dbService.run).toHaveBeenCalledWith(
        'DELETE FROM exercises WHERE id = ?',
        ['ex1']
      );

      expect(dbService.queueSyncMutation).toHaveBeenCalledWith('exercises', 'ex1', 'DELETE');
    });

    it('should auto-unlink routine references before deleting exercise (transactional)', async () => {
      (dbService.getFirst as jest.Mock)
        .mockResolvedValueOnce({ is_system: 0 })
        .mockResolvedValueOnce({ count: 0 });

      (dbService.getAll as jest.Mock).mockResolvedValueOnce([{ id: 're1' }, { id: 're2' }]);

      await ExerciseService.delete('ex1');

      expect(dbService.withTransaction).toHaveBeenCalledTimes(1);
      expect(dbService.run).toHaveBeenCalledWith(
        'DELETE FROM routine_exercises WHERE exercise_id = ?',
        ['ex1']
      );
      expect(dbService.run).toHaveBeenCalledWith(
        'DELETE FROM exercises WHERE id = ?',
        ['ex1']
      );

      expect(dbService.queueSyncMutation).toHaveBeenCalledWith('routine_exercises', 're1', 'DELETE');
      expect(dbService.queueSyncMutation).toHaveBeenCalledWith('routine_exercises', 're2', 'DELETE');
      expect(dbService.queueSyncMutation).toHaveBeenCalledWith('exercises', 'ex1', 'DELETE');
    });
  });

  describe('create', () => {
    it('should insert new exercise', async () => {
      await ExerciseService.create({
        category_id: 'c1',
        name: 'new exercise',
        type: 'weight_reps'
      });

      expect(dbService.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO exercises'),
        expect.arrayContaining(['c1', 'New Exercise'])
      );

      expect(dbService.queueSyncMutation).toHaveBeenCalledWith(
        'exercises',
        expect.any(String),
        'INSERT',
        expect.objectContaining({ name: 'New Exercise' })
      );
    });
  });
});
