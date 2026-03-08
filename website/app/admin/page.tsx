import { desc, eq, isNull, sql } from 'drizzle-orm';
import {
    Activity,
    Check,
    CheckCircle,
    Clock,
    EyeOff,
    Flame,
    Hash,
    LayoutDashboard,
    Shield,
    Smartphone,
    Trash2,
    Trophy,
    User,
    Users,
    Zap
} from 'lucide-react';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { SyncHealthPanel } from '../../src/components/admin/SyncHealthPanel';
import { db } from '../../src/db';
import * as schema from '../../src/db/schema';
import { auth } from '../../src/lib/auth/server';
import { syncChangelogToDatabase } from '../../src/lib/changelog-db-sync';
import { sendSegmentedPush } from '../../src/lib/firebase-admin';
import { getSyncHealthReport } from '../../src/lib/sync-health';

export const revalidate = 0;
export const runtime = 'nodejs';

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '').split(',').map(id => id.trim()).filter(Boolean);

async function getAuthenticatedAdmin(): Promise<string | null> {
    try {
        const { data: session } = await auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return null;
        if (ADMIN_USER_IDS.length === 0) return null;
        if (ADMIN_USER_IDS.includes(userId)) return userId;
        return null;
    } catch {
        return null;
    }
}

async function markFeedbackStatus(formData: FormData) {
    'use server';
    const adminId = await getAuthenticatedAdmin();
    if (!adminId) throw new Error('Unauthorized');
    const id = formData.get('id') as string;
    const status = formData.get('status') as string;
    if (!id || !status) return;
    await db.update(schema.feedback).set({ status, updatedAt: new Date() }).where(eq(schema.feedback.id, id));
    revalidatePath('/admin');
}

async function handleRoutineAction(formData: FormData) {
    'use server';
    const adminId = await getAuthenticatedAdmin();
    if (!adminId) throw new Error('Unauthorized');

    const id = formData.get('id') as string;
    const action = formData.get('action') as string;
    const currentModerated = formData.get('currentModerated') === '1';
    const message = formData.get('message') as string;

    if (action === 'toggle-moderation') {
        const newStatus = currentModerated ? 0 : 1;
        await db.update(schema.routines)
            .set({
                isModerated: newStatus,
                moderationMessage: newStatus === 1 ? (message || 'Contenido ocultado por incumplir las normas de la comunidad.') : null,
                // If we moderate (hide), we also ensure isPublic is 0 for consistency
                ...(newStatus === 1 ? { isPublic: 0 } : {}),
                updatedAt: new Date()
            })
            .where(eq(schema.routines.id, id));
    } else if (action === 'purge') {
        await db.update(schema.routines)
            .set({
                deletedAt: new Date(),
                isPublic: 0,
                isModerated: 1,
                moderationMessage: 'Esta rutina ha sido eliminada permanentemente por un administrador.',
                updatedAt: new Date()
            })
            .where(eq(schema.routines.id, id));
    }
    revalidatePath('/admin');
}

async function handleChangelogAction(formData: FormData) {
    'use server';
    const adminId = await getAuthenticatedAdmin();
    if (!adminId) throw new Error('Unauthorized');

    const id = formData.get('id') as string || crypto.randomUUID();
    const action = formData.get('action') as string;
    const version = formData.get('version') as string;
    const itemsRaw = formData.get('items') as string;
    const isUnreleased = formData.get('isUnreleased') === 'true' ? 1 : 0;

    if (action === 'save') {
        if (!version || !itemsRaw) return;
        const items = itemsRaw.split('\n').filter(i => i.trim().length > 0);

        const existing = await db.select().from(schema.changelogs).where(eq(schema.changelogs.id, id)).then(res => res[0]);
        const becomingReleased = isUnreleased === 0 && (!existing || existing.isUnreleased === 1);

        await db.insert(schema.changelogs)
            .values({
                id,
                version,
                items: JSON.stringify(items),
                isUnreleased,
                date: new Date(),
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: schema.changelogs.id,
                set: {
                    version,
                    items: JSON.stringify(items),
                    isUnreleased,
                    updatedAt: new Date(),
                }
            });

        if (becomingReleased) {
            // Automatic push notification for new version
            await sendSegmentedPush('all', 'Nueva Versión Disponible', `Actualización v${version} lista. Entra para ver qué hay de nuevo.`, {
                type: 'system',
                actionUrl: 'irontrain://changelog'
            });
        }
    } else if (action === 'delete') {
        await db.delete(schema.changelogs).where(eq(schema.changelogs.id, id));
    }
    revalidatePath('/admin');
}

async function handleChangelogSyncAction() {
    'use server';
    const adminId = await getAuthenticatedAdmin();
    if (!adminId) throw new Error('Unauthorized');

    const result = await syncChangelogToDatabase({ force: true, minIntervalMs: 0 });
    revalidatePath('/admin');

    const query = new URLSearchParams();
    query.set('changelogSyncStatus', result.reason);
    query.set('changelogUpserted', String(result.upsertedCount));
    query.set('changelogSource', String(result.sourceCount));
    query.set('changelogSyncedAt', result.syncedAt);
    redirect(`/admin?${query.toString()}`);
}

async function handleNotificationAction(formData: FormData) {
    'use server';
    const adminId = await getAuthenticatedAdmin();
    if (!adminId) throw new Error('Unauthorized');

    const id = formData.get('id') as string || crypto.randomUUID();
    const action = formData.get('action') as string;
    const title = formData.get('title') as string;
    const message = formData.get('message') as string;
    const type = formData.get('type') as string;
    const displayMode = formData.get('displayMode') as string;
    const priority = formData.get('priority') as string || 'normal';
    const targetVersion = formData.get('targetVersion') as string;
    const targetPlatform = formData.get('targetPlatform') as string;
    const targetSegment = formData.get('targetSegment') as string || 'all';
    const actionUrl = formData.get('actionUrl') as string;
    const isActive = formData.get('isActive') === 'true' ? 1 : 0;

    const metadata = actionUrl ? JSON.stringify({ actionUrl }) : null;

    if (action === 'save') {
        if (!title || !message) return;
        await db.insert(schema.adminNotifications)
            .values({
                id,
                title,
                message,
                type: type || 'toast',
                priority,
                displayMode: displayMode || 'once',
                targetVersion: targetVersion || null,
                targetPlatform: targetPlatform || 'all',
                targetSegment: targetSegment,
                metadata,
                isActive,
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: schema.adminNotifications.id,
                set: {
                    title,
                    message,
                    type: type || 'toast',
                    priority,
                    displayMode: displayMode || 'once',
                    targetVersion: targetVersion || null,
                    targetPlatform: targetPlatform || 'all',
                    targetSegment: targetSegment,
                    metadata,
                    isActive,
                    updatedAt: new Date(),
                }
            });

        // Trigger push if active
        if (isActive) {
            sendSegmentedPush(targetSegment, title, message, {
                id,
                type: type || 'toast',
                actionUrl: actionUrl || ''
            });
        }
    } else if (action === 'delete') {
        await db.delete(schema.adminNotifications).where(eq(schema.adminNotifications.id, id));
    }
    revalidatePath('/admin');
}

