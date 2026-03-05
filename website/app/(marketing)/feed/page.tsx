import { and, desc, eq, isNull } from 'drizzle-orm';
import { ChevronRight, Clock, Download, Globe, User } from 'lucide-react';
import { unstable_noStore as noStore } from 'next/cache';
import Link from 'next/link';
import { db } from '../../../src/db';
import * as schema from '../../../src/db/schema';

// Force dynamic rendering since we want real-time social feed
export const revalidate = 0;

export default async function RoutineFeedPage() {
    noStore(); // Ensure no aggressive caching for social feed

    // Fetch public routines with user profile usernames
    const publicRoutines = await db.select({
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
                isNull(schema.routines.deletedAt)
            )
        )
        .orderBy(desc(schema.routines.updatedAt));



    return (
        <section className="min-h-screen py-20 lg:py-32 bg-[#f5f1e8] text-[#1a1a2e] selection:bg-[#1a1a2e] selection:text-[#f5f1e8]">
            <div className="max-w-4xl mx-auto px-6 font-mono">

                {/* Header */}
                <div className="mb-16 border-b border-current/10 pb-8">
                    <div className="text-[10px] opacity-40 tracking-[0.3em] mb-4">
                        ━━━ P2P SOCIAL FEED ━━━
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-4 flex items-center gap-4">
                        <Globe className="w-10 h-10 opacity-80" />
                        DIRECTORIO GLOBAL
                    </h1>
                    <p className="text-sm opacity-70 max-w-2xl leading-relaxed">
                        Explora rutinas públicas compartidas por la comunidad de IronTrain.
                        Encuentra inspiración, descarga planes probados y entrena como los mejores.
                    </p>
                </div>

                {/* Feed List */}
                {publicRoutines.length === 0 ? (
                    <div className="text-center py-20 border border-current/20 border-dashed">
                        <Globe className="w-12 h-12 mx-auto opacity-20 mb-4" />
                        <h3 className="text-lg font-bold mb-2">Ninguna rutina pública aún</h3>
                        <p className="text-sm opacity-50">Sé el primero en compartir tu entrenamiento con el mundo.</p>
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {publicRoutines.map((routine: any) => (
                            <Link
                                href={`/share/routine/${routine.id}`}
                                key={routine.id}
                                className="group block border border-current/20 p-6 hover:border-current transition-all hover:-translate-y-1 bg-[#f5f1e8]"
                            >
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                    <div className="flex-1 space-y-3">
                                        <h2 className="text-2xl font-bold truncate group-hover:underline decoration-2 underline-offset-4">
                                            {routine.name}
                                        </h2>

                                        {routine.description && (
                                            <p className="text-sm opacity-70 line-clamp-2 md:line-clamp-3 leading-relaxed">
                                                {routine.description}
                                            </p>
                                        )}

                                        <div className="flex flex-wrap items-center gap-4 pt-4 text-[11px] opacity-50 uppercase tracking-widest font-bold">
                                            <div className="flex items-center gap-1.5">
                                                <User className="w-3.5 h-3.5" />
                                                <span className="truncate max-w-[120px]">@{routine.username || 'user'}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5" />
                                                <span>{new Date(routine.updatedAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="hidden md:flex flex-col items-end justify-between h-full pl-6 border-l border-current/10">
                                        <div className="bg-[#1a1a2e] text-[#f5f1e8] px-4 py-2 flex items-center gap-2 font-bold text-xs uppercase tracking-wider group-hover:bg-red-600 transition-colors">
                                            <Download className="w-3.5 h-3.5" />
                                            Obtener
                                        </div>
                                        <ChevronRight className="w-6 h-6 opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all mt-8" />
                                    </div>

                                    {/* Mobile button variant */}
                                    <div className="md:hidden mt-4 pt-4 border-t border-current/10">
                                        <div className="w-full bg-[#1a1a2e] text-[#f5f1e8] px-4 py-3 flex justify-center items-center gap-2 font-bold text-xs uppercase tracking-wider">
                                            <Download className="w-3.5 h-3.5" />
                                            Ver y Descargar
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
