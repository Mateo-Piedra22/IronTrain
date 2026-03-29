import { CategoryService } from '../CategoryService';
import { dbService } from '../DatabaseService';

jest.mock('../DatabaseService', () => ({
  dbService: {
    run: jest.fn(),
    getAll: jest.fn(),
    getFirst: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    queueSyncMutation: jest.fn(),
    withTransaction: jest.fn(async (cb: () => Promise<void>) => { await cb(); }),
  },
}));

describe('CategoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('deleteAndReassignExercises', () => {
    it('should throw error if category is system', async () => {
      (dbService.getFirst as jest.Mock).mockResolvedValueOnce({ id: 'c1', name: 'Pecho', is_system: 1, sort_order: 0 });

      await expect(CategoryService.deleteAndReassignExercises('c1'))
        .rejects.toThrow('Cannot delete system category');

      expect(dbService.delete).not.toHaveBeenCalled();
    });

    it('should reassign exercises to uncategorized and delete category in a transaction', async () => {
      (dbService.getFirst as jest.Mock)
        .mockResolvedValueOnce({ id: 'c1', name: 'Custom', is_system: 0, sort_order: 0 }) // getById
        .mockResolvedValueOnce({ id: 'uncategorized' }); // checkUncategorized (byId)

      (dbService.getAll as jest.Mock).mockResolvedValueOnce([]);
      await CategoryService.deleteAndReassignExercises('c1');

      expect(dbService.withTransaction).toHaveBeenCalled();
      expect(dbService.getAll).toHaveBeenCalledWith(
        'SELECT id FROM exercises WHERE category_id = ?',
        ['c1']
      );
      expect(dbService.delete).toHaveBeenCalledWith('categories', 'c1');
    });
  });

  describe('update', () => {
    it('should block editing uncategorized category', async () => {
      (dbService.getFirst as jest.Mock).mockResolvedValueOnce({
        id: 'uncategorized',
        name: 'Sin categoría',
        is_system: 1,
        sort_order: 9999,
      });

      await expect(CategoryService.update('uncategorized', 'Otra', '#ffffff'))
        .rejects.toThrow('Cannot edit uncategorized category');
    });

    it('should allow editing system categories except uncategorized', async () => {
      (dbService.getFirst as jest.Mock)
        .mockResolvedValueOnce({ id: 'c1', name: 'Pecho', is_system: 1, sort_order: 0 });

      await CategoryService.update('c1', 'pecho (editado)', '#123456');

      expect(dbService.update).toHaveBeenCalledWith(
        'categories',
        'c1',
        { name: 'Pecho (Editado)', color: '#123456' }
      );
    });
  });

  describe('create', () => {
    it('should Title Case category name on create', async () => {
      await CategoryService.create('press de banca', '#ffffff');

      expect(dbService.insert).toHaveBeenCalledWith(
        'categories',
        expect.objectContaining({ name: 'Press de Banca', color: '#ffffff' })
      );
    });
  });
});
