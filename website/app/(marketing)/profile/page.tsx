import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '../../../src/db';
import * as schema from '../../../src/db/schema';
import { verifyAuth } from '../../../src/lib/auth';

export default async function ProfileRedirectPage() {
    const h = await headers();
    const request = {
        headers: h,
        nextUrl: { searchParams: new URLSearchParams() },
    } as any;

    const userId = await verifyAuth(request);

    if (!userId) {
        redirect('/auth/sign-in');
    }

    const userProfile = await db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.id, userId)
    });

    if (!userProfile?.username) {
        redirect('/');
    }

    redirect(`/user/${userProfile.username}`);
}
