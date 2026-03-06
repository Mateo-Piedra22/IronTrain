import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';

import { verifyAuth } from '../../../../src/lib/auth';

function normalizeToken(raw: unknown): string {
    return typeof raw === 'string' ? raw.trim() : '';
}

function isReasonablePushToken(token: string): boolean {
    return token.length >= 16 && token.length <= 4096;
}

export async function POST(request: NextRequest) {
    try {
        const authedUserId = await verifyAuth(request);
        if (!authedUserId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { userId, pushToken, platform, tokenType } = await request.json();

        // Zero Trust: Ensure the authenticated user is the one they claim to be
        if (userId && userId !== authedUserId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const targetId = userId || authedUserId;

        const normalizedToken = normalizeToken(pushToken);
        if (!normalizedToken) {
            return NextResponse.json({ error: 'Missing pushToken' }, { status: 400 });
        }
        if (!isReasonablePushToken(normalizedToken)) {
            return NextResponse.json({ error: 'Invalid pushToken format' }, { status: 400 });
        }

        await db.insert(schema.userProfiles).values({
            id: targetId,
            pushToken: normalizedToken,
            updatedAt: new Date(),
            displayName: null,
        }).onConflictDoUpdate({
            target: schema.userProfiles.id,
            set: {
                pushToken: normalizedToken,
                updatedAt: new Date(),
            }
        });

        return NextResponse.json({ success: true, registered: { platform: String(platform || ''), tokenType: String(tokenType || '') } });
    } catch (error) {
        console.error('Error registering push token:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
