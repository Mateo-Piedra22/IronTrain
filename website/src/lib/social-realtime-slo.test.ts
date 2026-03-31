import { describe, expect, it } from 'vitest';
import { computeSocialRealtimeSlo, evaluateSocialRealtimeSlo } from './social-realtime-slo';

describe('social realtime SLO metrics', () => {
    it('computes fallback, stale, recovery p95 and anomaly ratio', () => {
        const metrics = computeSocialRealtimeSlo(
            {
                streamConnected: 100,
                streamClosed: 95,
                transportChangedToPolling: 12,
                staleDetected: 6,
                recovered: 10,
                observationWindowMinutes: 60,
            },
            [1000, 1400, 2000, 3000, 4000],
        );

        expect(metrics.fallbackRatio).toBe(0.12);
        expect(metrics.staleDetectionRate).toBe(0.06);
        expect(metrics.recoveryTimeP95Ms).toBe(3800);
        expect(metrics.closeAnomalyRatio).toBe(0.05);
    });

    it('handles empty denominators and empty recovery durations safely', () => {
        const metrics = computeSocialRealtimeSlo(
            {
                streamConnected: 0,
                streamClosed: 0,
                transportChangedToPolling: 0,
                staleDetected: 0,
                recovered: 0,
                observationWindowMinutes: 60,
            },
            [],
        );

        expect(metrics.fallbackRatio).toBe(0);
        expect(metrics.staleDetectionRate).toBe(0);
        expect(metrics.recoveryTimeP95Ms).toBeNull();
        expect(metrics.closeAnomalyRatio).toBe(0);
    });

    it('flags threshold violations for alerting', () => {
        const status = evaluateSocialRealtimeSlo(
            {
                streamConnected: 100,
                streamClosed: 60,
                transportChangedToPolling: 40,
                staleDetected: 30,
                recovered: 15,
                observationWindowMinutes: 60,
            },
            [1000, 7000, 9000, 12000],
            {
                maxFallbackRatio: 0.2,
                maxStaleDetectionRate: 0.1,
                maxCloseAnomalyRatio: 0.1,
                maxRecoveryTimeP95Ms: 8000,
            },
        );

        expect(status.ok).toBe(false);
        expect(status.failures).toContain('fallbackRatio');
        expect(status.failures).toContain('staleDetectionRate');
        expect(status.failures).toContain('closeAnomalyRatio');
        expect(status.failures).toContain('recoveryTimeP95Ms');
    });
});
