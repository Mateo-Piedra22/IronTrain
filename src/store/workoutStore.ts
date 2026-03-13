import { create } from 'zustand';
import { configService } from '../services/ConfigService';
import { dbService } from '../services/DatabaseService';
import { workoutService } from '../services/WorkoutService';
import { Exercise, Workout, WorkoutSet } from '../types/db';
import { logger } from '../utils/logger';
import { useTimerStore } from './timerStore';

// Types for the active workout state
interface ActiveWorkoutState {
    activeWorkout: Workout | null;
    activeSets: WorkoutSet[];
    workoutTimer: number; // seconds
    isTimerRunning: boolean;
    lastTickAtMs: number | null;

    exerciseNames: Record<string, string>;
    loadExercises: () => Promise<void>;

    // Actions
    startWorkout: (name?: string) => Promise<void>;
    resumeWorkout: (workout: Workout) => Promise<void>;
    finishWorkout: () => Promise<void>;
    cancelWorkout: () => Promise<void>;
    tickTimer: () => void;
    setWorkoutStatus: (status: 'in_progress' | 'completed') => Promise<void>;

    addExercise: (exerciseId: string) => Promise<void>;
    addSet: (exerciseId: string) => Promise<void>;
    updateSet: (setId: string, updates: Partial<WorkoutSet>) => Promise<void>;
    removeSet: (setId: string) => Promise<void>;
    toggleSetComplete: (setId: string) => Promise<void>;

    loadSetsForWorkout: (workoutId: string) => Promise<void>;
    loadWorkoutById: (workoutId: string) => Promise<void>;
}

