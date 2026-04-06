import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '../../../../../src/lib/auth/server';

const AUTH_COOKIE_HINT = /(auth|session|neon|better)/i;

function cookieDomainVariants(rawDomain: string | undefined): string[] {
    if (!rawDomain) return [];
    const normalized = rawDomain.trim().toLowerCase().replace(/^\.+/, '');
    if (!normalized || !normalized.includes('.')) return [];
    return [normalized, `.${normalized}`];
}

export async function POST() {
    const response = NextResponse.json({ success: true });

    try {
        await auth.signOut();
    } catch {
    }

    const cookieStore = await cookies();
    const currentCookies = cookieStore.getAll();
    const candidateNames = new Set(
        currentCookies
            .map((cookie) => cookie.name)
            .filter((name) => AUTH_COOKIE_HINT.test(name))
    );

    const domains = cookieDomainVariants(process.env.NEON_AUTH_COOKIE_DOMAIN);

    for (const cookieName of candidateNames) {
        response.cookies.set(cookieName, '', {
            path: '/',
            maxAge: 0,
            expires: new Date(0),
            httpOnly: true,
            sameSite: 'lax',
            secure: true,
        });

        for (const domain of domains) {
            response.cookies.set(cookieName, '', {
                path: '/',
                maxAge: 0,
                expires: new Date(0),
                httpOnly: true,
                sameSite: 'lax',
                secure: true,
                domain,
            });
        }
    }

    return response;
}
