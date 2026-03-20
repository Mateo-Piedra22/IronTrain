import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
    ChevronRight,
    Clock,
    Dumbbell,
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
import { ExperimentWrapper, PremiumFeatureBadge } from '../../components/PostHogFeatures';


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

    // Fetch public routines with user profile usernames
    const publicRoutinesData = await db.select({
        id: schema.routines.id,
        name: schema.routines.name,
        description: schema.routines.description,
        userId: schema.routines.userId,
        username: schema.userProfiles.username,
        updatedAt: schema.routines.updatedAt,
    })
        .from(schema.routines)
        .leftJoin(schema.userProfiles, eq(schema.routines.userId, schema.userProfiles.id))
        .where(
            and(
                eq(schema.routines.isPublic, 1),
                isNull(schema.routines.deletedAt),
                sql`${schema.routines.isModerated} = 0 OR ${schema.routines.isModerated} IS NULL`
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
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <span className="text-[10px] font-black opacity-60 uppercase">SYNC_LIVE</span>
                        </div>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                        <div>
                            <h1 className="text-5xl lg:text-7xl font-black tracking-tighter mb-4 leading-[0.85] uppercase italic">
                                FEED_X_<span className="text-red-600">HUB</span>
                            </h1>
                            <p className="text-xs font-black opacity-40 max-w-xl leading-relaxed uppercase tracking-widest italic">
                                Explora el ecosistema IronTrain: rutinas de la comunidad y ejercicios oficiales del Marketplace.
                            </p>
                            <div className="mt-4">
                                <PremiumFeatureBadge />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab Switcher */}
                <div className="flex bg-[#1a1a2e]/5 p-1 border-2 border-[#1a1a2e] mb-12">
                    <Link
                        href="/feed?view=community"
                        className={`flex-1 text-center py-3 font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${!isMarketplace ? 'bg-[#1a1a2e] text-[#f5f1e8]' : 'text-[#1a1a2e] hover:bg-[#1a1a2e]/10'}`}
                    >
                        <User className="w-3.5 h-3.5" /> COMUNIDAD_P2P
                    </Link>
                    <Link
                        href="/feed?view=marketplace"
                        className={`flex-1 text-center py-3 font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${isMarketplace ? 'bg-[#1a1a2e] text-[#f5f1e8]' : 'text-[#1a1a2e] hover:bg-[#1a1a2e]/10'}`}
                    >
                        <ShoppingBag className="w-3.5 h-3.5" /> MARKETPLACE_OFFICIAL
                    </Link>
                </div>

                {/* List View */}
                {!isMarketplace ? (
                    publicRoutinesData.length === 0 ? (
                        <div className="text-center py-20 border-2 border-[#1a1a2e] border-dashed bg-white/50">
                            <Globe className="w-12 h-12 mx-auto opacity-20 mb-4" />
                            <h3 className="text-lg font-black uppercase mb-2">Ninguna rutina pública aún</h3>
                            <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Sé el primero en compartir tu entrenamiento con el mundo.</p>
                        </div>
                    ) : (
                        <div className="grid gap-6">
                            {publicRoutinesData.map((routine: any) => (
                                <ExperimentWrapper key={routine.id}>
                                    <Link
                                        href={`/share/routine/${routine.id}`}
                                        className="group block border-2 border-[#1a1a2e] p-6 hover:shadow-[12px_12px_0px_0px_rgba(26,26,46,1)] transition-all hover:-translate-y-1 bg-white"
                                    >
                                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                            <div className="flex-1 space-y-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="bg-[#1a1a2e] text-[#f5f1e8] px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter">P2P_ROUTINE</div>
                                                    <h2 className="text-2xl font-black uppercase tracking-tighter truncate group-hover:text-red-600">
                                                        {routine.name}
                                                    </h2>
                                                </div>

                                                {routine.description && (
                                                    <p className="text-xs font-bold opacity-60 line-clamp-2 md:line-clamp-3 leading-relaxed uppercase italic">
                                                        {routine.description}
                                                    </p>
                                                )}

                                                <div className="flex flex-wrap items-center gap-6 pt-4 text-[10px] font-black uppercase tracking-[0.2em]">
                                                    <div className="flex items-center gap-2 opacity-100">
                                                        <User className="w-3.5 h-3.5 text-red-600" />
                                                        <span>@{routine.username || 'user'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 opacity-30">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        <span>{routine.updatedAt && new Date(routine.updatedAt).getTime() > 0
                                                            ? new Date(routine.updatedAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                                            : new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-end justify-center h-full sm:pl-6 sm:border-l-2 sm:border-[#1a1a2e]/10">
                                                <div className="bg-[#1a1a2e] text-[#f5f1e8] h-12 w-12 flex items-center justify-center group-hover:bg-red-600 transition-colors shadow-[4px_4px_0px_0px_rgba(26,26,46,0.2)]">
                                                    <ChevronRight className="w-6 h-6" />
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                </ExperimentWrapper>
                            ))}
                        </div>
                    )
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {officialExercises.map((exercise: any) => {
                            const category = categories.find((c: any) => c.id === exercise.categoryId);
                            const isAdopted = adoptedOriginIds.includes(exercise.id);

                            return (
                                <div
                                    key={exercise.id}
                                    className="group relative border-2 border-[#1a1a2e] bg-white p-6 pb-20 flex flex-col justify-between hover:shadow-[12px_12px_0px_0px_rgba(26,26,46,1)] transition-all hover:-translate-y-1"
                                >
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <ShoppingBag size={80} strokeWidth={1} />
                                    </div>

                                    {category?.color && (
                                        <div className="absolute top-0 left-0 w-full h-1.5" style={{ backgroundColor: category.color }} />
                                    )}

                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-red-600 text-white px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter">OFFICIAL_ASSET</div>
                                            <span className="text-[9px] font-black uppercase opacity-40">{category?.name || 'EJERCICIO'}</span>
                                        </div>

                                        <h2 className="text-2xl font-black uppercase tracking-tighter leading-none italic decoration-red-600 group-hover:underline">
                                            {exercise.name}
                                        </h2>

                                        <div className="flex flex-wrap gap-1.5">
                                            {exercise.badges.map((eb: any) => (
                                                <span
                                                    key={eb.badge.id}
                                                    className="px-2 py-0.5 border border-[#1a1a2e] text-[8px] font-black uppercase tracking-widest bg-[#f5f1e8]"
                                                    style={{ color: eb.badge.color }}
                                                >
                                                    {eb.badge.name}
                                                </span>
                                            ))}
                                        </div>

                                        {exercise.notes && (
                                            <p className="text-[9px] font-bold opacity-50 uppercase tracking-widest leading-relaxed line-clamp-2 italic">
                                                {exercise.notes}
                                            </p>
                                        )}
                                    </div>

                                    <div className="absolute bottom-0 left-0 w-full p-4 border-t-2 border-[#1a1a2e] flex items-center justify-between">
                                        <div className="flex items-center gap-1">
                                            <Dumbbell className="w-3 h-3 opacity-20" />
                                            <span className="text-[8px] font-black opacity-30 uppercase">IRON_ASSET_ID: {exercise.id.slice(0, 8)}</span>
                                        </div>

                                        {!currentUserId ? (
                                            <Link
                                                href={`/`}
                                                className="px-4 py-2 bg-[#1a1a2e] text-[#f5f1e8] font-black text-[10px] uppercase tracking-widest hover:bg-red-600 transition-all shadow-[4px_4px_0px_0px_rgba(26,26,46,0.2)] flex items-center gap-2"
                                            >
                                                LOGIN <Plus className="w-3 h-3 text-red-600" />
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
