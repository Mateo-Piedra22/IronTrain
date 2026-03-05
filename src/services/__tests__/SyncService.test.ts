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
});
