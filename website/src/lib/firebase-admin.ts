import admin from 'firebase-admin';

const serviceAccount = {
    "type": "service_account",
    "project_id": process.env.FIREBASE_PROJECT_ID,
    "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID,
    "private_key": process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    "client_email": process.env.FIREBASE_CLIENT_EMAIL,
    "client_id": process.env.FIREBASE_CLIENT_ID,
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": process.env.FIREBASE_CLIENT_X509_CERT_URL,
    "universe_domain": "googleapis.com"
} as any;

const firebaseEnvReady = Boolean(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_PRIVATE_KEY &&
    process.env.FIREBASE_CLIENT_EMAIL
);

if (firebaseEnvReady && !admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (e) {
        console.error('Firebase Admin init failed');
    }
}

export const messaging = firebaseEnvReady ? admin.messaging() : null;

function toStringData(data?: any): Record<string, string> | undefined {
    if (!data || typeof data !== 'object') return undefined;
    return Object.keys(data).reduce((acc: any, key) => {
        acc[key] = String(data[key]);
        return acc;
    }, {});
}

function looksLikeFcmToken(token: string): boolean {
    const t = token.trim();
    if (t.length < 32 || t.length > 4096) return false;
    if (/^[A-Fa-f0-9]{64,}$/.test(t)) return false;
    return true;
}

export async function sendPushNotification(token: string, title: string, body: string, data?: any) {
    if (!messaging) return { success: false, reason: 'firebase_not_configured' };
    if (!looksLikeFcmToken(token)) return { success: false, reason: 'invalid_fcm_token' };
    try {
        await messaging.send({
            token,
            notification: { title, body },
            data: toStringData(data),
            android: {
                priority: 'high',
                notification: { sound: 'default', channelId: 'default' },
            },
            apns: {
                payload: { aps: { sound: 'default', contentAvailable: true } },
            },
        });
        return { success: true };
    } catch (error) {
        console.error('Error sending push notification');
        return { success: false, reason: 'send_failed' };
    }
}

export async function sendSegmentedPush(segment: string, title: string, body: string, data?: any) {
    if (!messaging) return { success: false, reason: 'firebase_not_configured' };
    try {
        const { db } = await import('../db');
        const { userProfiles, workouts } = await import('../db/schema');
        const { isNotNull, eq, gt, lt, and, desc, inArray } = await import('drizzle-orm');

        const now = new Date();
        const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
        const fourteenDaysAgo = Math.floor((Date.now() - 14 * 24 * 60 * 60 * 1000) / 1000);
        const sevenDaysAgoDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        let targetTokens: string[] = [];

        if (segment === 'all') {
            const results = await db.select({ token: userProfiles.pushToken })
                .from(userProfiles)
                .where(isNotNull(userProfiles.pushToken));
            targetTokens = results.map(r => r.token as string);
        } else if (segment === 'new') {
            const results = await db.select({ token: userProfiles.pushToken })
                .from(userProfiles)
                .where(and(
                    isNotNull(userProfiles.pushToken),
                    gt(userProfiles.createdAt, sevenDaysAgoDate)
                ));
            targetTokens = results.map(r => r.token as string);
        } else if (segment === 'active' || segment === 'inactive') {
            // Find users with recent workouts
            const recentWorkouts = db.select({ userId: workouts.userId })
                .from(workouts)
                .where(gt(workouts.date, segment === 'active' ? sevenDaysAgo : fourteenDaysAgo));

            const query = db.select({ token: userProfiles.pushToken })
                .from(userProfiles)
                .where(and(
                    isNotNull(userProfiles.pushToken),
                    segment === 'active'
                        ? inArray(userProfiles.id, recentWorkouts)
                        : undefined // Inactive is more complex, let's just do exclusion if possible
                ));

            if (segment === 'inactive') {
                // For inactive, we want those who are NOT in the recent workouts list
                // and have at least one workout ever (to avoid spamming brand new users who haven't started)
                // actually, let's keep it simple for now as Drizzle subqueries can be tricky with NOT IN
                const activeUserIds = (await recentWorkouts).map(w => w.userId);
                const results = await db.select({ token: userProfiles.pushToken, id: userProfiles.id })
                    .from(userProfiles)
                    .where(isNotNull(userProfiles.pushToken));

                targetTokens = results
                    .filter(r => !activeUserIds.includes(r.id))
                    .map(r => r.token as string);
            } else {
                targetTokens = (await query).map(r => r.token as string);
            }
        }

        targetTokens = targetTokens.filter((t) => looksLikeFcmToken(String(t)));
        if (targetTokens.length === 0) return { success: true, sent: 0 };

        // Process in batches of 500
        const batches = [];
        for (let i = 0; i < targetTokens.length; i += 500) {
            batches.push(targetTokens.slice(i, i + 500));
        }

        const dataPayload = toStringData(data);

        for (const batch of batches) {
            await messaging.sendEachForMulticast({
                tokens: batch,
                notification: { title, body },
                data: dataPayload,
                android: {
                    priority: 'high',
                    notification: { sound: 'default', channelId: 'default' },
                },
                apns: {
                    payload: { aps: { sound: 'default', contentAvailable: true } },
                },
            });
        }

        return { success: true, sent: targetTokens.length };
    } catch (error) {
        console.error('Error sending segmented push');
        return { success: false, reason: 'send_failed' };
    }
}
