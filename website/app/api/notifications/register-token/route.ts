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

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const { pushToken, platform, tokenType } = (body || {}) as { pushToken?: unknown; platform?: unknown; tokenType?: unknown };
        const targetId = authedUserId;

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
