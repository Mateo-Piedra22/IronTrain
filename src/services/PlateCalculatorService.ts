import { PlateInventory } from '../types/db';

export interface PlateLoadout {
    perSide: { plate: number; pairs: number }[];
    totalWeight: number;
    barWeight: number;
}

export interface PlateCalculationResult {
    exact: PlateLoadout[];
    closestBelow: PlateLoadout | null;
    closestAbove: PlateLoadout | null;
    targetWeight: number;
    barWeight: number;
}

const SCALE = 100;

function toInt(weight: number): number {
    return Math.round(weight * SCALE);
}

function toFloat(weightInt: number): number {
    return Math.round((weightInt / SCALE) * 100) / 100;
}

function normalizeInventory(inventory: PlateInventory[]): { weightInt: number; weight: number; pairs: number }[] {
    return inventory
        .filter((p) => Number.isFinite(p.weight) && p.weight > 0 && p.count > 0)
        .map((p) => {
            const pairs = Math.floor((p.count ?? 0) / 2);
            return { weightInt: toInt(p.weight), weight: p.weight, pairs };
        })
        .filter((p) => p.pairs > 0)
        .sort((a, b) => b.weightInt - a.weightInt);
}

function buildLoadout(chosen: Map<number, number>, barInt: number): PlateLoadout {
    const perSide = Array.from(chosen.entries())
        .filter(([, pairs]) => pairs > 0)
        .map(([weightInt, pairs]) => ({ plate: toFloat(weightInt), pairs }))
        .sort((a, b) => b.plate - a.plate);

    const sideSumInt = perSide.reduce((acc, p) => acc + toInt(p.plate) * p.pairs, 0);
    const totalInt = barInt + (2 * sideSumInt);

    return {
        perSide,
        totalWeight: toFloat(totalInt),
        barWeight: toFloat(barInt)
    };
}

function scoreFewerPlates(loadout: PlateLoadout): number {
    const totalPairs = loadout.perSide.reduce((acc, p) => acc + p.pairs, 0);
    return totalPairs;
}

export class PlateCalculatorService {
    static calculate(options: {
        targetWeight: number;
        barWeight: number;
        inventory: PlateInventory[];
        maxSolutions?: number;
        preferFewerPlates?: boolean;
    }): PlateCalculationResult {
        const maxSolutions = Math.max(1, Math.min(options.maxSolutions ?? 6, 20));
        const preferFewerPlates = options.preferFewerPlates ?? true;

        const target = Number.isFinite(options.targetWeight) ? options.targetWeight : 0;
        const bar = Number.isFinite(options.barWeight) ? options.barWeight : 0;

        const targetInt = toInt(target);
        const barInt = toInt(bar);

        if (targetInt <= 0 || barInt < 0 || targetInt <= barInt) {
            return { exact: [], closestBelow: null, closestAbove: null, targetWeight: target, barWeight: bar };
        }

        const sideTargetInt = Math.floor((targetInt - barInt) / 2);
        const items = normalizeInventory(options.inventory);

        const chosen = new Map<number, number>();
        const exact: PlateLoadout[] = [];
        let bestBelowDiff = Number.POSITIVE_INFINITY;
        let bestAboveDiff = Number.POSITIVE_INFINITY;
        let bestBelowLoadout: PlateLoadout | null = null;
        let bestAboveLoadout: PlateLoadout | null = null;

        const dfs = (idx: number, remaining: number) => {
            if (exact.length >= maxSolutions && bestBelowLoadout && bestAboveLoadout) return;

            if (idx >= items.length) {
                const sideSumInt = Array.from(chosen.entries()).reduce((acc, [w, k]) => acc + (w * k), 0);
                const loadout = buildLoadout(chosen, barInt);
                const diff = sideTargetInt - sideSumInt;

                if (diff === 0) {
                    exact.push(loadout);
                } else if (diff > 0) {
                    if (diff < bestBelowDiff) {
                        bestBelowDiff = diff;
                        bestBelowLoadout = loadout;
                    }
                } else {
                    const over = Math.abs(diff);
                    if (over < bestAboveDiff) {
                        bestAboveDiff = over;
                        bestAboveLoadout = loadout;
                    }
                }
                return;
            }

            const item = items[idx];
            const maxPairs = item.pairs;
            const w = item.weightInt;

            const maxK = Math.min(maxPairs, Math.floor(remaining / w) + 4);
            for (let k = maxK; k >= 0; k--) {
                if (k > 0) chosen.set(w, k);
                else chosen.delete(w);

                const nextRemaining = remaining - (k * w);
                if (nextRemaining < 0) {
                    dfs(idx + 1, nextRemaining);
                    continue;
                }

                dfs(idx + 1, nextRemaining);

                if (exact.length >= maxSolutions && preferFewerPlates) {
                    const last = exact[exact.length - 1];
                    if (last && scoreFewerPlates(last) <= 2) break;
                }
            }
        };

        dfs(0, sideTargetInt);

        const uniqueKey = (l: PlateLoadout) => l.perSide.map((p) => `${p.plate}x${p.pairs}`).join('|');
        const uniqueExact = new Map<string, PlateLoadout>();
        for (const l of exact) uniqueExact.set(uniqueKey(l), l);

        const sortedExact = Array.from(uniqueExact.values()).sort((a, b) => {
            const sa = scoreFewerPlates(a);
            const sb = scoreFewerPlates(b);
            if (preferFewerPlates && sa !== sb) return sa - sb;
            return b.totalWeight - a.totalWeight;
        });

        return {
            exact: sortedExact.slice(0, maxSolutions),
            closestBelow: bestBelowLoadout,
            closestAbove: bestAboveLoadout,
            targetWeight: target,
            barWeight: bar
        };
    }
}
