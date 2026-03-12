import { uuidV4 } from '../../utils/uuid';
import { dbService } from '../DatabaseService';
import { routineService } from '../RoutineService';

jest.mock('../DatabaseService', () => ({
  dbService: {
    run: jest.fn(),
    queueSyncMutation: jest.fn(),
    getAll: jest.fn(),
    getFirst: jest.fn(),
    withTransaction: jest.fn(async (cb: () => Promise<void>) => { await cb(); }),
  },
}));

jest.mock('../../utils/uuid', () => ({
  uuidV4: jest.fn(),
}));

describe('RoutineService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('title case on write', () => {
    it('Title Cases routine name on create', async () => {
      (uuidV4 as jest.Mock).mockReturnValueOnce('r-new');

      await routineService.createRoutine('press de banca', undefined, 0);

      expect(dbService.run).toHaveBeenCalledWith(
        'INSERT INTO routines (id, name, description, is_public) VALUES (?, ?, ?, ?)',
        ['r-new', 'Press de Banca', null, 0]
      );

      expect(dbService.queueSyncMutation).toHaveBeenCalledWith(
        'routines',
        'r-new',
        'INSERT',
        expect.objectContaining({ name: 'Press de Banca' })
      );
    });

    it('Title Cases routine day name on create', async () => {
      (uuidV4 as jest.Mock).mockReturnValueOnce('d-new');

      await routineService.addRoutineDay('r1', 'dia 1', 0);

      expect(dbService.run).toHaveBeenCalledWith(
        'INSERT INTO routine_days (id, routine_id, name, order_index) VALUES (?, ?, ?, ?)',
        ['d-new', 'r1', 'Dia 1', 0]
      );

      expect(dbService.queueSyncMutation).toHaveBeenCalledWith(
        'routine_days',
        'd-new',
        'INSERT',
        expect.objectContaining({ name: 'Dia 1' })
      );
    });
  });

  it('imports shared routines with mapped categories', async () => {
    (uuidV4 as jest.Mock)
      .mockReturnValueOnce('cat-new')
      .mockReturnValueOnce('ex-new')
      .mockReturnValueOnce('routine-new')
      .mockReturnValueOnce('day-new')
      .mockReturnValueOnce('re-new');

    (dbService.getFirst as jest.Mock).mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id FROM categories ORDER BY')) {
        return { id: 'cat-default' };
      }
      if (sql.includes('SELECT id FROM categories WHERE name')) {
        return null;
      }
      if (sql.includes('SELECT id FROM exercises WHERE origin_id')) {
        return null;
      }
      return null;
    });

    await routineService.importSharedRoutine({
      routine: { name: 'Rutina A' },
      routine_days: [{ id: 'd1', name: 'Día 1', order_index: 0 }],
      routine_exercises: [{ routine_day_id: 'd1', exercise_id: 'e1', order_index: 0, notes: 'nota' }],
      exercises: [{ id: 'e1', name: 'Sentadilla', type: 'weight_reps', default_increment: 2.5, category_id: 'c1', origin_id: 'orig-1' }],
      categories: [{ id: 'c1', name: 'Piernas', color: '#111111', sort_order: 1, is_system: 0 }],
    });

    expect(dbService.run).toHaveBeenCalledWith(
      'INSERT INTO categories (id, name, is_system, sort_order, color) VALUES (?, ?, ?, ?, ?)',
      ['cat-new', 'Piernas', 0, 1, '#111111']
    );
    expect(dbService.run).toHaveBeenCalledWith(
      'INSERT INTO exercises (id, category_id, name, type, default_increment, notes, is_system, origin_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['ex-new', 'cat-new', 'Sentadilla', 'weight_reps', 2.5, null, 0, 'orig-1']
    );
  });

  it('imports shared routines with default category when missing', async () => {
    (uuidV4 as jest.Mock)
      .mockReturnValueOnce('ex-new')
      .mockReturnValueOnce('routine-new')
      .mockReturnValueOnce('day-new')
      .mockReturnValueOnce('re-new');

    (dbService.getFirst as jest.Mock).mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id FROM categories ORDER BY')) {
        return { id: 'cat-default' };
      }
      if (sql.includes('SELECT id FROM exercises WHERE origin_id')) {
        return null;
      }
      return null;
    });

    await routineService.importSharedRoutine({
      routine: { name: 'Rutina B' },
      routine_days: [{ id: 'd1', name: 'Día 1', order_index: 0 }],
      routine_exercises: [{ routine_day_id: 'd1', exercise_id: 'e1', order_index: 0 }],
      exercises: [{ id: 'e1', name: 'Press', type: 'weight_reps', default_increment: 2.5, origin_id: 'orig-2' }],
    });

    expect(dbService.run).toHaveBeenCalledWith(
      'INSERT INTO exercises (id, category_id, name, type, default_increment, notes, is_system, origin_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['ex-new', 'cat-default', 'Press', 'weight_reps', 2.5, null, 0, 'orig-2']
    );
  });

  it('exports routine with categories', async () => {
    (dbService.getFirst as jest.Mock).mockResolvedValue({ id: 'r1', name: 'Rutina' });
    (dbService.getAll as jest.Mock).mockImplementation(async (sql: string) => {
      if (sql.includes('FROM routine_days')) return [{ id: 'd1', routine_id: 'r1', name: 'Día 1', order_index: 0 }];
      if (sql.includes('FROM routine_exercises')) return [{ id: 're1', routine_day_id: 'd1', exercise_id: 'e1', order_index: 0 }];
      if (sql.includes('FROM exercises')) return [{ id: 'e1', category_id: 'c1', name: 'Sentadilla', type: 'weight_reps' }];
      if (sql.includes('FROM categories')) return [{ id: 'c1', name: 'Piernas' }];
      return [];
    });

    const result = await routineService.exportRoutine('r1');

    expect(Array.isArray(result.categories)).toBe(true);
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].id).toBe('c1');
  });
});
