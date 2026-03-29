import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '../../../../src/lib/auth';
import { logger } from '../../../../src/lib/logger';
import { MarketplaceResolver } from '../../../../src/lib/marketplace';
import { parseMarketplaceCheckoutPayload } from '../../../../src/lib/marketplace-validation';
import { RATE_LIMITS } from '../../../../src/lib/rate-limit';

export const runtime = 'nodejs';

/**
 * API Endpoint: Marketplace Checkout
 * Transactionally adopts official exercises into the user's library.
 */
export async function POST(req: NextRequest) {
    try {
        const userId = await verifyAuth(req);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rateLimit = await RATE_LIMITS.MARKETPLACE_CHECKOUT(userId);
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

        let body: unknown;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const parsed = parseMarketplaceCheckoutPayload(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.message }, { status: 400 });
        }

        const exerciseIds = [...new Set(parsed.data.exerciseIds)];

        logger.info(`Marketplace Checkout: User ...${userId.slice(-8)} adopting ${exerciseIds.length} exercises`);

        const results = await MarketplaceResolver.checkoutExercises(userId, exerciseIds);

        return NextResponse.json({
            success: true,
            ...results
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Marketplace Checkout Fatal for User`, { message });
        return NextResponse.json({
            error: 'Internal server error',
            message
        }, { status: 500 });
    }
}
