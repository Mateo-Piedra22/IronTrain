import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import {
    Activity,
    ChevronRight,
    Clock,
    Flame,
    Globe,
    Trophy,
    User as UserIcon
} from 'lucide-react';
import { Metadata } from 'next';
import { unstable_noStore as noStore } from 'next/cache';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { ExperimentWrapper } from '../../../components/PostHogFeatures';

export const revalidate = 0;

export async function generateMetadata(props: { params: Promise<{ username: string }> }): Promise<Metadata> {
    const { username } = await props.params;
    return {
        title: `@${username} | IronTrain Social`,
        description: `View ${username}'s training progress, IronScore, and shared routines on IronTrain.`,
    };
}

export default async function UserProfilePage(props: { params: Promise<{ username: string }> }) {
    noStore();
    const { username } = await props.params;

    // Fetch User Profile
    const profile = await db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.username, username)
    });

    if (!profile) {
        notFound();
    }

    // Fetch user's public routines
    const routines = await db.select({
        id: schema.routines.id,
        name: schema.routines.name,
        description: schema.routines.description,
        updatedAt: schema.routines.updatedAt,
    })
        .from(schema.routines)
        .where(
            and(
                eq(schema.routines.userId, profile.id),
                eq(schema.routines.isPublic, 1),
                isNull(schema.routines.deletedAt),
                sql`${schema.routines.isModerated} = 0 OR ${schema.routines.isModerated} IS NULL`
            )
        )
        .orderBy(desc(schema.routines.updatedAt));

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
                                <div className="bg-[#1a1a2e] text-[#f5f1e8] px-3 py-1 text-[10px] font-black uppercase tracking-widest">VERIFIED_NODE</div>
                                <div className="border border-[#1a1a2e] px-3 py-1 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                    <Activity className="w-3 h-3" /> STATUS: ACTIVE
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-[3px] border-[#1a1a2e] bg-white divide-y-[3px] md:divide-y-0 md:divide-x-[3px] divide-[#1a1a2e] shadow-[16px_16px_0px_0px_rgba(26,26,46,0.05)]">
                        <div className="p-8 flex flex-col items-center justify-center text-center group hover:bg-[#1a1a2e] hover:text-[#f5f1e8] transition-all">
                            <Trophy className="w-6 h-6 mb-3 opacity-20 group-hover:opacity-100 transition-opacity" />
                            <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-1">TOTAL_IRONSCORE</div>
                            <div className="text-4xl lg:text-5xl font-black tracking-tighter">{profile.scoreLifetime || 0}</div>
                        </div>

                        <div className="p-8 flex flex-col items-center justify-center text-center group hover:bg-[#1a1a2e] hover:text-[#f5f1e8] transition-all">
                            <Flame className="w-6 h-6 mb-3 opacity-20 group-hover:opacity-100 transition-opacity text-orange-600 group-hover:text-current" />
                            <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-1">CURRENT_STREAK</div>
                            <div className="text-4xl lg:text-5xl font-black tracking-tighter">{profile.currentStreak || 0}W</div>
                        </div>

                        <div className="p-8 flex flex-col items-center justify-center text-center group hover:bg-[#1a1a2e] hover:text-[#f5f1e8] transition-all">
                            <Globe className="w-6 h-6 mb-3 opacity-20 group-hover:opacity-100 transition-opacity" />
                            <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-1">SHARED_COMMUNICATION</div>
                            <div className="text-4xl lg:text-5xl font-black tracking-tighter">{routines.length}</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Routines section */}
            <section className="py-20 lg:py-24">
                <div className="container mx-auto px-4 max-w-5xl">
                    <div className="flex items-center gap-4 mb-12">
                        <div className="h-px bg-[#1a1a2e] flex-1 opacity-20"></div>
                        <h2 className="text-sm font-black uppercase tracking-[0.5em] opacity-60">PUBLIC_DATAFEED</h2>
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
        </main>
    );
}
