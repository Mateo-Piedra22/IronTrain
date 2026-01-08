import { create } from 'zustand';

interface TimerState {
    timeLeft: number;
    isRunning: boolean;
    duration: number;
    startTimer: (seconds: number) => void;
    stopTimer: () => void;
    tick: () => void;
    addTime: (seconds: number) => void;
}

export const useTimerStore = create<TimerState>((set, get) => ({
    timeLeft: 0,
    isRunning: false,
    duration: 0,
    startTimer: (seconds: number) => set({ timeLeft: seconds, duration: seconds, isRunning: true }),
    stopTimer: () => set({ isRunning: false, timeLeft: 0 }),
    tick: () => {
        const { timeLeft, isRunning } = get();
        if (isRunning && timeLeft > 0) {
            set({ timeLeft: timeLeft - 1 });
        } else if (isRunning && timeLeft <= 0) {
            set({ isRunning: false });
            // Play sound? (Future)
        }
    },
    addTime: (seconds: number) => set((state) => ({ timeLeft: state.timeLeft + seconds })),
}));
