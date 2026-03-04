import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, platform, version, metadata } = body;

        if (!id || !platform) {
            return NextResponse.json({ error: 'Faltan parámetros críticos (id, platform).' }, { status: 400 });
        }

        await db.insert(schema.appInstalls).values({
            id: String(id),
            platform: String(platform),
            version: version ? String(version) : null,
            metadata: metadata ? JSON.stringify(metadata) : null,
            createdAt: new Date(),
        }).onConflictDoNothing(); // Prevent duplicates per device ID

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('Error tracking install:', e);
        return NextResponse.json({ error: 'Error del servidor.' }, { status: 500 });
    }
}