async function handleScoringConfigAction(formData: FormData) {
    'use server';
    const adminId = await getAuthenticatedAdmin();
    if (!adminId) throw new Error('Unauthorized');

    const toInt = (name: string, fallback: number) => {
        const value = Number(formData.get(name));
        if (!Number.isFinite(value)) return fallback;
        return Math.max(0, Math.round(value));
    };
    const toFloat = (name: string, fallback: number) => {
        const value = Number(formData.get(name));
        if (!Number.isFinite(value)) return fallback;
        return value;
    };

    await db.insert(schema.socialScoringConfig).values({
        id: 'default',
        workoutCompletePoints: toInt('workoutCompletePoints', 20),
        extraDayPoints: toInt('extraDayPoints', 10),
        extraDayWeeklyCap: toInt('extraDayWeeklyCap', 2),
        prNormalPoints: toInt('prNormalPoints', 10),
        prBig3Points: toInt('prBig3Points', 25),
        adverseWeatherPoints: toInt('adverseWeatherPoints', 15),
        weekTier2Min: toInt('weekTier2Min', 3),
        weekTier3Min: toInt('weekTier3Min', 5),
        weekTier4Min: toInt('weekTier4Min', 10),
        tier2Multiplier: toFloat('tier2Multiplier', 1.1),
        tier3Multiplier: toFloat('tier3Multiplier', 1.25),
        tier4Multiplier: toFloat('tier4Multiplier', 1.5),
        coldThresholdC: toFloat('coldThresholdC', 3),
        weatherBonusEnabled: formData.get('weatherBonusEnabled') === 'true' ? 1 : 0,
        updatedAt: new Date(),
        updatedBy: adminId,
    }).onConflictDoUpdate({
        target: schema.socialScoringConfig.id,
        set: {
            workoutCompletePoints: toInt('workoutCompletePoints', 20),
            extraDayPoints: toInt('extraDayPoints', 10),
            extraDayWeeklyCap: toInt('extraDayWeeklyCap', 2),
            prNormalPoints: toInt('prNormalPoints', 10),
            prBig3Points: toInt('prBig3Points', 25),
            adverseWeatherPoints: toInt('adverseWeatherPoints', 15),
            weekTier2Min: toInt('weekTier2Min', 3),
            weekTier3Min: toInt('weekTier3Min', 5),
            weekTier4Min: toInt('weekTier4Min', 10),
            tier2Multiplier: toFloat('tier2Multiplier', 1.1),
            tier3Multiplier: toFloat('tier3Multiplier', 1.25),
            tier4Multiplier: toFloat('tier4Multiplier', 1.5),
            coldThresholdC: toFloat('coldThresholdC', 3),
            weatherBonusEnabled: formData.get('weatherBonusEnabled') === 'true' ? 1 : 0,
            updatedAt: new Date(),
            updatedBy: adminId,
        }
    });

    revalidatePath('/admin');
}

async function handleGlobalEventAction(formData: FormData) {
    'use server';
    const adminId = await getAuthenticatedAdmin();
    if (!adminId) throw new Error('Unauthorized');

    const action = String(formData.get('action') || '');
    const id = String(formData.get('id') || crypto.randomUUID());

    if (action === 'delete') {
        await db.delete(schema.globalEvents).where(eq(schema.globalEvents.id, id));
        revalidatePath('/admin');
        return;
    }

    const name = String(formData.get('name') || '').trim();
    const multiplier = Number(formData.get('multiplier') || 1);
    const startRaw = String(formData.get('startDate') || '');
    const endRaw = String(formData.get('endDate') || '');
    const isActive = formData.get('isActive') === 'true' ? 1 : 0;
    const sendPush = formData.get('sendPush') === 'true';

    if (!name || !Number.isFinite(multiplier) || multiplier <= 0 || !startRaw || !endRaw) {
        revalidatePath('/admin');
        return;
    }

    const startDate = new Date(startRaw);
    const endDate = new Date(endRaw);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
        revalidatePath('/admin');
        return;
    }

    await db.insert(schema.globalEvents).values({
        id,
        name,
        multiplier,
        startDate,
        endDate,
        isActive,
        pushSent: 0,
        updatedAt: new Date(),
        createdBy: adminId,
    }).onConflictDoUpdate({
        target: schema.globalEvents.id,
        set: {
            name,
            multiplier,
            startDate,
            endDate,
            isActive,
            updatedAt: new Date(),
        }
    });

    if (isActive === 1 && sendPush) {
        await sendSegmentedPush(
            'all',
            '¡Evento Global Activo!',
            `${name} · multiplicador x${multiplier.toFixed(2)} en todo tu puntaje.`,
            { type: 'system', actionUrl: 'irontrain://social' }
        );
        await db.update(schema.globalEvents).set({ pushSent: 1, updatedAt: new Date() }).where(eq(schema.globalEvents.id, id));
    }

    revalidatePath('/admin');
}

