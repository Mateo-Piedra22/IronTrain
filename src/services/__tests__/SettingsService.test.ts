import { dbService } from '../DatabaseService';
import { SettingsService } from '../SettingsService';

jest.mock('../DatabaseService', () => ({
  dbService: {
    run: jest.fn(),
    getAll: jest.fn(),
    getFirst: jest.fn(),
    withTransaction: jest.fn(async (cb: () => Promise<void>) => { await cb(); }),
  },
}));

describe('SettingsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should persist plate inventory with unit preserved (kg/lbs)', async () => {
    const service = new SettingsService();
    await service.updatePlateInventory([
      { weight: 20, count: 2, type: 'standard', unit: 'kg' } as any,
      { weight: 20, count: 2, type: 'standard', unit: 'lbs' } as any,
    ]);

    const calls = (dbService.run as jest.Mock).mock.calls
      .filter((c) => String(c[0]).startsWith('INSERT INTO plate_inventory'));

    expect(calls.length).toBe(2);
    expect(calls[0][1]).toEqual([expect.any(String), 20, 2, 2, 'standard', 'kg', null]);
    expect(calls[1][1]).toEqual([expect.any(String), 20, 2, 2, 'standard', 'lbs', null]);
  });
});

