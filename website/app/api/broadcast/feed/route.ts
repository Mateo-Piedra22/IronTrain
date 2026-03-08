import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../src/db';
import { verifyAuth } from '../../../../src/lib/auth';
import { buildBroadcastFeed } from '../../../../src/lib/broadcast/feed';
import { parseBroadcastFeedQuery } from '../../../../src/lib/broadcast/query';

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
                createdAt: i.createdAt.toISOString(),
                lifecycle: {
                    ...i.lifecycle,
                    startsAt: i.lifecycle.startsAt ? i.lifecycle.startsAt.toISOString() : null,
                    endsAt: i.lifecycle.endsAt ? i.lifecycle.endsAt.toISOString() : null,
                },
            })),
        });
    } catch (error) {
        console.error('Error building broadcast feed:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
