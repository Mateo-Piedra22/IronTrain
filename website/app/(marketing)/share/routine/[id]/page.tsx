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

    const routineRecords = await db.select({
        id: schema.routines.id,
        name: schema.routines.name,
        description: schema.routines.description,
        userId: schema.routines.userId,
        username: schema.userProfiles.username,
        updatedAt: schema.routines.updatedAt,
    })
        .from(schema.routines)
        .leftJoin(schema.userProfiles, eq(schema.routines.userId, schema.userProfiles.id))
        .where(and(eq(schema.routines.id, id), isNull(schema.routines.deletedAt)));

    const routine = routineRecords[0];

    if (!routine) return notFound();

    const daysWithExercises = await db.select({
        dayId: schema.routineDays.id,
        dayName: schema.routineDays.name,
        dayOrder: schema.routineDays.orderIndex,
        exerciseId: schema.routineExercises.id,
        exerciseName: schema.exercises.name,
        exerciseOrder: schema.routineExercises.orderIndex
    })
        .from(schema.routineDays)
        .leftJoin(schema.routineExercises, eq(schema.routineDays.id, schema.routineExercises.routineDayId))
        .leftJoin(schema.exercises, eq(schema.routineExercises.exerciseId, schema.exercises.id))
        .where(and(eq(schema.routineDays.routineId, id), isNull(schema.routineDays.deletedAt)))
        .orderBy(schema.routineDays.orderIndex, schema.routineExercises.orderIndex);

    // Grouping
    const groupedDays: Record<string, { name: string, exercises: string[] }> = {};
    daysWithExercises.forEach(row => {
        if (!groupedDays[row.dayId]) {
            groupedDays[row.dayId] = { name: row.dayName, exercises: [] };
        }
        if (row.exerciseName) {
            groupedDays[row.dayId].exercises.push(row.exerciseName);
        }
    });

    const deepLink = `irontrain://share/routine/${id}`;
    const publicLink = `https://irontrain.motiona.xyz/share/routine/${id}`;

    return (
        <div className="min-h-screen py-12 md:py-20 px-6 font-mono text-[#1a1a2e]">
            <div className="max-w-2xl mx-auto">
                {/* Back Link */}
                <Link href="/feed" className="inline-flex items-center gap-2 text-[10px] opacity-40 hover:opacity-100 mb-8 transition-opacity uppercase tracking-[0.2em]">
                    ← Volver al Directorio
                </Link>

                <div className="border border-current p-6 md:p-10 relative bg-[#f5f1e8]">
                    {/* Header Decorative Bar */}
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-current"></div>

                    <div className="flex flex-col gap-6">
                        {/* Title Section */}
                        <div>
                            <div className="text-[10px] opacity-40 tracking-[0.3em] mb-2 uppercase italic flex items-center gap-2">
                                <Sparkles className="w-3 h-3" />
                                PLAN DE ENTRENAMIENTO
                            </div>
                            <h1 className="text-3xl md:text-5xl font-bold tracking-tighter uppercase break-words leading-[0.9]">
                                {routine.name}
                            </h1>
                        </div>

                        {/* Description */}
                        {routine.description && (
                            <div className="border-l-2 border-current pl-4 py-2 opacity-70">
                                <p className="text-sm italic leading-relaxed">
                                    {routine.description}
                                </p>
                            </div>
                        )}

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 border-y border-current/10 py-6 my-2 gap-8">
                            <div>
                                <div className="text-[10px] opacity-40 uppercase tracking-widest mb-1">Volumen</div>
                                <div className="text-2xl font-bold">{Object.keys(groupedDays).length} DÍAS</div>
                            </div>
                            <div>
                                <div className="text-[10px] opacity-40 uppercase tracking-widest mb-1">Creado por</div>
                                <div className="text-sm font-bold truncate">@{routine.username || 'user'}</div>
                            </div>
                        </div>

                        {/* Structure Section */}
                        <div className="space-y-8">
                            <h3 className="text-[10px] opacity-40 uppercase tracking-[0.3em]">━━ DESGLOSE DE SESIONES</h3>

                            <div className="space-y-8">
                                {Object.values(groupedDays).map((day, idx) => (
                                    <div key={idx} className="relative pl-8">
                                        <div className="absolute left-0 top-0 text-[10px] font-bold opacity-30">
                                            {String(idx + 1).padStart(2, '0')}
                                        </div>
                                        <h4 className="font-bold text-lg uppercase tracking-tight mb-3">
                                            {day.name}
                                        </h4>
                                        <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-current/5 pt-3">
                                            {day.exercises.length > 0 ? day.exercises.map((ex, i) => (
                                                <div key={i} className="text-[11px] opacity-60 flex items-center gap-2 uppercase font-bold">
                                                    <span className="w-1 h-1 bg-current opacity-30 rounded-full" />
                                                    {ex}
                                                </div>
                                            )) : (
                                                <span className="text-[10px] opacity-30 italic">Sin ejercicios definidos</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Footer / Actions */}
                        <div className="mt-12 pt-8 border-t border-current space-y-4">
                            <a
                                href={deepLink}
                                className="w-full bg-[#1a1a2e] text-[#f5f1e8] py-5 px-6 flex items-center justify-center gap-4 hover:opacity-90 transition-opacity font-bold uppercase tracking-[0.15em] text-sm"
                            >
                                <Download className="w-5 h-5" />
                                DESCARGAR EN MI APP
                            </a>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    className="border border-current/20 py-4 px-6 flex items-center justify-center gap-3 hover:bg-current/5 transition-all text-[11px] font-bold uppercase tracking-wider"
                                    data-copy={publicLink}
                                >
                                    <Copy className="w-4 h-4 opacity-40" />
                                    Copiar Enlace
                                </button>
                                <Link
                                    href="/downloads"
                                    className="border border-current/20 py-4 px-6 flex items-center justify-center gap-3 hover:bg-current/5 transition-all text-[11px] font-bold uppercase tracking-wider"
                                >
                                    Obtener IronTrain
                                </Link>
                            </div>

                            <div className="text-[9px] opacity-30 text-center pt-6 uppercase tracking-widest leading-relaxed">
                                FECHA DE EMISIÓN: {new Date(routine.updatedAt).toLocaleDateString()}
                                <br />
                                VERIFICADO POR SISTEMA IRONTRAIN P2P
                            </div>
                        </div>
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
                                    const previousLabel = btn.innerHTML;
                                    btn.innerText = 'COPIADO ✓';
                                    setTimeout(() => { btn.innerHTML = previousLabel; }, 1500);
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
