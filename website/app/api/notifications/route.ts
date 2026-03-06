import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../src/db';
import * as schema from '../../../src/db/schema';
import { verifyAuth } from '../../../src/lib/auth';

export const revalidate = 0; // Don't cache notifications

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const version = searchParams.get('version');
    const platform = searchParams.get('platform');
    const queryUserId = searchParams.get('userId');

    try {
        const authedUserId = await verifyAuth(request);
        const userId = authedUserId || queryUserId;

        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // 1. Initial query for all potentially active notifications
        const data = await db.select()
            .from(schema.adminNotifications)
            .where(
                and(
                    eq(schema.adminNotifications.isActive, 1),
                    or(
                        isNull(schema.adminNotifications.expiresAt),
                        gt(schema.adminNotifications.expiresAt, now)
                    ),
                    or(
                        isNull(schema.adminNotifications.targetVersion),
                        version ? eq(schema.adminNotifications.targetVersion, version) : undefined
                    ),
                    or(
                        isNull(schema.adminNotifications.targetPlatform),
                        platform ? eq(schema.adminNotifications.targetPlatform, platform) : undefined
                    ),
                    or(
                        eq(schema.adminNotifications.targetPlatform, 'all'),
                        platform ? eq(schema.adminNotifications.targetPlatform, platform) : undefined
                    )
                )
            )
            .orderBy(desc(schema.adminNotifications.priority), desc(schema.adminNotifications.createdAt));

        // 2. Filter by segment and capping if userId is provided
        let filteredData = data;

        if (userId) {
            // Check for system notification capping (1 per 24h)
            const recentSystemNotifs = await db.select()
                .from(schema.notificationLogs)
                .where(
                    and(
                        eq(schema.notificationLogs.userId, userId),
                        eq(schema.notificationLogs.action, 'seen'),
                        gt(schema.notificationLogs.createdAt, oneDayAgo)
                    )
                );

            const hasReceivedRecentSystem = recentSystemNotifs.length > 0;

            // Get user info for segmentation
            const [profile] = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.id, userId));
            const [lastWorkout] = await db.select({ date: schema.workouts.date })
                .from(schema.workouts)
                .where(eq(schema.workouts.userId, userId))
                .orderBy(desc(schema.workouts.date))
                .limit(1);

            const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
            const fourteenDaysAgo = Math.floor((Date.now() - 14 * 24 * 60 * 60 * 1000) / 1000);

            const isNewUser = profile ? (profile.updatedAt.getTime() > now.getTime() - 7 * 24 * 60 * 60 * 1000) : false;
            const isActiveUser = lastWorkout ? (lastWorkout.date > sevenDaysAgo) : false;
            const isInactiveUser = lastWorkout ? (lastWorkout.date < fourteenDaysAgo) : true;

            filteredData = data.filter(n => {
                // Apply Capping for system/modal types
                if (hasReceivedRecentSystem && (n.type === 'system' || n.type === 'modal')) {
                    return false;
                }

                // Apply Segmentation
                const segment = n.targetSegment || 'all';
                if (segment === 'all') return true;
                if (segment === 'new' && isNewUser) return true;
                if (segment === 'active' && isActiveUser) return true;
                if (segment === 'inactive' && isInactiveUser) return true;
                if (segment === 'premium') return false; // Placeholder for future premium flag

                return false;
            });
        }

        const notifications = filteredData.map(n => ({
            id: n.id,
            title: n.title,
            message: n.message,
            type: n.type,
            priority: n.priority,
            displayMode: n.displayMode,
            metadata: n.metadata ? JSON.parse(n.metadata) : null
        }));

        return NextResponse.json({
            notifications
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
