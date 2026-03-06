import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '../../../../src/lib/auth';
import { syncChangelogToDatabase } from '../../../../src/lib/changelog-db-sync';

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

function isAdminUser(userId: string): boolean {
    return ADMIN_USER_IDS.includes(userId);
}

export async function POST(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!isAdminUser(userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const result = await syncChangelogToDatabase({ force: true, minIntervalMs: 0 });
        return NextResponse.json({
            success: true,
            ...result,
        });
    } catch {
        return NextResponse.json({ error: 'Failed to sync changelog' }, { status: 500 });
    }
}
