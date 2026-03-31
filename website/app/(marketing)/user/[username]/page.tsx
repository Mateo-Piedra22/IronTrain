import { and, count, desc, eq, isNull, or, sql } from 'drizzle-orm';
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
    Trophy,
    User as UserIcon
} from 'lucide-react';
import { Metadata } from 'next';
import { unstable_noStore as noStore } from 'next/cache';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { logger } from '../../../../src/lib/logger';
import { verifyAuthFromHeaders } from '../../../../src/lib/server-auth';
import { reconcileStreakStateForUser } from '../../../../src/lib/social-scoring';
import { ExperimentWrapper } from '../../../components/PostHogFeatures';

export const revalidate = 0;

export async function generateMetadata(props: { params: Promise<{ username: string }> }): Promise<Metadata> {
    const { username } = await props.params;
    return {
        title: `@${username} | IronTrain Social`,
        description: `View ${username}'s training progress, IronScore, and shared routines on IronTrain.`,
    };
}

export default async function UserProfilePage(props: {
    params: Promise<{ username: string }>,
    searchParams: Promise<{ page?: string }>
}) {
    noStore();
    const { username } = await props.params;
    const sp = await props.searchParams;
    const page = parseInt(sp.page || '1');
    const pageSize = 10;
    const offset = (page - 1) * pageSize;

    const h = await headers();
    const currentUserId = await verifyAuthFromHeaders(h);

    // Fetch User Profile
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

    // Fetch user's public routines
    const routines = (isPrivate && !isOwner) ? [] : await db.select({
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

    // Fetch Score History with Pagination
    const scoreHistoryQuery = db.select()
        .from(schema.scoreEvents)
        .where(and(
            eq(schema.scoreEvents.userId, profile.id),
            isNull(schema.scoreEvents.deletedAt)
        ))
        .orderBy(desc(schema.scoreEvents.createdAt));

    const scoreHistory = (isPrivate && !isOwner) ? [] : await scoreHistoryQuery
        .limit(pageSize)
        .offset(offset);

    // Total count for pagination
    const totalScoreEventsResult = (isPrivate && !isOwner) ? [{ value: 0 }] : await db.select({ value: count() })
        .from(schema.scoreEvents)
        .where(and(
            eq(schema.scoreEvents.userId, profile.id),
            isNull(schema.scoreEvents.deletedAt)
        ));
    const totalScoreEvents = totalScoreEventsResult[0].value;
    const totalPages = Math.ceil(totalScoreEvents / pageSize);

    // Fetch Score Summary (Direct Sum)
    const scoreSummary = (isPrivate && !isOwner) ? [] : await db.select({
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

    const recentActivity = (isPrivate && !isOwner) ? [] : await db.select({
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

    const activityLabel = (actionType: string) => {
        if (actionType === 'pr_broken') return 'PR roto';
        if (actionType === 'routine_shared') return 'Rutina compartida';
        return 'Workout completado';
    };

    return (
        <main className="min-h-screen bg-[#f5f1e8] text-[#1a1a2e] selection:bg-[#1a1a2e] selection:text-[#f5f1e8]">
            {/* Profile Header */}
            <section className="border-b-[4px] border-[#1a1a2e] py-16 lg:py-24 relative overflow-hidden bg-white">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] select-none pointer-events-none">
                    <UserIcon size={400} strokeWidth={1} />
                </div>

                <div className="container mx-auto px-4 relative z-10">
                    <div className="flex flex-col md:flex-row items-center md:items-end gap-8 mb-12">
                        <div className="w-32 h-32 lg:w-48 lg:h-48 bg-[#1a1a2e] text-[#f5f1e8] flex items-center justify-center font-black text-6xl lg:text-8xl border-[6px] border-[#1a1a2e] shadow-[12px_12px_0px_0px_rgba(26,26,46,0.1)]">
                            {profile.username?.slice(0, 2).toUpperCase() || '??'}
                        </div>

                        <div className="text-center md:text-left flex-1">
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-4">
                                <div className="bg-[#1a1a2e] text-[#f5f1e8] px-2 py-0.5 text-[8px] font-black uppercase tracking-widest">VERIFIED_NODE</div>
                                {isPrivate && (
                                    <div className="border border-[#1a1a2e] px-2 py-0.5 text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5">
                                        <Lock className="w-2.5 h-2.5" /> PROFILE_PRIVATE
                                    </div>
                                )}
                                <div className="border border-[#1a1a2e] px-2 py-0.5 text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 opacity-40">
                                    <Activity className="w-2.5 h-2.5" /> STATUS: ACTIVE
                                </div>
                            </div>

                            <h1 className="text-5xl lg:text-7xl font-black uppercase tracking-tighter leading-none italic mb-2">
                                @{profile.username}
                            </h1>
                            <p className="text-sm font-bold opacity-40 uppercase tracking-[0.4em] italic mb-6">
                                {profile.displayName || 'IRON_OPERATIVE_UNNAMED'}
                            </p>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 border-[3px] border-[#1a1a2e] bg-white divide-y-[3px] lg:divide-y-0 lg:divide-x-[3px] divide-[#1a1a2e] shadow-[16px_16px_0px_0px_rgba(26,26,46,0.05)]">
                        <div className="p-8 flex flex-col items-center justify-center text-center group hover:bg-[#1a1a2e] hover:text-[#f5f1e8] transition-all">
                            <Trophy className="w-6 h-6 mb-3 opacity-20 group-hover:opacity-100 transition-opacity" />
                            <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-1">TOTAL_IRONSCORE</div>
                            <div className="text-4xl lg:text-5xl font-black tracking-tighter">
                                {isPrivate && !isOwner ? '---' : (profile.scoreLifetime || 0)}
                            </div>
                        </div>

                        <div className="p-8 flex flex-col items-center justify-center text-center group hover:bg-[#1a1a2e] hover:text-[#f5f1e8] transition-all">
                            <Flame className="w-6 h-6 mb-3 opacity-20 group-hover:opacity-100 transition-opacity text-orange-600 group-hover:text-current" />
                            <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-1">DAILY_STREAK</div>
                            <div className="text-4xl lg:text-5xl font-black tracking-tighter">
                                {isPrivate && !isOwner ? '---' : (profile.currentStreak || 0)}D
                            </div>
                        </div>

                        <div className="p-8 flex flex-col items-center justify-center text-center group hover:bg-[#1a1a2e] hover:text-[#f5f1e8] transition-all">
                            <Calendar className="w-6 h-6 mb-3 opacity-20 group-hover:opacity-100 transition-opacity text-blue-600 group-hover:text-current" />
                            <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-1">WEEKLY_STREAK</div>
                            <div className="text-4xl lg:text-5xl font-black tracking-tighter">
                                {isPrivate && !isOwner ? '---' : (profile.streakWeeks || 0)}W
                            </div>
                        </div>

                        <div className="p-8 flex flex-col items-center justify-center text-center group hover:bg-[#1a1a2e] hover:text-[#f5f1e8] transition-all">
                            <Globe className="w-6 h-6 mb-3 opacity-20 group-hover:opacity-100 transition-opacity" />
                            <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-1">DATA_SHARED</div>
                            <div className="text-4xl lg:text-5xl font-black tracking-tighter">
                                {isPrivate && !isOwner ? '---' : routines.length}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {isPrivate && !isOwner ? (
                <section className="py-32 flex flex-col items-center justify-center text-center">
                    <Lock size={64} className="opacity-10 mb-6" />
                    <h2 className="text-sm font-black uppercase tracking-[0.5em] opacity-40">ENCRYPTED_PROFILE_CONTENT</h2>
                    <p className="text-[10px] font-bold opacity-30 mt-4 uppercase tracking-[0.2em] max-w-xs leading-relaxed">
                        Este perfil es privado. Solo los contactos autorizados pueden ver los registros operativos.
                    </p>
                </section>
            ) : (
                <>
                    {/* Score Summary Section */}
                    <section className="py-20 lg:py-24 border-b border-[#1a1a2e]/5">
                        <div className="container mx-auto px-4 max-w-5xl">
                            <div className="flex items-center gap-4 mb-12">
                                <div className="h-px bg-[#1a1a2e] flex-1 opacity-20"></div>
                                <h2 className="text-sm font-black uppercase tracking-[0.5em] opacity-60 italic">SCORE_AUDIT</h2>
                                <div className="h-px bg-[#1a1a2e] flex-1 opacity-20"></div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {scoreSummary.map((item) => (
                                    <div key={item.eventType} className="border-2 border-[#1a1a2e] p-6 bg-white shadow-[8px_8px_0px_0px_rgba(26,26,46,0.03)] group hover:bg-[#1a1a2e] hover:text-[#f5f1e8] transition-all">
                                        <div className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 mb-2 group-hover:text-white/50">{item.eventType.replace(/_/g, ' ')}</div>
                                        <div className="flex items-end justify-between">
                                            <div className="text-4xl font-black tracking-tighter">+{item.totalPoints}</div>
                                            <div className="text-[10px] font-bold opacity-30 group-hover:text-white/30 italic">x{item.count} EVENTOS</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Routines section */}
                    <section className="py-20 lg:py-24 border-t border-[#1a1a2e]/5">
                        <div className="container mx-auto px-4 max-w-5xl">
                            <div className="flex items-center gap-4 mb-12">
                                <div className="h-px bg-[#1a1a2e] flex-1 opacity-20"></div>
                                <h2 className="text-sm font-black uppercase tracking-[0.5em] opacity-60 italic">SOCIAL_ACTIVITY</h2>
                                <div className="h-px bg-[#1a1a2e] flex-1 opacity-20"></div>
                            </div>

                            {recentActivity.length === 0 ? (
                                <div className="text-center py-16 border-2 border-[#1a1a2e] border-dashed bg-white/50">
                                    <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30">NO_ACTIVITY_LOGS</div>
                                </div>
                            ) : (
                                <div className="grid md:grid-cols-2 gap-6">
                                    {recentActivity.map((entry) => {
                                        const metadata = (typeof entry.metadata === 'object' && entry.metadata !== null) ? entry.metadata as Record<string, unknown> : null;
                                        const value = metadata?.prValue ?? metadata?.pointsAwarded ?? metadata?.durationMin;
                                        return (
                                            <article key={entry.id} className="border-2 border-[#1a1a2e] p-6 bg-white shadow-[8px_8px_0px_0px_rgba(26,26,46,0.03)]">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">{activityLabel(entry.actionType)}</div>
                                                    <div className="text-[10px] font-bold opacity-40">{new Date(entry.createdAt || new Date()).toLocaleDateString('es-AR')}</div>
                                                </div>
                                                <div className="text-xs font-bold uppercase tracking-[0.15em] opacity-60">KUDOS: {entry.kudoCount || 0}</div>
                                                {value !== undefined && value !== null && (
                                                    <div className="mt-3 text-3xl font-black tracking-tighter">{String(value)}</div>
                                                )}
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="py-20 lg:py-24">
                        <div className="container mx-auto px-4 max-w-5xl">
                            <div className="flex items-center gap-4 mb-12">
                                <div className="h-px bg-[#1a1a2e] flex-1 opacity-20"></div>
                                <h2 className="text-sm font-black uppercase tracking-[0.5em] opacity-60 italic">PUBLIC_DATAFEED</h2>
                                <div className="h-px bg-[#1a1a2e] flex-1 opacity-20"></div>
                            </div>

                            {routines.length === 0 ? (
                                <div className="text-center py-32 border-[3px] border-[#1a1a2e] border-dashed bg-white/50">
                                    <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30">NO_PUBLIC_DATA_TRANSMISSIONS</div>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {routines.map((routine) => (
                                        <ExperimentWrapper key={routine.id}>
                                            <Link
                                                href={`/share/routine/${routine.id}`}
                                                className="group block border-[3px] border-[#1a1a2e] p-8 transition-all hover:bg-[#1a1a2e] hover:text-[#f5f1e8] bg-white relative overflow-hidden shadow-[12px_12px_0px_0px_rgba(26,26,46,0.03)]"
                                            >
                                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative z-10">
                                                    <div className="flex-1 space-y-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="border border-current px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter italic">P2P_TRANSMISSION</div>
                                                        </div>

                                                        <h3 className="text-3xl lg:text-4xl font-black uppercase tracking-tighter leading-none group-hover:italic transition-all">
                                                            {routine.name}
                                                        </h3>

                                                        {routine.description && (
                                                            <p className="text-xs font-bold opacity-60 line-clamp-2 leading-relaxed uppercase italic max-w-2xl">
                                                                {routine.description}
                                                            </p>
                                                        )}

                                                        <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-[0.3em] opacity-40">
                                                            <Clock className="w-3.5 h-3.5" />
                                                            <span>STAMP: {new Date(routine.updatedAt || new Date()).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                                        </div>
                                                    </div>

                                                    <div className="pt-4 md:pt-0">
                                                        <div className="w-10 h-10 border-2 border-current flex items-center justify-center rotate-45 group-hover:rotate-0 transition-transform">
                                                            <ChevronRight className="-rotate-45 group-hover:rotate-0 transition-transform" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </Link>
                                        </ExperimentWrapper>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Score History Section */}
                    <section className="py-20 bg-[#1a1a2e] text-[#f5f1e8]">
                        <div className="container mx-auto px-4 max-w-5xl">
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                                <div>
                                    <div className="flex items-center gap-3 mb-4">
                                        <History className="w-5 h-5 opacity-40" />
                                        <h2 className="text-sm font-black uppercase tracking-[0.5em] opacity-60 text-white/40">OPERATIONAL_LOGS</h2>
                                    </div>
                                    <h3 className="text-4xl lg:text-6xl font-black uppercase tracking-tighter italic">PUNTUACIÓN_HISTORIAL</h3>
                                </div>
                                <p className="text-[10px] font-bold opacity-30 uppercase max-w-xs leading-relaxed">
                                    Registro de transmisiones de datos y bonus acumulados durante misiones de entrenamiento.
                                </p>
                            </div>

                            <div className="border-[3px] border-white/10 overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b-[3px] border-white/10 bg-white/5">
                                            <th className="p-6 text-[10px] font-black uppercase tracking-widest opacity-40">TIPO_EVENTO</th>
                                            <th className="p-6 text-[10px] font-black uppercase tracking-widest opacity-40">FECHA_STAMP</th>
                                            <th className="p-6 text-[10px] font-black uppercase tracking-widest opacity-40 text-right">MAGNITUD</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {scoreHistory.length === 0 ? (
                                            <tr>
                                                <td colSpan={3} className="p-12 text-center text-sm font-bold opacity-20 italic">
                                                    SIN_REGISTROS_DISPONIBLES
                                                </td>
                                            </tr>
                                        ) : (
                                            scoreHistory.map((item) => (
                                                <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                                                    <td className="p-6">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse group-hover:scale-150 transition-transform"></div>
                                                            <span className="text-sm font-black uppercase tracking-tight">{item.eventType.replace(/_/g, ' ')}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-6">
                                                        <span className="text-[11px] font-bold opacity-40 uppercase tabular-nums tracking-widest">
                                                            {new Date(item.createdAt || new Date()).toLocaleDateString('es-AR', {
                                                                day: '2-digit',
                                                                month: '2-digit',
                                                                year: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </span>
                                                    </td>
                                                    <td className="p-6 text-right">
                                                        <span className="text-xl font-black tracking-tighter text-yellow-500">
                                                            +{item.pointsAwarded}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls */}
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

                            <div className="mt-12 flex justify-center">
                                <div className="px-6 py-4 border-[2px] border-white/5 bg-white/[0.02] inline-flex flex-col items-center">
                                    <Activity className="w-4 h-4 mb-2 opacity-20" />
                                    <div className="text-[8px] font-black uppercase tracking-[0.5em] opacity-30">END_OF_DATAFEED</div>
                                </div>
                            </div>
                        </div>
                    </section>
                </>
            )}
        </main>
    );
}
