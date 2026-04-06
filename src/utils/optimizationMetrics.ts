import { useAuthStore } from '@/src/store/authStore';
import * as analytics from '@/src/utils/analytics';

type MetricProperties = Record<string, unknown>;

const defaultThrottleMs = 15_000;
const metricLastSentAt = new Map<string, number>();

const shouldEmit = (eventName: string, reason: string, throttleMs: number) => {
    const now = Date.now();
    const key = `${eventName}:${reason}`;
    const previous = metricLastSentAt.get(key) || 0;
    if (now - previous < throttleMs) return false;
    metricLastSentAt.set(key, now);
    return true;
};

export const captureOptimizationMetric = (
    eventName: string,
    properties: MetricProperties = {},
    throttleMs: number = defaultThrottleMs
) => {
    const reason = String(properties.reason || 'default');
    if (!shouldEmit(eventName, reason, throttleMs)) return;

    try {
        const authState = useAuthStore.getState();
        analytics.capture(eventName, {
            ...properties,
            user_id: authState.user?.id || null,
            has_token: !!authState.token,
            platform: 'mobile',
            ts_ms: Date.now(),
        });
    } catch {
        // no-op
    }
};
