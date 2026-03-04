import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
    const url = new URL(request.nextUrl);
    const redirectUri = url.searchParams.get('redirectUri');

    // If we have a redirectUri, we want to save it in a cookie
    // so the bridge page can send the user back to the correct app link.
    if (redirectUri && url.pathname.startsWith('/auth/')) {
        const response = NextResponse.next();
        response.cookies.set('redirect_uri', redirectUri, {
            path: '/',
            maxAge: 600, // 10 minutes
            httpOnly: true,
            sameSite: 'lax',
        });
        return response;
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/auth/:path*'],
};
