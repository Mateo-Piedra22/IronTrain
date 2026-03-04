import { syncService } from '../SyncService';
import { dbService } from '../DatabaseService';
import { useAuthStore } from '../../store/authStore';

jest.mock('../DatabaseService', () => ({
  dbService: {
    getDatabase: jest.fn(),
  },
}));

jest.mock('../../store/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(),
  },
}));

const dbMock = {
  getAllAsync: jest.fn(),
  runAsync: jest.fn(),
  getFirstAsync: jest.fn(),
};

describe('SyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (dbService.getDatabase as jest.Mock).mockReturnValue(dbMock);
    (useAuthStore.getState as jest.Mock).mockReturnValue({ token: 'token-1' });
    global.fetch = jest.fn();
  });

  it('marks invalid payloads as failed and skips push', async () => {
    dbMock.getAllAsync
      .mockResolvedValueOnce([{
        id: 1,
        table_name: 'exercises',
        record_id: 'r1',
        operation: 'INSERT',
        payload: '{',
        created_at: Date.now(),
      }])
      .mockResolvedValueOnce([]);

    await (syncService as any).pushLocalChanges('token-1');

    const calls = (dbMock.runAsync as jest.Mock).mock.calls;
    const failedCall = calls.find(call => String(call[0]).includes("status = 'failed'"));
    expect(failedCall).toBeDefined();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('ignores disallowed tables during pull', async () => {
    dbMock.getFirstAsync.mockResolvedValue({ value: '0' });
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

    const calls = (dbMock.runAsync as jest.Mock).mock.calls.map(call => String(call[0]));
    const invalidInsert = calls.find(sql => sql.includes('hack_table'));
    expect(invalidInsert).toBeUndefined();
  });
});
