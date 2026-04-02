type EndpointMetricRecord = {
    endpoint: string;
    outcome: 'success' | 'conflict' | 'ignored' | 'error';
    statusCode: number;
    event?: string;
    durationMs?: number;
};

type EndpointMetricRecorder = (record: Omit<EndpointMetricRecord, 'endpoint' | 'durationMs'> & { durationMs?: number }) => void;

type MetricValue = {
    count: number;
    lastAt: string;
    latencyMs: {
        min: number | null;
        max: number | null;
        avg: number | null;
        p95: number | null;
    };
};

const counters = new Map<string, MetricValue>();
const latencySamples = new Map<string, number[]>();

const MAX_SAMPLES_PER_BUCKET = 64;

function isFiniteLatency(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function percentile(values: number[], p: number): number | null {
    if (!values.length) return null;
    const sorted = [...values].sort((left, right) => left - right);
    if (p <= 0) return sorted[0];
    if (p >= 100) return sorted[sorted.length - 1];

    const rank = (p / 100) * (sorted.length - 1);
    const lowerIndex = Math.floor(rank);
    const upperIndex = Math.ceil(rank);

    if (lowerIndex === upperIndex) return sorted[lowerIndex];

    const weight = rank - lowerIndex;
    return sorted[lowerIndex] + (sorted[upperIndex] - sorted[lowerIndex]) * weight;
}

function summarizeLatencies(samples: number[]): MetricValue['latencyMs'] {
    if (!samples.length) {
        return {
            min: null,
            max: null,
            avg: null,
            p95: null,
        };
    }

    let min = samples[0];
    let max = samples[0];
    let sum = 0;

    for (const sample of samples) {
        if (sample < min) min = sample;
        if (sample > max) max = sample;
        sum += sample;
    }

    return {
        min,
        max,
        avg: Number((sum / samples.length).toFixed(2)),
        p95: percentile(samples, 95),
    };
}

function toKey(record: EndpointMetricRecord): string {
    return [
        record.endpoint,
        record.outcome,
        String(record.statusCode),
        record.event ?? 'none',
    ].join('|');
}

export function recordEndpointMetric(record: EndpointMetricRecord): void {
    const key = toKey(record);
    const samples = latencySamples.get(key) ?? [];
    if (isFiniteLatency(record.durationMs)) {
        samples.push(record.durationMs);
        if (samples.length > MAX_SAMPLES_PER_BUCKET) {
            samples.splice(0, samples.length - MAX_SAMPLES_PER_BUCKET);
        }
    }
    latencySamples.set(key, samples);

    const existing = counters.get(key);
    const nextCount = (existing?.count ?? 0) + 1;
    counters.set(key, {
        count: nextCount,
        lastAt: new Date().toISOString(),
        latencyMs: summarizeLatencies(samples),
    });
}

export function createEndpointMetricRecorder(endpoint: string, startedAtMs = Date.now()): EndpointMetricRecorder {
    return (record) => {
        const derivedDurationMs = Number.isFinite(record.durationMs)
            ? record.durationMs
            : Math.max(0, Date.now() - startedAtMs);

        recordEndpointMetric({
            endpoint,
            outcome: record.outcome,
            statusCode: record.statusCode,
            event: record.event,
            durationMs: derivedDurationMs,
        });
    };
}

export function getEndpointMetricsSnapshot(): Record<string, MetricValue> {
    return Object.fromEntries(counters.entries());
}

export function resetEndpointMetricsForTests(): void {
    counters.clear();
    latencySamples.clear();
}
