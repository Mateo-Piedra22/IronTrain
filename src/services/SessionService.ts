import { differenceInMinutes } from 'date-fns';
import * as analytics from '../utils/analytics';
import { logger } from '../utils/logger';
import { dataEventService } from './DataEventService';
import { dbService } from './DatabaseService';
import { systemNotificationService } from './SystemNotificationService';
import { workoutService } from './WorkoutService';

class SessionService {
    public async startWorkout(workoutId: string): Promise<void> {
        const workout = await dbService.getWorkoutById(workoutId);
        if (!workout) throw new Error('Workout not found');

        const now = Date.now();
        const startTime = workout.start_time || now;

        await dbService.update('workouts', workoutId, {
            status: 'in_progress',
            start_time: startTime,
            end_time: null
        });

        await systemNotificationService.showPersistentWorkout({
            elapsedSeconds: 0,
            completedSets: 0,
            totalExercises: 0,
            isPaused: false,
            workoutName: workout.name,
        });
        
        analytics.capture('workout_started', {
            workout_id: workoutId,
            is_template: workout.is_template
        });

        dataEventService.emit('DATA_UPDATED');
    }

    public async finishWorkout(workoutId: string): Promise<void> {
        const workout = await dbService.getWorkoutById(workoutId);
        if (!workout) return;

        const now = Date.now();
        const startTime = workout.start_time || now;
        const duration = Math.max(1, differenceInMinutes(now, startTime));

        try {
            await dbService.withTransaction(async () => {
                await dbService.update('workouts', workoutId, {
                    status: 'completed',
                    end_time: now,
                    duration
                });

                await workoutService.createSocialFeedEventsForFinishedWorkout(workoutId, now);
            });

            systemNotificationService.dismissPersistentWorkout();

            analytics.capture('workout_finished', {
                workout_id: workoutId,
                duration
            });

            dataEventService.emit('DATA_UPDATED');
        } catch (e) {
            logger.error('Failed to finish workout', { error: e, workoutId });
            throw e;
        }
    }

    public async pauseWorkout(workoutId: string): Promise<void> {
        // Pausing in IronTrain V9 means keeping the status but clearing the active session state locally if needed.
        // Usually handled by the UI/Store, but we can track metadata if required.
        analytics.capture('workout_paused', { workout_id: workoutId });
    }

    public async resumeWorkout(workoutId: string): Promise<void> {
        const workout = await dbService.getWorkoutById(workoutId);
        if (!workout) return;

        if (workout.status === 'completed') {
            await dbService.update('workouts', workoutId, {
                status: 'in_progress',
                end_time: null
            });
            await workoutService.cleanupActivityFeedForWorkout(workoutId);
        }

        await systemNotificationService.showPersistentWorkout({
            elapsedSeconds: workout.duration ?? 0,
            completedSets: 0,
            totalExercises: 0,
            isPaused: false,
            workoutName: workout.name,
        });
        
        analytics.capture('workout_resumed', { workout_id: workoutId });
        dataEventService.emit('DATA_UPDATED');
    }
}

export const sessionService = new SessionService();
