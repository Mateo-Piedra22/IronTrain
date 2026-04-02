import { NextRequest } from 'next/server';
import { handleThemeModerationRequest } from '../_action';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    return handleThemeModerationRequest(req, context, 'restore');
}
