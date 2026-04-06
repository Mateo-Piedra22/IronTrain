import { systemNotificationService } from '@/src/services/SystemNotificationService';
import { useWorkoutStore } from '@/src/store/workoutStore';
import { useEffect, useRef } from 'react';

/**
 * Headless component that keeps the workout timer ticking globally.
 * Mounted in the root _layout.tsx.
 */
export function WorkoutTimerSync() {
    const tickTimer = useWorkoutStore(state => state.tickTimer);
    const isTimerRunning = useWorkoutStore(state => state.isTimerRunning);
    const activeWorkout = useWorkoutStore(state => state.activeWorkout);
    const activeSets = useWorkoutStore(state => state.activeSets);
    const workoutTimer = useWorkoutStore(state => state.workoutTimer);

    const notifCounterRef = useRef<number>(0);
    const activeWorkoutRef = useRef(activeWorkout);
    const activeSetsRef = useRef(activeSets);
    const workoutTimerRef = useRef(workoutTimer);

    useEffect(() => {
        activeWorkoutRef.current = activeWorkout;
    }, [activeWorkout]);

    useEffect(() => {
        activeSetsRef.current = activeSets;
    }, [activeSets]);

    useEffect(() => {
        workoutTimerRef.current = workoutTimer;
    }, [workoutTimer]);

    useEffect(() => {
        if (!isTimerRunning || !activeWorkoutRef.current) {
            // If timer stopped, we dismiss the notification to ensure UI consistency
            systemNotificationService.dismissPersistentWorkout();
            return;
        }

        tickTimer();

        const interval = setInterval(() => {
            tickTimer();

            // Handle system notification updates every ~10 ticks
            notifCounterRef.current += 1;
            if (notifCounterRef.current >= 10) {
                notifCounterRef.current = 0;

                const sets = activeSetsRef.current;
                const workout = activeWorkoutRef.current;
                const elapsedSeconds = workoutTimerRef.current;
                if (!workout) return;

                const completedSets = sets.filter(s => !!s.completed).length;
                const uniqueExercises = new Set(sets.map(s => s.exercise_id)).size;

                systemNotificationService.showPersistentWorkout({
                    elapsedSeconds,
                    completedSets,
                    totalExercises: uniqueExercises,
                    isPaused: false,
                    workoutName: workout.name || 'Entrenamiento'
                });
            }
        }, 1000);

        return () => {
            clearInterval(interval);
        };
    }, [isTimerRunning, activeWorkout?.id, tickTimer]);

    return null;
}
