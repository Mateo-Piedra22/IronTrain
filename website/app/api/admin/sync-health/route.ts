import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '../../../../src/lib/auth';
import { getSyncHealthReport } from '../../../../src/lib/sync-health';

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

function isAdminUser(userId: string): boolean {
    return ADMIN_USER_IDS.includes(userId);
}

export async function GET(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!isAdminUser(userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const report = await getSyncHealthReport();
        return NextResponse.json({ success: true, report });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to build sync health report';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
