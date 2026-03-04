import { and, eq, isNull } from 'drizzle-orm';
import { Copy, Download, Sparkles } from 'lucide-react';
import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '../../../../../src/db';
import * as schema from '../../../../../src/db/schema';

interface RoutinePageProps {
    params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: RoutinePageProps): Promise<Metadata> {
    const { id } = await params;
    const routineRecords = await db.select().from(schema.routines).where(and(eq(schema.routines.id, id), isNull(schema.routines.deletedAt)));
    const routine = routineRecords[0];

    if (!routine) return { title: 'Rutina No Encontrada' };

    return {
        title: `Descargar ${routine.name} | IronTrain`,
        description: routine.description || `Sincroniza esta rutina directamente a tu aplicación IronTrain.`,
    };
}

export default async function RoutineSharePage({ params }: RoutinePageProps) {
    const { id } = await params;

    const routineRecords = await db.select().from(schema.routines).where(and(eq(schema.routines.id, id), isNull(schema.routines.deletedAt)));
    const routine = routineRecords[0];

    if (!routine) return notFound();

    const daysRecords = await db.select().from(schema.routineDays).where(and(eq(schema.routineDays.routineId, id), isNull(schema.routineDays.deletedAt))).orderBy(schema.routineDays.orderIndex);

    // Prepare Deep Link (Will trigger intent over IronTrain app)
    const deepLink = `irontrain://share/routine/${id}`;
    const publicLink = `https://irontrain.motiona.xyz/share/routine/${id}`;

    return (
        <div className="flex flex-col min-h-[calc(100vh-80px)] p-6 md:p-12 items-center justify-center">
            <div className="w-full max-w-lg">
                <div className="border border-current/20 bg-white/50 backdrop-blur-sm p-8 rounded-sm shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-amber-500"></div>

                    <div className="flex items-center gap-3 mb-6">
                        <Sparkles className="w-6 h-6 opacity-40 text-red-500" />
                        <h1 className="text-3xl font-bold tracking-tight uppercase">{routine.name}</h1>
                    </div>

                    {routine.description && (
                        <p className="text-sm opacity-60 mb-8 border-l-2 border-current/20 pl-4 py-1 italic font-mono">
                            "{routine.description}"
                        </p>
                    )}

                    <div className="space-y-4 mb-8">
                        <div className="text-[10px] opacity-40 font-mono tracking-widest mb-2 uppercase">━━ Desglose del Plan</div>
                        <div className="flex items-center justify-between border-b border-current/10 py-3 font-mono text-sm">
                            <span className="opacity-80">Días de Entrenamiento</span>
                            <span className="font-bold tabular-nums">{daysRecords.length} Días</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-current/10 py-3 font-mono text-sm">
                            <span className="opacity-80">Creador</span>
                            <span className="font-bold truncate max-w-[120px]" title={routine.userId}>{routine.userId}</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 font-mono">
                        <a
                            href={deepLink}
                            className="w-full px-6 py-4 bg-[#1a1a2e] text-[#f5f1e8] hover:bg-black transition-colors flex items-center justify-center gap-2 group text-sm font-bold tracking-wider"
                        >
                            <Download className="w-4 h-4 group-hover:-translate-y-1 transition-transform" />
                            ABRIR Y DESCARGAR EN LA APP
                        </a>
                        <button
                            type="button"
                            className="w-full px-6 py-3 border border-current/20 hover:border-current transition-colors flex items-center justify-center gap-2 text-xs font-bold tracking-wider uppercase"
                            data-copy={publicLink}
                        >
                            <Copy className="w-4 h-4" />
                            Copiar link público
                        </button>

                        <p className="text-xs text-center opacity-40 mt-4 px-4 leading-relaxed tracking-wide">
                            Si no tienes la app instalada, debes <Link href="/downloads" className="underline hover:text-red-500">Descargar IronTrain</Link> primero.
                        </p>
                    </div>
                </div>
            </div>
            <script
                dangerouslySetInnerHTML={{
                    __html: `
                    (function () {
                        document.querySelectorAll('[data-copy]').forEach(function (btn) {
                            btn.addEventListener('click', async function () {
                                try {
                                    const link = btn.getAttribute('data-copy');
                                    if (!link) return;
                                    await navigator.clipboard.writeText(link);
                                    const previous = btn.innerHTML;
                                    btn.innerHTML = 'Link copiado';
                                    setTimeout(() => { btn.innerHTML = previous; }, 1200);
                                } catch {}
                            });
                        });
                    })();
                `,
                }}
            />
        </div>
    );
}
