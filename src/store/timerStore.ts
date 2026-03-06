import { create } from 'zustand';
import { configService } from '../services/ConfigService';
import { feedbackService } from '../services/FeedbackService';
import { systemNotificationService } from '../services/SystemNotificationService';

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
        if (s > 0) {
            systemNotificationService.scheduleRestTimerNotification(endAtMs);
        } else {
            systemNotificationService.cancelRestTimerNotification();
        }
    },
    stopTimer: () => {
        systemNotificationService.cancelRestTimerNotification();
        set({ isRunning: false, timeLeft: 0, duration: 0, endAtMs: null });
    },
    pauseTimer: () => {
        systemNotificationService.cancelRestTimerNotification();
        set((state) => {
            if (!state.isRunning || state.timeLeft <= 0) return state;
            return { isRunning: false, endAtMs: null };
        });
    },
    resumeTimer: () => set((state) => {
        if (state.isRunning || state.timeLeft <= 0) return state;
        const now = Date.now();
        const endAtMs = now + state.timeLeft * 1000;
        systemNotificationService.scheduleRestTimerNotification(endAtMs);
        return { isRunning: true, endAtMs };
    }),
    restartTimer: () => set((state) => {
        const s = Math.max(0, Math.floor(state.duration));
        if (s <= 0) return state;
        const now = Date.now();
        const endAtMs = now + s * 1000;
        systemNotificationService.scheduleRestTimerNotification(endAtMs);
        return { timeLeft: s, isRunning: true, endAtMs };
    }),
    tick: () => {
        const { isRunning, endAtMs } = get();
        if (!isRunning || !endAtMs) return;
        const now = Date.now();
        const left = Math.max(0, Math.ceil((endAtMs - now) / 1000));
        if (left <= 0) {
            const prefs = configService.get('notificationPreferences');
            if (prefs.sounds.restTimer) {
                feedbackService.restTimerExpired();
            } else {
                // Still provide haptic even if sound for rest timer is off
                feedbackService.timerComplete();
            }
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
            systemNotificationService.scheduleRestTimerNotification(endAtMs);
            const now = Date.now();
            const timeLeft = Math.max(0, Math.ceil((endAtMs - now) / 1000));
            return { endAtMs, timeLeft };
        }
        return { timeLeft: state.timeLeft + s };
    }),
}));
