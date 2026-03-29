import { getUnixTime, startOfDay } from 'date-fns';
import { useAuthStore } from '../store/authStore';
import { Workout, WorkoutSet } from '../types/db';
import * as analytics from '../utils/analytics';
import { logger } from '../utils/logger';
import { dataEventService } from './DataEventService';
import { dbService } from './DatabaseService';
import { workoutService } from './WorkoutService';

class TemplateService {
    public async createWorkoutFromTemplate(templateId: string, date: Date = new Date()): Promise<string> {
        const template = await dbService.getWorkoutById(templateId);
        if (!template) throw new Error('Template not found');

        const nowMs = Date.now();
        const startOfToday = getUnixTime(startOfDay(date)) * 1000;

        const newWorkout: Partial<Workout> = {
            id: workoutService.generateIdInternal(),
            name: template.name,
            notes: template.notes,
            date: startOfToday,
            start_time: nowMs,
            status: 'in_progress',
            duration: 0,
            is_template: 0,
        };

        const templateSets = await dbService.getSetsForWorkout(templateId);

        try {
            await dbService.withTransaction(async () => {
                await dbService.insert('workouts', newWorkout);
                
                const workoutId = newWorkout.id!;
                const validSets = templateSets.filter((s: WorkoutSet) => s.exercise_id);
                
                let orderIndex = 0;
                for (const ts of validSets) {
                    const ex = await dbService.getExerciseById(ts.exercise_id);
                    const initialWeight = ts.weight || 0;
                    const initialReps = ts.reps || 0;

                    const payload: Partial<WorkoutSet> = {
                        workout_id: workoutId,
                        exercise_id: ts.exercise_id,
                        type: ts.type || 'normal',
                        order_index: orderIndex++,
                        weight: initialWeight,
                        reps: initialReps,
                        distance: ts.distance ?? undefined,
                        time: ts.time ?? undefined,
                        notes: ts.notes ?? undefined,
                        rpe: ts.rpe ?? undefined,
                        completed: 0
                    };

                    await workoutService.addSet(workoutId, ts.exercise_id, ts.type as any, payload);
                }
            });

            analytics.capture('template_applied', {
                template_id: templateId,
                workout_id: newWorkout.id,
                set_count: templateSets.length
            });

            dataEventService.emit('DATA_UPDATED');
            return newWorkout.id!;
        } catch (e) {
            logger.error('Failed to create workout from template', { error: e, templateId });
            throw e;
        }
    }

    public async saveWorkoutAsTemplate(workoutId: string, templateName: string): Promise<string> {
        const workout = await dbService.getWorkoutById(workoutId);
        if (!workout) throw new Error('Workout not found');

        const sets = await dbService.getSetsForWorkout(workoutId);
        const userId = useAuthStore.getState().user?.id;
        const nowMs = Date.now();

        const templateId = workoutService.generateIdInternal();

        try {
            await dbService.withTransaction(async () => {
                await dbService.insert('templates', {
                    id: templateId,
                    user_id: userId,
                    name: templateName,
                    notes: workout.notes,
                    created_at: nowMs,
                    updated_at: nowMs
                });

                for (const set of sets) {
                    await dbService.insert('template_sets', {
                        id: workoutService.generateIdInternal(),
                        template_id: templateId,
                        exercise_id: set.exercise_id,
                        type: set.type,
                        order_index: set.order_index,
                        weight: set.weight,
                        reps: set.reps,
                        distance: set.distance,
                        time: set.time,
                        rpe: set.rpe,
                        notes: set.notes
                    });
                }
            });

            analytics.capture('template_created', {
                template_id: templateId,
                source_workout_id: workoutId,
                set_count: sets.length
            });

            dataEventService.emit('DATA_UPDATED');
            return templateId;
        } catch (e) {
            logger.error('Failed to save workout as template', { error: e, workoutId });
            throw e;
        }
    }
}

export const templateService = new TemplateService();
