import { dbService } from '../DatabaseService';
import { GoalsService } from '../GoalsService';

jest.mock('../DatabaseService', () => ({
  dbService: {
    run: jest.fn(),
    getAll: jest.fn(),
  },
}));

describe('GoalsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createGoal', () => {
    it('should validate title', async () => {
      await expect(GoalsService.createGoal({ title: '   ', targetValue: 100 }))
        .rejects.toThrow('El título es obligatorio');
    });

    it('should validate target value', async () => {
      await expect(GoalsService.createGoal({ title: 'Bench', targetValue: 0 }))
        .rejects.toThrow('El objetivo debe ser mayor que 0');
    });

    it('should insert goal when valid', async () => {
      await GoalsService.createGoal({ title: 'Bench', targetValue: 100, currentValue: 80 });
      expect(dbService.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO goals'),
        expect.arrayContaining(['Bench', 100, 80])
      );
    });
  });
});

