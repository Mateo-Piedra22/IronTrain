import { useAuthStore } from '../../store/authStore';
import { dbService } from '../DatabaseService';
import { syncService } from '../SyncService';

jest.mock('../DatabaseService', () => ({
  dbService: {
    getAll: jest.fn(),
    run: jest.fn(),
    getFirst: jest.fn(),
    withTransaction: jest.fn(async (cb: () => Promise<void>) => { await cb(); }),
  },
}));

jest.mock('../../store/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(),
  },
}));

describe('SyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore.getState as jest.Mock).mockReturnValue({ token: 'token-1' });
    global.fetch = jest.fn();
  });

  it('computes local status with per-table active/deleted counts and aggregates only active', async () => {
    // For each table, checkLocalStatus issues 2 queries when supportsDelete=true, else 1.
    // We return 1 active and 2 deleted for all soft-delete tables, and 5 for non-soft-delete tables.
    const getFirst = dbService.getFirst as jest.Mock;

    getFirst.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM plate_inventory')) return { count: 5 };
      if (sql.includes('FROM settings')) return { count: 5 };
      if (sql.includes('FROM user_profiles')) return { count: 5 };
      if (sql.includes('deleted_at IS NULL')) return { count: 1 };
      if (sql.includes('deleted_at IS NOT NULL')) return { count: 2 };
      return { count: 0 };
    });

    const res = await syncService.checkLocalStatus();

    expect(res.counts).toBeDefined();
    expect(res.counts?.categories).toEqual({ active: 1, deleted: 2, total: 3 });
    expect(res.counts?.plate_inventory).toEqual({ active: 5, deleted: 0, total: 5 });
    expect(res.counts?.settings).toEqual({ active: 5, deleted: 0, total: 5 });

    expect(res.recordCount).toBe(30);
    expect(res.hasData).toBe(true);
  });

  it('computes queue status counts from sync_queue', async () => {
    (dbService.getFirst as jest.Mock)
      .mockResolvedValueOnce({ count: 2 }) // pending
      .mockResolvedValueOnce({ count: 1 }) // failed
      .mockResolvedValueOnce({ count: 3 }); // processing

    const res = await syncService.checkQueueStatus();

    expect(res).toEqual({ pending: 2, failed: 1, processing: 3, totalOutstanding: 6 });
  });

  it('marks invalid payloads as failed and skips push', async () => {
    (dbService.getAll as jest.Mock)
      .mockResolvedValueOnce([{
        id: 'q1',
        table_name: 'exercises',
        record_id: 'r1',
        operation: 'INSERT',
        payload: '{',
        created_at: Date.now(),
      }])
      .mockResolvedValueOnce([]);

    await (syncService as any).pushLocalChanges('token-1');

    const calls = (dbService.run as jest.Mock).mock.calls;
    const failedCall = calls.find(call => String(call[0]).includes("status = 'failed'"));
    expect(failedCall).toBeDefined();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('ignores disallowed tables during pull', async () => {
    (dbService.getFirst as jest.Mock).mockResolvedValue({ value: '0' });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        changes: [
          { table: 'hack_table', operation: 'INSERT', payload: { id: 'x1' } },
          { table: 'exercises', operation: 'DELETE', payload: { id: '' } },
        ],
      }),
    });

    await (syncService as any).pullRemoteChanges('token-1');

    const calls = (dbService.run as jest.Mock).mock.calls.map(call => String(call[0]));
    const invalidInsert = calls.find(sql => sql.includes('hack_table'));
    expect(invalidInsert).toBeUndefined();
  });

  it('applies pull upserts in dependency order (parents before children)', async () => {
    (dbService.getFirst as jest.Mock).mockResolvedValue({ value: '0' });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        changes: [
          {
            table: 'workout_sets',
            operation: 'INSERT',
            payload: {
              id: 'set-1',
              workout_id: 'w-1',
              exercise_id: 'e-1',
              type: 'weight_reps',
              order_index: 0,
              completed: 0,
              updated_at: 2,
              deleted_at: null,
            },
          },
          {
            table: 'workouts',
            operation: 'INSERT',
            payload: {
              id: 'w-1',
              date: 1,
              start_time: 1,
              status: 'in_progress',
              updated_at: 1,
              deleted_at: null,
            },
          },
        ],
        serverTime: 3,
      }),
    });

    (dbService.getAll as jest.Mock).mockResolvedValue([]);

    await (syncService as any).pullRemoteChanges('token-1');

    const runSql = (dbService.run as jest.Mock).mock.calls.map((c) => String(c[0]));
    const workoutIdx = runSql.findIndex((sql) => sql.includes('INSERT OR REPLACE INTO workouts'));
    const setIdx = runSql.findIndex((sql) => sql.includes('INSERT OR REPLACE INTO workout_sets'));

    expect(workoutIdx).toBeGreaterThanOrEqual(0);
    expect(setIdx).toBeGreaterThanOrEqual(0);
    expect(workoutIdx).toBeLessThan(setIdx);
  });

  it('defers FK-failing upserts and retries them without aborting pull', async () => {
    (dbService.getFirst as jest.Mock).mockResolvedValue({ value: '0' });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        changes: [
          {
            table: 'workout_sets',
            operation: 'INSERT',
            payload: {
              id: 'set-2',
              workout_id: 'w-2',
              exercise_id: 'e-2',
              type: 'weight_reps',
              order_index: 0,
              completed: 0,
              updated_at: 2,
              deleted_at: null,
            },
          },
          {
            table: 'workouts',
            operation: 'INSERT',
            payload: {
              id: 'w-2',
              date: 1,
              start_time: 1,
              status: 'in_progress',
              updated_at: 1,
              deleted_at: null,
            },
          },
        ],
        serverTime: 3,
      }),
    });

    (dbService.getAll as jest.Mock).mockResolvedValue([]);

    // First attempt to insert workout_sets fails due to FK; retry pass should succeed.
    (dbService.run as jest.Mock).mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT OR REPLACE INTO workout_sets')) {
        const calls = (dbService.run as jest.Mock).mock.calls.filter((c) => String(c[0]).includes('INSERT OR REPLACE INTO workout_sets'));
        if (calls.length === 0) {
          const err: any = new Error('FOREIGN KEY constraint failed');
          throw err;
        }
      }
      return {} as any;
    });

    await expect((syncService as any).pullRemoteChanges('token-1')).resolves.toBeUndefined();
  });

  it('normalizes scoped cloud settings keys to local keys during pull', async () => {
    (dbService.getFirst as jest.Mock).mockResolvedValue({ value: '0' });
    (dbService.getAll as jest.Mock).mockResolvedValue([]);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        changes: [
          {
            table: 'settings',
            operation: 'UPDATE',
            payload: {
              key: 'user-abc:last_pull_sync',
              value: '123',
              updated_at: 22,
            },
          },
        ],
        serverTime: 44,
      }),
    });

    await (syncService as any).pullRemoteChanges('token-1');

    const insertCall = (dbService.run as jest.Mock).mock.calls.find((c) => String(c[0]).includes('INSERT OR REPLACE INTO settings'));
    expect(insertCall).toBeDefined();
    expect(insertCall?.[1]).toEqual(expect.arrayContaining(['last_pull_sync']));
  });
});
