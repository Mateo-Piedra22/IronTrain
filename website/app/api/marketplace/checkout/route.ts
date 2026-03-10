import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '../../../../src/lib/auth';
import { logger } from '../../../../src/lib/logger';
import { MarketplaceResolver } from '../../../../src/lib/marketplace';

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

        // Global System Status Check
        const { validateSystemAccess } = await import('../../../../src/lib/system-status');
        const { isRestricted, response } = await validateSystemAccess();
        if (isRestricted) return response as NextResponse;

        let body;
        try {
            body = await req.json();
        } catch (e) {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const { exerciseIds } = body;

        if (!Array.isArray(exerciseIds) || exerciseIds.length === 0) {
            return NextResponse.json({ error: 'Invalid payload: exerciseIds must be a non-empty array' }, { status: 400 });
        }

        if (exerciseIds.length > 50) {
            return NextResponse.json({ error: 'Too many exercises per checkout (max 50)' }, { status: 413 });
        }

        logger.info(`Marketplace Checkout: User ${userId} adopting ${exerciseIds.length} exercises`);

        const results = await MarketplaceResolver.checkoutExercises(userId, exerciseIds);

        return NextResponse.json({
            success: true,
            ...results
        });

    } catch (error: any) {
        logger.error(`Marketplace Checkout Fatal for User:`, error);
        return NextResponse.json({
            error: 'Internal server error',
            message: error.message
        }, { status: 500 });
    }
}
