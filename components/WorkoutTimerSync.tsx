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

    useEffect(() => {
        if (!isTimerRunning || !activeWorkout) {
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

                const completedSets = activeSets.filter(s => s.completed === 1).length;
                const uniqueExercises = new Set(activeSets.map(s => s.exercise_id)).size;

                systemNotificationService.showPersistentWorkout({
                    elapsedSeconds: workoutTimer,
                    completedSets,
                    totalExercises: uniqueExercises,
                    isPaused: false,
                    workoutName: activeWorkout.name || 'Entrenamiento'
                });
            }
        }, 1000);

        return () => {
            clearInterval(interval);
        };
    }, [isTimerRunning, !!activeWorkout, activeWorkout?.id, tickTimer, activeSets.length, workoutTimer]);

    return null;
}
