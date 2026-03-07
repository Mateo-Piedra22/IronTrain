import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import { verifyAuth } from '../../../../src/lib/auth';
import { getOrCreateScoreConfig, isAdverseWeather } from '../../../../src/lib/social-scoring';

export async function POST(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { lat, lon, city } = body;

        if (lat === undefined || lon === undefined) {
            return NextResponse.json({ error: 'Faltan coordenadas' }, { status: 400 });
        }

        // Usamos una transacción simple o simplemente el db ya que getOrCreateScoreConfig lo acepta
        const config = await getOrCreateScoreConfig(db);
        const weather = await isAdverseWeather(lat, lon, config.coldThresholdC);

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
        console.error('[Weather API] Error:', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

function getConditionLabel(reason: string | null): string {
    switch (reason) {
        case 'rain': return 'Lluvia';
        case 'snow': return 'Nieve';
        case 'storm': return 'Tormenta';
        case 'cold': return 'Clima Gélido';
        default: return 'Clima Adverso';
    }
}
