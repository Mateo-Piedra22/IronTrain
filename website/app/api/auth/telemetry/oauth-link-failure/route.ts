import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAuth } from '../../../../../src/lib/auth';
import { captureServerEvent } from '../../../../../src/lib/posthog-server';

const oauthLinkFailureSchema = z.object({
    provider: z.literal('google'),
    error: z.string().trim().min(1).max(128),
    flow: z.enum(['link', 'sign-in', 'sign-up']).optional(),
    source: z.enum(['callback_query', 'client_response']).optional(),
    redirectUri: z.string().trim().max(2048).nullable().optional(),
    callbackURL: z.string().trim().max(2048),
    errorCallbackURL: z.string().trim().max(2048),
    pagePath: z.string().trim().max(512),
    pageSearch: z.string().trim().max(1024),
    userAgent: z.string().trim().max(1024),
});

function extractHost(value: string): string | null {
    try {
        return new URL(value).host;
    } catch {
        return null;
    }
}

export async function POST(req: NextRequest) {
    const userId = await verifyAuth(req);
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload: unknown;
    try {
        payload = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const parsed = oauthLinkFailureSchema.safeParse(payload);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const data = parsed.data;

    void captureServerEvent(userId, 'auth_oauth_link_callback_failed', {
        provider: data.provider,
        oauth_error: data.error,
        oauth_flow: data.flow ?? 'link',
        oauth_error_source: data.source ?? 'callback_query',
        redirect_uri_present: Boolean(data.redirectUri),
        callback_host: extractHost(data.callbackURL),
        error_callback_host: extractHost(data.errorCallbackURL),
        page_path: data.pagePath,
        page_search: data.pageSearch,
        user_agent: data.userAgent,
    }).catch(() => undefined);

    return NextResponse.json({ ok: true });
}
