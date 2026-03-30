import { NextResponse } from 'next/server';
import { auth } from '../../../src/lib/auth/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        await auth.signOut();
    } catch (error) {
        console.error('[auth/sign-out] signOut failed:', error);
    }

    const url = new URL('/', request.url);
    return NextResponse.redirect(url);
}
