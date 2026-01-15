import { CalculatorService } from '../CalculatorService';

describe('CalculatorService', () => {
  describe('estimate1RM', () => {
    it('should return 0 for invalid inputs', () => {
      expect(CalculatorService.estimate1RM('epley', 0, 5)).toBe(0);
      expect(CalculatorService.estimate1RM('epley', 100, 0)).toBe(0);
    });

    it('should compute epley estimate', () => {
      expect(CalculatorService.estimate1RM('epley', 100, 5)).toBe(117);
    });
  });

  describe('roundToIncrement', () => {
    it('should round to nearest increment', () => {
      expect(CalculatorService.roundToIncrement(102.4, 2.5)).toBe(102.5);
      expect(CalculatorService.roundToIncrement(101.2, 2.5)).toBe(100);
    });
  });
});

