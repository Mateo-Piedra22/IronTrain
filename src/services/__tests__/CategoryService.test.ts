import { CategoryService } from '../CategoryService';
import { dbService } from '../DatabaseService';

jest.mock('../DatabaseService', () => ({
  dbService: {
    run: jest.fn(),
    getAll: jest.fn(),
    getFirst: jest.fn(),
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

      expect(dbService.run).not.toHaveBeenCalledWith('DELETE FROM categories WHERE id = ?', expect.anything());
    });

    it('should reassign exercises to uncategorized and delete category in a transaction', async () => {
      (dbService.getFirst as jest.Mock)
        .mockResolvedValueOnce({ id: 'c1', name: 'Custom', is_system: 0, sort_order: 0 })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await CategoryService.deleteAndReassignExercises('c1');

      expect(dbService.run).toHaveBeenCalledWith(
        'INSERT INTO categories (id, name, is_system, sort_order, color) VALUES (?, ?, 1, ?, ?)',
        ['uncategorized', 'Sin categoría', 9999, '#94a3b8']
      );
      expect(dbService.withTransaction).toHaveBeenCalled();
      expect(dbService.run).toHaveBeenCalledWith(
        'UPDATE exercises SET category_id = ? WHERE category_id = ?',
        ['uncategorized', 'c1']
      );
      expect(dbService.run).toHaveBeenCalledWith('DELETE FROM categories WHERE id = ?', ['c1']);
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

      expect(dbService.run).toHaveBeenCalledWith(
        'UPDATE categories SET name = ?, color = ? WHERE id = ?',
        ['Pecho (Editado)', '#123456', 'c1']
      );
    });
  });

  describe('create', () => {
    it('should Title Case category name on create', async () => {
      await CategoryService.create('press de banca', '#ffffff');

      expect(dbService.run).toHaveBeenCalledWith(
        'INSERT INTO categories (id, name, color, is_system) VALUES (?, ?, ?, 0)',
        expect.arrayContaining(['Press de Banca', '#ffffff'])
      );
    });
  });
});
