import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../../src/db';
import * as schema from '../../../../../src/db/schema';
import { verifyAuth } from '../../../../../src/lib/auth';
import { RATE_LIMITS } from '../../../../../src/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const trainingDaysSchema = z.object({
    trainingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
});

export async function PUT(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Rate limiting
        const rateLimit = await RATE_LIMITS.SOCIAL_PROFILE_UPDATE(userId);
        if (!rateLimit.ok) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                { 
                    status: 429,
                    headers: { 
                        'Retry-After': String(Math.ceil((rateLimit.resetAtMs - Date.now()) / 1000)),
                        'X-RateLimit-Remaining': String(rateLimit.remaining),
                        'X-RateLimit-Reset': String(rateLimit.resetAtMs),
                    }
                }
            );
        }

        const body = await req.json().catch(() => null);
        const parsed = trainingDaysSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({
                error: 'Invalid payload',
                code: 'INVALID_TRAINING_DAYS',
                details: parsed.error.flatten(),
            }, { status: 400 });
        }

        const { trainingDays } = parsed.data;

        // Deduplicate and sort FIRST
        const uniqueDays = [...new Set(trainingDays)].sort();

        const settingKey = `${userId}:training_days`;
        const value = JSON.stringify(uniqueDays);

        // Upsert the training_days setting
        await db
            .insert(schema.settings)
            .values({
                key: settingKey,
                value,
                userId,
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: schema.settings.key,
                set: {
                    value,
                    updatedAt: new Date(),
                },
            });

        return NextResponse.json({ success: true, trainingDays: uniqueDays });
    } catch (e: unknown) {
        const error = e as Error;
        const message = error.message || 'Internal server error';
        return NextResponse.json({
            error: message,
            code: 'TRAINING_DAYS_UPDATE_FAILED',
            details: error.toString()
        }, { status: 500 });
    }
}
