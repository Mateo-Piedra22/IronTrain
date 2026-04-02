import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { Shield } from 'lucide-react';
import { Suspense } from 'react';
import { db } from '../../src/db';
import * as schema from '../../src/db/schema';
import { getSyncHealthReport } from '../../src/lib/sync-health';
import { getAuthenticatedAdmin } from './actions';

// New Components
import AdminTabs from './components/AdminTabs';
import AnalyticsPanel from './components/AnalyticsPanel';
import CommunityModerationPanel from './components/CommunityModerationPanel';
import ContentManagementPanel from './components/ContentManagementPanel';
import IronSocialPanel from './components/IronSocialPanel';
import MarketplaceManagementPanel from './components/MarketplaceManagementPanel';
import PostHogGuidePanel from './components/PostHogGuidePanel';
import SyncWorkoutsPanel from './components/SyncWorkoutsPanel';
import SystemStatusPanel from './components/SystemStatusPanel';
import ThemesModerationPanel from './components/ThemesModerationPanel';

export const revalidate = 0;
export const runtime = 'nodejs';

function toDateSafe(value: unknown): Date | null {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
}

function toIsoSafe(value: unknown): string | null {
    const d = toDateSafe(value);
    return d ? d.toISOString() : null;
}

const ISO_EPOCH_FALLBACK = new Date(0).toISOString();

interface AdminPageProps {
    params: Promise<any>;
    searchParams: Promise<{
        tab?: string;
        source?: 'all' | 'system' | 'community';
        editNotifId?: string;
        editChangelogId?: string;
        editEventId?: string;
        changelogSyncStatus?: string;
        changelogUpserted?: string;
        changelogSource?: string;
        changelogSyncedAt?: string;
        editId?: string;
        editType?: 'exercises' | 'categories' | 'badges';
        workoutsPage?: string;
        leaderboardPage?: string;
    }>;
}

