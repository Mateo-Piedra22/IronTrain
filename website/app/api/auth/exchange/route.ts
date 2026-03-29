import { and, eq, gt } from 'drizzle-orm';
import * as jose from 'jose';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../src/db';
import { authCodes } from '../../../../src/db/schema';
import { RATE_LIMITS } from '../../../../src/lib/rate-limit';

export const runtime = 'nodejs'; // Using nodejs for crypto/jose support if needed, though edge works too

const exchangePayloadSchema = z.object({
    code: z.string().trim().min(1).max(512),
});

export async function POST(req: NextRequest) {
    try {
        const forwardedFor = req.headers.get('x-forwarded-for') ?? 'unknown';
        const clientIp = forwardedFor.split(',')[0]?.trim() || 'unknown';
        const rateLimit = await RATE_LIMITS.AUTH_EXCHANGE(`anon:${clientIp}`);
        if (!rateLimit.ok) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(Math.ceil((rateLimit.resetAtMs - Date.now()) / 1000)),
                    },
                }
            );
        }

        const body = await req.json().catch(() => null);
        const parsed = exchangePayloadSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
        }
        const code = parsed.data.code;

        // 1. Find the code and ensure it's not expired
        const now = new Date();
        const results = await db.select()
            .from(authCodes)
            .where(
                and(
                    eq(authCodes.code, code),
                    gt(authCodes.expiresAt, now)
                )
            );

        const record = results[0];

        if (!record) {
            return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 });
        }

        // 2. Clear the code immediately (single use)
        await db.delete(authCodes).where(eq(authCodes.code, code));

        // 3. Generate the long-lived JWT for the mobile app
        const secretStr = process.env.NEON_AUTH_COOKIE_SECRET;
        if (!secretStr) {
            console.error('[AuthExchange] NEON_AUTH_COOKIE_SECRET not configured');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const secret = new TextEncoder().encode(secretStr);

        const jwt = await new jose.SignJWT({
            id: record.userId,
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setSubject(record.userId)
            .setAudience('irontrain-mobile')
            .setExpirationTime('30d')
            .sign(secret);

        return NextResponse.json({ token: jwt });
    } catch (error) {
        console.error('[AuthExchange] Error during exchange:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
