import * as crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../src/db';
import * as schema from '../../../src/db/schema';
import { verifyAuth } from '../../../src/lib/auth';

const ALLOWED_TYPES = new Set(['bug', 'feature_request', 'review', 'other']);

function cleanText(value: unknown, max: number): string {
    if (typeof value !== 'string') return '';
    return value.trim().slice(0, max);
}

function hashIp(ip: string): string {
    return crypto.createHash('sha256').update(ip).digest('hex');
}

export async function POST(req: NextRequest) {
    try {
        // Global System Status Check
        const { validateSystemAccess } = await import('../../../src/lib/system-status');
        const { isRestricted, response } = await validateSystemAccess();
        if (isRestricted) return response as NextResponse;

        const body = await req.json();
        const rawType = cleanText(body?.type, 32);
        const message = cleanText(body?.message, 4000);

        if (!rawType || !message) {
            return NextResponse.json({ error: 'Faltan parámetros críticos (type, message).' }, { status: 400 });
        }
        if (!ALLOWED_TYPES.has(rawType)) {
            return NextResponse.json({ error: 'Tipo de feedback inválido.' }, { status: 400 });
        }
        if (message.length < 10) {
            return NextResponse.json({ error: 'El mensaje debe tener al menos 10 caracteres.' }, { status: 400 });
        }

        let userId = null;
        try {
            userId = await verifyAuth(req);
        } catch { }

        const [profile] = userId
            ? await db.select({
                displayName: schema.userProfiles.displayName,
                username: schema.userProfiles.username,
            }).from(schema.userProfiles).where(eq(schema.userProfiles.id, userId)).limit(1)
            : [null];

        const rawMetadata = body?.metadata && typeof body.metadata === 'object' ? body.metadata as Record<string, unknown> : {};
        const xff = req.headers.get('x-forwarded-for') || '';
        const ip = xff.split(',')[0]?.trim() || '0.0.0.0';
        const metadata = {
            appVersion: cleanText(rawMetadata.appVersion, 32) || null,
            appBuild: cleanText(rawMetadata.appBuild, 32) || null,
            platform: cleanText(rawMetadata.platform, 16) || null,
            osVersion: cleanText(rawMetadata.osVersion, 32) || null,
            deviceModel: cleanText(rawMetadata.deviceModel, 64) || null,
            context: cleanText(rawMetadata.context, 64) || null,
            subject: cleanText(rawMetadata.subject, 140) || null,
            contactEmail: cleanText(rawMetadata.contactEmail, 128) || null,
            userAgent: cleanText(req.headers.get('user-agent'), 256) || null,
            ipHash: hashIp(ip),
            sender: {
                id: userId || null,
                username: profile?.username || null,
                displayName: profile?.displayName || null,
            },
        };

        const fbId = crypto.randomUUID();

        await db.insert(schema.feedback).values({
            id: fbId,
            userId: userId || null,
            type: rawType,
            message,
            status: 'open',
            metadata: JSON.stringify(metadata),
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        return NextResponse.json({ success: true, id: fbId });
    } catch (e: any) {
        console.error('Error procesando feedback:', e);
        return NextResponse.json({ error: 'Error del servidor procesando el feedback.' }, { status: 500 });
    }
}
