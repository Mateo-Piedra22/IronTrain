import { getEndpointMetricsSnapshot } from '@/lib/endpoint-metrics';

type SloBucket = {
    key: string;
    endpoint: string;
    outcome: string;
    statusCode: number;
    count: number;
    p95Ms: number | null;
    avgMs: number | null;
};

export type ThemesApiSloThresholds = {
    maxErrorRate: number;
    maxP95LatencyMs: number;
    maxAvgLatencyMs: number;
    minSamples: number;
};

export type ThemesApiSloNamespace = {
    name: 'social' | 'admin';
    totalRequests: number;
    successRate: number;
    errorRate: number;
    p95LatencyMs: number | null;
    avgLatencyMs: number | null;
    breachingEndpoints: string[];
    ok: boolean;
};

export type ThemesApiSloStatus = {
    generatedAt: string;
    thresholds: ThemesApiSloThresholds;
    namespaces: {
        social: ThemesApiSloNamespace;
        admin: ThemesApiSloNamespace;
    };
    ok: boolean;
    failures: string[];
};

const DEFAULT_THRESHOLDS: ThemesApiSloThresholds = {
    maxErrorRate: 0.02,
    maxP95LatencyMs: 900,
    maxAvgLatencyMs: 450,
    minSamples: 20,
};

function parseBucket(key: string, value: { count: number; latencyMs?: { p95: number | null; avg: number | null } }): SloBucket | null {
    const [endpoint, outcome, statusCodeRaw] = key.split('|');
    const statusCode = Number.parseInt(statusCodeRaw ?? '0', 10);

    if (!endpoint || !Number.isFinite(statusCode)) return null;

    return {
        key,
        endpoint,
        outcome: outcome ?? 'error',
        statusCode,
        count: Number.isFinite(value.count) ? value.count : 0,
        p95Ms: value.latencyMs?.p95 ?? null,
        avgMs: value.latencyMs?.avg ?? null,
    };
}

function aggregateNamespace(name: 'social' | 'admin', buckets: SloBucket[], thresholds: ThemesApiSloThresholds): ThemesApiSloNamespace {
    const totalRequests = buckets.reduce((acc, bucket) => acc + bucket.count, 0);
    const errorRequests = buckets
        .filter((bucket) => bucket.statusCode >= 500 || bucket.outcome === 'error' && bucket.statusCode >= 400)
        .reduce((acc, bucket) => acc + bucket.count, 0);

    const successRequests = buckets
        .filter((bucket) => bucket.outcome === 'success' || bucket.outcome === 'ignored' || bucket.outcome === 'conflict')
        .reduce((acc, bucket) => acc + bucket.count, 0);

    const weightedP95Numerator = buckets.reduce((acc, bucket) => {
        if (bucket.p95Ms === null) return acc;
        return acc + (bucket.p95Ms * bucket.count);
    }, 0);

    const weightedP95Denominator = buckets.reduce((acc, bucket) => {
        if (bucket.p95Ms === null) return acc;
        return acc + bucket.count;
    }, 0);

    const weightedAvgNumerator = buckets.reduce((acc, bucket) => {
        if (bucket.avgMs === null) return acc;
        return acc + (bucket.avgMs * bucket.count);
    }, 0);

    const weightedAvgDenominator = buckets.reduce((acc, bucket) => {
        if (bucket.avgMs === null) return acc;
        return acc + bucket.count;
    }, 0);

    const p95LatencyMs = weightedP95Denominator > 0
        ? Number((weightedP95Numerator / weightedP95Denominator).toFixed(2))
        : null;

    const avgLatencyMs = weightedAvgDenominator > 0
        ? Number((weightedAvgNumerator / weightedAvgDenominator).toFixed(2))
        : null;

    const errorRate = totalRequests > 0 ? errorRequests / totalRequests : 0;
    const successRate = totalRequests > 0 ? successRequests / totalRequests : 0;

    const breachingEndpoints = Array.from(
        new Set(
            buckets
                .filter((bucket) => bucket.statusCode >= 500 || (bucket.p95Ms !== null && bucket.p95Ms > thresholds.maxP95LatencyMs))
                .map((bucket) => bucket.endpoint),
        ),
    );

    const hasEnoughSamples = totalRequests >= thresholds.minSamples;
    const latencyOk = p95LatencyMs === null || p95LatencyMs <= thresholds.maxP95LatencyMs;
    const avgOk = avgLatencyMs === null || avgLatencyMs <= thresholds.maxAvgLatencyMs;
    const errorOk = errorRate <= thresholds.maxErrorRate;

    return {
        name,
        totalRequests,
        successRate: Number(successRate.toFixed(4)),
        errorRate: Number(errorRate.toFixed(4)),
        p95LatencyMs,
        avgLatencyMs,
        breachingEndpoints,
        ok: hasEnoughSamples ? latencyOk && avgOk && errorOk : true,
    };
}

function getThresholdsFromEnv(): ThemesApiSloThresholds {
    return {
        maxErrorRate: Number(process.env.THEMES_SLO_MAX_ERROR_RATE ?? DEFAULT_THRESHOLDS.maxErrorRate),
        maxP95LatencyMs: Number(process.env.THEMES_SLO_MAX_P95_MS ?? DEFAULT_THRESHOLDS.maxP95LatencyMs),
        maxAvgLatencyMs: Number(process.env.THEMES_SLO_MAX_AVG_MS ?? DEFAULT_THRESHOLDS.maxAvgLatencyMs),
        minSamples: Number(process.env.THEMES_SLO_MIN_SAMPLES ?? DEFAULT_THRESHOLDS.minSamples),
    };
}

export function computeThemesApiSloStatus(thresholds = getThresholdsFromEnv()): ThemesApiSloStatus {
    const snapshot = getEndpointMetricsSnapshot();
    const buckets = Object.entries(snapshot)
        .map(([key, value]) => parseBucket(key, value))
        .filter((bucket): bucket is SloBucket => Boolean(bucket));

    const socialBuckets = buckets.filter((bucket) => bucket.endpoint.startsWith('social.themes.'));
    const adminBuckets = buckets.filter((bucket) => bucket.endpoint.startsWith('admin.themes.'));

    const social = aggregateNamespace('social', socialBuckets, thresholds);
    const admin = aggregateNamespace('admin', adminBuckets, thresholds);

    const failures: string[] = [];
    if (!social.ok) failures.push('social');
    if (!admin.ok) failures.push('admin');

    return {
        generatedAt: new Date().toISOString(),
        thresholds,
        namespaces: {
            social,
            admin,
        },
        ok: failures.length === 0,
        failures,
    };
}
