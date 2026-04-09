import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
    try {
        const upstreamUrl = new URL('/api/auth/get-session', req.nextUrl.origin);
        upstreamUrl.searchParams.set('disableCookieCache', 'true');

        const response = await fetch(upstreamUrl.toString(), {
            method: 'GET',
            headers: {
                cookie: req.headers.get('cookie') || '',
                'x-requested-with': 'XMLHttpRequest',
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            return NextResponse.json({ session: null }, { status: 401 });
        }

        const data = await response.json().catch(() => null);

        if (!data?.session || !data?.user?.id) {
            return NextResponse.json({ session: null }, { status: 401 });
        }

        const user = data.user as {
            id: string;
            email?: string | null;
            name?: string | null;
            full_name?: string | null;
            fullName?: string | null;
            displayName?: string | null;
            display_name?: string | null;
        };

        const name = user.name || user.full_name || user.fullName || user.displayName || user.display_name || null;

        return NextResponse.json(
            {
                session: {
                    user: {
                        id: user.id,
                        email: user.email ?? null,
                        name,
                    },
                },
            },
            {
                status: 200,
                headers: {
                    'Cache-Control': 'no-store',
                },
            }
        );
    } catch (error) {
        console.error('[bridge-session] auth.getSession failed:', error);
        return NextResponse.json({ session: null, error: 'session_unavailable' }, { status: 500 });
    }
}
