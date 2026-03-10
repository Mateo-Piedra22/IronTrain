import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
    const url = new URL(request.nextUrl);
    const redirectUri = url.searchParams.get('redirectUri');

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-url', request.url);

    // If we have a redirectUri, we want to save it in a cookie
    // so the bridge page can send the user back to the correct app link.
    if (redirectUri && url.pathname.startsWith('/auth/')) {
        const response = NextResponse.next({
            request: {
                headers: requestHeaders,
            },
        });
        response.cookies.set('redirect_uri', redirectUri, {
            path: '/',
            maxAge: 600, // 10 minutes
            httpOnly: true,
            sameSite: 'lax',
        });
        return response;
    }

    return NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
