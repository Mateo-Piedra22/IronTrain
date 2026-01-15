import { dbService } from '../DatabaseService';
import { ExerciseService } from '../ExerciseService';

// Mock dependencies
jest.mock('../DatabaseService', () => ({
  dbService: {
    run: jest.fn(),
    getAll: jest.fn(),
    getFirst: jest.fn(),
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

      await ExerciseService.delete('ex1');

      expect(dbService.run).toHaveBeenCalledWith(
        'DELETE FROM exercises WHERE id = ?',
        ['ex1']
      );
    });
  });

  describe('create', () => {
    it('should insert new exercise', async () => {
      await ExerciseService.create({
        category_id: 'c1',
        name: 'New Exercise',
        type: 'weight_reps'
      });

      expect(dbService.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO exercises'),
        expect.arrayContaining(['c1', 'New Exercise'])
      );
    });
  });
});
