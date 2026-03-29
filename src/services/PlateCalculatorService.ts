import { PlateInventory, PlateType } from '../types/db';

export interface PlateLoadout {
    perSide: { plate: number; pairs: number; color?: string; type?: PlateType }[];
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
// Safety cap for DP search width; each slot uses ~12 bytes across dp + trace arrays.
// Memory usage ≈ MAX_DP_SEARCH_UNITS * 12 bytes.
// For MAX_DP_SEARCH_UNITS = 500_000 this is 500_000 * 12 ≈ 6_000_000 bytes (~5.7 MiB).
const MAX_DP_SEARCH_UNITS = 500_000;

function toInt(weight: number): number {
    return Math.round(weight * SCALE);
}

function toFloat(weightInt: number): number {
    return Math.round((weightInt / SCALE) * 100) / 100;
}

function normalizeInventory(inventory: PlateInventory[]): { weightInt: number; weight: number; pairs: number; color?: string; type?: PlateType }[] {
    return inventory
        .filter((p) => Number.isFinite(p.weight) && p.weight > 0 && p.count > 0)
        .map((p) => {
            const pairs = Math.floor((p.count ?? 0) / 2);
            return { weightInt: toInt(p.weight), weight: p.weight, pairs, color: p.color, type: p.type };
        })
        .filter((p) => p.pairs > 0)
        .sort((a, b) => b.weightInt - a.weightInt);
}

function buildLoadout(chosen: Map<number, number>, barInt: number, metadataMap: Map<number, { color?: string; type?: PlateType }>): PlateLoadout {
    const perSide = Array.from(chosen.entries())
        .filter(([, pairs]) => pairs > 0)
        .map(([weightInt, pairs]) => {
            const meta = metadataMap.get(weightInt);
            return { plate: toFloat(weightInt), pairs, color: meta?.color, type: meta?.type };
        })
        .sort((a, b) => b.plate - a.plate);

    const sideSumInt = perSide.reduce((acc, p) => acc + toInt(p.plate) * p.pairs, 0);
    const totalInt = barInt + (2 * sideSumInt);

    return {
        perSide,
        totalWeight: toFloat(totalInt),
        barWeight: toFloat(barInt)
    };
}



export class PlateCalculatorService {
    static calculate(options: {
        targetWeight: number;
        barWeight: number;
        inventory: PlateInventory[];
        maxSolutions?: number;
        preferFewerPlates?: boolean;
    }): PlateCalculationResult {
        const target = Number.isFinite(options.targetWeight) ? options.targetWeight : 0;
        const bar = Number.isFinite(options.barWeight) ? options.barWeight : 0;

        const targetInt = toInt(target);
        const barInt = toInt(bar);

        if (targetInt <= 0 || barInt < 0 || targetInt <= barInt) {
            return { exact: [], closestBelow: null, closestAbove: null, targetWeight: target, barWeight: bar };
        }

        const sideTargetInt = Math.floor((targetInt - barInt) / 2);
        const items = normalizeInventory(options.inventory);
        const metadataMap = new Map<number, { color?: string; type?: PlateType }>();
        items.forEach(item => metadataMap.set(item.weightInt, { color: item.color, type: item.type }));

        // Phase 1: Bounded Knapsack Dynamic Programming
        // dp[w] = minimum plates required to hit weight w per side
        const maxPlateWeight = items.length > 0 ? items[0].weightInt : 0;
        const reachableSideMax = items.reduce((acc, item) => acc + item.weightInt * item.pairs, 0);
        const desiredSearchW = sideTargetInt + maxPlateWeight * 2; // Buffer for closestAbove
        const maxSearchW = Math.min(desiredSearchW, reachableSideMax, MAX_DP_SEARCH_UNITS);
        
        const INF = 1000000;
        const dp = new Int32Array(maxSearchW + 1);
        dp.fill(INF);
        dp[0] = 0;

        // Traceback matrices to reconstruct the optimal loadout
        const traceItemIdx = new Int16Array(maxSearchW + 1);
        const traceCount = new Int16Array(maxSearchW + 1);
        const tracePrevW = new Int32Array(maxSearchW + 1);
        traceItemIdx.fill(-1);
        traceCount.fill(0);
        tracePrevW.fill(-1);

        for (let idx = 0; idx < items.length; idx++) {
            const item = items[idx];
            const w = item.weightInt;
            const count = item.pairs;

            // Traverse backwards to properly consume items as a bounded knapsack
            for (let currentW = maxSearchW; currentW >= 0; currentW--) {
                if (dp[currentW] === INF) continue;

                for (let k = 1; k <= count; k++) {
                    const nextW = currentW + k * w;
                    if (nextW <= maxSearchW) {
                        const newPlatesCount = dp[currentW] + k;
                        // For equal plate counts, prefer heavier plates (which occurs naturally due to item sorting, 
                        // but < strictly enforces minimum plates)
                        if (newPlatesCount < dp[nextW]) {
                            dp[nextW] = newPlatesCount;
                            traceItemIdx[nextW] = idx;
                            traceCount[nextW] = k;
                            tracePrevW[nextW] = currentW;
                        }
                    }
                }
            }
        }

        // Helper to reconstruct loadout from DP traces
        const reconstruct = (w: number): PlateLoadout | null => {
            if (dp[w] === INF) return null;
            const chosen = new Map<number, number>();
            let current = w;
            
            while (current > 0) {
                const idx = traceItemIdx[current];
                if (idx === -1) break; 
                
                const k = traceCount[current];
                const item = items[idx];
                
                // DP might trace multiple sets of the same plate if our algorithm branched, 
                // but bounded backwards loop ensures distinct items per trace edge
                chosen.set(item.weightInt, (chosen.get(item.weightInt) || 0) + k);
                current = tracePrevW[current];
            }
            return buildLoadout(chosen, barInt, metadataMap);
        };

        const exact: PlateLoadout[] = [];
        let bestBelowLoadout: PlateLoadout | null = null;
        let bestAboveLoadout: PlateLoadout | null = null;

        // 1. Find Exact Target Math
        if (sideTargetInt <= maxSearchW && dp[sideTargetInt] !== INF) {
            const loadout = reconstruct(sideTargetInt);
            if (loadout) exact.push(loadout);
        }

        // 2. Find Closest Below
        for (let w = Math.min(sideTargetInt - 1, maxSearchW); w > 0; w--) {
            if (dp[w] !== INF) {
                bestBelowLoadout = reconstruct(w);
                break;
            }
        }

        // 3. Find Closest Above
        if (sideTargetInt < maxSearchW) {
            for (let w = sideTargetInt + 1; w <= maxSearchW; w++) {
                if (dp[w] !== INF) {
                    bestAboveLoadout = reconstruct(w);
                    break;
                }
            }
        }

        return {
            exact,
            closestBelow: bestBelowLoadout,
            closestAbove: bestAboveLoadout,
            targetWeight: target,
            barWeight: bar
        };
    }
}
