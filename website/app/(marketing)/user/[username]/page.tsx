import { and, count, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import {
    Activity,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Clock,
    Flame,
    Globe,
    History,
    Lock,
    Palette,
    Trophy,
    User as UserIcon
} from 'lucide-react';
import { Metadata } from 'next';
import { unstable_noStore as noStore } from 'next/cache';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ThemeModePreview from '../../../../components/marketplace/ThemeModePreview';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { logger } from '../../../../src/lib/logger';
import { verifyAuthFromHeaders } from '../../../../src/lib/server-auth';
import { reconcileStreakStateForUser } from '../../../../src/lib/social-scoring';
import { buildThemeHashtags } from '../../../../src/lib/theme-marketplace/theme-hashtags';
import { ExperimentWrapper } from '../../../components/PostHogFeatures';
import ProfileActivityFeed from './ProfileActivityFeed';
import ProfileFriendActions from './ProfileFriendActions';

export const revalidate = 0;

type ProfilePageProps = {
    params: Promise<{ username: string }>;
    searchParams: Promise<{ page?: string }>;
};

const SCORE_PAGE_SIZE = 10;
const THEMES_LIMIT = 12;

const toPositiveInt = (raw: string | undefined, fallback = 1) => {
    const parsed = Number.parseInt(raw ?? '', 10);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return parsed;
};

export async function generateMetadata(props: { params: Promise<{ username: string }> }): Promise<Metadata> {
    const { username } = await props.params;
    return {
        title: `@${username} | IronTrain Social`,
        description: `Perfil social de ${username}: progreso, themes y rutinas compartidas en IronTrain.`,
    };
}

export default async function UserProfilePage(props: ProfilePageProps) {
    noStore();

    const { username } = await props.params;
    const sp = await props.searchParams;

    const page = toPositiveInt(sp.page, 1);
    const offset = (page - 1) * SCORE_PAGE_SIZE;

    const requestHeaders = await headers();
    const currentUserId = await verifyAuthFromHeaders(requestHeaders);

    const initialProfile = await db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.username, username)
    });

    if (!initialProfile) {
        notFound();
    }

    await reconcileStreakStateForUser(db, initialProfile.id).catch((error) => {
        logger.captureException(error, {
            scope: 'marketing.user.reconcileStreakState',
            username,
            userId: initialProfile.id,
        });
    });

    const profile = await db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.username, username)
    }) || initialProfile;

    const isOwner = currentUserId === profile.id;
    const isPrivate = profile.isPublic === false;
    const locked = isPrivate && !isOwner;

    const relationship = (!currentUserId || isOwner)
        ? null
        : await db.select({
            id: schema.friendships.id,
            userId: schema.friendships.userId,
            friendId: schema.friendships.friendId,
            status: schema.friendships.status,
        })
            .from(schema.friendships)
            .where(and(
                isNull(schema.friendships.deletedAt),
                or(
                    and(eq(schema.friendships.userId, currentUserId), eq(schema.friendships.friendId, profile.id)),
                    and(eq(schema.friendships.userId, profile.id), eq(schema.friendships.friendId, currentUserId)),
                ),
            ))
            .limit(1);

    const relationshipRow = relationship?.[0] ?? null;
    const relationshipStatus: 'none' | 'pending_outgoing' | 'pending_incoming' | 'accepted' | 'blocked' = !relationshipRow
        ? 'none'
        : relationshipRow.status === 'accepted'
            ? 'accepted'
            : relationshipRow.status === 'blocked'
                ? 'blocked'
                : relationshipRow.userId === currentUserId
                    ? 'pending_outgoing'
                    : 'pending_incoming';
    const relationshipBadgeLabel = relationshipStatus === 'accepted'
        ? 'REL: AMIGO'
        : relationshipStatus === 'pending_outgoing'
            ? 'REL: SOLICITUD_ENVIADA'
            : relationshipStatus === 'pending_incoming'
                ? 'REL: SOLICITUD_RECIBIDA'
                : relationshipStatus === 'blocked'
                    ? 'REL: BLOQUEADO'
                    : 'REL: SIN_CONEXION';
    const relationshipBadgeClass = relationshipStatus === 'accepted'
        ? 'border-emerald-700/80 text-emerald-800 bg-emerald-50'
        : relationshipStatus === 'pending_outgoing'
            ? 'border-amber-700/80 text-amber-800 bg-amber-50'
            : relationshipStatus === 'pending_incoming'
                ? 'border-blue-700/80 text-blue-800 bg-blue-50'
                : relationshipStatus === 'blocked'
                    ? 'border-red-700/80 text-red-800 bg-red-50'
                    : 'border-[#1a1a2e]/40 text-[#1a1a2e]/70 bg-transparent';

    const routines = locked
        ? []
        : await db.select({
            id: schema.routines.id,
            name: schema.routines.name,
            description: schema.routines.description,
            updatedAt: schema.routines.updatedAt,
        })
            .from(schema.routines)
            .where(
                and(
                    eq(schema.routines.userId, profile.id),
                    eq(schema.routines.isPublic, true),
                    isNull(schema.routines.deletedAt),
                    or(isNull(schema.routines.isModerated), eq(schema.routines.isModerated, false))
                )
            )
            .orderBy(desc(schema.routines.updatedAt));

    const themes = locked
        ? []
        : await db.select({
            id: schema.themePacks.id,
            slug: schema.themePacks.slug,
            name: schema.themePacks.name,
            description: schema.themePacks.description,
            tags: schema.themePacks.tags,
            supportsLight: schema.themePacks.supportsLight,
            supportsDark: schema.themePacks.supportsDark,
            currentVersion: schema.themePacks.currentVersion,
            downloadsCount: schema.themePacks.downloadsCount,
            appliesCount: schema.themePacks.appliesCount,
            ratingAvg: schema.themePacks.ratingAvg,
            ratingCount: schema.themePacks.ratingCount,
            updatedAt: schema.themePacks.updatedAt,
            visibility: schema.themePacks.visibility,
            status: schema.themePacks.status,
        })
            .from(schema.themePacks)
            .where(
                and(
                    eq(schema.themePacks.ownerId, profile.id),
                    isNull(schema.themePacks.deletedAt),
                    ...(isOwner
                        ? []
                        : [
                            eq(schema.themePacks.visibility, 'public'),
                            eq(schema.themePacks.status, 'approved'),
                        ]),
                )
            )
            .orderBy(desc(schema.themePacks.updatedAt))
            .limit(THEMES_LIMIT);

    const themeIds = themes.map((theme) => theme.id);
    const themeVersions = themeIds.length === 0
        ? []
        : await db.select({
            themePackId: schema.themePackVersions.themePackId,
            version: schema.themePackVersions.version,
            payload: schema.themePackVersions.payload,
        })
            .from(schema.themePackVersions)
            .where(inArray(schema.themePackVersions.themePackId, themeIds));

    const themePayloadById = new Map<string, Record<string, unknown>>();
    for (const row of themeVersions) {
        const theme = themes.find((entry) => entry.id === row.themePackId);
        if (!theme) continue;
        if (row.version !== theme.currentVersion) continue;
        themePayloadById.set(row.themePackId, (row.payload ?? {}) as Record<string, unknown>);
    }

    const scoreHistory = locked
        ? []
        : await db.select()
            .from(schema.scoreEvents)
            .where(and(
                eq(schema.scoreEvents.userId, profile.id),
                isNull(schema.scoreEvents.deletedAt)
            ))
            .orderBy(desc(schema.scoreEvents.createdAt))
            .limit(SCORE_PAGE_SIZE)
            .offset(offset);

    const totalScoreEventsResult = locked
        ? [{ value: 0 }]
        : await db.select({ value: count() })
            .from(schema.scoreEvents)
            .where(and(
                eq(schema.scoreEvents.userId, profile.id),
                isNull(schema.scoreEvents.deletedAt)
            ));

    const totalScoreEvents = totalScoreEventsResult[0]?.value ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalScoreEvents / SCORE_PAGE_SIZE));

    const scoreSummary = locked
        ? []
        : await db.select({
            eventType: schema.scoreEvents.eventType,
            totalPoints: sql<number>`sum(${schema.scoreEvents.pointsAwarded})`.mapWith(Number),
            count: count()
        })
            .from(schema.scoreEvents)
            .where(and(
                eq(schema.scoreEvents.userId, profile.id),
                isNull(schema.scoreEvents.deletedAt)
            ))
            .groupBy(schema.scoreEvents.eventType)
            .orderBy(desc(sql`sum(${schema.scoreEvents.pointsAwarded})`));

    const recentActivity = locked
        ? []
        : await db.select({
            id: schema.activityFeed.id,
            actionType: schema.activityFeed.actionType,
            metadata: schema.activityFeed.metadata,
            createdAt: schema.activityFeed.createdAt,
            kudoCount: schema.activityFeed.kudoCount,
        })
            .from(schema.activityFeed)
            .where(and(
                eq(schema.activityFeed.userId, profile.id),
                isNull(schema.activityFeed.deletedAt)
            ))
            .orderBy(desc(schema.activityFeed.createdAt))
            .limit(8);

    const activityIds = recentActivity.map((entry) => entry.id);
    const viewerKudos = (!currentUserId || activityIds.length === 0)
        ? []
        : await db.select({ feedId: schema.kudos.feedId })
            .from(schema.kudos)
            .where(and(
                eq(schema.kudos.giverId, currentUserId),
                inArray(schema.kudos.feedId, activityIds),
                isNull(schema.kudos.deletedAt),
            ));

    const initialKudoedIds = viewerKudos.map((entry) => entry.feedId).filter((entry): entry is string => Boolean(entry));

    return (
        <main className="min-h-screen bg-[#f5f1e8] text-[#1a1a2e] selection:bg-[#1a1a2e] selection:text-[#f5f1e8]">
            <section className="border-b-[4px] border-[#1a1a2e] py-14 lg:py-20 relative overflow-hidden bg-white">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] select-none pointer-events-none">
                    <UserIcon size={360} strokeWidth={1} />
                </div>

                <div className="container mx-auto px-4 relative z-10 max-w-6xl">
                    <div className="flex flex-col md:flex-row items-center md:items-end gap-8 mb-10">
                        <div className="w-28 h-28 lg:w-40 lg:h-40 bg-[#1a1a2e] text-[#f5f1e8] flex items-center justify-center font-black text-5xl lg:text-7xl border-[6px] border-[#1a1a2e] shadow-[12px_12px_0px_0px_rgba(26,26,46,0.1)]">
                            {profile.username?.slice(0, 2).toUpperCase() || '??'}
                        </div>

                        <div className="text-center md:text-left flex-1">
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-4">
                                <div className="bg-[#1a1a2e] text-[#f5f1e8] px-2 py-0.5 text-[8px] font-black uppercase tracking-widest">PROFILE_NODE</div>
                                {isPrivate && (
                                    <div className="border border-[#1a1a2e] px-2 py-0.5 text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5">
                                        <Lock className="w-2.5 h-2.5" /> PRIVATE_PROFILE
                                    </div>
                                )}
                                <div className="border border-[#1a1a2e] px-2 py-0.5 text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 opacity-40">
                                    <Activity className="w-2.5 h-2.5" /> SOCIAL_ACTIVE
                                </div>
                                {!!currentUserId && !isOwner && (
                                    <div className={`border px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${relationshipBadgeClass}`}>
                                        {relationshipBadgeLabel}
                                    </div>
                                )}
                            </div>

                            <h1 className="text-4xl lg:text-6xl font-black uppercase tracking-tighter leading-none italic mb-2">
                                @{profile.username}
                            </h1>
                            <p className="text-xs font-bold opacity-40 uppercase tracking-[0.25em] italic">
                                {profile.displayName || 'IRON_OPERATIVE_UNNAMED'}
                            </p>

                            <ProfileFriendActions
                                currentUserId={currentUserId}
                                profileUserId={profile.id}
                                initialStatus={relationshipStatus}
                                requestId={relationshipRow?.id ?? null}
                            />

                            {isOwner && (
                                <div className="mt-4 border-2 border-[#1a1a2e] bg-white p-3 md:p-4">
                                    <div className="text-[9px] font-black uppercase tracking-[0.2em] opacity-50 mb-3">OWNER_CONTROLS</div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <Link
                                            href="/auth/account"
                                            className="text-center border border-[#1a1a2e] px-3 py-2 text-[10px] font-black uppercase tracking-[0.15em] hover:bg-[#1a1a2e] hover:text-[#f5f1e8] transition-colors"
                                        >
                                            Seguridad de cuenta
                                        </Link>
                                        <Link
                                            href="/settings"
                                            className="text-center border border-[#1a1a2e] px-3 py-2 text-[10px] font-black uppercase tracking-[0.15em] hover:bg-[#1a1a2e] hover:text-[#f5f1e8] transition-colors"
                                        >
                                            Ajustes app
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-0 border-[3px] border-[#1a1a2e] bg-white divide-y-[3px] lg:divide-y-0 lg:divide-x-[3px] divide-[#1a1a2e]">
                        <div className="p-6 flex flex-col items-center justify-center text-center">
                            <Trophy className="w-6 h-6 mb-2 opacity-20" />
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-1">IRONSCORE</div>
                            <div className="text-3xl font-black tracking-tighter">{locked ? '---' : (profile.scoreLifetime || 0)}</div>
                        </div>

                        <div className="p-6 flex flex-col items-center justify-center text-center">
                            <Flame className="w-6 h-6 mb-2 opacity-20 text-orange-600" />
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-1">Racha diaria</div>
                            <div className="text-3xl font-black tracking-tighter">{locked ? '---' : `${profile.currentStreak || 0}D`}</div>
                        </div>

                        <div className="p-6 flex flex-col items-center justify-center text-center">
                            <Calendar className="w-6 h-6 mb-2 opacity-20 text-blue-600" />
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-1">Racha semanal</div>
                            <div className="text-3xl font-black tracking-tighter">{locked ? '---' : `${profile.streakWeeks || 0}W`}</div>
                        </div>

                        <div className="p-6 flex flex-col items-center justify-center text-center">
                            <Palette className="w-6 h-6 mb-2 opacity-20" />
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-1">Themes</div>
                            <div className="text-3xl font-black tracking-tighter">{locked ? '---' : themes.length}</div>
                        </div>

                        <div className="p-6 flex flex-col items-center justify-center text-center">
                            <Globe className="w-6 h-6 mb-2 opacity-20" />
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-1">Rutinas públicas</div>
                            <div className="text-3xl font-black tracking-tighter">{locked ? '---' : routines.length}</div>
                        </div>
                    </div>
                </div>
            </section>

            {locked ? (
                <section className="py-28 flex flex-col items-center justify-center text-center">
                    <Lock size={64} className="opacity-10 mb-6" />
                    <h2 className="text-sm font-black uppercase tracking-[0.5em] opacity-40">PERFIL_PRIVADO</h2>
                    <p className="text-[10px] font-bold opacity-30 mt-4 uppercase tracking-[0.2em] max-w-xs leading-relaxed">
                        Este perfil es privado. Solo su dueño puede ver su actividad, themes y rutinas.
                    </p>
                </section>
            ) : (
                <>
                    <section className="py-16 lg:py-20 border-b border-[#1a1a2e]/10">
                        <div className="container mx-auto px-4 max-w-6xl space-y-8">
                            <div className="flex items-center gap-4">
                                <div className="h-px bg-[#1a1a2e] flex-1 opacity-20" />
                                <h2 className="text-sm font-black uppercase tracking-[0.5em] opacity-60 italic">THEMES</h2>
                                <div className="h-px bg-[#1a1a2e] flex-1 opacity-20" />
                            </div>

                            {themes.length === 0 ? (
                                <div className="text-center py-14 border-2 border-[#1a1a2e] border-dashed bg-white/40">
                                    <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30">SIN_THEMES_PUBLICADOS</div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {themes.map((theme) => {
                                        const payload = themePayloadById.get(theme.id) || {};
                                        const tags = buildThemeHashtags({
                                            rawTags: theme.tags,
                                            supportsLight: theme.supportsLight,
                                            supportsDark: theme.supportsDark,
                                            limit: 5,
                                        });

                                        return (
                                            <Link
                                                key={theme.id}
                                                href={`/share/theme/${theme.slug}`}
                                                className="group border-[3px] border-[#1a1a2e] bg-white p-6 flex flex-col justify-between hover:bg-[#1a1a2e] hover:text-[#f5f1e8] transition-all"
                                            >
                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="bg-current text-background px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter">THEME</span>
                                                        <span className="text-[10px] font-black uppercase opacity-40">V{theme.currentVersion}</span>
                                                        <span className="text-[10px] font-black uppercase opacity-40">
                                                            {theme.supportsLight && theme.supportsDark ? 'LIGHT+DARK' : theme.supportsLight ? 'LIGHT_ONLY' : 'DARK_ONLY'}
                                                        </span>
                                                        {isOwner && (
                                                            <span className="text-[10px] font-black uppercase opacity-40">{theme.visibility}/{theme.status}</span>
                                                        )}
                                                    </div>

                                                    <h3 className="text-2xl lg:text-3xl font-black uppercase tracking-tighter leading-[0.9] italic">
                                                        {theme.name}
                                                    </h3>

                                                    {theme.description && (
                                                        <p className="text-[10px] font-bold opacity-60 uppercase tracking-tight leading-relaxed line-clamp-2 italic">
                                                            {theme.description}
                                                        </p>
                                                    )}

                                                    <ThemeModePreview
                                                        payload={payload}
                                                        supportsLight={theme.supportsLight}
                                                        supportsDark={theme.supportsDark}
                                                        compact
                                                    />

                                                    {tags.length > 0 && (
                                                        <div className="flex flex-wrap gap-2">
                                                            {tags.map((tag) => (
                                                                <span key={`${theme.id}:${tag}`} className="text-[8px] px-2 py-0.5 border border-current font-black tracking-tighter uppercase">
                                                                    #{tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="mt-6 pt-4 border-t border-current/20 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.15em]">
                                                    <span className="opacity-60">Installs {theme.downloadsCount}</span>
                                                    <span className="opacity-60">Applies {theme.appliesCount}</span>
                                                    <span className="opacity-60">⭐ {Number(theme.ratingAvg || 0).toFixed(1)} ({theme.ratingCount || 0})</span>
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="py-16 lg:py-20 border-b border-[#1a1a2e]/10">
                        <div className="container mx-auto px-4 max-w-6xl">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="h-px bg-[#1a1a2e] flex-1 opacity-20" />
                                <h2 className="text-sm font-black uppercase tracking-[0.5em] opacity-60 italic">RUTINAS</h2>
                                <div className="h-px bg-[#1a1a2e] flex-1 opacity-20" />
                            </div>

                            {routines.length === 0 ? (
                                <div className="text-center py-16 border-[3px] border-[#1a1a2e] border-dashed bg-white/40">
                                    <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30">SIN_RUTINAS_PUBLICAS</div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {routines.map((routine) => (
                                        <ExperimentWrapper key={routine.id}>
                                            <Link
                                                href={`/share/routine/${routine.id}`}
                                                className="group block border-[3px] border-[#1a1a2e] p-6 transition-all hover:bg-[#1a1a2e] hover:text-[#f5f1e8] bg-white"
                                            >
                                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                                    <div className="flex-1 space-y-4">
                                                        <div className="inline-flex border border-current px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter italic">
                                                            P2P_ROUTINE
                                                        </div>

                                                        <h3 className="text-2xl lg:text-3xl font-black uppercase tracking-tighter leading-none group-hover:italic transition-all">
                                                            {routine.name}
                                                        </h3>

                                                        {routine.description && (
                                                            <p className="text-xs font-bold opacity-60 line-clamp-2 leading-relaxed uppercase italic max-w-2xl">
                                                                {routine.description}
                                                            </p>
                                                        )}

                                                        <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] opacity-50">
                                                            <Clock className="w-3.5 h-3.5" />
                                                            <span>{new Date(routine.updatedAt || new Date()).toLocaleDateString('es-AR')}</span>
                                                        </div>
                                                    </div>

                                                    <div className="w-10 h-10 border-2 border-current flex items-center justify-center">
                                                        <ChevronRight className="w-5 h-5" />
                                                    </div>
                                                </div>
                                            </Link>
                                        </ExperimentWrapper>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="py-16 lg:py-20 border-b border-[#1a1a2e]/10">
                        <div className="container mx-auto px-4 max-w-6xl">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="h-px bg-[#1a1a2e] flex-1 opacity-20" />
                                <h2 className="text-sm font-black uppercase tracking-[0.5em] opacity-60 italic">ACTIVIDAD_RECIENTE</h2>
                                <div className="h-px bg-[#1a1a2e] flex-1 opacity-20" />
                            </div>

                            {recentActivity.length === 0 ? (
                                <div className="text-center py-14 border-2 border-[#1a1a2e] border-dashed bg-white/40">
                                    <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30">SIN_ACTIVIDAD</div>
                                </div>
                            ) : (
                                <ProfileActivityFeed
                                    items={recentActivity}
                                    initialKudoedIds={initialKudoedIds}
                                    canReact={Boolean(currentUserId && !isOwner)}
                                />
                            )}
                        </div>
                    </section>

                    <section className="py-16 lg:py-20 border-b border-[#1a1a2e]/10">
                        <div className="container mx-auto px-4 max-w-6xl">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="h-px bg-[#1a1a2e] flex-1 opacity-20" />
                                <h2 className="text-sm font-black uppercase tracking-[0.5em] opacity-60 italic">SCORE_RESUMEN</h2>
                                <div className="h-px bg-[#1a1a2e] flex-1 opacity-20" />
                            </div>

                            {scoreSummary.length === 0 ? (
                                <div className="text-center py-14 border-2 border-[#1a1a2e] border-dashed bg-white/40">
                                    <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30">SIN_EVENTOS_DE_SCORE</div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {scoreSummary.map((item) => (
                                        <div key={item.eventType} className="border-2 border-[#1a1a2e] p-5 bg-white">
                                            <div className="text-[10px] font-black uppercase tracking-[0.15em] opacity-40 mb-2">{item.eventType.replace(/_/g, ' ')}</div>
                                            <div className="flex items-end justify-between gap-3">
                                                <div className="text-3xl font-black tracking-tighter">+{item.totalPoints}</div>
                                                <div className="text-[10px] font-bold opacity-40">x{item.count}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="py-16 lg:py-20 bg-[#1a1a2e] text-[#f5f1e8]">
                        <div className="container mx-auto px-4 max-w-6xl">
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                                <div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <History className="w-5 h-5 opacity-40" />
                                        <h2 className="text-sm font-black uppercase tracking-[0.4em] opacity-50">SCORE_HISTORY</h2>
                                    </div>
                                    <h3 className="text-3xl lg:text-5xl font-black uppercase tracking-tighter italic">Historial de puntuación</h3>
                                </div>
                            </div>

                            <div className="border-[3px] border-white/10 overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b-[3px] border-white/10 bg-white/5">
                                            <th className="p-5 text-[10px] font-black uppercase tracking-widest opacity-40">Tipo</th>
                                            <th className="p-5 text-[10px] font-black uppercase tracking-widest opacity-40">Fecha</th>
                                            <th className="p-5 text-[10px] font-black uppercase tracking-widest opacity-40 text-right">Puntos</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {scoreHistory.length === 0 ? (
                                            <tr>
                                                <td colSpan={3} className="p-10 text-center text-sm font-bold opacity-20 italic">
                                                    SIN_REGISTROS
                                                </td>
                                            </tr>
                                        ) : (
                                            scoreHistory.map((item) => (
                                                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                                    <td className="p-5 text-sm font-black uppercase tracking-tight">{item.eventType.replace(/_/g, ' ')}</td>
                                                    <td className="p-5 text-[11px] font-bold opacity-40 uppercase tabular-nums tracking-widest">
                                                        {new Date(item.createdAt || new Date()).toLocaleDateString('es-AR', {
                                                            day: '2-digit',
                                                            month: '2-digit',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </td>
                                                    <td className="p-5 text-right text-xl font-black tracking-tighter text-yellow-500">+{item.pointsAwarded}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {totalPages > 1 && (
                                <div className="mt-8 flex items-center justify-between">
                                    <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 italic">
                                        FILA {offset + 1}-{Math.min(offset + scoreHistory.length, totalScoreEvents)} DE {totalScoreEvents}
                                    </div>
                                    <div className="flex gap-2">
                                        <Link
                                            href={`/user/${username}?page=${page - 1}`}
                                            className={`w-12 h-12 border-2 border-white/10 flex items-center justify-center transition-all ${page <= 1 ? 'opacity-20 pointer-events-none' : 'hover:bg-white hover:text-[#1a1a2e]'}`}
                                        >
                                            <ChevronLeft className="w-5 h-5" />
                                        </Link>
                                        <Link
                                            href={`/user/${username}?page=${page + 1}`}
                                            className={`w-12 h-12 border-2 border-white/10 flex items-center justify-center transition-all ${page >= totalPages ? 'opacity-20 pointer-events-none' : 'hover:bg-white hover:text-[#1a1a2e]'}`}
                                        >
                                            <ChevronRight className="w-5 h-5" />
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                </>
            )}
        </main>
    );
}
