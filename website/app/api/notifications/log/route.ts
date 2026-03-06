import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';

import { verifyAuth } from '../../../../src/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const userId = await verifyAuth(request);
        const body = await request.json();
        const { id, action, metadata } = body;

        if (!id || !action) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        await db.insert(schema.notificationLogs).values({
            id: crypto.randomUUID(),
            notificationId: id,
            userId: userId || 'anonymous',
            action,
            metadata: metadata ? JSON.stringify(metadata) : null,
            createdAt: new Date()
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error logging notification action:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
