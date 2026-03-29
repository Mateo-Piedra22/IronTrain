type EndpointMetricRecord = {
    endpoint: string;
    outcome: 'success' | 'conflict' | 'ignored' | 'error';
    statusCode: number;
    event?: string;
};

type MetricValue = {
    count: number;
    lastAt: string;
};

const counters = new Map<string, MetricValue>();

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
    const existing = counters.get(key);
    const nextCount = (existing?.count ?? 0) + 1;
    counters.set(key, {
        count: nextCount,
        lastAt: new Date().toISOString(),
    });
}

export function getEndpointMetricsSnapshot(): Record<string, MetricValue> {
    return Object.fromEntries(counters.entries());
}

export function resetEndpointMetricsForTests(): void {
    counters.clear();
}