export default async function AdminPage({
    searchParams,
}: AdminPageProps) {
    const adminId = await getAuthenticatedAdmin();

    if (!adminId) {
        // Simple unauthorized view or redirect
        return (
            <div className="h-screen flex items-center justify-center bg-[#f5f1e8] font-mono">
                <div className="border-4 border-[#1a1a2e] p-12 bg-white text-center shadow-[12px_12px_0px_0px_rgba(26,26,46,1)]">
                    <Shield className="w-16 h-16 mx-auto mb-6 text-red-600" />
                    <h1 className="text-4xl font-black uppercase mb-4 tracking-tighter">ACCESS_DENIED</h1>
                    <p className="text-xs font-black opacity-40 uppercase tracking-widest leading-relaxed">
                        SOLO_PERSONAL_AUTORIZADO<br />
                        PROTOCOL_ZERO_TRUST_ACTIVE
                    </p>
                </div>
            </div>
        );
    }

    // 0. Resolve parameters
    const params = await searchParams;
    const activeTab = (params.tab as 'status' | 'social' | 'content' | 'moderation' | 'themes-moderation' | 'marketplace' | 'sync' | 'analytics' | 'posthog') || 'status';
    const themeSourceFilter = (params.source as 'all' | 'system' | 'community') || 'all';

    const {
        editNotifId,
        editChangelogId,
        editEventId,
        changelogSyncStatus,
        changelogUpserted,
        changelogSource,
        changelogSyncedAt,
        editId,
        editType,
        workoutsPage: wPageStr,
        leaderboardPage: lPageStr
    } = params;

    const workoutsPage = Math.max(1, Number(wPageStr) || 1);
    const workoutsPageSize = 50;
    const workoutsOffset = (workoutsPage - 1) * workoutsPageSize;

    const leaderboardPage = Math.max(1, Number(lPageStr) || 1);
    const leaderboardPageSize = 30;
    const leaderboardOffset = (leaderboardPage - 1) * leaderboardPageSize;

    // 1. Core Data (Always needed or lightweight)
    const [
        totalWorkoutsResult,
        totalProfilesResult,
    ] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(schema.workouts),
        db.select({ count: sql<number>`count(*)` }).from(schema.userProfiles),
    ]);

    const totalWorkouts = Number(totalWorkoutsResult[0]?.count || 0);
    const totalProfiles = Number(totalProfilesResult[0]?.count || 0);
    const pendingFeedbackCount = 0; // Removed custom feedback table

    // 2. Conditional Panel Data
    let routinesData: any[] = [];
    let changelogsRaw: any[] = [];
    let changelogReactionsResult: any[] = [];
    let scoringConfigData: any[] = [];
    let globalEventsData: any[] = [];
    let leaderboardData: any[] = [];
    let syncHealth = null;
    let officialExercisesRaw: any[] = [];
    let officialCategoriesRaw: any[] = [];
    let officialBadgesRaw: any[] = [];
    let workoutsForSyncPanel: any[] = [];
    let themeModerationPacksRaw: any[] = [];
    let themeModerationReportsRaw: any[] = [];

    if (activeTab === 'status') {
        syncHealth = await getSyncHealthReport();
    } else if (activeTab === 'sync') {
        workoutsForSyncPanel = await db.select({
            id: schema.workouts.id,
            userId: schema.workouts.userId,
            username: schema.userProfiles.username,
            status: schema.workouts.status,
            date: schema.workouts.date,
            startTime: schema.workouts.startTime,
            endTime: schema.workouts.endTime,
            updatedAt: schema.workouts.updatedAt,
            deletedAt: schema.workouts.deletedAt,
            setCount: sql<number>`count(${schema.workoutSets.id})`,
        })
            .from(schema.workouts)
            .leftJoin(schema.workoutSets, eq(schema.workoutSets.workoutId, schema.workouts.id))
            .leftJoin(schema.userProfiles, eq(schema.userProfiles.id, schema.workouts.userId))
            .groupBy(schema.workouts.id, schema.userProfiles.username)
            .orderBy(desc(schema.workouts.updatedAt))
            .limit(workoutsPageSize)
            .offset(workoutsOffset);
    } else if (activeTab === 'social') {
        const [scoring, events, leaderboard] = await Promise.all([
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
            }).from(schema.userProfiles)
                .orderBy(desc(schema.userProfiles.scoreLifetime))
                .limit(leaderboardPageSize)
                .offset(leaderboardOffset),
        ]);
        scoringConfigData = scoring;
        globalEventsData = events;
        leaderboardData = leaderboard;
    } else if (activeTab === 'content') {
        const [logs, cReactions, events] = await Promise.all([
            db.select().from(schema.changelogs).orderBy(desc(schema.changelogs.version)),
            db.select({
                changelogId: schema.changelogReactions.changelogId,
                count: sql<number>`count(*)`
            }).from(schema.changelogReactions)
                .where(isNull(schema.changelogReactions.deletedAt))
                .groupBy(schema.changelogReactions.changelogId),
            db.select().from(schema.globalEvents).orderBy(desc(schema.globalEvents.startDate)),
        ]);
        changelogsRaw = logs;
        changelogReactionsResult = cReactions;
        globalEventsData = events;
    } else if (activeTab === 'moderation') {
        const [routines] = await Promise.all([
            db.select({
                id: schema.routines.id,
                name: schema.routines.name,
                userId: schema.routines.userId,
                isPublic: schema.routines.isPublic,
                isModerated: schema.routines.isModerated,
                moderationMessage: schema.routines.moderationMessage,
                updatedAt: schema.routines.updatedAt,
                username: schema.userProfiles.username,
            })
                .from(schema.routines)
                .leftJoin(schema.userProfiles, eq(schema.routines.userId, schema.userProfiles.id))
                .where(isNull(schema.routines.deletedAt))
                .orderBy(desc(schema.routines.updatedAt))
                .limit(100),
        ]);
        routinesData = routines;
    } else if (activeTab === 'marketplace') {
        const [exercises, categories, badges] = await Promise.all([
            db.query.exercises.findMany({
                where: eq(schema.exercises.isSystem, 1),
                with: { badges: true }
            }),
            db.select().from(schema.categories).where(eq(schema.categories.isSystem, 1)),
            db.select().from(schema.badges).where(eq(schema.badges.isSystem, 1)),
        ]);
        officialExercisesRaw = exercises;
        officialCategoriesRaw = categories;
        officialBadgesRaw = badges;
    } else if (activeTab === 'themes-moderation') {
        const sourceFilterSql = themeSourceFilter === 'system'
            ? eq(schema.themePacks.isSystem, true)
            : themeSourceFilter === 'community'
                ? eq(schema.themePacks.isSystem, false)
                : sql`1=1`;

        const [packs, reports] = await Promise.all([
            db.select({
                id: schema.themePacks.id,
                slug: schema.themePacks.slug,
                ownerId: schema.themePacks.ownerId,
                ownerUsername: schema.userProfiles.username,
                name: schema.themePacks.name,
                isSystem: schema.themePacks.isSystem,
                visibility: schema.themePacks.visibility,
                status: schema.themePacks.status,
                moderationMessage: schema.themePacks.moderationMessage,
                downloadsCount: schema.themePacks.downloadsCount,
                appliesCount: schema.themePacks.appliesCount,
                ratingAvg: schema.themePacks.ratingAvg,
                ratingCount: schema.themePacks.ratingCount,
                createdAt: schema.themePacks.createdAt,
                updatedAt: schema.themePacks.updatedAt,
            })
                .from(schema.themePacks)
                .leftJoin(schema.userProfiles, eq(schema.userProfiles.id, schema.themePacks.ownerId))
                .where(
                    and(
                        isNull(schema.themePacks.deletedAt),
                        sourceFilterSql,
                        sql`${schema.themePacks.status} in ('pending_review', 'approved', 'rejected', 'suspended')`,
                    ),
                )
                .orderBy(desc(schema.themePacks.updatedAt))
                .limit(200),
            db.select({
                id: schema.themePackReports.id,
                themePackId: schema.themePackReports.themePackId,
                reporterUserId: schema.themePackReports.reporterUserId,
                reason: schema.themePackReports.reason,
                details: schema.themePackReports.details,
                status: schema.themePackReports.status,
                createdAt: schema.themePackReports.createdAt,
                updatedAt: schema.themePackReports.updatedAt,
                themeSlug: schema.themePacks.slug,
                themeName: schema.themePacks.name,
                themeStatus: schema.themePacks.status,
                themeIsSystem: schema.themePacks.isSystem,
                ownerId: schema.themePacks.ownerId,
            })
                .from(schema.themePackReports)
                .innerJoin(schema.themePacks, eq(schema.themePacks.id, schema.themePackReports.themePackId))
                .where(
                    and(
                        isNull(schema.themePacks.deletedAt),
                        sourceFilterSql,
                        sql`${schema.themePackReports.status} in ('open', 'resolved', 'dismissed')`,
                    ),
                )
                .orderBy(desc(schema.themePackReports.createdAt))
                .limit(200),
        ]);

        themeModerationPacksRaw = packs;
        themeModerationReportsRaw = reports;
    }

    // Secondary Fetch: Targeted Analytics for current leaderboard page
    const visibleUserIds = leaderboardData.map(u => u.id);
    const [scoreBreakdownRows, recentScoreEvents] = visibleUserIds.length > 0 ? await Promise.all([
        db.select({
            userId: schema.scoreEvents.userId,
            eventType: schema.scoreEvents.eventType,
            count: sql<number>`count(*)`,
            points: sql<number>`sum(${schema.scoreEvents.pointsAwarded})`,
        })
            .from(schema.scoreEvents)
            .where(sql`${schema.scoreEvents.userId} IN ${visibleUserIds}`) // Using generic SQL for inArray compatibility if needed
            .groupBy(schema.scoreEvents.userId, schema.scoreEvents.eventType),
        db.select({
            userId: schema.scoreEvents.userId,
            eventType: schema.scoreEvents.eventType,
            pointsAwarded: schema.scoreEvents.pointsAwarded,
            metadata: schema.scoreEvents.metadata,
            createdAt: schema.scoreEvents.createdAt,
        })
            .from(schema.scoreEvents)
            .where(sql`${schema.scoreEvents.userId} IN ${visibleUserIds}`)
            .orderBy(desc(schema.scoreEvents.createdAt))
            .limit(500), // Limit total recent events for the page
    ]) : [[], []];

    // Data Transformation
    const changelogs = (changelogsRaw || []).map(c => ({
        ...c,
        items: (c.items || []) as string[],
        kudos: (changelogReactionsResult as any[] || []).find((r: any) => r.changelogId === c.id)?.count || 0
    }));

    const breakdownByUser = scoreBreakdownRows.reduce<Record<string, any[]>>((acc, row) => {
        if (!acc[row.userId]) acc[row.userId] = [];
        acc[row.userId].push({ eventType: row.eventType, count: Number(row.count), points: Number(row.points) });
        return acc;
    }, {});

    const recentEventsByUser = recentScoreEvents.reduce<Record<string, any[]>>((acc, row) => {
        if (!acc[row.userId]) acc[row.userId] = [];
        if (acc[row.userId].length < 5) acc[row.userId].push(row);
        return acc;
    }, {});

    const scoreConfig = (scoringConfigData as any)?.[0] ?? {
        workoutCompletePoints: 20,
        extraDayPoints: 10,
        weatherBonusEnabled: true,
        coldThresholdC: 3,
    };

    const now = new Date();
    const metrics = {
        installs: 0, // Migrado a PostHog
        users: totalProfiles,
        activeEvents: globalEventsData.length > 0 ? globalEventsData.filter((e) => {
            if (e.isActive !== true) return false;
            const start = toDateSafe((e as any)?.startDate);
            const end = toDateSafe((e as any)?.endDate);
            if (!start || !end) return false;
            return start <= now && end >= now;
        }).length : 0,
        pendingFeedback: pendingFeedbackCount,
    };

    const lastChangelogSync = changelogsRaw.reduce<Date | null>((latest, row) => {
        const updated = toDateSafe((row as any)?.updatedAt);
        if (!updated) return latest;
        if (!latest) return updated;
        return updated > latest ? updated : latest;
    }, null);

    const currentDateDisplay = new Date().toLocaleDateString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    // Convert all dates to strings for safe serialization to client components
    const sanitizedChangelogs = changelogs.map(c => ({
        ...c,
        date: toIsoSafe((c as any)?.date),
        createdAt: toIsoSafe((c as any)?.createdAt),
        updatedAt: toIsoSafe((c as any)?.updatedAt),
    }));

    const sanitizedGlobalEvents = globalEventsData.map(e => ({
        ...e,
        startDate: toIsoSafe((e as any)?.startDate) ?? ISO_EPOCH_FALLBACK,
        endDate: toIsoSafe((e as any)?.endDate) ?? ISO_EPOCH_FALLBACK,
        createdAt: toIsoSafe((e as any)?.createdAt),
        updatedAt: toIsoSafe((e as any)?.updatedAt),
    }));

    const sanitizedRoutines = routinesData.map(r => ({
        ...r,
        updatedAt: toIsoSafe((r as any)?.updatedAt),
    }));

    const sanitizedLeaderboard = leaderboardData.map(p => ({
        ...p,
        updatedAt: toIsoSafe((p as any)?.updatedAt),
    }));

    const sanitizedBreakdown = Object.fromEntries(
        Object.entries(breakdownByUser).map(([uid, items]) => [uid, items])
    );

    const sanitizedRecent = Object.fromEntries(
        Object.entries(recentEventsByUser).map(([uid, events]) => [
            uid,
            events.map(e => ({
                ...e,
                createdAt: toIsoSafe((e as any)?.createdAt),
                updatedAt: toIsoSafe((e as any)?.updatedAt),
            }))
        ])
    );

    const sanitizedOfficialExercises = (officialExercisesRaw || []).map(e => ({
        ...e,
        updatedAt: toIsoSafe((e as any)?.updatedAt),
    }));

    const sanitizedOfficialCategories = (officialCategoriesRaw || []).map(c => ({
        ...c,
        updatedAt: toIsoSafe((c as any)?.updatedAt),
    }));

    const sanitizedOfficialBadges = (officialBadgesRaw || []).map(b => ({
        ...b,
        updatedAt: toIsoSafe((b as any)?.updatedAt),
    }));

    const sanitizedWorkoutsForSync = (workoutsForSyncPanel || []).map((w) => ({
        id: w.id,
        userId: w.userId,
        username: w.username ?? null,
        status: w.status ?? null,
        date: Number(w.date),
        startTime: Number(w.startTime),
        endTime: w.endTime === null || w.endTime === undefined ? null : Number(w.endTime),
        updatedAt: toIsoSafe((w as any)?.updatedAt) ?? ISO_EPOCH_FALLBACK,
        deletedAt: toIsoSafe((w as any)?.deletedAt),
        setCount: Number(w.setCount || 0),
    }));

    const sanitizedThemesModeration = (themeModerationPacksRaw || []).map((item) => ({
        ...item,
        ratingAvg: Number(item.ratingAvg || 0),
        ratingCount: Number(item.ratingCount || 0),
        downloadsCount: Number(item.downloadsCount || 0),
        appliesCount: Number(item.appliesCount || 0),
        createdAt: toIsoSafe((item as any)?.createdAt),
        updatedAt: toIsoSafe((item as any)?.updatedAt),
    }));

    const sanitizedThemeReportsModeration = (themeModerationReportsRaw || []).map((item) => ({
        ...item,
        createdAt: toIsoSafe((item as any)?.createdAt),
        updatedAt: toIsoSafe((item as any)?.updatedAt),
    }));

    return (
        <div className="min-h-screen bg-[#f5f1e8] text-[#1a1a2e] font-mono p-4 md:p-8 selection:bg-[#1a1a2e] selection:text-[#f5f1e8]">
            <header className="mb-12 border-b-2 border-[#1a1a2e] pb-8">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-[#1a1a2e] p-3 text-[#f5f1e8]">
                            <Shield className="w-8 h-8" />
                        </div>
                        <div>
                            <div className="text-[10px] opacity-60 tracking-[0.2em] mb-1">[ IRONTRAIN COMMAND CENTER ]</div>
                            <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase leading-none">ADMIN_X_V2</h1>
                            <p className="text-[10px] opacity-40 mt-2 font-bold tracking-wider flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-green-500 animate-pulse"></span>
                                SYSTEM_STATUS: OPERATIONAL_ZERO_TRUST • {currentDateDisplay}
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <Suspense fallback={
                <div className="p-8 border-4 border-[#1a1a2e] bg-white animate-pulse">
                    <div className="flex gap-4 mb-8">
                        {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-10 w-32 bg-[#1a1a2e]/10 border-2 border-[#1a1a2e]/20" />)}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="h-64 bg-[#1a1a2e]/5 border-2 border-[#1a1a2e]/10" />
                        <div className="h-64 bg-[#1a1a2e]/5 border-2 border-[#1a1a2e]/10" />
                    </div>
                </div>
            }>
                <AdminTabs
                    statusPanel={
                        <SystemStatusPanel
                            metrics={metrics}
                            syncHealth={syncHealth}
                        />
                    }
                    syncPanel={
                        <SyncWorkoutsPanel
                            workouts={sanitizedWorkoutsForSync}
                            pagination={{
                                currentPage: workoutsPage,
                                totalPages: Math.ceil(totalWorkouts / workoutsPageSize),
                                totalItems: totalWorkouts
                            }}
                        />
                    }
                    socialPanel={
                        <IronSocialPanel
                            scoreConfig={scoreConfig}
                            globalEvents={sanitizedGlobalEvents}
                            leaderboard={sanitizedLeaderboard}
                            breakdownByUser={sanitizedBreakdown}
                            recentEventsByUser={sanitizedRecent}
                            pagination={{
                                currentPage: leaderboardPage,
                                totalPages: Math.ceil(totalProfiles / leaderboardPageSize),
                                totalItems: totalProfiles
                            }}
                        />
                    }
                    contentPanel={
                        <ContentManagementPanel
                            changelogs={sanitizedChangelogs}
                            notifications={[]}
                            globalEvents={sanitizedGlobalEvents}
                            editingChangelog={editChangelogId ? (sanitizedChangelogs.find(c => c.id === editChangelogId) ?? null) : null}
                            editingNotification={null}
                            editingGlobalEvent={editEventId ? (sanitizedGlobalEvents.find(e => e.id === editEventId) ?? null) : null}
                            syncStatus={{
                                lastSyncAt: toIsoSafe(lastChangelogSync),
                                totalInDb: sanitizedChangelogs.length,
                                syncStatus: changelogSyncStatus || null,
                                upsertedCount: changelogUpserted || null,
                                sourceCount: changelogSource || null,
                                syncedAt: changelogSyncedAt || null
                            }}
                        />
                    }
                    moderationPanel={
                        <CommunityModerationPanel
                            routines={sanitizedRoutines}
                        />
                    }
                    themesModerationPanel={
                        <ThemesModerationPanel
                            themes={sanitizedThemesModeration}
                            reports={sanitizedThemeReportsModeration}
                        />
                    }
                    marketplacePanel={
                        <MarketplaceManagementPanel
                            officialExercises={sanitizedOfficialExercises}
                            officialCategories={sanitizedOfficialCategories}
                            officialBadges={sanitizedOfficialBadges}
                            editingId={editId}
                            editingType={editType}
                        />
                    }
                    analyticsPanel={<AnalyticsPanel />}
                    posthogPanel={<PostHogGuidePanel />}
                />
            </Suspense>

            <footer className="mt-24 text-center pb-12 border-t border-[#1a1a2e] pt-12">
                <div className="text-[10px] opacity-40 font-bold tracking-[0.3em] uppercase mb-4">
                    IRONTRAIN CORE ● ENTERPRISE SECURITY & CONTENT HUB
                </div>
                <div className="text-[9px] opacity-20 font-mono">
                    BUILD 2026.03.08_V2_REFACTOR ● MOTIONA_ZERO_TRUST_ENGINE
                </div>
            </footer>
        </div>
    );
}
