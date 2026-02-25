import notifee, { AndroidImportance, TimestampTrigger, TriggerType } from '@notifee/react-native';
import { create } from 'zustand';
import { feedbackService } from '../services/FeedbackService';

const TIMER_NOTIFICATION_ID = 'rest-timer-alert';

async function scheduleTimerNotification(endAtMs: number) {
    try {
        await notifee.createChannel({
            id: 'timers',
            name: 'Temporizadores de Descanso',
            sound: 'default',
            importance: AndroidImportance.HIGH,
        });

        const trigger: TimestampTrigger = {
            type: TriggerType.TIMESTAMP,
            timestamp: endAtMs,
        };

        await notifee.createTriggerNotification(
            {
                id: TIMER_NOTIFICATION_ID,
                title: '¡Descanso Terminado!',
                body: 'Es hora de tu próxima serie. ¡Vamos!',
                android: {
                    channelId: 'timers',
                    pressAction: {
                        id: 'default',
                    },
                },
                ios: {
                    sound: 'default',
                }
            },
            trigger
        );
    } catch (e) {
        console.warn('Failed to schedule timer notification', e);
    }
}

async function cancelTimerNotification() {
    try {
        await notifee.cancelNotification(TIMER_NOTIFICATION_ID);
    } catch (e) {
        // ignore
    }
}

interface TimerState {
    timeLeft: number;
    isRunning: boolean;
    duration: number;
    endAtMs: number | null;
    startTimer: (seconds: number) => void;
    stopTimer: () => void;
    pauseTimer: () => void;
    resumeTimer: () => void;
    restartTimer: () => void;
    tick: () => void;
    addTime: (seconds: number) => void;
}

export const useTimerStore = create<TimerState>((set, get) => ({
    timeLeft: 0,
    isRunning: false,
    duration: 0,
    endAtMs: null,
    startTimer: (seconds: number) => {
        const s = Math.max(0, Math.floor(seconds));
        const now = Date.now();
        const endAtMs = now + s * 1000;
        set({ timeLeft: s, duration: s, isRunning: s > 0, endAtMs: s > 0 ? endAtMs : null });
        if (s > 0) scheduleTimerNotification(endAtMs);
        else cancelTimerNotification();
    },
    stopTimer: () => {
        cancelTimerNotification();
        set({ isRunning: false, timeLeft: 0, duration: 0, endAtMs: null });
    },
    pauseTimer: () => {
        cancelTimerNotification();
        set((state) => {
            if (!state.isRunning || state.timeLeft <= 0) return state;
            return { isRunning: false, endAtMs: null };
        });
    },
    resumeTimer: () => set((state) => {
        if (state.isRunning || state.timeLeft <= 0) return state;
        const now = Date.now();
        const endAtMs = now + state.timeLeft * 1000;
        scheduleTimerNotification(endAtMs);
        return { isRunning: true, endAtMs };
    }),
    restartTimer: () => set((state) => {
        const s = Math.max(0, Math.floor(state.duration));
        if (s <= 0) return state;
        const now = Date.now();
        const endAtMs = now + s * 1000;
        scheduleTimerNotification(endAtMs);
        return { timeLeft: s, isRunning: true, endAtMs };
    }),
    tick: () => {
        const { isRunning, endAtMs } = get();
        if (!isRunning || !endAtMs) return;
        const now = Date.now();
        const left = Math.max(0, Math.ceil((endAtMs - now) / 1000));
        if (left <= 0) {
            cancelTimerNotification();
            feedbackService.restTimerExpired();
            set({ timeLeft: 0, isRunning: false, endAtMs: null });
        } else {
            set({ timeLeft: left });
        }
    },
    addTime: (seconds: number) => set((state) => {
        const s = Math.max(0, Math.floor(seconds));
        if (s <= 0) return state;
        if (state.isRunning && state.endAtMs) {
            const endAtMs = state.endAtMs + s * 1000;
            scheduleTimerNotification(endAtMs);
            const now = Date.now();
            const timeLeft = Math.max(0, Math.ceil((endAtMs - now) / 1000));
            return { endAtMs, timeLeft };
        }
        return { timeLeft: state.timeLeft + s };
    }),
}));
