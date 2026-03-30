import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuthFromHeaders } from '../../../../src/lib/server-auth';

/**
 * /user/me — redirects the logged-in user to their own profile page.
 * If not logged in, redirects to sign-in.
 * If logged in but no username set, redirects to /settings.
 */
export default async function UserMePage() {
    const h = await headers();
    const userId = await verifyAuthFromHeaders(h);

    if (!userId) {
        redirect('/auth/sign-in');
    }

    const profile = await db.select({ username: schema.userProfiles.username })
        .from(schema.userProfiles)
        .where(eq(schema.userProfiles.id, userId))
        .limit(1);

    const username = profile[0]?.username;

    if (!username) {
        redirect('/auth/bridge');
    }

    const normalizedUsername = String(username).trim().replace(/^@+/, '');
    if (!/^[a-z0-9_]{3,20}$/.test(normalizedUsername)) {
        redirect('/auth/bridge');
    }

    redirect(`/user/${normalizedUsername}`);
}
