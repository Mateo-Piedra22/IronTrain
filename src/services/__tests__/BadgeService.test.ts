import { badgeService } from '../BadgeService';
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

describe('BadgeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createCustomBadge', () => {
    it('Title Cases badge name on create', async () => {
      await badgeService.createCustomBadge({
        name: 'barra z',
        color: '#ffffff',
        icon: null,
        group_name: 'equipamiento',
        deleted_at: null,
        origin_id: null,
      } as any);

      expect(dbService.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO badges'),
        expect.arrayContaining(['Barra Z'])
      );
    });
  });

  describe('updateBadge', () => {
    it('Title Cases badge name on update', async () => {
      await badgeService.updateBadge('b1', { name: 'press banca' });

      expect(dbService.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE badges SET'),
        expect.arrayContaining(['Press Banca'])
      );

      expect(dbService.queueSyncMutation).toHaveBeenCalledWith(
        'badges',
        'b1',
        'UPDATE',
        expect.objectContaining({ name: 'Press Banca' })
      );
    });
  });
});