export const useWorkoutStore = create<ActiveWorkoutState>((set, get) => ({
    activeWorkout: null,
    activeSets: [],
    workoutTimer: 0,
    isTimerRunning: false,
    lastTickAtMs: null,
    exerciseNames: {},

    loadExercises: async () => {
        try {
            const exercises = await dbService.getAll<Exercise>('SELECT id, name FROM exercises');
            const map: Record<string, string> = {};
            exercises.forEach(e => map[e.id] = e.name);
            set({ exerciseNames: map });
        } catch (e) {
            logger.captureException(e, { scope: 'workoutStore.loadExercises' });
        }
    },

    startWorkout: async (name) => {
        const now = new Date();
        const workout = await workoutService.getActiveWorkout(now);

        if (name) {
            await workoutService.update(workout.id, { name });
            workout.name = name;
        }

        set({
            activeWorkout: workout,
            activeSets: [],
            workoutTimer: 0,
            isTimerRunning: workout.status !== 'completed' && workout.is_template !== 1,
            lastTickAtMs: Date.now()
        });

        if (workout.status !== 'completed' && workout.is_template !== 1) {
            await configService.set('runningWorkoutTimerWorkoutId', workout.id);
        }

        // Load sets if resuming or created
        await get().loadSetsForWorkout(workout.id);
    },

    resumeWorkout: async (workout) => {
        const savedDuration = workout.duration ?? 0;
        set({
            activeWorkout: workout,
            workoutTimer: savedDuration,
            isTimerRunning: workout.status !== 'completed' && workout.is_template !== 1,
            lastTickAtMs: Date.now()
        });
        if (workout.status !== 'completed' && workout.is_template !== 1) {
            await configService.set('runningWorkoutTimerWorkoutId', workout.id);
        }
        await get().loadSetsForWorkout(workout.id);
    },

    tickTimer: () => {
        const { activeWorkout, workoutTimer, lastTickAtMs, isTimerRunning } = get();
        if (!activeWorkout || !isTimerRunning) return;
        if (activeWorkout.status === 'completed' || activeWorkout.is_template === 1) return;

        const ownerId = configService.get('runningWorkoutTimerWorkoutId');
        if (!ownerId || ownerId !== activeWorkout.id) return;

        const now = Date.now();
        const last = lastTickAtMs ?? now;
        const deltaSec = Math.max(0, Math.floor((now - last) / 1000));
        if (deltaSec <= 0) return;

        const newTime = workoutTimer + deltaSec;
        set({ workoutTimer: newTime, lastTickAtMs: now });

        // Persist to DB every 10 seconds
        if (newTime % 10 < deltaSec) {
            workoutService.update(activeWorkout.id, { duration: newTime });
        }
    },

    loadSetsForWorkout: async (workoutId) => {
        const sets = await workoutService.getSets(workoutId);
        set({ activeSets: sets });
    },

    loadWorkoutById: async (workoutId) => {
        const workout = await dbService.getWorkoutById(workoutId);
        if (!workout) {
            set({ activeWorkout: null, activeSets: [], isTimerRunning: false, workoutTimer: 0, lastTickAtMs: null });
            return;
        }
        const savedDuration = workout.duration ?? 0;
        const ownerId = configService.get('runningWorkoutTimerWorkoutId');
        const isOwner = !!ownerId && ownerId === workout.id;
        const canRun = workout.status !== 'completed' && workout.is_template !== 1;
        set({
            activeWorkout: workout,
            workoutTimer: savedDuration,
            isTimerRunning: canRun && isOwner,
            lastTickAtMs: Date.now()
        });
        await Promise.all([get().loadExercises(), get().loadSetsForWorkout(workout.id)]);
    },

    finishWorkout: async () => {
        const { activeWorkout } = get();
        if (!activeWorkout) return;

        await workoutService.finishWorkout(activeWorkout.id);
        const ownerId = configService.get('runningWorkoutTimerWorkoutId');
        if (ownerId === activeWorkout.id) {
            await configService.set('runningWorkoutTimerWorkoutId', null);
        }
        set({
            activeWorkout: { ...activeWorkout, status: 'completed', end_time: Date.now() } as any,
            isTimerRunning: false,
            lastTickAtMs: null
        });
    },

    cancelWorkout: async () => {
        const { activeWorkout } = get();
        if (activeWorkout) {
            await workoutService.delete(activeWorkout.id);
            const ownerId = configService.get('runningWorkoutTimerWorkoutId');
            if (ownerId === activeWorkout.id) {
                await configService.set('runningWorkoutTimerWorkoutId', null);
            }
        }
        set({ activeWorkout: null, activeSets: [], isTimerRunning: false, lastTickAtMs: null });
    },

    setWorkoutStatus: async (status) => {
        const { activeWorkout } = get();
        if (!activeWorkout) return;
        if (activeWorkout.is_template === 1) return;

        if (status === 'completed') {
            await workoutService.finishWorkout(activeWorkout.id);
            const ownerId = configService.get('runningWorkoutTimerWorkoutId');
            if (ownerId === activeWorkout.id) {
                await configService.set('runningWorkoutTimerWorkoutId', null);
            }
            set({
                activeWorkout: { ...activeWorkout, status: 'completed', end_time: Date.now() } as any,
                isTimerRunning: false,
                lastTickAtMs: null
            });
            return;
        }

        await workoutService.resumeWorkout(activeWorkout.id);
        await configService.set('runningWorkoutTimerWorkoutId', activeWorkout.id);
        set({
            activeWorkout: { ...activeWorkout, status: 'in_progress', end_time: undefined } as any,
            isTimerRunning: true,
            lastTickAtMs: Date.now()
        });
    },

    addExercise: async (exerciseId) => {
        await get().addSet(exerciseId);
    },

    addSet: async (exerciseId) => {
        const { activeWorkout } = get();
        if (!activeWorkout) return;
        if (activeWorkout.status === 'completed') return;

        // Logic now delegated to Service
        await workoutService.addSet(activeWorkout.id, exerciseId);

        // Refresh local state
        await get().loadSetsForWorkout(activeWorkout.id);
    },

    updateSet: async (setId, updates) => {
        const { activeWorkout } = get();
        if (!activeWorkout || activeWorkout.status === 'completed') return;
        const prev = get().activeSets.find(s => s.id === setId);
        const shouldAutoRest =
            updates.completed === 1 &&
            prev?.completed !== 1 &&
            configService.get('autoStartRestTimerOnSetComplete');

        // Optimistic update
        set(state => ({
            activeSets: state.activeSets.map(s => s.id === setId ? { ...s, ...updates } : s)
        }));

        try {
            await workoutService.updateSet(setId, updates);
            if (shouldAutoRest) {
                useTimerStore.getState().startTimer(configService.get('defaultRestTimer'));
            }
        } catch (e) {
            logger.captureException(e, { scope: 'workoutStore.updateSet' });
            // Revert on failure (could implement fetching fresh state)
            if (activeWorkout) await get().loadSetsForWorkout(activeWorkout.id);
        }
    },

    removeSet: async (setId) => {
        const { activeWorkout } = get();
        if (!activeWorkout || activeWorkout.status === 'completed') return;
        await workoutService.deleteSet(setId);
        set(state => ({
            activeSets: state.activeSets.filter(s => s.id !== setId)
        }));
    },

    toggleSetComplete: async (setId) => {
        const s = get().activeSets.find(s => s.id === setId);
        if (s) {
            await get().updateSet(setId, { completed: s.completed ? 0 : 1 });
        }
    }
}));
