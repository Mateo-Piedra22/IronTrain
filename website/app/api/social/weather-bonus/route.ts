import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import { verifyAuth } from '../../../../src/lib/auth';
import { logger } from '../../../../src/lib/logger';
import { getOrCreateScoreConfig, isAdverseWeather } from '../../../../src/lib/social-scoring';

export async function POST(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json().catch(() => null);
        if (!body || typeof body !== 'object') {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const lat = Number((body as any).lat);
        const lon = Number((body as any).lon);
        const city = (body as any).city;

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            return NextResponse.json({ error: 'Coordenadas inválidas' }, { status: 400 });
        }
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            return NextResponse.json({ error: 'Coordenadas fuera de rango' }, { status: 400 });
        }
        if (city !== undefined && city !== null && typeof city !== 'string') {
            return NextResponse.json({ error: 'city inválido' }, { status: 400 });
        }

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
