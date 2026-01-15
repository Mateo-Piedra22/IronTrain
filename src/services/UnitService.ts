export type WeightUnit = 'kg' | 'lbs';

export class UnitService {
    static KG_PER_LB = 0.45359237;
    static LB_PER_KG = 2.2046226218;

    static lbsToKg(valueLbs: number): number {
        const v = Number.isFinite(valueLbs) ? valueLbs : 0;
        return v * UnitService.KG_PER_LB;
    }

    static kgToLbs(valueKg: number): number {
        const v = Number.isFinite(valueKg) ? valueKg : 0;
        return v * UnitService.LB_PER_KG;
    }
}

