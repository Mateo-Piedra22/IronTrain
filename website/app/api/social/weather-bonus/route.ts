import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../src/db';
import { verifyAuth } from '../../../../src/lib/auth';
import { logger } from '../../../../src/lib/logger';
import { RATE_LIMITS } from '../../../../src/lib/rate-limit';
import { getOrCreateScoreConfig, isAdverseWeather } from '../../../../src/lib/social-scoring';

const weatherBonusPayloadSchema = z.object({
    lat: z.number().finite().min(-90).max(90),
    lon: z.number().finite().min(-180).max(180),
    city: z.string().trim().min(1).max(120).optional().nullable(),
});

export async function POST(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const rateLimit = await RATE_LIMITS.SOCIAL_WEATHER_BONUS(userId);
        if (!rateLimit.ok) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(Math.ceil((rateLimit.resetAtMs - Date.now()) / 1000)),
                    },
                }
            );
        }

        const body = await req.json().catch(() => null);
        const parsed = weatherBonusPayloadSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({
                error: 'Invalid payload',
                details: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), code: issue.code })),
            }, { status: 400 });
        }

        const { lat, lon, city } = parsed.data;

        // Usamos una transacción simple o simplemente el db ya que getOrCreateScoreConfig lo acepta
        const config = await getOrCreateScoreConfig(db);
        const weather = await isAdverseWeather(
            db,
            userId,
            lat,
            lon,
            config.coldThresholdC,
            config.heatThresholdC
        );

        const weatherInfo = {
            location: city || 'Tu ubicación',
            condition: weather.adverse ? getConditionLabel(weather.reason) : 'Cielo Despejado',
            temperature: weather.tempC !== null ? Math.round(weather.tempC) : 20,
            multiplier: 1.0, // El sistema usa +15 pts fijos según la UI, pero mantenemos el campo por compatibilidad
            isActive: weather.adverse,
            checkedAtMs: weather.checkedAtMs ?? Date.now(),
            expiresAtMs: (weather.checkedAtMs ?? Date.now()) + (20 * 60 * 1000),
        };

        return NextResponse.json({ success: true, weatherBonus: weatherInfo });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        logger.error('[Weather API] Error', { error: message });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

function getConditionLabel(reason: string | null): string {
    switch (reason) {
        case 'rain': return 'Lluvia';
        case 'snow': return 'Nieve';
        case 'storm': return 'Tormenta';
        case 'cold': return 'Clima Gélido';
        case 'heat': return 'Calor Extremo';
        default: return 'Clima Adverso';
    }
}
