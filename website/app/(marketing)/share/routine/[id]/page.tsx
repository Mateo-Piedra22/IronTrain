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
        <div className="flex flex-col min-h-[calc(100vh-80px)] p-6 md:p-12 items-center justify-center bg-[#f8fafc]">
            <div className="w-full max-w-2xl text-left">
                <div className="border border-slate-200 bg-white p-8 rounded-3xl shadow-xl relative overflow-hidden text-left">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-orange-500 to-amber-500"></div>

                    <div className="flex items-center gap-3 mb-6">
                        <Sparkles className="w-8 h-8 text-orange-500" />
                        <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">{routine.name}</h1>
                    </div>

                    {routine.description && (
                        <p className="text-slate-500 mb-8 border-l-4 border-orange-500/20 pl-4 py-1 italic font-medium">
                            {routine.description}
                        </p>
                    )}

                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-slate-50 p-4 rounded-2xl">
                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Días</div>
                            <div className="text-xl font-black text-slate-900">{Object.keys(groupedDays).length}</div>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl">
                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Autor</div>
                            <div className="text-sm font-black text-slate-900 truncate">@{routine.username || 'user'}</div>
                        </div>
                    </div>

                    <div className="space-y-6 mb-10">
                        <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">━━ Estructura del Plan</h3>
                        <div className="space-y-4">
                            {Object.values(groupedDays).map((day, idx) => (
                                <div key={idx} className="border border-slate-100 rounded-2xl p-4 bg-slate-50/30 text-left">
                                    <div className="font-black text-slate-800 mb-2 flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center">{idx + 1}</div>
                                        {day.name}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {day.exercises.length > 0 ? day.exercises.map((ex, i) => (
                                            <span key={i} className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded-lg font-bold text-slate-500">
                                                {ex}
                                            </span>
                                        )) : <span className="text-[10px] text-slate-400 italic">Sin ejercicios definidos</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <a
                            href={deepLink}
                            className="w-full px-6 py-5 bg-slate-900 text-white rounded-2xl hover:bg-black transition-all flex items-center justify-center gap-3 group text-sm font-black tracking-wider shadow-lg shadow-slate-900/20"
                        >
                            <Download className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
                            DESCARGAR EN MI APP
                        </a>
                        <button
                            type="button"
                            className="w-full px-6 py-4 border border-slate-200 bg-white rounded-2xl hover:border-slate-400 transition-all flex items-center justify-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase text-slate-500"
                            data-copy={publicLink}
                        >
                            <Copy className="w-4 h-4" />
                            Copiar Link Público
                        </button>

                        <p className="text-[10px] text-center text-slate-400 mt-6 px-4 leading-relaxed font-bold uppercase tracking-tighter">
                            ¿No tienes IronTrain? <Link href="/downloads" className="text-orange-500 underline">Consíguelo gratis aquí</Link>
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
                                    btn.innerHTML = 'COPIADO';
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
