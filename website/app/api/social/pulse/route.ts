import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '../../../../src/lib/auth';
import { RATE_LIMITS } from '../../../../src/lib/rate-limit';
import { computeSocialPulse } from '../../../../src/lib/social-pulse';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const rateLimit = await RATE_LIMITS.SOCIAL_PULSE(userId);
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

        const pulse = await computeSocialPulse(userId);

        return NextResponse.json({
            success: true,
            pulse,
        });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
