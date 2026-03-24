import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { syncChangelogToDatabase } from '../../../../src/lib/changelog-db-sync';
import { logger } from '../../../../src/lib/logger';

const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';

function verifySignature(payload: string, signature: string): boolean {
    if (!GITHUB_WEBHOOK_SECRET) {
        // Zero Trust: no secret = no access. Reject all unsigned requests.
        console.error('[GITHUB_WEBHOOK] GITHUB_WEBHOOK_SECRET is not configured. Rejecting request.');
        return false;
    }

    const hmac = crypto.createHmac('sha256', GITHUB_WEBHOOK_SECRET);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    try {
        return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
    } catch {
        return false;
    }
}

export async function POST(req: NextRequest) {
    const signature = req.headers.get('x-hub-signature-256') || '';
    const event = req.headers.get('x-github-event') || '';
    const bodyText = await req.text();

    if (GITHUB_WEBHOOK_SECRET && !verifySignature(bodyText, signature)) {
        return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
    }

    try {
        // We trigger sync on 'release' or 'push' to main (if changelog file changes)
        // For now, any verified webhook triggers a sync to keep it simple and robust
        // But we can filter by event type if we want to be more specific.

        const payload = JSON.parse(bodyText);

        logger.info(`[GITHUB_WEBHOOK] Event: ${event} received. Triggering sync...`, {
            action: payload.action,
            repository: payload.repository?.full_name
        });

        const result = await syncChangelogToDatabase({ force: true, minIntervalMs: 0 });

        return NextResponse.json({
            success: true,
            event,
            upserted: result.upsertedCount,
            syncedAt: result.syncedAt
        });
    } catch (error) {
        logger.captureException(error, { scope: 'github-webhook' });
        return NextResponse.json({ error: 'internal_error' }, { status: 500 });
    }
}
