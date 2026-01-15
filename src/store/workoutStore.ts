import { create } from 'zustand';
import { dbService } from '../services/DatabaseService';
import { workoutService } from '../services/WorkoutService';
import { Exercise, Workout, WorkoutSet } from '../types/db';

// Types for the active workout state
interface ActiveWorkoutState {
    activeWorkout: Workout | null;
    activeSets: WorkoutSet[];
    workoutTimer: number; // seconds
    isTimerRunning: boolean;

    exerciseNames: Record<string, string>;
    loadExercises: () => Promise<void>;

    // Actions
    startWorkout: (name?: string) => Promise<void>;
    resumeWorkout: (workout: Workout) => Promise<void>;
    finishWorkout: () => Promise<void>;
    cancelWorkout: () => Promise<void>;
    tickTimer: () => void;

    addExercise: (exerciseId: string) => Promise<void>;
    addSet: (exerciseId: string) => Promise<void>;
    updateSet: (setId: string, updates: Partial<WorkoutSet>) => Promise<void>;
    removeSet: (setId: string) => Promise<void>;
    toggleSetComplete: (setId: string) => Promise<void>;

    loadSetsForWorkout: (workoutId: string) => Promise<void>;
}

export const useWorkoutStore = create<ActiveWorkoutState>((set, get) => ({
    activeWorkout: null,
    activeSets: [],
    workoutTimer: 0,
    isTimerRunning: false,
    exerciseNames: {},

    loadExercises: async () => {
        try {
            const exercises = await dbService.getAll<Exercise>('SELECT id, name FROM exercises');
            const map: Record<string, string> = {};
            exercises.forEach(e => map[e.id] = e.name);
            set({ exerciseNames: map });
        } catch (e) {
            console.error('Failed to load exercises', e);
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
            isTimerRunning: true
        });
        
        // Load sets if resuming or created
        await get().loadSetsForWorkout(workout.id);
    },

    resumeWorkout: async (workout) => {
        set({ activeWorkout: workout, workoutTimer: workout.duration || 0, isTimerRunning: true });
        await get().loadSetsForWorkout(workout.id);
    },

    tickTimer: () => {
        const { activeWorkout, workoutTimer } = get();
        if (activeWorkout) {
            const newTime = workoutTimer + 1;
            set({ workoutTimer: newTime });

            // Save every 10 seconds to avoid data loss on crash
            if (newTime % 10 === 0) {
                workoutService.update(activeWorkout.id, { duration: newTime });
            }
        }
    },

    loadSetsForWorkout: async (workoutId) => {
        const sets = await workoutService.getSets(workoutId);
        set({ activeSets: sets });
    },

    finishWorkout: async () => {
        const { activeWorkout } = get();
        if (!activeWorkout) return;

        await workoutService.finishWorkout(activeWorkout.id);
        set({ activeWorkout: null, activeSets: [], isTimerRunning: false });
    },

    cancelWorkout: async () => {
        const { activeWorkout } = get();
        if (activeWorkout) {
            await workoutService.delete(activeWorkout.id);
        }
        set({ activeWorkout: null, activeSets: [], isTimerRunning: false });
    },

    addExercise: async (exerciseId) => {
        await get().addSet(exerciseId);
    },

    addSet: async (exerciseId) => {
        const { activeWorkout } = get();
        if (!activeWorkout) return;

        // Logic now delegated to Service
        await workoutService.addSet(activeWorkout.id, exerciseId);
        
        // Refresh local state
        await get().loadSetsForWorkout(activeWorkout.id);
    },

    updateSet: async (setId, updates) => {
        // Optimistic update
        set(state => ({
            activeSets: state.activeSets.map(s => s.id === setId ? { ...s, ...updates } : s)
        }));

        try {
            await workoutService.updateSet(setId, updates);
        } catch (e) {
            console.error('Failed to update set:', e);
            // Revert on failure (could implement fetching fresh state)
            const { activeWorkout } = get();
            if (activeWorkout) await get().loadSetsForWorkout(activeWorkout.id);
        }
    },

    removeSet: async (setId) => {
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
