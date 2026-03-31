import { z } from 'zod';

export const sharedRoutinePayloadSchema = z.object({
    routine: z.record(z.string(), z.unknown()).optional(),
    routine_days: z.array(z.record(z.string(), z.unknown())).max(60).default([]),
    routine_exercises: z.array(z.record(z.string(), z.unknown())).min(1).max(1200),
    exercises: z.array(z.record(z.string(), z.unknown())).max(1200).default([]),
    categories: z.array(z.record(z.string(), z.unknown())).max(300).default([]),
    badges: z.array(z.record(z.string(), z.unknown())).max(600).default([]),
    exercise_badges: z.array(z.record(z.string(), z.unknown())).max(3000).default([]),
});

export type SharedRoutinePayload = z.infer<typeof sharedRoutinePayloadSchema>;
