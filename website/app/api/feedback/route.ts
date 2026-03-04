import * as crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../src/db';
import * as schema from '../../../src/db/schema';
import { verifyAuth } from '../../../src/lib/auth';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { type, message, metadata } = body;

        if (!type || !message) {
            return NextResponse.json({ error: 'Faltan parámetros críticos (type, message).' }, { status: 400 });
        }

        let userId = null;
        try {
            userId = await verifyAuth(req);
        } catch { }

        const fbId = crypto.randomUUID();

        await db.insert(schema.feedback).values({
            id: fbId,
            userId: userId || null,
            type: String(type),
            message: String(message),
            status: 'open',
            metadata: metadata ? JSON.stringify(metadata) : null,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        return NextResponse.json({ success: true, id: fbId });
    } catch (e: any) {
        console.error('Error procesando feedback:', e);
        return NextResponse.json({ error: 'Error del servidor procesando el feedback.' }, { status: 500 });
    }
}
