import * as analytics from '@/src/utils/analytics';

export const OPTIMIZATION_FLAGS = {
    syncSchedulerV2: 'opt.sync.scheduler.v2',
    socialRealtimeV2: 'opt.social.realtime.v2',
    timerUnifiedV1: 'opt.timer.unified.v1',
    diaryIncrementalRefreshV1: 'opt.diary.incremental_refresh.v1',
    analysisLazyLoadingV1: 'opt.analysis.lazy_loading.v1',
} as const;

export type OptimizationFlagName = keyof typeof OPTIMIZATION_FLAGS;

const parseBoolean = (value: string | undefined): boolean | null => {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return null;
};

const envFallbackMap: Record<OptimizationFlagName, string | undefined> = {
    syncSchedulerV2: process.env.EXPO_PUBLIC_OPT_SYNC_SCHEDULER_V2,
    socialRealtimeV2: process.env.EXPO_PUBLIC_OPT_SOCIAL_REALTIME_V2,
    timerUnifiedV1: process.env.EXPO_PUBLIC_OPT_TIMER_UNIFIED_V1,
    diaryIncrementalRefreshV1: process.env.EXPO_PUBLIC_OPT_DIARY_INCREMENTAL_REFRESH_V1,
    analysisLazyLoadingV1: process.env.EXPO_PUBLIC_OPT_ANALYSIS_LAZY_LOADING_V1,
};

export const isOptimizationFlagEnabled = (flagName: OptimizationFlagName): boolean => {
    const key = OPTIMIZATION_FLAGS[flagName];
    try {
        const remoteValue = analytics.isFeatureFlagEnabled(key);
        if (typeof remoteValue === 'boolean') return remoteValue;
    } catch {
        // no-op; fallback handled below
    }

    const envFallback = parseBoolean(envFallbackMap[flagName]);
    return envFallback ?? false;
};
