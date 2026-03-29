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
    pauseWorkout: () => void;
    unpauseWorkout: () => void;
    updateDuration: (seconds: number) => Promise<void>;
    finishWorkout: () => Promise<void>;
    cancelWorkout: () => Promise<void>;
    tickTimer: () => void;
    setWorkoutStatus: (status: 'in_progress' | 'completed') => Promise<void>;

    addExercise: (exerciseId: string) => Promise<void>;
    addSet: (exerciseId: string) => Promise<void>;
    updateSet: (setId: string, updates: Partial<WorkoutSet>) => Promise<void>;
    removeSet: (setId: string) => Promise<void>;
    toggleSetComplete: (setId: string) => Promise<void>;
    reorderSets: (workoutId: string, orderedSetIds: string[]) => Promise<void>;

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

    pauseWorkout: () => {
        set({ isTimerRunning: false, lastTickAtMs: null });
        const { activeWorkout, workoutTimer } = get();
        if (activeWorkout) {
            configService.setGeneric(`runningWorkoutTimerStartTimestamp_${activeWorkout.id}`, null);
            configService.setGeneric(`runningWorkoutTimerBaseSeconds_${activeWorkout.id}`, workoutTimer);
            workoutService.update(activeWorkout.id, { duration: workoutTimer });
        }
    },

    unpauseWorkout: () => {
        const { activeWorkout, workoutTimer } = get();
        set({ isTimerRunning: true, lastTickAtMs: Date.now() });
        if (activeWorkout) {
            configService.setGeneric(`runningWorkoutTimerStartTimestamp_${activeWorkout.id}`, Date.now());
            configService.setGeneric(`runningWorkoutTimerBaseSeconds_${activeWorkout.id}`, workoutTimer);
            configService.set('runningWorkoutTimerWorkoutId', activeWorkout.id);
        }
    },

    updateDuration: async (seconds: number) => {
        const { activeWorkout, isTimerRunning } = get();
        set({ workoutTimer: seconds, lastTickAtMs: isTimerRunning ? Date.now() : null });
        if (activeWorkout) {
            await workoutService.update(activeWorkout.id, { duration: seconds });
            configService.setGeneric(`runningWorkoutTimerBaseSeconds_${activeWorkout.id}`, seconds);
            if (isTimerRunning) {
                configService.setGeneric(`runningWorkoutTimerStartTimestamp_${activeWorkout.id}`, Date.now());
            }
        }
    },

    resumeWorkout: async (workout) => {
        // If it was already completed, we NEED to resume it in the DB
        if (workout.status === 'completed') {
            await workoutService.resumeWorkout(workout.id);
            workout.status = 'in_progress';
        }

        const savedDuration = workout.duration ?? 0;
        set({
            activeWorkout: { ...workout, status: 'in_progress' } as any,
            workoutTimer: savedDuration,
            isTimerRunning: workout.is_template !== 1,
            lastTickAtMs: Date.now()
        });

        if (workout.is_template !== 1) {
            await configService.set('runningWorkoutTimerWorkoutId', workout.id);
        }
        await get().loadSetsForWorkout(workout.id);
    },

    tickTimer: () => {
        const { activeWorkout, workoutTimer, lastTickAtMs, isTimerRunning } = get();
        if (!activeWorkout || !isTimerRunning) return;
        if (activeWorkout.status === 'completed' || activeWorkout.is_template === 1) return;

        // Ensure we only tick if this workout is the globally "active" one
        const ownerId = configService.get('runningWorkoutTimerWorkoutId');
        if (!ownerId || ownerId !== activeWorkout.id) return;

        const now = Date.now();
        const last = lastTickAtMs ?? now;
        const deltaMs = now - last;

        // Only tick if at least 1 second has passed
        if (deltaMs < 1000) return;

        let deltaSec = Math.floor(deltaMs / 1000);

        // Cap delta to prevent massive duration jumps if app was suspended/backgrounded
        // 43200s = 12 hours
        if (deltaSec > 43200) deltaSec = 43200;

        const newTime = workoutTimer + deltaSec;

        // Update state with new time and precisely tracked last tick (accounting for floor loss)
        set({
            workoutTimer: newTime,
            lastTickAtMs: last + (deltaSec * 1000)
        });

        // Persist to DB periodically or if it's the first tick.
        // NOTE: The persistence interval trades off fewer DB writes vs. potentially losing
        // up to that many seconds of timer data if the app crashes. It is configurable
        // via `workoutTimerPersistIntervalSeconds` (defaults to 60 seconds).
        const rawPersistInterval = configService.get('workoutTimerPersistIntervalSeconds');
        const persistIntervalSec =
            typeof rawPersistInterval === 'number' && isFinite(rawPersistInterval) && rawPersistInterval > 0
                ? rawPersistInterval
                : 60;
        if (newTime % persistIntervalSec < deltaSec || workoutTimer === 0) {
            workoutService.update(activeWorkout.id, { duration: newTime });
            // Also sync to global config for StatusBar recovery
            configService.setGeneric(`runningWorkoutTimerBaseSeconds_${activeWorkout.id}`, newTime);
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
        const { activeWorkout, workoutTimer } = get();
        if (!activeWorkout) return;

        // Use the accumulated timer as the final duration
        await workoutService.finishWorkout(activeWorkout.id, workoutTimer);

        const ownerId = configService.get('runningWorkoutTimerWorkoutId');
        if (ownerId === activeWorkout.id) {
            await configService.set('runningWorkoutTimerWorkoutId', null);
        }

        set({
            activeWorkout: null, // Clear active workout to signal finish to UI
            isTimerRunning: false,
            workoutTimer: 0,
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
            await get().finishWorkout();
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
            get().updateSet(setId, { completed: s.completed ? 0 : 1 });
        }
    },

    reorderSets: async (workoutId, orderedSetIds) => {
        const { activeWorkout } = get();
        if (!activeWorkout || activeWorkout.status === 'completed') return;

        // Optimistic update
        set(state => {
            const newSets = [...state.activeSets];
            // Sort newSets based on orderedSetIds
            newSets.sort((a, b) => {
                const idxA = orderedSetIds.indexOf(a.id);
                const idxB = orderedSetIds.indexOf(b.id);
                if (idxA === -1 && idxB === -1) return 0;
                if (idxA === -1) return 1;
                if (idxB === -1) return -1;
                return idxA - idxB;
            });
            // Also assign local order_index sequentially for immediate UI reflection
            newSets.forEach((s, idx) => s.order_index = idx);
            return { activeSets: newSets };
        });

        try {
            await workoutService.reorderSets(workoutId, orderedSetIds);
        } catch (e) {
            logger.captureException(e, { scope: 'workoutStore.reorderSets' });
            await get().loadSetsForWorkout(workoutId); // revert
        }
    }
}));
