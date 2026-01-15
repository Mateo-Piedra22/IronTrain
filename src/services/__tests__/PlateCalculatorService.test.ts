import { PlateCalculatorService } from '../PlateCalculatorService';

describe('PlateCalculatorService', () => {
  it('should return empty when target <= bar', () => {
    const res = PlateCalculatorService.calculate({
      targetWeight: 20,
      barWeight: 20,
      inventory: [],
    });
    expect(res.exact.length).toBe(0);
    expect(res.closestBelow).toBeNull();
  });

  it('should find an exact loadout when available', () => {
    const res = PlateCalculatorService.calculate({
      targetWeight: 100,
      barWeight: 20,
      inventory: [
        { weight: 20, count: 2, type: 'standard', unit: 'kg' },
        { weight: 10, count: 4, type: 'standard', unit: 'kg' },
      ] as any,
      maxSolutions: 5,
    });

    expect(res.exact.length).toBeGreaterThan(0);
    expect(res.exact[0].totalWeight).toBe(100);
  });

  it('should ignore odd leftover plates (pairs only)', () => {
    const res = PlateCalculatorService.calculate({
      targetWeight: 40,
      barWeight: 20,
      inventory: [
        { weight: 10, count: 3, type: 'standard', unit: 'kg' },
      ] as any,
    });
    expect(res.exact.length).toBeGreaterThan(0);
    expect(res.exact[0].totalWeight).toBe(40);
    const ten = res.exact[0].perSide.find((p) => p.plate === 10);
    expect(ten?.pairs).toBe(1);
  });
});
