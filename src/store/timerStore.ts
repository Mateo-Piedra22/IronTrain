import { create } from 'zustand';

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
    },
    stopTimer: () => set({ isRunning: false, timeLeft: 0, duration: 0, endAtMs: null }),
    pauseTimer: () => set((state) => {
        if (!state.isRunning || state.timeLeft <= 0) return state;
        return { isRunning: false, endAtMs: null };
    }),
    resumeTimer: () => set((state) => {
        if (state.isRunning || state.timeLeft <= 0) return state;
        const now = Date.now();
        return { isRunning: true, endAtMs: now + state.timeLeft * 1000 };
    }),
    restartTimer: () => set((state) => {
        const s = Math.max(0, Math.floor(state.duration));
        if (s <= 0) return state;
        const now = Date.now();
        return { timeLeft: s, isRunning: true, endAtMs: now + s * 1000 };
    }),
    tick: () => {
        const { isRunning, endAtMs } = get();
        if (!isRunning || !endAtMs) return;
        const now = Date.now();
        const left = Math.max(0, Math.ceil((endAtMs - now) / 1000));
        if (left <= 0) {
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
            const now = Date.now();
            const timeLeft = Math.max(0, Math.ceil((endAtMs - now) / 1000));
            return { endAtMs, timeLeft };
        }
        return { timeLeft: state.timeLeft + s };
    }),
}));