export default async function AdminPanel(props: {
    searchParams: Promise<{
        editNotifId?: string;
        editChangelogId?: string;
        changelogSyncStatus?: string;
        changelogUpserted?: string;
        changelogSource?: string;
        changelogSyncedAt?: string;
    }>
}) {
    const params = await props.searchParams;
    const editNotifId = params.editNotifId;
    const editChangelogId = params.editChangelogId;
    const changelogSyncStatus = params.changelogSyncStatus;
    const changelogUpserted = Number(params.changelogUpserted || 0);
    const changelogSource = Number(params.changelogSource || 0);
    const changelogSyncedAt = params.changelogSyncedAt;

    const adminId = await getAuthenticatedAdmin();
    if (!adminId) redirect('/');

    const [
        routinesData,
        profilesData,
        installsData,
        feedbackData,
        changelogsData,
        adminNotificationsData,
        notificationLogsResult,
        changelogReactionsResult,
        scoringConfigData,
        globalEventsData,
        socialProfilesData,
        scoreBreakdownRows,
        recentScoreEvents,
        syncHealthReport
    ] = await Promise.all([
        db.select({
            id: schema.routines.id,
            name: schema.routines.name,
            description: schema.routines.description,
            isPublic: schema.routines.isPublic,
            isModerated: schema.routines.isModerated,
            moderationMessage: schema.routines.moderationMessage,
            updatedAt: schema.routines.updatedAt,
            userId: schema.routines.userId,
            username: schema.userProfiles.username,
        })
            .from(schema.routines)
            .leftJoin(schema.userProfiles, eq(schema.routines.userId, schema.userProfiles.id))
            .where(isNull(schema.routines.deletedAt))
            .orderBy(desc(schema.routines.updatedAt)),
        db.select({ count: sql<number>`count(*)` }).from(schema.userProfiles),
        db.select({ count: sql<number>`count(*)` }).from(schema.appInstalls),
        db.select({
            id: schema.feedback.id,
            userId: schema.feedback.userId,
            type: schema.feedback.type,
            message: schema.feedback.message,
            status: schema.feedback.status,
            metadata: schema.feedback.metadata,
            createdAt: schema.feedback.createdAt,
            updatedAt: schema.feedback.updatedAt,
            senderDisplayName: schema.userProfiles.displayName,
            senderUsername: schema.userProfiles.username,
        })
            .from(schema.feedback)
            .leftJoin(schema.userProfiles, eq(schema.feedback.userId, schema.userProfiles.id))
            .orderBy(desc(schema.feedback.createdAt)),
        db.select().from(schema.changelogs).orderBy(desc(schema.changelogs.version)),
        db.select().from(schema.adminNotifications).orderBy(desc(schema.adminNotifications.createdAt)),
        db.select({
            notificationId: schema.notificationLogs.notificationId,
            action: schema.notificationLogs.action,
            count: sql<number>`count(*)`
        }).from(schema.notificationLogs).groupBy(schema.notificationLogs.notificationId, schema.notificationLogs.action),
        db.select({
            changelogId: schema.changelogReactions.changelogId,
            count: sql<number>`count(*)`
        }).from(schema.changelogReactions)
            .where(isNull(schema.changelogReactions.deletedAt))
            .groupBy(schema.changelogReactions.changelogId),
        db.select().from(schema.socialScoringConfig).where(eq(schema.socialScoringConfig.id, 'default')),
        db.select().from(schema.globalEvents).orderBy(desc(schema.globalEvents.startDate)),
        db.select({
            id: schema.userProfiles.id,
            username: schema.userProfiles.username,
            displayName: schema.userProfiles.displayName,
            scoreLifetime: schema.userProfiles.scoreLifetime,
            streakWeeks: schema.userProfiles.streakWeeks,
            streakMultiplier: schema.userProfiles.streakMultiplier,
            currentStreak: schema.userProfiles.currentStreak,
            highestStreak: schema.userProfiles.highestStreak,
            updatedAt: schema.userProfiles.updatedAt,
        }).from(schema.userProfiles).orderBy(desc(schema.userProfiles.scoreLifetime)).limit(80),
        db.select({
            userId: schema.scoreEvents.userId,
            eventType: schema.scoreEvents.eventType,
            count: sql<number>`count(*)`,
            points: sql<number>`sum(${schema.scoreEvents.pointsAwarded})`,
        }).from(schema.scoreEvents).groupBy(schema.scoreEvents.userId, schema.scoreEvents.eventType),
        db.select({
            userId: schema.scoreEvents.userId,
            eventType: schema.scoreEvents.eventType,
            pointsAwarded: schema.scoreEvents.pointsAwarded,
            metadata: schema.scoreEvents.metadata,
            createdAt: schema.scoreEvents.createdAt,
        }).from(schema.scoreEvents).orderBy(desc(schema.scoreEvents.createdAt)).limit(500),
        getSyncHealthReport(),
    ]);

    const changelogs = (changelogsData || []).map(c => ({
        ...c,
        items: JSON.parse(c.items || '[]') as string[],
        kudos: (changelogReactionsResult as any[] || []).find((r: any) => r.changelogId === c.id)?.count || 0
    }));
    const feedbackRows = feedbackData.map((f) => {
        const metadata = (() => {
            if (!f.metadata) return null;
            try {
                return JSON.parse(f.metadata) as Record<string, any>;
            } catch {
                return null;
            }
        })();
        const senderName = f.senderDisplayName || (f.senderUsername ? `@${f.senderUsername}` : (f.userId || 'Anónimo'));
        return { ...f, metadata, senderName };
    });
    const lastChangelogDbSyncAt = changelogsData.reduce<Date | null>((latest, row) => {
        if (!latest) return row.updatedAt;
        return row.updatedAt > latest ? row.updatedAt : latest;
    }, null);

    const editingNotification = editNotifId ? adminNotificationsData.find(n => n.id === editNotifId) : null;
    const editingChangelog = editChangelogId ? changelogs.find(c => c.id === editChangelogId) : null;
    const now = Date.now();
    const activeGlobalMultiplier = globalEventsData
        .filter((event) => event.isActive === 1 && new Date(event.startDate).getTime() <= now && new Date(event.endDate).getTime() >= now)
        .reduce((max, event) => Math.max(max, Number(event.multiplier || 1)), 1);
    const breakdownByUser = scoreBreakdownRows.reduce<Record<string, Array<{ eventType: string; count: number; points: number }>>>((acc, row) => {
        if (!acc[row.userId]) acc[row.userId] = [];
        acc[row.userId].push({
            eventType: row.eventType,
            count: Number(row.count || 0),
            points: Number(row.points || 0),
        });
        return acc;
    }, {});
    const recentEventsByUser = recentScoreEvents.reduce<Record<string, Array<{ eventType: string; pointsAwarded: number; createdAt: Date; metadata: string | null }>>>((acc, row) => {
        if (!acc[row.userId]) acc[row.userId] = [];
        if (acc[row.userId].length < 5) {
            acc[row.userId].push({
                eventType: row.eventType,
                pointsAwarded: Number(row.pointsAwarded || 0),
                createdAt: row.createdAt,
                metadata: row.metadata,
            });
        }
        return acc;
    }, {});

    const getNotifStats = (id: string) => {
        const stats = notificationLogsResult.filter(l => l.notificationId === id);
        const seen = stats.find(s => s.action === 'seen')?.count || 0;
        const clicked = stats.find(s => s.action === 'clicked')?.count || 0;
        return { seen, clicked };
    };
    const adminNotifications = adminNotificationsData || [];
    const scoreConfig = scoringConfigData?.[0] ?? {
        workoutCompletePoints: 20,
        extraDayPoints: 10,
        extraDayWeeklyCap: 2,
        prNormalPoints: 10,
        prBig3Points: 25,
        adverseWeatherPoints: 15,
        weekTier2Min: 3,
        weekTier3Min: 5,
        weekTier4Min: 10,
        tier2Multiplier: 1.1,
        tier3Multiplier: 1.25,
        tier4Multiplier: 1.5,
        coldThresholdC: 3,
        weatherBonusEnabled: 1,
    };
    const globalEvents = globalEventsData || [];
    const nowDate = new Date();
    const activeEventsCount = globalEvents.filter(e => e.isActive === 1 && e.startDate <= nowDate && e.endDate >= nowDate).length;

    const totalUsers = Number(profilesData[0]?.count || 0);
    const totalInstalls = Number(installsData[0]?.count || 0);
    const pendingFeedbackCount = feedbackRows.filter(f => f.status === 'open').length;

    // IronSocial metrics
    const totalKudosData = await db.select({ count: sql<number>`count(*)` }).from(schema.kudos);
    const totalActivityData = await db.select({ count: sql<number>`count(*)` }).from(schema.activityFeed);

    const totalKudos = Number(totalKudosData[0]?.count || 0);
    const totalActivity = Number(totalActivityData[0]?.count || 0);
    const totalScoreEventsData = await db.select({ count: sql<number>`count(*)` }).from(schema.scoreEvents);
    const totalScoreEvents = Number(totalScoreEventsData[0]?.count || 0);

    const topStreaks = await db.select({
        id: schema.userProfiles.id,
        username: schema.userProfiles.username,
        currentStreak: schema.userProfiles.currentStreak,
        highestStreak: schema.userProfiles.highestStreak
    }).from(schema.userProfiles)
        .where(sql`${schema.userProfiles.highestStreak} > 0`)
        .orderBy(desc(schema.userProfiles.highestStreak))
        .limit(5);

    const currentDate = new Date().toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    return (
        <div className="min-h-screen bg-[#f5f1e8] text-[#1a1a2e] font-mono p-4 md:p-8 selection:bg-[#1a1a2e] selection:text-[#f5f1e8]">
            <header className="mb-12 border-b-2 border-[#1a1a2e] pb-8">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-[#1a1a2e] p-3 text-[#f5f1e8]">
                            <Shield className="w-8 h-8" />
                        </div>
                        <div>
                            <div className="text-[10px] opacity-60 tracking-[0.2em] mb-1">[ TELEMETRÍA CENTRAL ]</div>
                            <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase leading-none">ADMIN_X_ZERO</h1>
                            <p className="text-[10px] opacity-40 mt-2 font-bold tracking-wider flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-[#1a1a2e] animate-pulse"></span>
                                SYSTEM STATUS: ONLINE • {currentDate}
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            {/* METRICS GRID - THERMAL STYLE */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 border border-[#1a1a2e] bg-[#1a1a2e] mb-12 shadow-[8px_8px_0px_0px_rgba(26,26,46,0.1)]">
                <div className="bg-[#f5f1e8] p-6 border-r border-b border-[#1a1a2e] md:border-b-0 lg:border-b-0">
                    <div className="text-[10px] opacity-60 font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Smartphone className="w-3.5 h-3.5" /> INSTALACIONES
                    </div>
                    <div className="text-4xl font-black tracking-tighter">{totalInstalls}</div>
                    <div className="text-[9px] opacity-40 font-bold mt-2 uppercase tracking-wide">Device_UUID_Unique</div>
                </div>

                <div className="bg-[#f5f1e8] p-6 border-r border-b border-[#1a1a2e] md:border-b-0 lg:border-b-0">
                    <div className="text-[10px] opacity-60 font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Users className="w-3.5 h-3.5" /> CUENTAS_SYNC
                    </div>
                    <div className="text-4xl font-black tracking-tighter">{totalUsers}</div>
                    <div className="text-[9px] opacity-40 font-bold mt-2 uppercase tracking-wide">P2P_Encryption_Active</div>
                </div>

                <div className="bg-[#f5f1e8] p-6 border-r border-[#1a1a2e]">
                    <div className="text-[10px] opacity-60 font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5" /> PUBLIC_FEED
                    </div>
                    <div className="text-4xl font-black tracking-tighter">{routinesData.filter(r => r.isPublic === 1).length}</div>
                    <div className="text-[9px] opacity-40 font-bold mt-2 uppercase tracking-wide">Total_Indexed_Routines</div>
                </div>

                <div className="bg-[#1a1a2e] p-6 text-[#f5f1e8]">
                    <div className="text-[10px] opacity-50 font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                        <LayoutDashboard className="w-3.5 h-3.5 text-orange-400" /> PENDIENTE
                    </div>
                    <div className="text-4xl font-black tracking-tighter text-orange-400">{pendingFeedbackCount}</div>
                    <div className="text-[9px] text-orange-400/60 font-black mt-2 uppercase tracking-wide">Urgent_Action_Required</div>
                </div>
            </div>

            <SyncHealthPanel initialReport={syncHealthReport} />

            {/* SECCIÓN 02: SOCIAL */}
            <div className="mb-12">
                <div className="flex items-center gap-3 mb-6 border-b border-[#1a1a2e]/10 pb-2">
                    <div className="bg-[#1a1a2e] text-[#f5f1e8] text-[10px] font-black px-2 py-0.5">02</div>
                    <h2 className="text-lg font-black uppercase tracking-tight">IRONSOCIAL_INTERACTIONS</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="border border-[#1a1a2e] p-6 bg-[#f5f1e8]/50">
                        <div className="text-[10px] opacity-60 font-black uppercase mb-4 flex items-center gap-2">
                            <Flame className="w-3.5 h-3.5" /> KUDOS_FIRED
                        </div>
                        <div className="text-4xl font-black tracking-tighter">{totalKudos}</div>
                        <div className="text-[9px] opacity-40 font-bold mt-2 uppercase">Global_Motivation_Counter</div>
                    </div>

                    <div className="border border-[#1a1a2e] p-6 bg-[#f5f1e8]/50">
                        <div className="text-[10px] opacity-60 font-black uppercase mb-4 flex items-center gap-2">
                            <Zap className="w-3.5 h-3.5" /> ACTIVITY_OPS
                        </div>
                        <div className="text-4xl font-black tracking-tighter">{totalActivity}</div>
                        <div className="text-[9px] opacity-40 font-bold mt-2 uppercase">Live_Event_Log_Stream</div>
                    </div>

                    <div className="bg-[#1a1a2e] p-6 text-[#f5f1e8]">
                        <div className="text-[10px] opacity-50 font-black uppercase mb-4 flex items-center gap-2">
                            <Trophy className="w-3.5 h-3.5 text-orange-400" /> DISCIPLINA_LEADERBOARD
                        </div>
                        {topStreaks.length > 0 ? (
                            <div className="space-y-2 mt-2">
                                {topStreaks.map((athlete, i) => (
                                    <div key={athlete.id} className="flex items-center justify-between border-b border-[#f5f1e8]/10 pb-1">
                                        <span className="text-[11px] font-bold uppercase tracking-tight">#{i + 1} {athlete.username || 'ANON_USER'}</span>
                                        <span className="text-[11px] font-black text-orange-400 font-mono">STREAK_{athlete.highestStreak}D</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-[10px] opacity-30 italic">WAITING_FOR_DATA...</div>
                        )}
                    </div>

                    <div className="border border-[#1a1a2e] p-6 bg-[#f5f1e8]/50">
                        <div className="text-[10px] opacity-60 font-black uppercase mb-4 flex items-center gap-2">
                            <Trophy className="w-3.5 h-3.5" /> SCORE_EVENTS
                        </div>
                        <div className="text-4xl font-black tracking-tighter">{totalScoreEvents}</div>
                        <div className="text-[9px] opacity-40 font-bold mt-2 uppercase">Global Events Activos: {activeEventsCount}</div>
                    </div>
                </div>
            </div>

            <div className="mb-12">
                <div className="flex items-center gap-3 mb-6 border-b border-[#1a1a2e]/10 pb-2">
                    <div className="bg-[#1a1a2e] text-[#f5f1e8] text-[10px] font-black px-2 py-0.5">03</div>
                    <h2 className="text-lg font-black uppercase tracking-tight">SOCIAL_SCORE_ENGINE</h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="border-2 border-[#1a1a2e] p-6 bg-[#f5f1e8]">
                        <h3 className="font-black text-xs uppercase mb-4 border-b border-[#1a1a2e]/10 pb-2">RULES_CONFIG</h3>
                        <form action={handleScoringConfigAction} className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <label className="text-[10px] font-black uppercase">Workout +<input name="workoutCompletePoints" type="number" min={0} defaultValue={scoreConfig.workoutCompletePoints} className="w-full mt-1 bg-white border border-[#1a1a2e] p-2 text-xs font-bold" /></label>
                                <label className="text-[10px] font-black uppercase">Extra Day +<input name="extraDayPoints" type="number" min={0} defaultValue={scoreConfig.extraDayPoints} className="w-full mt-1 bg-white border border-[#1a1a2e] p-2 text-xs font-bold" /></label>
                                <label className="text-[10px] font-black uppercase">Cap Extra/Sem<input name="extraDayWeeklyCap" type="number" min={0} defaultValue={scoreConfig.extraDayWeeklyCap} className="w-full mt-1 bg-white border border-[#1a1a2e] p-2 text-xs font-bold" /></label>
                                <label className="text-[10px] font-black uppercase">PR Normal +<input name="prNormalPoints" type="number" min={0} defaultValue={scoreConfig.prNormalPoints} className="w-full mt-1 bg-white border border-[#1a1a2e] p-2 text-xs font-bold" /></label>
                                <label className="text-[10px] font-black uppercase">PR Big3 +<input name="prBig3Points" type="number" min={0} defaultValue={scoreConfig.prBig3Points} className="w-full mt-1 bg-white border border-[#1a1a2e] p-2 text-xs font-bold" /></label>
                                <label className="text-[10px] font-black uppercase">Bonus Clima +<input name="adverseWeatherPoints" type="number" min={0} defaultValue={scoreConfig.adverseWeatherPoints} className="w-full mt-1 bg-white border border-[#1a1a2e] p-2 text-xs font-bold" /></label>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <label className="text-[10px] font-black uppercase">Sem Min T2<input name="weekTier2Min" type="number" min={1} defaultValue={scoreConfig.weekTier2Min} className="w-full mt-1 bg-white border border-[#1a1a2e] p-2 text-xs font-bold" /></label>
                                <label className="text-[10px] font-black uppercase">Sem Min T3<input name="weekTier3Min" type="number" min={1} defaultValue={scoreConfig.weekTier3Min} className="w-full mt-1 bg-white border border-[#1a1a2e] p-2 text-xs font-bold" /></label>
                                <label className="text-[10px] font-black uppercase">Sem Min T4<input name="weekTier4Min" type="number" min={1} defaultValue={scoreConfig.weekTier4Min} className="w-full mt-1 bg-white border border-[#1a1a2e] p-2 text-xs font-bold" /></label>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <label className="text-[10px] font-black uppercase">x Tier2<input name="tier2Multiplier" type="number" step="0.01" min={1} defaultValue={scoreConfig.tier2Multiplier} className="w-full mt-1 bg-white border border-[#1a1a2e] p-2 text-xs font-bold" /></label>
                                <label className="text-[10px] font-black uppercase">x Tier3<input name="tier3Multiplier" type="number" step="0.01" min={1} defaultValue={scoreConfig.tier3Multiplier} className="w-full mt-1 bg-white border border-[#1a1a2e] p-2 text-xs font-bold" /></label>
                                <label className="text-[10px] font-black uppercase">x Tier4<input name="tier4Multiplier" type="number" step="0.01" min={1} defaultValue={scoreConfig.tier4Multiplier} className="w-full mt-1 bg-white border border-[#1a1a2e] p-2 text-xs font-bold" /></label>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <label className="text-[10px] font-black uppercase">Umbral frío °C<input name="coldThresholdC" type="number" step="0.1" defaultValue={scoreConfig.coldThresholdC} className="w-full mt-1 bg-white border border-[#1a1a2e] p-2 text-xs font-bold" /></label>
                                <label className="text-[10px] font-black uppercase">Weather Bonus
                                    <select name="weatherBonusEnabled" defaultValue={scoreConfig.weatherBonusEnabled === 1 ? 'true' : 'false'} className="w-full mt-1 bg-white border border-[#1a1a2e] p-2 text-xs font-bold">
                                        <option value="true">ON</option>
                                        <option value="false">OFF</option>
                                    </select>
                                </label>
                            </div>
                            <button type="submit" className="w-full bg-[#1a1a2e] text-[#f5f1e8] py-3 font-black uppercase text-[10px] hover:bg-orange-500 transition-colors">
                                SAVE_SCORE_CONFIG
                            </button>
                        </form>
                    </div>

                    <div className="border-2 border-[#1a1a2e] p-6 bg-[#f5f1e8]">
                        <h3 className="font-black text-xs uppercase mb-4 border-b border-[#1a1a2e]/10 pb-2">GLOBAL_MULTIPLIER_EVENTS</h3>
                        <form action={handleGlobalEventAction} className="space-y-3 mb-6">
                            <input type="hidden" name="id" value="" />
                            <input type="hidden" name="action" value="save" />
                            <div className="grid grid-cols-2 gap-3">
                                <input name="name" placeholder="Nombre del evento" className="bg-white border border-[#1a1a2e] p-2 text-xs font-bold col-span-2" required />
                                <input name="multiplier" type="number" step="0.01" min="1" placeholder="1.50" className="bg-white border border-[#1a1a2e] p-2 text-xs font-bold" required />
                                <select name="isActive" defaultValue="true" className="bg-white border border-[#1a1a2e] p-2 text-xs font-bold">
                                    <option value="true">Activo</option>
                                    <option value="false">Inactivo</option>
                                </select>
                                <input name="startDate" type="datetime-local" className="bg-white border border-[#1a1a2e] p-2 text-xs font-bold" required />
                                <input name="endDate" type="datetime-local" className="bg-white border border-[#1a1a2e] p-2 text-xs font-bold" required />
                                <select name="sendPush" defaultValue="true" className="bg-white border border-[#1a1a2e] p-2 text-xs font-bold col-span-2">
                                    <option value="true">Enviar Push Global</option>
                                    <option value="false">No enviar Push</option>
                                </select>
                            </div>
                            <button type="submit" className="w-full bg-[#1a1a2e] text-orange-400 py-3 font-black uppercase text-[10px] hover:bg-orange-500 hover:text-[#1a1a2e] transition-colors">
                                CREATE_GLOBAL_EVENT
                            </button>
                        </form>
                        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                            {globalEvents.map((event) => (
                                <div key={event.id} className="border border-[#1a1a2e]/20 p-3 bg-white">
                                    <div className="flex items-center justify-between">
                                        <div className="font-black text-xs uppercase">{event.name}</div>
                                        <span className="text-[10px] font-black bg-[#1a1a2e] text-[#f5f1e8] px-2 py-1">x{Number(event.multiplier).toFixed(2)}</span>
                                    </div>
                                    <div className="text-[10px] opacity-60 font-bold mt-1">
                                        {new Date(event.startDate).toLocaleString('es-AR')} → {new Date(event.endDate).toLocaleString('es-AR')}
                                    </div>
                                    <div className="flex items-center justify-between mt-2">
                                        <div className="text-[9px] font-black uppercase">{event.isActive === 1 ? 'ACTIVO' : 'INACTIVO'} · PUSH_{event.pushSent === 1 ? 'ENVIADO' : 'NO'}</div>
                                        <form action={handleGlobalEventAction}>
                                            <input type="hidden" name="id" value={event.id} />
                                            <button type="submit" name="action" value="delete" className="text-red-600 text-[10px] font-black uppercase">DELETE</button>
                                        </form>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-8 border-2 border-[#1a1a2e] bg-[#f5f1e8] p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-[#1a1a2e]/10 pb-3">
                        <h3 className="font-black text-xs uppercase tracking-wider">SOCIAL_USERS_INTEL</h3>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase">
                            <span className="bg-[#1a1a2e] text-[#f5f1e8] px-2 py-1">USERS {socialProfilesData.length}</span>
                            <span className="border border-[#1a1a2e]/30 px-2 py-1">GLOBAL_X {activeGlobalMultiplier.toFixed(2)}</span>
                        </div>
                    </div>
                    <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                        {socialProfilesData.map((profile) => {
                            const breakdown = (breakdownByUser[profile.id] || []).sort((a, b) => b.points - a.points);
                            const recent = recentEventsByUser[profile.id] || [];
                            const effectiveMultiplier = Number(profile.streakMultiplier || 1) * activeGlobalMultiplier;
                            return (
                                <details key={profile.id} className="border border-[#1a1a2e]/20 bg-white px-3 py-2 group">
                                    <summary className="list-none cursor-pointer flex flex-wrap items-center justify-between gap-3">
                                        <div className="min-w-[220px]">
                                            <div className="font-black text-sm uppercase tracking-tight">{profile.displayName || profile.username || profile.id}</div>
                                            <div className="text-[10px] opacity-50 font-mono">{profile.id}</div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase">
                                            <span className="bg-[#1a1a2e] text-[#f5f1e8] px-2 py-1">PTS {Number(profile.scoreLifetime || 0)}</span>
                                            <span className="border border-[#1a1a2e]/30 px-2 py-1">STREAK_W {Number(profile.streakWeeks || 0)}</span>
                                            <span className="border border-[#1a1a2e]/30 px-2 py-1">STREAK_X {Number(profile.streakMultiplier || 1).toFixed(2)}</span>
                                            <span className="border border-[#1a1a2e]/30 px-2 py-1">TOTAL_X {effectiveMultiplier.toFixed(2)}</span>
                                        </div>
                                    </summary>
                                    <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        <div className="border border-[#1a1a2e]/10 p-3">
                                            <div className="text-[10px] font-black uppercase mb-2 opacity-70">POINTS_BREAKDOWN</div>
                                            {breakdown.length === 0 ? (
                                                <div className="text-[10px] opacity-40 font-bold">SIN EVENTOS</div>
                                            ) : (
                                                <div className="space-y-1">
                                                    {breakdown.map((item) => (
                                                        <div key={`${profile.id}-${item.eventType}`} className="flex items-center justify-between text-[10px] font-black uppercase">
                                                            <span>{item.eventType}</span>
                                                            <span className="font-mono">+{item.points} ({item.count})</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="border border-[#1a1a2e]/10 p-3">
                                            <div className="text-[10px] font-black uppercase mb-2 opacity-70">RECENT_SCORE_EVENTS</div>
                                            {recent.length === 0 ? (
                                                <div className="text-[10px] opacity-40 font-bold">SIN EVENTOS RECIENTES</div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {recent.map((event, idx) => {
                                                        const meta = (() => {
                                                            if (!event.metadata) return null;
                                                            try {
                                                                return JSON.parse(event.metadata) as Record<string, any>;
                                                            } catch {
                                                                return null;
                                                            }
                                                        })();
                                                        return (
                                                            <div key={`${profile.id}-${idx}`} className="border border-[#1a1a2e]/10 p-2">
                                                                <div className="flex items-center justify-between text-[10px] font-black uppercase">
                                                                    <span>{event.eventType}</span>
                                                                    <span className="font-mono">+{event.pointsAwarded}</span>
                                                                </div>
                                                                <div className="text-[9px] opacity-50 font-mono mt-1">{new Date(event.createdAt).toLocaleString('es-AR')}</div>
                                                                {meta?.reason ? <div className="text-[9px] font-black uppercase mt-1">RAZÓN: {String(meta.reason)}</div> : null}
                                                                {meta?.exerciseName ? <div className="text-[9px] font-black uppercase mt-1">EJERCICIO: {String(meta.exerciseName)}</div> : null}
                                                                {meta?.tempC !== undefined ? <div className="text-[9px] font-black uppercase mt-1">TEMPERATURA: {String(meta.tempC)}°C</div> : null}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </details>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* SECCIÓN 04: MODERACIÓN RUTINAS */}
            <div className="mb-12">
                <div className="flex items-center gap-3 mb-6 border-b border-[#1a1a2e]/10 pb-2">
                    <div className="bg-[#1a1a2e] text-[#f5f1e8] text-[10px] font-black px-2 py-0.5">04</div>
                    <h2 className="text-lg font-black uppercase tracking-tight">PUBLIC_ROUTINES_MODERATION</h2>
                </div>

                <div className="border-2 border-[#1a1a2e] bg-[#f5f1e8] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] border-collapse">
                            <thead>
                                <tr className="border-b-2 border-[#1a1a2e] bg-[#1a1a2e] text-[#f5f1e8]">
                                    <th className="p-4 font-black uppercase tracking-widest">IDENTIFIER</th>
                                    <th className="p-4 font-black uppercase tracking-widest">AUTHOR</th>
                                    <th className="p-4 font-black uppercase tracking-widest">VISIBILITY</th>
                                    <th className="p-4 font-black uppercase tracking-widest text-right">ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1a1a2e]/10">
                                {routinesData.map(r => (
                                    <tr key={r.id} className="hover:bg-[#1a1a2e]/5 transition-colors group">
                                        <td className="p-4">
                                            <div className="font-black uppercase tracking-tighter text-sm mb-1">{r.name}</div>
                                            <div className="opacity-40 flex items-center gap-1 font-mono text-[9px]">
                                                <Hash className="w-2.5 h-2.5" /> {r.id}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-black text-[#1a1a2e] flex items-center gap-1">
                                                <User className="w-3 h-3 opacity-40" /> @{r.username || 'unknown_node'}
                                            </div>
                                            <div className="text-[9px] opacity-40 font-mono mt-1">{r.userId.slice(0, 16)}...</div>
                                        </td>
                                        <td className="p-4">
                                            {r.isPublic ? (
                                                <div className="inline-flex items-center gap-1.5 bg-[#1a1a2e] text-[#f5f1e8] px-2 py-0.5 font-black text-[9px] tracking-widest">
                                                    <Zap className="w-2.5 h-2.5" /> PÚBLICA
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center gap-1.5 border border-[#1a1a2e] px-2 py-0.5 font-black text-[9px] tracking-widest opacity-40">
                                                    <Clock className="w-2.5 h-2.5" /> PRIVADA
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <form action={handleRoutineAction} className="inline-flex flex-col gap-2 items-end">
                                                <input type="hidden" name="id" value={r.id} />
                                                <input type="hidden" name="currentModerated" value={r.isModerated ? '1' : '0'} />

                                                {!r.isModerated && (
                                                    <input
                                                        type="text"
                                                        name="message"
                                                        placeholder="Motivo (opcional)..."
                                                        className="bg-[#1a1a2e]/5 border border-[#1a1a2e]/20 px-2 py-1 text-[9px] w-32 focus:outline-none focus:border-[#1a1a2e]"
                                                    />
                                                )}

                                                {r.moderationMessage && (
                                                    <div className="text-[8px] text-amber-600 font-bold max-w-[120px] leading-tight mb-1 italic">
                                                        "{r.moderationMessage}"
                                                    </div>
                                                )}

                                                <div className="flex gap-2">
                                                    <button
                                                        type="submit"
                                                        name="action"
                                                        value="toggle-moderation"
                                                        className={`h-8 px-3 border border-[#1a1a2e] font-black uppercase text-[9px] transition-all flex items-center gap-2 ${r.isModerated ? 'bg-amber-400 hover:bg-[#1a1a2e] hover:text-[#f5f1e8]' : 'bg-[#f5f1e8] hover:bg-[#1a1a2e] hover:text-[#f5f1e8]'}`}
                                                        title={r.isModerated ? "Mostrar en feed" : "Ocultar en feed"}
                                                    >
                                                        {r.isModerated ? <CheckCircle className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                                        {r.isModerated ? 'HABILITAR' : 'OCULTAR'}
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        name="action"
                                                        value="purge"
                                                        className="h-8 px-3 bg-red-500 text-white font-black uppercase text-[9px] hover:bg-red-600 transition-all flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                                        title="Eliminar permanentemente"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" /> PURGA
                                                    </button>
                                                </div>
                                            </form>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* SECCIÓN 05: CHANGELOG MANAGER */}
            <div className="mb-12">
                <div className="mb-6 border-b border-[#1a1a2e]/10 pb-3">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="bg-[#1a1a2e] text-[#f5f1e8] text-[10px] font-black px-2 py-0.5">05</div>
                            <h2 className="text-lg font-black uppercase tracking-tight">CHANGELOG_SYSTEM_MGMT</h2>
                        </div>
                        <form action={handleChangelogSyncAction}>
                            <button
                                type="submit"
                                className="w-full md:w-auto h-9 px-4 bg-[#1a1a2e] text-[#f5f1e8] font-black uppercase text-[10px] tracking-wide hover:bg-orange-500 transition-colors flex items-center justify-center gap-2"
                            >
                                <Zap className="w-3.5 h-3.5" />
                                FORZAR_SYNC_DB
                            </button>
                        </form>
                    </div>
                    {changelogSyncStatus && (
                        <div className={`mt-3 border px-3 py-2 text-[10px] font-black uppercase tracking-wide flex flex-wrap items-center gap-2 ${changelogSyncStatus === 'synced' ? 'bg-green-100 border-green-600 text-green-900' : changelogSyncStatus === 'min_interval' ? 'bg-amber-100 border-amber-600 text-amber-900' : 'bg-[#1a1a2e]/5 border-[#1a1a2e]/30 text-[#1a1a2e]'}`}>
                            <span>SYNC_STATUS: {changelogSyncStatus}</span>
                            <span>UPSERTED: {changelogUpserted}</span>
                            <span>SOURCE: {changelogSource}</span>
                            {changelogSyncedAt ? <span>AT: {new Date(changelogSyncedAt).toLocaleString('es-AR')}</span> : null}
                        </div>
                    )}
                    <div className="mt-3 border border-[#1a1a2e]/20 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wide flex flex-wrap items-center gap-2">
                        <span>LAST_DB_SYNC:</span>
                        <span>{lastChangelogDbSyncAt ? new Date(lastChangelogDbSyncAt).toLocaleString('es-AR') : 'N/A'}</span>
                        <span>VERSIONS_DB: {changelogsData.length}</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Create Form */}
                    <div className="border-2 border-[#1a1a2e] p-6 bg-[#f5f1e8]">
                        <h3 className="font-black text-xs uppercase mb-4 border-b border-[#1a1a2e]/10 pb-2">
                            {editingChangelog ? 'EDIT_VERSION' : 'PUB_NEW_VERSION'}
                        </h3>
                        <form action={handleChangelogAction} className="space-y-4">
                            <input type="hidden" name="id" value={editingChangelog?.id || ''} />
                            <div>
                                <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Version_Tag</label>
                                <input name="version" defaultValue={editingChangelog?.version || ''} placeholder="e.g. 1.2.0" className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#1a1a2e]" required />
                            </div>
                            <div>
                                <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Change_Items (1 per line)</label>
                                <textarea name="items" defaultValue={editingChangelog?.items.join('\n') || ''} rows={5} placeholder="- Feature X&#10;- Fix Y" className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#1a1a2e]" required />
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" name="isUnreleased" value="true" id="unreleased" defaultChecked={editingChangelog?.isUnreleased === 1} />
                                <label htmlFor="unreleased" className="text-[10px] font-black uppercase">Unreleased_Draft</label>
                            </div>
                            <button type="submit" name="action" value="save" className="w-full bg-[#1a1a2e] text-[#f5f1e8] py-3 font-black uppercase text-[10px] hover:bg-orange-500 transition-colors">
                                {editingChangelog ? 'UPDATE_VERSION' : 'PUSH_TO_CENTRAL'}
                            </button>
                            {editingChangelog && (
                                <a href="/admin" className="block text-center text-[10px] font-black uppercase opacity-40 hover:opacity-100 mt-2 underline">CANCEL_EDIT</a>
                            )}
                        </form>
                    </div>

                    {/* List */}
                    <div className="lg:col-span-2 border-2 border-[#1a1a2e] overflow-hidden flex flex-col">
                        <div className="max-h-[500px] overflow-y-auto">
                            <table className="w-full text-[11px] border-collapse">
                                <thead>
                                    <tr className="bg-[#1a1a2e] text-[#f5f1e8]">
                                        <th className="p-3 text-left font-black tracking-widest uppercase">MANIFEST</th>
                                        <th className="p-3 text-left font-black tracking-widest uppercase">CHANGES</th>
                                        <th className="p-3 text-right font-black tracking-widest uppercase">OPS</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#1a1a2e]/10">
                                    {changelogs.map(c => (
                                        <tr key={c.id} className="hover:bg-white transition-colors">
                                            <td className="p-3 align-top">
                                                <div className="font-black text-sm">v{c.version}</div>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {c.isUnreleased ? (
                                                        <span className="text-[8px] bg-amber-400 px-1 font-black underline decoration-2">DRAFT</span>
                                                    ) : (
                                                        <span className="text-[8px] bg-green-400 px-1 font-black">LIVE</span>
                                                    )}
                                                    <span className="text-[8px] bg-white border border-[#1a1a2e] px-1 font-black">🔥 {c.kudos} KUDOS</span>
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <ul className="list-disc list-inside opacity-60">
                                                    {c.items.map((item, i) => (
                                                        <li key={i}>{item}</li>
                                                    ))}
                                                </ul>
                                            </td>
                                            <td className="p-3 text-right">
                                                <div className="flex items-center justify-end gap-3">
                                                    <a href={`?editChangelogId=${c.id}`} className="text-[#1a1a2e] opacity-40 hover:opacity-100 transition-opacity">
                                                        EDIT
                                                    </a>
                                                    <form action={handleChangelogAction}>
                                                        <input type="hidden" name="id" value={c.id} />
                                                        <button type="submit" name="action" value="delete" className="text-red-500 hover:text-red-700 block">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </form>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* SECCIÓN 06: NOTIF CENTER */}
            <div className="mb-12">
                <div className="flex items-center gap-3 mb-6 border-b border-[#1a1a2e]/10 pb-2">
                    <div className="bg-[#1a1a2e] text-[#f5f1e8] text-[10px] font-black px-2 py-0.5">06</div>
                    <h2 className="text-lg font-black uppercase tracking-tight">PUSH_CENTER_BROADCAST</h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Create Notification Form */}
                    <div className="border-2 border-[#1a1a2e] p-6 bg-[#f5f1e8]">
                        <h3 className="font-black text-xs uppercase mb-4 border-b border-[#1a1a2e]/10 pb-2">
                            {editingNotification ? 'EDIT_BROADCAST' : 'CREATE_BROADCAST'}
                        </h3>
                        <form action={handleNotificationAction} className="space-y-4">
                            <input type="hidden" name="id" value={editingNotification?.id || ''} />
                            <div>
                                <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Title</label>
                                <input name="title" defaultValue={editingNotification?.title || ''} className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none" required />
                            </div>
                            <div>
                                <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Message</label>
                                <textarea name="message" defaultValue={editingNotification?.message || ''} rows={3} className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none" required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Type</label>
                                    <select name="type" defaultValue={editingNotification?.type || 'toast'} className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none">
                                        <option value="toast">Toast (Small)</option>
                                        <option value="modal">Modal (Large)</option>
                                        <option value="system">System (Push)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Display_Mode</label>
                                    <select name="displayMode" defaultValue={editingNotification?.displayMode || 'once'} className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none">
                                        <option value="once">Once</option>
                                        <option value="always">Always</option>
                                        <option value="until_closed">Until Closed</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Priority</label>
                                    <select name="priority" defaultValue={editingNotification?.priority || 'normal'} className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none">
                                        <option value="low">Low</option>
                                        <option value="normal">Normal</option>
                                        <option value="high">High</option>
                                        <option value="critical">Critical</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Platform</label>
                                    <select name="targetPlatform" defaultValue={editingNotification?.targetPlatform || 'all'} className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none">
                                        <option value="all">All</option>
                                        <option value="android">Android</option>
                                        <option value="ios">iOS</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Segment</label>
                                    <select name="targetSegment" defaultValue={editingNotification?.targetSegment || 'all'} className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none">
                                        <option value="all">All Users</option>
                                        <option value="premium">Premium Only</option>
                                        <option value="active">Active (last 7d)</option>
                                        <option value="inactive">Inactive (14d+)</option>
                                        <option value="new">New Users (7d)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Version (Optional)</label>
                                    <input name="targetVersion" defaultValue={editingNotification?.targetVersion || ''} placeholder="e.g. 1.2.0" className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="text-[9px] font-black opacity-40 uppercase block mb-1">Action URL (Optional)</label>
                                    <input name="actionUrl" defaultValue={editingNotification?.metadata ? JSON.parse(editingNotification.metadata).actionUrl : ''} placeholder="irontrain://settings or https://..." className="w-full bg-white border border-[#1a1a2e] p-2 text-xs font-bold focus:outline-none" />
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" name="isActive" value="true" id="active" defaultChecked={editingNotification?.isActive !== 0} />
                                <label htmlFor="active" className="text-[10px] font-black uppercase">Live_Status</label>
                            </div>
                            <button type="submit" name="action" value="save" className="w-full bg-[#1a1a2e] text-orange-400 py-3 font-black uppercase text-[10px] hover:bg-orange-500 hover:text-[#1a1a2e] transition-colors flex items-center justify-center gap-2">
                                <Zap className="w-4 h-4" /> {editingNotification ? 'UPDATE_BROADCAST' : 'FIRE_BROADCAST'}
                            </button>
                            {editingNotification && (
                                <a href="/admin" className="block text-center text-[10px] font-black uppercase opacity-40 hover:opacity-100 mt-2 underline">CANCEL_EDIT</a>
                            )}
                        </form>
                    </div>

                    {/* Active Notifications */}
                    <div className="lg:col-span-2 border-2 border-[#1a1a2e] overflow-hidden flex flex-col">
                        <div className="max-h-[500px] overflow-y-auto">
                            <table className="w-full text-[11px] border-collapse">
                                <thead>
                                    <tr className="bg-[#1a1a2e] text-[#f5f1e8]">
                                        <th className="p-3 text-left font-black tracking-widest uppercase">BROADCAST</th>
                                        <th className="p-3 text-left font-black tracking-widest uppercase">CONFIG</th>
                                        <th className="p-3 text-right font-black tracking-widest uppercase">OPS</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#1a1a2e]/10">
                                    {adminNotifications.map(n => (
                                        <tr key={n.id} className="hover:bg-white transition-colors">
                                            <td className="p-3 align-top">
                                                <div className="font-black text-sm uppercase tracking-tighter">{n.title}</div>
                                                <p className="opacity-60 text-[10px] mt-1">{n.message}</p>
                                            </td>
                                            <td className="p-3 align-top">
                                                <div className="flex flex-wrap gap-1">
                                                    <span className={`text-[8px] px-1 font-black uppercase ${n.priority === 'critical' ? 'bg-red-600 text-white' : n.priority === 'high' ? 'bg-orange-600 text-white' : 'bg-[#1a1a2e] text-[#f5f1e8]'}`}>
                                                        {n.type}_{n.priority}
                                                    </span>
                                                    <span className="text-[8px] border border-[#1a1a2e] px-1 font-black uppercase">{n.displayMode}</span>
                                                    {n.isActive ? (
                                                        <span className="text-[8px] bg-green-400 px-1 font-black">ACTIVE</span>
                                                    ) : (
                                                        <span className="text-[8px] bg-red-400 px-1 font-black">INACTIVE</span>
                                                    )}
                                                    <span className="text-[8px] bg-blue-100 text-blue-700 px-1 font-black border border-blue-200">
                                                        {n.targetPlatform || 'all'}
                                                    </span>
                                                    <span className="text-[8px] bg-purple-100 text-purple-700 px-1 font-black border border-purple-200">
                                                        SEG: {n.targetSegment || 'all'}
                                                    </span>
                                                    <span className="text-[8px] bg-white border border-[#1a1a2e] px-1 font-black shadow-[1px_1px_0px_0px_rgba(26,26,46,1)]">
                                                        🔥 {n.reactionCount || 0} KUDOS
                                                    </span>
                                                </div>
                                                <div className="mt-2 grid grid-cols-2 gap-2 border-t border-[#1a1a2e]/5 pt-2">
                                                    <div className="text-[10px] font-black">
                                                        <span className="opacity-40">SEEN_</span>{getNotifStats(n.id).seen}
                                                    </div>
                                                    <div className="text-[10px] font-black">
                                                        <span className="opacity-40">CLCK_</span>{getNotifStats(n.id).clicked}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-3 text-right">
                                                <div className="flex items-center justify-end gap-3">
                                                    <a href={`?editNotifId=${n.id}`} className="text-[#1a1a2e] opacity-40 hover:opacity-100 transition-opacity">
                                                        EDIT
                                                    </a>
                                                    <form action={handleNotificationAction}>
                                                        <input type="hidden" name="id" value={n.id} />
                                                        <button type="submit" name="action" value="delete" className="text-red-500 hover:text-red-700 block">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </form>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* SECCIÓN 04: FEEDBACK */}
            <div className="mb-20">
                <div className="flex items-center gap-3 mb-6 border-b border-[#1a1a2e]/10 pb-2">
                    <div className="bg-[#1a1a2e] text-[#f5f1e8] text-[10px] font-black px-2 py-0.5">04</div>
                    <h2 className="text-lg font-black uppercase tracking-tight">SYSTEM_REPORTS_FEEDBACK</h2>
                </div>

                <div className="border border-[#1a1a2e] bg-[#f5f1e8] shadow-[4px_4px_0px_0px_rgba(26,26,46,0.05)]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] border-collapse">
                            <thead>
                                <tr className="border-b border-[#1a1a2e] bg-[#1a1a2e]/5">
                                    <th className="p-4 font-black uppercase tracking-widest opacity-60">TYPE</th>
                                    <th className="p-4 font-black uppercase tracking-widest opacity-60">CONTENT_LOG</th>
                                    <th className="p-4 font-black uppercase tracking-widest opacity-60">STATUS</th>
                                    <th className="p-4 font-black uppercase tracking-widest opacity-60 text-right">FLOW</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1a1a2e]/10">
                                {feedbackRows.map(f => (
                                    <tr key={f.id} className="hover:bg-white transition-colors">
                                        <td className="p-4">
                                            <div className={`inline-block px-1.5 py-0.5 font-black text-[9px] uppercase tracking-tighter ${f.type === 'bug' ? 'bg-red-100 text-red-600' :
                                                f.type === 'feature_request' ? 'bg-orange-100 text-orange-600' :
                                                    'bg-blue-100 text-blue-600'
                                                }`}>
                                                {f.type}
                                            </div>
                                        </td>
                                        <td className="p-4 max-w-lg">
                                            <p className="font-bold leading-tight uppercase tracking-tight text-[#1a1a2e]">{f.message}</p>
                                            <div className="mt-2 text-[10px] font-black uppercase tracking-wide flex flex-wrap items-center gap-2">
                                                <span className="border border-[#1a1a2e]/20 bg-white px-1.5 py-0.5">FROM: {f.senderName}</span>
                                                {f.metadata?.subject ? <span className="border border-[#1a1a2e]/20 bg-white px-1.5 py-0.5">SUBJECT: {String(f.metadata.subject)}</span> : null}
                                                {f.metadata?.platform ? <span className="border border-[#1a1a2e]/20 bg-white px-1.5 py-0.5">PLATFORM: {String(f.metadata.platform)}</span> : null}
                                                {f.metadata?.appVersion ? <span className="border border-[#1a1a2e]/20 bg-white px-1.5 py-0.5">APP: {String(f.metadata.appVersion)}</span> : null}
                                                {f.metadata?.contactEmail ? <span className="border border-[#1a1a2e]/20 bg-white px-1.5 py-0.5">CONTACT: {String(f.metadata.contactEmail)}</span> : null}
                                            </div>
                                            <div className="text-[9px] opacity-30 mt-2 font-mono flex items-center gap-1">
                                                <Clock className="w-2.5 h-2.5" /> {new Date(f.createdAt).toISOString()}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {f.status === 'open' ? (
                                                <div className="text-orange-500 font-black animate-pulse flex items-center gap-1">
                                                    <Activity className="w-3 h-3" /> PENDIENTE_X
                                                </div>
                                            ) : (
                                                <div className="text-[#1a1a2e] opacity-40 font-black flex items-center gap-1">
                                                    <Check className="w-3 h-3" /> ARCHIVADO
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <form action={markFeedbackStatus}>
                                                <input type="hidden" name="id" value={f.id} />
                                                <input type="hidden" name="status" value={f.status === 'open' ? 'resolved' : 'open'} />
                                                <button type="submit" className="border border-[#1a1a2e] px-4 py-1 font-black text-[9px] hover:bg-[#1a1a2e] hover:text-[#f5f1e8] transition-all uppercase">
                                                    {f.status === 'open' ? '→ RESOLVER' : '→ REABRIR'}
                                                </button>
                                            </form>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <footer className="mt-24 text-center pb-12 border-t border-[#1a1a2e] pt-12">
                <div className="text-[10px] opacity-40 font-bold tracking-[0.3em] uppercase mb-4">
                    IRONTRAIN CORE ● ENTERPRISE SECURITY & MODERATION
                </div>
                <div className="text-[9px] opacity-20 font-mono">
                    BUILD 2026.03.05_V2 ● POWERED_BY_MOTIONA_ZERO_TRUST
                </div>
            </footer>
        </div>
    );
}
