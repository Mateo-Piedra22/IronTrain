import { recordEndpointMetric, resetEndpointMetricsForTests } from '@/lib/endpoint-metrics';
import { beforeEach, describe, expect, it } from 'vitest';
import { computeThemesApiSloStatus } from './themes-api-slo';

describe('themes api slo', () => {
    beforeEach(() => {
        resetEndpointMetricsForTests();
    });

    it('stays healthy when rates and latency are within thresholds', () => {
        for (let index = 0; index < 30; index += 1) {
            recordEndpointMetric({ endpoint: 'social.themes.list', outcome: 'success', statusCode: 200, event: 'listed', durationMs: 120 });
        }

        const status = computeThemesApiSloStatus({
            maxErrorRate: 0.05,
            maxP95LatencyMs: 500,
            maxAvgLatencyMs: 300,
            minSamples: 20,
        });

        expect(status.ok).toBe(true);
        expect(status.namespaces.social.ok).toBe(true);
        expect(status.namespaces.social.totalRequests).toBe(30);
    });

    it('flags namespace when error rate breaches threshold', () => {
        for (let index = 0; index < 20; index += 1) {
            recordEndpointMetric({ endpoint: 'social.themes.list', outcome: 'success', statusCode: 200, event: 'listed', durationMs: 100 });
        }
        for (let index = 0; index < 5; index += 1) {
            recordEndpointMetric({ endpoint: 'social.themes.list', outcome: 'error', statusCode: 500, event: 'internal_error', durationMs: 200 });
        }

        const status = computeThemesApiSloStatus({
            maxErrorRate: 0.1,
            maxP95LatencyMs: 500,
            maxAvgLatencyMs: 300,
            minSamples: 20,
        });

        expect(status.ok).toBe(false);
        expect(status.failures).toContain('social');
        expect(status.namespaces.social.errorRate).toBeGreaterThan(0.1);
    });
});
