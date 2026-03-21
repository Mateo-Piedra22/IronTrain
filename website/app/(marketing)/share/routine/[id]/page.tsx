import { and, eq, inArray, isNull, or } from 'drizzle-orm';
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
    const routineRecords = await db.select().from(schema.routines).where(
        and(
            eq(schema.routines.id, id),
            isNull(schema.routines.deletedAt),
            or(isNull(schema.routines.isModerated), eq(schema.routines.isModerated, 0))
        )
    );
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
        scoreLifetime: schema.userProfiles.scoreLifetime,
        updatedAt: schema.routines.updatedAt,
    })
        .from(schema.routines)
        .leftJoin(schema.userProfiles, eq(schema.routines.userId, schema.userProfiles.id))
        .where(
            and(
                eq(schema.routines.id, id),
                isNull(schema.routines.deletedAt),
                or(isNull(schema.routines.isModerated), eq(schema.routines.isModerated, 0))
            )
        );

    const routine = routineRecords[0];

    if (!routine) return notFound();

    const daysWithExercises = await db.select({
        dayId: schema.routineDays.id,
        dayName: schema.routineDays.name,
        dayOrder: schema.routineDays.orderIndex,
        exerciseLinkId: schema.routineExercises.id,
        exerciseId: schema.exercises.id,
        exerciseName: schema.exercises.name,
        exerciseOrder: schema.routineExercises.orderIndex
    })
        .from(schema.routineDays)
        .leftJoin(schema.routineExercises, eq(schema.routineDays.id, schema.routineExercises.routineDayId))
        .leftJoin(schema.exercises, eq(schema.routineExercises.exerciseId, schema.exercises.id))
        .where(and(eq(schema.routineDays.routineId, id), isNull(schema.routineDays.deletedAt)))
        .orderBy(schema.routineDays.orderIndex, schema.routineExercises.orderIndex);

    const exerciseIds = Array.from(new Set(daysWithExercises.map(row => row.exerciseId).filter(Boolean)));

    // Fetch Badges for those exercises
    let badgesForExercises: any[] = [];
    if (exerciseIds.length > 0) {
        badgesForExercises = await db.select({
            exerciseId: schema.exerciseBadges.exerciseId,
            id: schema.badges.id,
            name: schema.badges.name,
            color: schema.badges.color,
        })
            .from(schema.exerciseBadges)
            .innerJoin(schema.badges, eq(schema.exerciseBadges.badgeId, schema.badges.id))
            .where(
                and(
                    inArray(schema.exerciseBadges.exerciseId, exerciseIds as string[]),
                    isNull(schema.exerciseBadges.deletedAt)
                )
            );
    }

    // Grouping
    const groupedDays: Record<string, { name: string, exercises: { name: string, id: string, badges: any[] }[] }> = {};
    daysWithExercises.forEach(row => {
        if (!groupedDays[row.dayId]) {
            groupedDays[row.dayId] = { name: row.dayName, exercises: [] };
        }
        if (row.exerciseName && row.exerciseId) {
            const exBadges = badgesForExercises.filter(b => b.exerciseId === row.exerciseId);
            groupedDays[row.dayId].exercises.push({
                id: row.exerciseId,
                name: row.exerciseName,
                badges: exBadges
            });
        }
    });

    const deepLink = `irontrain://share/routine/${id}`;
    const publicLink = `https://irontrain.motiona.xyz/share/routine/${id}`;

    return (
        <div className="min-h-screen py-12 md:py-24 px-6 font-mono text-[#1a1a2e] bg-[#f5f1e8]">
            <div className="max-w-3xl mx-auto">
                {/* Back Link */}
                <Link href="/feed" className="inline-flex items-center gap-2 text-[9px] font-black opacity-30 hover:opacity-100 mb-10 transition-all uppercase tracking-[0.4em]">
                    ← DIRECTORY_RETURN
                </Link>

                <div className="border-[3px] border-current p-8 md:p-14 relative bg-white shadow-[20px_20px_0px_0px_rgba(26,26,46,0.05)]">
                    {/* Header Decorative Bar */}
                    <div className="absolute top-0 left-0 w-full h-2 bg-current opacity-100"></div>

                    <div className="flex flex-col gap-8">
                        {/* Title Section */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="text-[10px] font-black opacity-40 tracking-[0.4em] uppercase italic flex items-center gap-2">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    SOCIAL_TRANSMISSION_PROTOCOL
                                </div>
                                <div className="text-[10px] font-black opacity-100 border border-current px-2 py-0.5">
                                    SCORE: {routine.scoreLifetime} PTS
                                </div>
                            </div>
                            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter uppercase break-words leading-[0.8] italic">
                                {routine.name}
                            </h1>
                        </div>

                        {/* Description */}
                        {routine.description && (
                            <div className="border-l-[3px] border-current pl-6 py-1 opacity-80">
                                <p className="text-sm font-bold italic leading-relaxed uppercase max-w-xl">
                                    {routine.description}
                                </p>
                            </div>
                        )}

                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 border-y-[2px] border-current/10 py-8 gap-10">
                            <div>
                                <div className="text-[9px] font-black opacity-30 uppercase tracking-[0.3em] mb-2">SYSTEM_VOLUME</div>
                                <div className="text-3xl font-black italic tracking-tighter">{Object.keys(groupedDays).length} SESIONES_H/W</div>
                            </div>
                            <div>
                                <div className="text-[9px] font-black opacity-30 uppercase tracking-[0.3em] mb-2">CREATOR_ID</div>
                                <Link
                                    href={`/user/${routine.username}`}
                                    className="text-xl font-black truncate italic hover:underline block"
                                >
                                    @{routine.username || 'ANONYMOUS_USER'}
                                </Link>
                                <div className="text-[8px] font-black opacity-40 mt-1 uppercase tracking-widest">VERIFIED_REPUTATION: {routine.scoreLifetime}</div>
                            </div>
                        </div>

                        {/* Structure Section */}
                        <div className="space-y-10">
                            <h3 className="text-[10px] font-black opacity-30 uppercase tracking-[0.4em] border-b border-current/10 pb-4">
                                SESSION_BREAKDOWN_LOG
                            </h3>

                            <div className="space-y-12">
                                {Object.values(groupedDays).map((day, idx) => (
                                    <div key={idx} className="relative pl-10 border-l-[1px] border-current/10">
                                        <div className="absolute -left-[1px] top-0 w-[1px] h-6 bg-current"></div>
                                        <div className="absolute -left-10 top-0 text-[10px] font-black opacity-20">
                                            {String(idx + 1).padStart(2, '0')}
                                        </div>
                                        <h4 className="font-black text-xl lg:text-2xl uppercase tracking-tighter mb-4 italic">
                                            {day.name}
                                        </h4>
                                        <div className="flex flex-col gap-4">
                                            {day.exercises.length > 0 ? day.exercises.map((ex, i) => (
                                                <div key={i} className="relative group/ex">
                                                    <div className="text-[12px] font-bold flex flex-wrap items-center gap-3 uppercase">
                                                        <span className="w-1.5 h-1.5 bg-current opacity-20" />
                                                        <span className="tracking-tight">{ex.name}</span>

                                                        {/* Badges UI for Web */}
                                                        {ex.badges.length > 0 && (
                                                            <div className="flex flex-wrap gap-1.5 ml-2">
                                                                {ex.badges.map((badge, bIdx) => (
                                                                    <span
                                                                        key={bIdx}
                                                                        className="text-[8px] px-2 py-0.5 border border-current font-black tracking-tighter"
                                                                        style={{
                                                                            backgroundColor: `${badge.color}10`,
                                                                            color: badge.color,
                                                                            borderColor: `${badge.color}30`
                                                                        }}
                                                                    >
                                                                        {badge.name}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )) : (
                                                <span className="text-[10px] opacity-30 italic font-black uppercase">NULL_EXERCISE_DATA</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Footer / Actions */}
                        <div className="mt-16 pt-10 border-t-[3px] border-current space-y-6">
                            <a
                                href={deepLink}
                                className="w-full bg-[#1a1a2e] text-[#f5f1e8] py-6 px-6 flex items-center justify-center gap-4 hover:invert transition-all font-black uppercase tracking-[0.2em] text-sm"
                            >
                                <Download className="w-5 h-5" />
                                DOWNLOAD_TO_LOCAL_NODE
                            </a>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    className="border-[2px] border-current py-4 px-6 flex items-center justify-center gap-3 hover:bg-current hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.2em]"
                                    data-copy={publicLink}
                                >
                                    <Copy className="w-4 h-4" />
                                    COPY_TRANSMISSION_ID
                                </button>
                                <Link
                                    href="/downloads"
                                    className="border-[2px] border-current py-4 px-6 flex items-center justify-center gap-3 hover:bg-current hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.2em]"
                                >
                                    ACQUIRE_IRONTRAIN_V2.0
                                </Link>
                            </div>

                            <div className="text-[9px] font-black opacity-30 text-center pt-8 uppercase tracking-[0.3em] leading-loose max-w-md mx-auto">
                                EMISSION_TIMESTAMP: {routine.updatedAt && new Date(routine.updatedAt).getTime() > 0
                                    ? new Date(routine.updatedAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                    : new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                <br />
                                STATUS: VERIFIED_BY_IRONTRAIN_P2P_NETWORK
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
