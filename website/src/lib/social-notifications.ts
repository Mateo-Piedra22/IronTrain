import { eq } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '../db/schema';
import { sendPushNotification } from './firebase-admin';

type UserBrief = {
    displayName: string;
    username: string | null;
    pushToken: string | null;
};

export async function getUserBrief(userId: string): Promise<UserBrief | null> {
    const [profile] = await db.select({
        displayName: schema.userProfiles.displayName,
        username: schema.userProfiles.username,
        pushToken: schema.userProfiles.pushToken,
    }).from(schema.userProfiles).where(eq(schema.userProfiles.id, userId)).limit(1);

    if (!profile) return null;
    return {
        displayName: profile.displayName || 'Atleta',
        username: profile.username,
        pushToken: profile.pushToken || null,
    };
}

export function formatActorName(actor: Pick<UserBrief, 'displayName' | 'username'> | null | undefined): string {
    if (!actor) return 'Un atleta';
    if (actor.username && actor.username.trim().length > 0) return `@${actor.username}`;
    return actor.displayName || 'Un atleta';
}

export async function notifyUserById(
    targetUserId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>
) {
    const target = await getUserBrief(targetUserId);
    if (!target?.pushToken) return { success: false, reason: 'missing_token' as const };
    return sendPushNotification(target.pushToken, title, body, data);
}
