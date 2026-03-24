import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import {
    ChevronRight,
    Clock,
    Globe,
    Plus,
    ShoppingBag,
    User
} from 'lucide-react';
import { unstable_noStore as noStore, revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import Link from 'next/link';
import { AdoptButton } from '../../../components/marketplace/AdoptButton';
import { db } from '../../../src/db';
import * as schema from '../../../src/db/schema';
import { verifyAuth } from '../../../src/lib/auth';
import { MarketplaceResolver } from '../../../src/lib/marketplace';
import { ExperimentWrapper } from '../../components/PostHogFeatures';


// Force dynamic rendering since we want real-time social feed
export const revalidate = 0;

export default async function RoutineFeedPage(props: { searchParams: Promise<{ view?: string }> }) {
    noStore();
    const sp = await props.searchParams;
    const view = sp.view || 'community';
    const isMarketplace = view === 'marketplace';

    const h = await headers();
    const request = {
        headers: h,
        nextUrl: { searchParams: new URLSearchParams() },
    } as any;
    const currentUserId = await verifyAuth(request);

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
        const request = {
            headers: h,
            nextUrl: { searchParams: new URLSearchParams() },
        } as any;
        const userId = await verifyAuth(request);
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
                        className={`flex-1 text-center py-4 font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${!isMarketplace ? 'bg-[#1a1a2e] text-[#f5f1e8]' : 'text-[#1a1a2e] hover:bg-[#1a1a2e]/5'}`}
                    >
                        <User className="w-3.5 h-3.5" /> COMUNIDAD_P2P
                    </Link>
                    <Link
                        href="/feed?view=marketplace"
                        className={`flex-1 text-center py-4 font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${isMarketplace ? 'bg-[#1a1a2e] text-[#f5f1e8]' : 'text-[#1a1a2e] hover:bg-[#1a1a2e]/5'}`}
                    >
                        <ShoppingBag className="w-3.5 h-3.5" /> MARKETPLACE_OFFICIAL
                    </Link>
                </div>

                {/* List View */}
                {!isMarketplace ? (
                    publicRoutinesData.length === 0 ? (
                        <div className="text-center py-24 border-2 border-[#1a1a2e] border-dashed bg-white/30">
                            <Globe className="w-12 h-12 mx-auto opacity-10 mb-6" />
                            <h3 className="text-base font-black uppercase mb-2">0_SOCIAL_DATA_FOUND</h3>
                            <p className="text-[9px] font-bold opacity-30 uppercase tracking-[0.3em]">No hay transmisiones públicas activas en este momento.</p>
                        </div>
                    ) : (
                        <div className="grid gap-6">
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
                        </div>
                    )
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
                                                href={`/auth/login`}
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
                )}
            </div>
        </section>
    );
}
