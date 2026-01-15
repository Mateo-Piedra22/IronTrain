export type OneRMFormula = 'epley' | 'brzycki' | 'lombardi';

export interface WarmupSuggestion {
    weight: number;
    reps: number;
    note?: string;
}

export class CalculatorService {
    static roundToIncrement(value: number, increment: number): number {
        if (!Number.isFinite(value)) return 0;
        if (!Number.isFinite(increment) || increment <= 0) return Math.round(value);
        return Math.round(value / increment) * increment;
    }

    static estimate1RM(formula: OneRMFormula, weight: number, reps: number): number {
        const w = Number.isFinite(weight) ? weight : 0;
        const r = Number.isFinite(reps) ? reps : 0;
        if (w <= 0 || r <= 0) return 0;

        if (formula === 'brzycki') {
            const denom = 37 - r;
            if (denom <= 0) return 0;
            return Math.round((w * 36) / denom);
        }
        if (formula === 'lombardi') {
            return Math.round(w * Math.pow(r, 0.10));
        }
        return Math.round(w * (1 + r / 30));
    }

    static percentTable(oneRm: number, percentages: number[], rounding: number): { pct: number; weight: number }[] {
        const base = Number.isFinite(oneRm) ? oneRm : 0;
        return percentages
            .map((pct) => ({
                pct,
                weight: CalculatorService.roundToIncrement(base * pct, rounding)
            }))
            .filter((r) => r.weight > 0);
    }

    static warmupSuggestions(args: { workingWeight: number; barWeight: number; rounding: number }): WarmupSuggestion[] {
        const workingWeight = Number.isFinite(args.workingWeight) ? args.workingWeight : 0;
        const barWeight = Number.isFinite(args.barWeight) ? args.barWeight : 0;
        const rounding = args.rounding;

        if (workingWeight <= 0) return [];

        const bar = Math.min(barWeight > 0 ? barWeight : 0, workingWeight);
        const steps: WarmupSuggestion[] = [
            { weight: bar, reps: 10, note: bar > 0 ? 'Barra' : undefined },
            { weight: CalculatorService.roundToIncrement(workingWeight * 0.40, rounding), reps: 8 },
            { weight: CalculatorService.roundToIncrement(workingWeight * 0.60, rounding), reps: 5 },
            { weight: CalculatorService.roundToIncrement(workingWeight * 0.75, rounding), reps: 3 },
            { weight: CalculatorService.roundToIncrement(workingWeight * 0.85, rounding), reps: 2 },
            { weight: CalculatorService.roundToIncrement(workingWeight * 0.92, rounding), reps: 1 },
        ];

        const filtered = steps
            .filter((s) => Number.isFinite(s.weight) && s.weight > 0 && s.weight < workingWeight)
            .map((s) => ({ ...s, weight: Math.max(0, s.weight) }));

        const unique = new Map<number, WarmupSuggestion>();
        for (const s of filtered) {
            if (!unique.has(s.weight)) unique.set(s.weight, s);
        }
        return Array.from(unique.values()).sort((a, b) => a.weight - b.weight);
    }
}

