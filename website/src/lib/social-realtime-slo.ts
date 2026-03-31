export type SocialRealtimeCounters = {
    streamConnected: number;
    streamClosed: number;
    transportChangedToPolling: number;
    staleDetected: number;
    recovered: number;
    observationWindowMinutes: number;
};

export type SocialRealtimeSlo = {
    fallbackRatio: number;
    staleDetectionRate: number;
    recoveryTimeP95Ms: number | null;
    closeAnomalyRatio: number;
};

export type SocialRealtimeThresholds = {
    maxFallbackRatio: number;
    maxStaleDetectionRate: number;
    maxCloseAnomalyRatio: number;
    maxRecoveryTimeP95Ms: number;
};

export type SocialRealtimeSloStatus = {
    ok: boolean;
    failures: Array<keyof SocialRealtimeSlo>;
    metrics: SocialRealtimeSlo;
};

const safeDivide = (numerator: number, denominator: number): number => {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
    return numerator / denominator;
};

const percentile = (values: number[], p: number): number | null => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);

    // Compute percentile using linear interpolation between closest ranks.
    // For p <= 0, return the minimum; for p >= 100, return the maximum.
    if (p <= 0) return sorted[0];
    if (p >= 100) return sorted[sorted.length - 1];

    const rank = (p / 100) * (sorted.length - 1);
    const lowerIndex = Math.floor(rank);
    const upperIndex = Math.ceil(rank);

    if (lowerIndex === upperIndex) {
        return sorted[lowerIndex];
    }

    const weight = rank - lowerIndex;
    return sorted[lowerIndex] + (sorted[upperIndex] - sorted[lowerIndex]) * weight;
};

export function computeSocialRealtimeSlo(
    counters: SocialRealtimeCounters,
    recoveryDurationsMs: number[]
): SocialRealtimeSlo {
    const fallbackRatio = safeDivide(counters.transportChangedToPolling, counters.streamConnected);
    const staleDetectionRate = safeDivide(counters.staleDetected, counters.streamConnected);
    const recoveryTimeP95Ms = percentile(
        recoveryDurationsMs.filter((value) => Number.isFinite(value) && value >= 0),
        95,
    );
    const closeAnomalyRatio = safeDivide(
        Math.max(0, counters.streamConnected - counters.streamClosed),
        counters.streamConnected,
    );

    return {
        fallbackRatio,
        staleDetectionRate,
        recoveryTimeP95Ms,
        closeAnomalyRatio,
    };
}

export function evaluateSocialRealtimeSlo(
    counters: SocialRealtimeCounters,
    recoveryDurationsMs: number[],
    thresholds: SocialRealtimeThresholds,
): SocialRealtimeSloStatus {
    const metrics = computeSocialRealtimeSlo(counters, recoveryDurationsMs);
    const failures: Array<keyof SocialRealtimeSlo> = [];

    if (metrics.fallbackRatio > thresholds.maxFallbackRatio) failures.push('fallbackRatio');
    if (metrics.staleDetectionRate > thresholds.maxStaleDetectionRate) failures.push('staleDetectionRate');
    if (metrics.closeAnomalyRatio > thresholds.maxCloseAnomalyRatio) failures.push('closeAnomalyRatio');
    if (metrics.recoveryTimeP95Ms !== null && metrics.recoveryTimeP95Ms > thresholds.maxRecoveryTimeP95Ms) {
        failures.push('recoveryTimeP95Ms');
    }

    return {
        ok: failures.length === 0,
        failures,
        metrics,
    };
}
