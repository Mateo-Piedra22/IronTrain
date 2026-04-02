import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

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

            void loadTrainingDays();
            void refreshLocation(true);
            startRealtimeSync();
            onViewed?.();

            const locInterval = setInterval(() => {
                void refreshLocation(true);
            }, locationRefreshIntervalMs);

            return () => {
                clearInterval(locInterval);
                stopRealtimeSync();
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
