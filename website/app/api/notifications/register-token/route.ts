import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';

import { verifyAuth } from '../../../../src/lib/auth';
import { parseNotificationRegistrationPayload } from '../../../../src/lib/notifications-registration-validation';
import { RATE_LIMITS } from '../../../../src/lib/rate-limit';

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

        const rateLimit = await RATE_LIMITS.NOTIFICATIONS_REGISTER_TOKEN(authedUserId);
        if (!rateLimit.ok) {
            const retryAfterSeconds = Math.max(1, Math.ceil((rateLimit.resetAtMs - Date.now()) / 1000));
            return NextResponse.json(
                { error: 'Too many requests' },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(retryAfterSeconds),
                    },
                }
            );
        }

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        let payload: ReturnType<typeof parseNotificationRegistrationPayload>;
        try {
            payload = parseNotificationRegistrationPayload(body);
        } catch {
            return NextResponse.json({ error: 'Invalid registration payload' }, { status: 400 });
        }

        const { pushToken, platform, tokenType } = payload;
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

export async function DELETE(request: NextRequest) {
    try {
        const authedUserId = await verifyAuth(request);
        if (!authedUserId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rateLimit = await RATE_LIMITS.NOTIFICATIONS_UNREGISTER_TOKEN(authedUserId);
        if (!rateLimit.ok) {
            const retryAfterSeconds = Math.max(1, Math.ceil((rateLimit.resetAtMs - Date.now()) / 1000));
            return NextResponse.json(
                { error: 'Too many requests' },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(retryAfterSeconds),
                    },
                }
            );
        }

        await db
            .update(schema.userProfiles)
            .set({
                pushToken: null,
                updatedAt: new Date(),
            })
            .where(eq(schema.userProfiles.id, authedUserId));

        return NextResponse.json({ success: true, unregistered: true });
    } catch (error) {
        console.error('Error unregistering push token:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
