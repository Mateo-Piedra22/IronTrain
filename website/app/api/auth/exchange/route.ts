import { and, eq, gt } from 'drizzle-orm';
import * as jose from 'jose';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import { authCodes } from '../../../../src/db/schema';

export const runtime = 'nodejs'; // Using nodejs for crypto/jose support if needed, though edge works too

export async function POST(req: NextRequest) {
    try {
        const { code } = await req.json();

        if (!code) {
            return NextResponse.json({ error: 'Code is required' }, { status: 400 });
        }

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
