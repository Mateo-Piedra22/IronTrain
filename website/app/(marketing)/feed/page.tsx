import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import {
    Activity,
    ChevronRight,
    Clock,
    Flame,
    Globe,
    Palette,
    Plus,
    ShoppingBag,
    Trophy,
    User
} from 'lucide-react';
import { unstable_noStore as noStore, revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import Link from 'next/link';
import { AdoptButton } from '../../../components/marketplace/AdoptButton';
import { db } from '../../../src/db';
import * as schema from '../../../src/db/schema';
import { MarketplaceResolver } from '../../../src/lib/marketplace';
import { verifyAuthFromHeaders } from '../../../src/lib/server-auth';
import { ExperimentWrapper } from '../../components/PostHogFeatures';


// Force dynamic rendering since we want real-time social feed
export const revalidate = 0;

const parseActivityMetadata = (metadata: unknown): { metadata: Record<string, unknown> | null; value: unknown } => {
    const obj = (typeof metadata === 'object' && metadata !== null)
        ? metadata as Record<string, unknown>
        : null;
    const value = obj?.prValue ?? obj?.pointsAwarded ?? obj?.durationMin;
    return { metadata: obj, value };
};

export default async function RoutineFeedPage(props: { searchParams: Promise<{ view?: string }> }) {
    noStore();
    const sp = await props.searchParams;
    const view = sp.view || 'community';
    const isMarketplace = view === 'marketplace';
    const isThemes = view === 'themes';

    const h = await headers();
    const currentUserId = await verifyAuthFromHeaders(h);

    const actionLabel = (actionType: string) => {
        if (actionType === 'pr_broken') return 'PR BATIDO';
        if (actionType === 'routine_shared') return 'RUTINA COMPARTIDA';
        return 'WORKOUT COMPLETADO';
    };

    // Fetch public routines with user profile usernames and scores
    const publicRoutinesData = await db.select({
        id: schema.routines.id,
        name: schema.routines.name,
        description: schema.routines.description,
        userId: schema.routines.userId,
        username: schema.userProfiles.username,
        scoreLifetime: schema.userProfiles.scoreLifetime,
        updatedAt: schema.routines.updatedAt,
    })
        .from(schema.routines)
        .leftJoin(schema.userProfiles, eq(schema.routines.userId, schema.userProfiles.id))
        .where(
            and(
                eq(schema.routines.isPublic, true),
                or(eq(schema.userProfiles.isPublic, true), isNull(schema.userProfiles.id)),
                isNull(schema.routines.deletedAt),
                or(
                    eq(schema.routines.isModerated, false),
                    isNull(schema.routines.isModerated)
                )
            )
        )
        .orderBy(desc(schema.routines.updatedAt));

    const recentSocialActivity = await db.select({
        id: schema.activityFeed.id,
        actionType: schema.activityFeed.actionType,
        metadata: schema.activityFeed.metadata,
        createdAt: schema.activityFeed.createdAt,
        kudoCount: schema.activityFeed.kudoCount,
        username: schema.userProfiles.username,
        displayName: schema.userProfiles.displayName,
        scoreLifetime: schema.userProfiles.scoreLifetime,
    })
        .from(schema.activityFeed)
        .leftJoin(schema.userProfiles, eq(schema.activityFeed.userId, schema.userProfiles.id))
        .where(
            and(
                isNull(schema.activityFeed.deletedAt),
                eq(schema.userProfiles.isPublic, true)
            )
        )
        .orderBy(desc(schema.activityFeed.createdAt))
        .limit(12);

    const publicThemes = await db.select({
        id: schema.themePacks.id,
        slug: schema.themePacks.slug,
        name: schema.themePacks.name,
        description: schema.themePacks.description,
        tags: schema.themePacks.tags,
        supportsLight: schema.themePacks.supportsLight,
        supportsDark: schema.themePacks.supportsDark,
        ownerId: schema.themePacks.ownerId,
        currentVersion: schema.themePacks.currentVersion,
        downloadsCount: schema.themePacks.downloadsCount,
        appliesCount: schema.themePacks.appliesCount,
        ratingAvg: schema.themePacks.ratingAvg,
        ratingCount: schema.themePacks.ratingCount,
        updatedAt: schema.themePacks.updatedAt,
        username: schema.userProfiles.username,
        displayName: schema.userProfiles.displayName,
    })
        .from(schema.themePacks)
        .leftJoin(schema.userProfiles, eq(schema.themePacks.ownerId, schema.userProfiles.id))
        .where(
            and(
                isNull(schema.themePacks.deletedAt),
                eq(schema.themePacks.visibility, 'public'),
                eq(schema.themePacks.status, 'approved'),
                or(eq(schema.userProfiles.isPublic, true), isNull(schema.userProfiles.id)),
            ),
        )
        .orderBy(desc(schema.themePacks.appliesCount), desc(schema.themePacks.downloadsCount), desc(schema.themePacks.updatedAt))
        .limit(40);

    const themeIds = publicThemes.map((theme) => theme.id);
    const themeVersions = themeIds.length > 0
        ? await db.select({
            themePackId: schema.themePackVersions.themePackId,
            version: schema.themePackVersions.version,
            payload: schema.themePackVersions.payload,
        })
            .from(schema.themePackVersions)
            .where(inArray(schema.themePackVersions.themePackId, themeIds))
        : [];

    const versionMap = new Map<string, Record<string, unknown>>();
    for (const row of themeVersions) {
        const theme = publicThemes.find((item) => item.id === row.themePackId);
        if (!theme) continue;
        if (row.version !== theme.currentVersion) continue;
        versionMap.set(row.themePackId, (row.payload ?? {}) as Record<string, unknown>);
    }

    // Fetch Marketplace Data
    const officialExercises = await db.query.exercises.findMany({
        where: eq(schema.exercises.isSystem, 1),
        with: {
            badges: {
                with: {
                    badge: true
                }
            }
        },
        orderBy: desc(schema.exercises.updatedAt)
    });

    const categories = await db.select().from(schema.categories).where(eq(schema.categories.isSystem, 1));

    // Fetch adopted originIds for current user
    let adoptedOriginIds: string[] = [];
    if (currentUserId) {
        const userExercises = await db.select({ originId: schema.exercises.originId })
            .from(schema.exercises)
            .where(
                and(
                    eq(schema.exercises.userId, currentUserId),
                    inArray(schema.exercises.originId, officialExercises.map(e => e.id).concat(['__EMPTY__']))
                )
            );
        adoptedOriginIds = userExercises.map(ue => ue.originId).filter(Boolean) as string[];
    }

    async function handleAdoptAction(formData: FormData) {
        'use server';
        const h = await headers();
        const userId = await verifyAuthFromHeaders(h);
        if (!userId) return;

        const exerciseId = formData.get('exerciseId') as string;
        await MarketplaceResolver.checkoutExercises(userId, [exerciseId]);
        revalidatePath('/feed');
    }

    return (
        <section className="min-h-screen py-20 lg:py-32 bg-[#f5f1e8] text-[#1a1a2e] selection:bg-[#1a1a2e] selection:text-[#f5f1e8]">
            <div className="max-w-4xl mx-auto px-6 font-mono">

                <div className="mb-16 border-b-2 border-[#1a1a2e] pb-10">
                    <div className="flex items-center justify-between mb-6">
                        <div className="text-[10px] font-black opacity-40 tracking-[0.4em] uppercase">
                            DIRECTORIO_GLOBAL_ESTADOS_Y_ACCION
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#1a1a2e] animate-pulse"></span>
                            <span className="text-[10px] font-black opacity-60 uppercase">SYNC_LIVE</span>
                        </div>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                        <div>
                            <h1 className="text-5xl lg:text-7xl font-black tracking-tighter mb-4 leading-[0.85] uppercase italic">
                                FEED_X_<span className="opacity-40">HUB</span>
                            </h1>
                            <p className="text-xs font-black opacity-40 max-w-xl leading-relaxed uppercase tracking-widest italic">
                                Ecosistema IronTrain v2.0: Directorio social de rutinas P2P y activos oficiales.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Tab Switcher */}
                <div className="flex bg-transparent border-2 border-[#1a1a2e] mb-12">
                    <Link
                        href="/feed?view=community"
                        className={`flex-1 text-center py-4 font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${!isMarketplace && !isThemes ? 'bg-[#1a1a2e] text-[#f5f1e8]' : 'text-[#1a1a2e] hover:bg-[#1a1a2e]/5'}`}
                    >
                        <User className="w-3.5 h-3.5" /> ROUTINES_MARKET
                    </Link>
                    <Link
                        href="/feed?view=marketplace"
                        className={`flex-1 text-center py-4 font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${isMarketplace ? 'bg-[#1a1a2e] text-[#f5f1e8]' : 'text-[#1a1a2e] hover:bg-[#1a1a2e]/5'}`}
                    >
                        <ShoppingBag className="w-3.5 h-3.5" /> OFFICIAL_MARKET
                    </Link>
                    <Link
                        href="/feed?view=themes"
                        className={`flex-1 text-center py-4 font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${isThemes ? 'bg-[#1a1a2e] text-[#f5f1e8]' : 'text-[#1a1a2e] hover:bg-[#1a1a2e]/5'}`}
                    >
                        <Palette className="w-3.5 h-3.5" /> THEMES_MARKET
                    </Link>
                </div>

                {/* List View */}
                {!isMarketplace && !isThemes ? (
                    publicRoutinesData.length === 0 ? (
                        <div className="text-center py-24 border-2 border-[#1a1a2e] border-dashed bg-white/30">
                            <Globe className="w-12 h-12 mx-auto opacity-10 mb-6" />
                            <h3 className="text-base font-black uppercase mb-2">0_ROUTINES_FOUND</h3>
                            <p className="text-[9px] font-bold opacity-30 uppercase tracking-[0.3em]">No hay rutinas públicas disponibles en este momento.</p>
                        </div>
                    ) : (
                        <div className="grid gap-8">
                            {publicRoutinesData.map((routine: any) => (
                                <ExperimentWrapper key={routine.id}>
                                    <Link
                                        href={`/share/routine/${routine.id}`}
                                        className="group block border-2 border-[#1a1a2e] p-7 transition-all hover:bg-[#1a1a2e] hover:text-[#f5f1e8] bg-white relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 right-0 p-2 opacity-5 font-bold text-[60px] leading-none select-none pointer-events-none">
                                            {routine.scoreLifetime}
                                        </div>

                                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative z-10">
                                            <div className="flex-1 space-y-5">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <div className="border border-[#1a1a2e] group-hover:border-[#f5f1e8] px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter transition-colors">P2P_DATABANK</div>
                                                    <div className="bg-[#1a1a2e] text-[#f5f1e8] group-hover:bg-[#f5f1e8] group-hover:text-[#1a1a2e] px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter flex items-center gap-1 transition-colors">
                                                        SCORE: {routine.scoreLifetime} PTS
                                                    </div>
                                                </div>

                                                <h2 className="text-3xl lg:text-4xl font-black uppercase tracking-tighter leading-none">
                                                    {routine.name}
                                                </h2>

                                                {routine.description && (
                                                    <p className="text-xs font-bold opacity-60 line-clamp-2 md:line-clamp-3 leading-relaxed uppercase italic max-w-2xl">
                                                        {routine.description}
                                                    </p>
                                                )}

                                                <div className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-2 text-[9px] font-bold uppercase tracking-[0.25em]">
                                                    <div className="flex items-center gap-2">
                                                        <User className="w-3.5 h-3.5" />
                                                        <span className="opacity-100 italic">CREATOR:
                                                            <Link href={`/user/${routine.username}`} className="hover:underline ml-1">
                                                                @{routine.username || 'ANON'}
                                                            </Link>
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 opacity-40">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        <span>TS: {routine.updatedAt && new Date(routine.updatedAt).getTime() > 0
                                                            ? new Date(routine.updatedAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                                            : new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center md:items-start pt-2">
                                                <ChevronRight className="w-8 h-8 opacity-20 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        </div>
                                    </Link>
                                </ExperimentWrapper>
                            ))}

                            {recentSocialActivity.length > 0 && (
                                <section className="border-2 border-[#1a1a2e] bg-white p-6 md:p-8">
                                    <div className="flex items-center justify-between mb-6">
                                        <h2 className="text-[10px] font-black uppercase tracking-[0.25em] opacity-60">SOCIAL_ACTIVITY_STREAM</h2>
                                        <Activity className="w-4 h-4 opacity-40" />
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        {recentSocialActivity.map((entry) => {
                                            const { metadata, value } = parseActivityMetadata(entry.metadata);
                                            return (
                                                <div key={entry.id} className="border border-[#1a1a2e]/20 p-4">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="text-[9px] font-black uppercase tracking-[0.2em]">{actionLabel(entry.actionType)}</div>
                                                        <div className="text-[9px] font-bold opacity-40">{new Date(entry.createdAt || new Date()).toLocaleDateString('es-AR')}</div>
                                                    </div>
                                                    <div className="text-sm font-black uppercase tracking-tight">
                                                        @{entry.username || entry.displayName || 'athlete'}
                                                    </div>
                                                    <div className="flex items-center gap-4 mt-3 text-[10px] font-bold uppercase tracking-[0.15em] opacity-60">
                                                        <span className="flex items-center gap-1"><Flame className="w-3.5 h-3.5" /> {entry.kudoCount || 0} KUDOS</span>
                                                        <span className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5" /> SCORE {entry.scoreLifetime || 0}</span>
                                                        {value !== undefined && value !== null && <span>VALOR {String(value)}</span>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}
                        </div>
                    )
                ) : isMarketplace ? (
                    officialExercises.length === 0 ? (
                        <div className="text-center py-24 border-2 border-[#1a1a2e] border-dashed bg-white/30">
                            <ShoppingBag className="w-12 h-12 mx-auto opacity-10 mb-6" />
                            <h3 className="text-base font-black uppercase mb-2">0_OFFICIAL_ASSETS_FOUND</h3>
                            <p className="text-[9px] font-bold opacity-30 uppercase tracking-[0.3em]">No hay assets oficiales públicos disponibles en este momento.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {officialExercises.map((exercise: any) => {
                                const category = categories.find((c: any) => c.id === exercise.categoryId);
                                const isAdopted = adoptedOriginIds.includes(exercise.id);

                                return (
                                    <div
                                        key={exercise.id}
                                        className="group relative border-[3px] border-[#1a1a2e] bg-white p-8 pb-24 flex flex-col justify-between hover:bg-[#1a1a2e] hover:text-[#f5f1e8] transition-all shadow-[12px_12px_0px_0px_rgba(26,26,46,0.05)]"
                                    >
                                        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                                            <ShoppingBag size={100} strokeWidth={1.5} />
                                        </div>

                                        <div className="space-y-6 relative z-10">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-current text-background px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter">OFFICIAL_CORE_ASSET</div>
                                                <span className="text-[10px] font-black uppercase opacity-40 italic tracking-widest">{category?.name || 'GENERIC_COMPONENT'}</span>
                                            </div>

                                            <h2 className="text-3xl lg:text-4xl font-black uppercase tracking-tighter leading-[0.9] italic group-hover:underline">
                                                {exercise.name}
                                            </h2>

                                            <div className="flex flex-wrap gap-2">
                                                {exercise.badges.map((eb: any) => (
                                                    <span
                                                        key={eb.badge.id}
                                                        className="px-2 py-0.5 border border-current text-[8px] font-black uppercase tracking-widest bg-current/5"
                                                        style={{
                                                            color: eb.badge.color === '#ef4444' ? 'inherit' : eb.badge.color,
                                                            borderColor: `${eb.badge.color}40`
                                                        }}
                                                    >
                                                        {eb.badge.name}
                                                    </span>
                                                ))}
                                            </div>

                                            {exercise.notes && (
                                                <p className="text-[10px] font-bold opacity-60 uppercase tracking-tight leading-relaxed line-clamp-2 italic max-w-xs">
                                                    {exercise.notes}
                                                </p>
                                            )}
                                        </div>

                                        <div className="absolute bottom-0 left-0 w-full p-6 border-t-[1px] border-current/20 flex items-center justify-between z-20">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[8px] font-black opacity-30 uppercase tracking-[0.2em]">IRON_ASSET_ID</span>
                                                <span className="text-[10px] font-black tracking-tighter">{exercise.id.slice(0, 12).toUpperCase()}</span>
                                            </div>

                                            {!currentUserId ? (
                                                <Link
                                                    href={`/auth/sign-in`}
                                                    className="px-6 py-3 bg-current text-background font-black text-[10px] uppercase tracking-[0.2em] hover:invert transition-all flex items-center gap-2"
                                                >
                                                    AUTH_REQUIRED <Plus className="w-3.5 h-3.5" />
                                                </Link>
                                            ) : (
                                                <form action={handleAdoptAction}>
                                                    <input type="hidden" name="exerciseId" value={exercise.id} />
                                                    <AdoptButton isAdopted={isAdopted} />
                                                </form>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )
                ) : (
                    publicThemes.length === 0 ? (
                        <div className="text-center py-24 border-2 border-[#1a1a2e] border-dashed bg-white/30">
                            <Palette className="w-12 h-12 mx-auto opacity-10 mb-6" />
                            <h3 className="text-base font-black uppercase mb-2">0_THEMES_FOUND</h3>
                            <p className="text-[9px] font-bold opacity-30 uppercase tracking-[0.3em]">No hay themes públicos disponibles en este momento.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {publicThemes.map((theme) => {
                                const payload = versionMap.get(theme.id) || {};
                                const preview = (payload.preview && typeof payload.preview === 'object')
                                    ? payload.preview as Record<string, string>
                                    : {};
                                const hero = preview.hero || '#8AA0B8';
                                const surface = preview.surface || '#FFFFFF';
                                const text = preview.text || '#0F172A';
                                const tags = Array.isArray(theme.tags) ? theme.tags.slice(0, 3) : [];

                                return (
                                    <Link
                                        key={theme.id}
                                        href={`/share/theme/${theme.slug}`}
                                        className="group relative border-[3px] border-[#1a1a2e] bg-white p-8 pb-24 flex flex-col justify-between hover:bg-[#1a1a2e] hover:text-[#f5f1e8] transition-all shadow-[12px_12px_0px_0px_rgba(26,26,46,0.05)]"
                                    >
                                        <div className="space-y-6 relative z-10">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-current text-background px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter">THEME_PACK</div>
                                                <span className="text-[10px] font-black uppercase opacity-40 italic tracking-widest">V{theme.currentVersion}</span>
                                            </div>

                                            <h2 className="text-3xl lg:text-4xl font-black uppercase tracking-tighter leading-[0.9] italic group-hover:underline">
                                                {theme.name}
                                            </h2>

                                            {theme.description && (
                                                <p className="text-[10px] font-bold opacity-60 uppercase tracking-tight leading-relaxed line-clamp-2 italic max-w-xs">
                                                    {theme.description}
                                                </p>
                                            )}

                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="h-12 border border-current/20" style={{ backgroundColor: hero }} />
                                                <div className="h-12 border border-current/20" style={{ backgroundColor: surface }} />
                                                <div className="h-12 border border-current/20" style={{ backgroundColor: text }} />
                                            </div>

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

                                        <div className="absolute bottom-0 left-0 w-full p-6 border-t-[1px] border-current/20 flex items-center justify-between z-20">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[8px] font-black opacity-30 uppercase tracking-[0.2em]">THEME_ID</span>
                                                <span className="text-[10px] font-black tracking-tighter">{theme.slug.toUpperCase()}</span>
                                                <span className="text-[8px] font-black opacity-50">@{theme.username || theme.displayName || 'ANON'}</span>
                                            </div>
                                            <div className="text-right text-[8px] font-black opacity-60 uppercase tracking-[0.2em]">
                                                <div>Installs {theme.downloadsCount}</div>
                                                <div>Applies {theme.appliesCount}</div>
                                                <div>Rate {Number(theme.ratingAvg || 0).toFixed(1)} ({theme.ratingCount || 0})</div>
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )
                )}
            </div>
        </section>
    );
}
