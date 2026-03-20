import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import { verifyAuth } from '../../../../src/lib/auth';
import { buildBroadcastFeed } from '../../../../src/lib/broadcast/feed';
import { parseBroadcastFeedQuery } from '../../../../src/lib/broadcast/query';

function toIsoSafe(value: unknown): string | null {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
    return null;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    try {
        const query = parseBroadcastFeedQuery(request.url);
        const userId = await verifyAuth(request);

        const { items } = await buildBroadcastFeed({
            db,
            query,
            userId,
        });

        return NextResponse.json({
            generatedAt: new Date().toISOString(),
            items: items.map((i) => ({
                ...i,
                createdAt: toIsoSafe((i as any)?.createdAt),
                lifecycle: {
                    ...i.lifecycle,
                    startsAt: toIsoSafe((i as any)?.lifecycle?.startsAt),
                    endsAt: toIsoSafe((i as any)?.lifecycle?.endsAt),
                },
            })),
        });
    } catch (error) {
        console.error('Error building broadcast feed:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
