import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { isOptimizationFlagEnabled } from '../utils/optimizationFlags';
import { captureOptimizationMetric } from '../utils/optimizationMetrics';

interface UseSocialRealtimeLifecycleOptions {
    enabled: boolean;
    loadTrainingDays: () => void | Promise<void>;
    refreshLocation: (silent?: boolean) => void | Promise<void>;
    startRealtimeSync: () => void;
    stopRealtimeSync: () => void;
    onViewed?: () => void;
    locationRefreshIntervalMs?: number;
}

export function useSocialRealtimeLifecycle({
    enabled,
    loadTrainingDays,
    refreshLocation,
    startRealtimeSync,
    stopRealtimeSync,
    onViewed,
    locationRefreshIntervalMs = 3 * 60 * 1000,
}: UseSocialRealtimeLifecycleOptions) {
    useFocusEffect(
        useCallback(() => {
            if (!enabled) return;

            const socialRealtimeV2Enabled = isOptimizationFlagEnabled('socialRealtimeV2');
            const resolvedLocationIntervalMs = socialRealtimeV2Enabled
                ? Math.max(locationRefreshIntervalMs, 5 * 60 * 1000)
                : locationRefreshIntervalMs;

            captureOptimizationMetric('opt_social_realtime_focus_start', {
                reason: 'tab_focus',
                social_realtime_v2_enabled: socialRealtimeV2Enabled,
                location_interval_ms: resolvedLocationIntervalMs,
            }, 3000);

            void loadTrainingDays();
            void refreshLocation(true);
            startRealtimeSync();
            onViewed?.();

            const locInterval = setInterval(() => {
                void refreshLocation(true);
            }, resolvedLocationIntervalMs);

            return () => {
                clearInterval(locInterval);
                stopRealtimeSync();
                captureOptimizationMetric('opt_social_realtime_focus_stop', {
                    reason: 'tab_blur',
                    social_realtime_v2_enabled: socialRealtimeV2Enabled,
                }, 3000);
            };
        }, [
            enabled,
            loadTrainingDays,
            refreshLocation,
            startRealtimeSync,
            stopRealtimeSync,
            onViewed,
            locationRefreshIntervalMs,
        ])
    );
}
