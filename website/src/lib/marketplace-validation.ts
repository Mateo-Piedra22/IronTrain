import { z } from 'zod';

const EXERCISE_ID_PATTERN = /^[A-Za-z0-9:_-]+$/;

export const marketplaceCheckoutSchema = z.object({
    exerciseIds: z
        .array(
            z.string()
                .trim()
                .min(1, 'Exercise ID cannot be empty')
                .max(128, 'Exercise ID too long')
                .regex(EXERCISE_ID_PATTERN, 'Exercise ID contains invalid characters')
        )
        .min(1, 'At least one exercise is required')
        .max(50, 'Too many exercises per checkout (max 50)'),
}).strict();

export type MarketplaceCheckoutInput = z.infer<typeof marketplaceCheckoutSchema>;

export function parseMarketplaceCheckoutPayload(payload: unknown):
    | { success: true; data: MarketplaceCheckoutInput }
    | { success: false; message: string } {
    const parsed = marketplaceCheckoutSchema.safeParse(payload);
    if (!parsed.success) {
        const firstIssue = parsed.error.issues[0];
        return { success: false, message: firstIssue?.message ?? 'Invalid checkout payload' };
    }
    return { success: true, data: parsed.data };
}
