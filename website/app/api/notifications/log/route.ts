import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';

import { verifyAuth } from '../../../../src/lib/auth';
import { parseNotificationLogPayload } from '../../../../src/lib/notifications-log';
import { checkRateLimit } from '../../../../src/lib/rate-limit';

export async function POST(request: NextRequest) {
    try {
        const userId = await verifyAuth(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const parsed = parseNotificationLogPayload(body);
        if (!parsed.ok) {
            return NextResponse.json({ error: parsed.error }, { status: 400 });
        }

        const rateKey = `notif_log:${userId}:${parsed.value.id}:${parsed.value.action}`;
        const limit = checkRateLimit({ key: rateKey, limit: 8, windowMs: 60_000 });
        if (!limit.ok) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }

        await db.insert(schema.notificationLogs).values({
            id: crypto.randomUUID(),
            notificationId: parsed.value.id,
            userId,
            action: parsed.value.action,
            metadata: parsed.value.metadata ? JSON.stringify(parsed.value.metadata) : null,
            createdAt: new Date()
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error logging notification action:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
