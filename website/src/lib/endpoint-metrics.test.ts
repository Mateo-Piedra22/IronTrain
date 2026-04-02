import { beforeEach, describe, expect, it } from 'vitest';
import { getEndpointMetricsSnapshot, recordEndpointMetric, resetEndpointMetricsForTests } from './endpoint-metrics';

describe('endpoint metrics', () => {
    beforeEach(() => {
        resetEndpointMetricsForTests();
    });

    it('increments grouped counters', () => {
        recordEndpointMetric({ endpoint: 'social.inbox.send', outcome: 'success', statusCode: 200, event: 'created' });
        recordEndpointMetric({ endpoint: 'social.inbox.send', outcome: 'success', statusCode: 200, event: 'created' });

        const snapshot = getEndpointMetricsSnapshot();
        expect(snapshot['social.inbox.send|success|200|created']?.count).toBe(2);
    });

    it('keeps separate buckets by event and outcome', () => {
        recordEndpointMetric({ endpoint: 'sync.push', outcome: 'ignored', statusCode: 200, event: 'read_only_table' });
        recordEndpointMetric({ endpoint: 'sync.push', outcome: 'conflict', statusCode: 409, event: 'stale' });

        const snapshot = getEndpointMetricsSnapshot();
        expect(snapshot['sync.push|ignored|200|read_only_table']?.count).toBe(1);
        expect(snapshot['sync.push|conflict|409|stale']?.count).toBe(1);
    });

    it('reset clears all counters', () => {
        recordEndpointMetric({ endpoint: 'social.friends.request', outcome: 'success', statusCode: 200, event: 'created' });
        resetEndpointMetricsForTests();
        const snapshot = getEndpointMetricsSnapshot();
        expect(Object.keys(snapshot)).toHaveLength(0);
    });

    it('tracks latency aggregates when duration is provided', () => {
        recordEndpointMetric({ endpoint: 'social.themes.list', outcome: 'success', statusCode: 200, event: 'listed', durationMs: 40 });
        recordEndpointMetric({ endpoint: 'social.themes.list', outcome: 'success', statusCode: 200, event: 'listed', durationMs: 100 });
        recordEndpointMetric({ endpoint: 'social.themes.list', outcome: 'success', statusCode: 200, event: 'listed', durationMs: 60 });

        const snapshot = getEndpointMetricsSnapshot();
        const bucket = snapshot['social.themes.list|success|200|listed'];

        expect(bucket?.latencyMs.min).toBe(40);
        expect(bucket?.latencyMs.max).toBe(100);
        expect(bucket?.latencyMs.avg).toBeCloseTo(66.67, 2);
        expect(bucket?.latencyMs.p95).toBeCloseTo(96, 2);
    });
});
