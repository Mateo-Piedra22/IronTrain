import { NextRequest, NextResponse } from 'next/server';

import { runSocialIntegrityAudit } from '../../../../src/lib/social-integrity';

export const runtime = 'nodejs';

function parseLimit(value: string | null): number {
    const parsed = Number(value || 200);
    if (!Number.isFinite(parsed)) return 200;
    return Math.max(1, Math.min(1000, parsed));
}

function extractBearerToken(value: string | null): string {
    if (!value) return '';
    const lower = value.toLowerCase();
    if (!lower.startsWith('bearer ')) return '';
    return value.slice(7).trim();
}

export async function GET(req: NextRequest) {
    const configuredSecret = process.env.SOCIAL_INTEGRITY_CRON_SECRET || process.env.CRON_SECRET || '';
    if (!configuredSecret) {
        return NextResponse.json({ error: 'Cron secret is not configured' }, { status: 500 });
    }

    const providedSecret = req.headers.get('x-cron-secret') || '';
    const providedBearerSecret = extractBearerToken(req.headers.get('authorization'));
    const isAuthorized = providedSecret === configuredSecret || providedBearerSecret === configuredSecret;

    if (!isAuthorized) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseLimit(searchParams.get('limit'));

    const report = await runSocialIntegrityAudit({
        reconcile: true,
        limit,
    });

    return NextResponse.json({ success: true, report });
}
