import { create } from 'zustand';
import { dbService } from '../services/DatabaseService';
import { GhostValueService } from '../services/GhostValues';
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
    addSet: (exerciseId: string) => void;
    updateSet: (setId: string, updates: Partial<WorkoutSet>) => void;
    removeSet: (setId: string) => void;
    toggleSetComplete: (setId: string) => void;

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
        const now = Date.now();
        // Create in DB first to get ID
        const id = await dbService.createWorkout(now);

        // If name provided, update it (createWorkout defaults to 'Workout')
        if (name) {
            await dbService.run('UPDATE workouts SET name = ? WHERE id = ?', [name, id]);
        }

        // Fetch full object
        const newWorkout = await dbService.getWorkoutById(id);

        if (newWorkout) {
            set({
                activeWorkout: newWorkout,
                activeSets: [],
                workoutTimer: 0,
                isTimerRunning: true
            });
        }
    },

    resumeWorkout: async (workout) => {
        // Calculate elapsed time since start.
        // If we want "Resumable" workouts that were "paused" for days, this simple diff is wrong.
        // But for "App Crash" recovery, difference from Start Date is dangerous if user sleeps.
        // Better: Just load the 'duration' saved in DB.
        // And we need to ensure we SAVE the duration periodically.

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
                dbService.run('UPDATE workouts SET duration = ? WHERE id = ?', [newTime, activeWorkout.id]);
            }
        }
    },

    loadSetsForWorkout: async (workoutId) => {
        const sets = await dbService.getAll<WorkoutSet>(
            'SELECT * FROM workout_sets WHERE workout_id = ? ORDER BY order_index ASC',
            [workoutId]
        );
        set({ activeSets: sets });
    },

    finishWorkout: async () => {
        const { activeWorkout, workoutTimer } = get();
        if (!activeWorkout) return;

        await dbService.run(
            'UPDATE workouts SET status = ?, duration = ? WHERE id = ?',
            ['completed', workoutTimer, activeWorkout.id]
        );

        set({ activeWorkout: null, activeSets: [], isTimerRunning: false });
    },

    cancelWorkout: async () => {
        const { activeWorkout } = get();
        if (activeWorkout) {
            await dbService.run('DELETE FROM workouts WHERE id = ?', [activeWorkout.id]);
        }
        set({ activeWorkout: null, activeSets: [], isTimerRunning: false });
    },

    addExercise: async (exerciseId) => {
        get().addSet(exerciseId);
    },

    addSet: async (exerciseId) => {
        const { activeWorkout, activeSets } = get();
        if (!activeWorkout) return;

        const currentSets = activeSets.filter(s => s.exercise_id === exerciseId);
        let weight = 0;
        let reps = 0;

        if (currentSets.length > 0) {
            // Copy from last set in this workout
            const lastSet = currentSets[currentSets.length - 1];
            weight = lastSet.weight || 0;
            reps = lastSet.reps || 0;
        } else {
            // Fetch Ghost Value
            const ghost = await GhostValueService.getLastSet(exerciseId);
            if (ghost) {
                weight = ghost.weight;
                reps = ghost.reps;
            }
        }

        const newSet: WorkoutSet = {
            id: crypto.randomUUID(),
            workout_id: activeWorkout.id,
            exercise_id: exerciseId,
            type: 'normal',
            weight,
            reps,
            order_index: activeSets.length + 1,
            completed: 0
        };

        await dbService.addSet(newSet);
        set({ activeSets: [...activeSets, newSet] });
    },

    updateSet: (setId, updates) => {
        set(state => ({
            activeSets: state.activeSets.map(s => s.id === setId ? { ...s, ...updates } : s)
        }));

        const s = get().activeSets.find(s => s.id === setId);
        if (s) {
            dbService.run(
                'UPDATE workout_sets SET weight=?, reps=?, rpe=?, completed=?, type=? WHERE id=?',
                [s.weight, s.reps, s.rpe ?? null, s.completed, s.type, setId]
            );
        }
    },

    removeSet: async (setId) => {
        await dbService.run('DELETE FROM workout_sets WHERE id = ?', [setId]);
        set(state => ({
            activeSets: state.activeSets.filter(s => s.id !== setId)
        }));
    },

    toggleSetComplete: (setId) => {
        const s = get().activeSets.find(s => s.id === setId);
        if (s) {
            get().updateSet(setId, { completed: s.completed ? 0 : 1 });
        }
    }
}));
