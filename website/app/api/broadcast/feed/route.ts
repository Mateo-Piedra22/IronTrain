import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import { verifyAuth } from '../../../../src/lib/auth';
import { buildBroadcastFeed } from '../../../../src/lib/broadcast/feed';
import { parseBroadcastFeedQuery } from '../../../../src/lib/broadcast/query';
import { RATE_LIMITS } from '../../../../src/lib/rate-limit';

const getClientIp = (request: NextRequest): string => {
    const forwardedFor = request.headers.get('x-forwarded-for') ?? 'unknown';
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
};

function toIsoSafe(value: unknown): string | null {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
    return null;
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== 'object') return null;
    return value as Record<string, unknown>;
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    try {
        const query = parseBroadcastFeedQuery(request.url);
        const clientIp = getClientIp(request);
        const userId = await verifyAuth(request);

        const rateKey = userId ? userId : `anon:${clientIp}`;
        const rateLimit = await RATE_LIMITS.BROADCAST_FEED(rateKey);
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

        const { items } = await buildBroadcastFeed({
            db,
            query,
            userId,
        });

        return NextResponse.json({
            generatedAt: new Date().toISOString(),
            items: items.map((i) => ({
                ...i,
                createdAt: toIsoSafe(asRecord(i)?.createdAt),
                lifecycle: {
                    ...i.lifecycle,
                    startsAt: toIsoSafe(asRecord(asRecord(i)?.lifecycle)?.startsAt),
                    endsAt: toIsoSafe(asRecord(asRecord(i)?.lifecycle)?.endsAt),
                },
            })),
        });
    } catch (error) {
        console.error('Error building broadcast feed:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
