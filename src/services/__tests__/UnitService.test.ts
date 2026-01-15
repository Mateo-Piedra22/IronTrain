import { UnitService } from '../UnitService';

describe('UnitService', () => {
  it('should convert kg <-> lbs approximately', () => {
    const kg = 100;
    const lbs = UnitService.kgToLbs(kg);
    const back = UnitService.lbsToKg(lbs);
    expect(Math.abs(back - kg)).toBeLessThan(0.0001);
  });
});

