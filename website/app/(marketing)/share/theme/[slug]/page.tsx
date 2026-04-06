import { and, desc, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { Palette } from 'lucide-react';
import { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ThemeModePreview from '../../../../../components/marketplace/ThemeModePreview';
import { db } from '../../../../../src/db';
import * as schema from '../../../../../src/db/schema';
import { verifyAuthFromHeaders } from '../../../../../src/lib/server-auth';
import { buildThemeHashtags } from '../../../../../src/lib/theme-marketplace/theme-hashtags';
import { ThemeInteractionsPanel } from './ThemeInteractionsPanel';
import { ThemeShareActions } from './ThemeShareActions';

interface ThemePageProps {
    params: Promise<{ slug: string }>;
    searchParams?: Promise<{ commentsPage?: string; feedbackPage?: string; feedbackStatus?: string; mode?: string }>;
}

async function getThemePackBySlug(slug: string) {
    const rows = await db.select({
        id: schema.themePacks.id,
        ownerId: schema.themePacks.ownerId,
        slug: schema.themePacks.slug,
        name: schema.themePacks.name,
        description: schema.themePacks.description,
        tags: schema.themePacks.tags,
        currentVersion: schema.themePacks.currentVersion,
        supportsLight: schema.themePacks.supportsLight,
        supportsDark: schema.themePacks.supportsDark,
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
                eq(schema.themePacks.slug, slug),
                isNull(schema.themePacks.deletedAt),
                eq(schema.themePacks.visibility, 'public'),
                eq(schema.themePacks.status, 'approved'),
            ),
        )
        .limit(1);

    const pack = rows[0];
    if (!pack) return null;

    const [version] = await db.select({
        payload: schema.themePackVersions.payload,
    })
        .from(schema.themePackVersions)
        .where(
            and(
                eq(schema.themePackVersions.themePackId, pack.id),
                eq(schema.themePackVersions.version, pack.currentVersion),
            ),
        )
        .limit(1);

    return {
        pack,
        payload: (version?.payload ?? {}) as Record<string, unknown>,
    };
}

export async function generateMetadata({ params }: ThemePageProps): Promise<Metadata> {
    const { slug } = await params;
    const data = await getThemePackBySlug(slug);

    if (!data) return { title: 'Theme no encontrado' };

    return {
        title: `Descargar ${data.pack.name} | IronTrain Themes`,
        description: data.pack.description || `Importa el theme ${data.pack.name} directamente en IronTrain.`,
    };
}

export default async function ThemeSharePage({ params, searchParams }: ThemePageProps) {
    const { slug } = await params;
    const sp = searchParams ? await searchParams : undefined;

    const parsedCommentsPage = Number(sp?.commentsPage ?? '1');
    const commentsPage = Number.isFinite(parsedCommentsPage) && parsedCommentsPage > 0
        ? Math.floor(parsedCommentsPage)
        : 1;
    const commentsPageSize = 6;

    const parsedFeedbackPage = Number(sp?.feedbackPage ?? '1');
    const feedbackPage = Number.isFinite(parsedFeedbackPage) && parsedFeedbackPage > 0
        ? Math.floor(parsedFeedbackPage)
        : 1;
    const feedbackPageSize = 5;
    const feedbackStatusRaw = (sp?.feedbackStatus ?? 'all').toLowerCase();
    const feedbackStatus = ['all', 'open', 'resolved', 'dismissed'].includes(feedbackStatusRaw)
        ? feedbackStatusRaw as 'all' | 'open' | 'resolved' | 'dismissed'
        : 'all';
    const previewModeRaw = (sp?.mode ?? '').toLowerCase();

    const data = await getThemePackBySlug(slug);

    if (!data) return notFound();

    const { pack, payload } = data;
    const initialPreviewMode = previewModeRaw === 'light' || previewModeRaw === 'dark'
        ? previewModeRaw
        : pack.supportsDark
            ? 'dark'
            : 'light';
    const resolvedPreviewMode = initialPreviewMode === 'dark' && !pack.supportsDark
        ? 'light'
        : initialPreviewMode === 'light' && !pack.supportsLight && pack.supportsDark
            ? 'dark'
            : initialPreviewMode;
    const requestHeaders = await headers();
    const currentUserId = await verifyAuthFromHeaders(requestHeaders);

    const reviewWhere = and(
        eq(schema.themePackRatings.themePackId, pack.id),
        isNull(schema.themePackRatings.deletedAt),
        isNotNull(schema.themePackRatings.review),
        sql`length(trim(${schema.themePackRatings.review})) > 0`,
        or(eq(schema.userProfiles.isPublic, true), isNull(schema.userProfiles.id)),
    );

    const [{ count: totalReviews }] = await db.select({
        count: sql<number>`count(*)::int`,
    })
        .from(schema.themePackRatings)
        .leftJoin(schema.userProfiles, eq(schema.themePackRatings.userId, schema.userProfiles.id))
        .where(reviewWhere);

    const totalCommentsPages = Math.max(1, Math.ceil((totalReviews ?? 0) / commentsPageSize));
    const currentCommentsPage = Math.min(commentsPage, totalCommentsPages);
    const commentsOffset = (currentCommentsPage - 1) * commentsPageSize;

    const recentReviews = await db.select({
        id: schema.themePackRatings.id,
        rating: schema.themePackRatings.rating,
        review: schema.themePackRatings.review,
        updatedAt: schema.themePackRatings.updatedAt,
        username: schema.userProfiles.username,
        displayName: schema.userProfiles.displayName,
    })
        .from(schema.themePackRatings)
        .leftJoin(schema.userProfiles, eq(schema.themePackRatings.userId, schema.userProfiles.id))
        .where(reviewWhere)
        .orderBy(desc(schema.themePackRatings.updatedAt))
        .limit(commentsPageSize)
        .offset(commentsOffset);

    const [userRatingRow] = currentUserId
        ? await db.select({
            rating: schema.themePackRatings.rating,
            review: schema.themePackRatings.review,
        })
            .from(schema.themePackRatings)
            .where(
                and(
                    eq(schema.themePackRatings.themePackId, pack.id),
                    eq(schema.themePackRatings.userId, currentUserId),
                    isNull(schema.themePackRatings.deletedAt),
                ),
            )
            .limit(1)
        : [];

    const ownFeedbackRows = currentUserId
        ? (() => {
            const ownFeedbackWhere = and(
                eq(schema.themePackFeedback.themePackId, pack.id),
                eq(schema.themePackFeedback.userId, currentUserId),
                feedbackStatus === 'all' ? sql`true` : eq(schema.themePackFeedback.status, feedbackStatus),
            );

            return Promise.all([
                db.select({ count: sql<number>`count(*)::int` })
                    .from(schema.themePackFeedback)
                    .where(ownFeedbackWhere)
                    .limit(1),
                db.select({
                    id: schema.themePackFeedback.id,
                    kind: schema.themePackFeedback.kind,
                    message: schema.themePackFeedback.message,
                    status: schema.themePackFeedback.status,
                    updatedAt: schema.themePackFeedback.updatedAt,
                })
                    .from(schema.themePackFeedback)
                    .where(ownFeedbackWhere)
                    .orderBy(desc(schema.themePackFeedback.updatedAt))
                    .limit(feedbackPageSize)
                    .offset(Math.max(0, feedbackPage - 1) * feedbackPageSize),
            ]);
        })()
        : Promise.resolve([[{ count: 0 }], []] as const);

    const [ownFeedbackCountRows, ownFeedbackItems] = await ownFeedbackRows;
    const totalOwnFeedback = ownFeedbackCountRows[0]?.count ?? 0;
    const totalOwnFeedbackPages = Math.max(1, Math.ceil(totalOwnFeedback / feedbackPageSize));
    const currentOwnFeedbackPage = Math.min(feedbackPage, totalOwnFeedbackPages);

    const buildShareHref = (
        nextCommentsPage: number,
        nextFeedbackStatus: 'all' | 'open' | 'resolved' | 'dismissed',
        nextFeedbackPage: number,
        nextMode: 'light' | 'dark',
    ) => {
        const qs = new URLSearchParams();
        qs.set('commentsPage', String(nextCommentsPage));
        qs.set('feedbackStatus', nextFeedbackStatus);
        qs.set('feedbackPage', String(nextFeedbackPage));
        qs.set('mode', nextMode);
        return `/share/theme/${pack.slug}?${qs.toString()}`;
    };

    const publicLink = `https://irontrain.motiona.xyz/share/theme/${pack.slug}`;
    const exportUrl = `https://irontrain.motiona.xyz/api/share/theme/${pack.slug}`;

    const tags = buildThemeHashtags({
        rawTags: pack.tags,
        supportsLight: pack.supportsLight,
        supportsDark: pack.supportsDark,
    });

    return (
        <div className="min-h-screen py-12 md:py-24 px-6 font-mono text-[#1a1a2e] bg-[#f5f1e8]">
            <div className="max-w-3xl mx-auto">
                <Link href="/feed?view=themes" className="inline-flex items-center gap-2 text-[9px] font-black opacity-30 hover:opacity-100 mb-10 transition-all uppercase tracking-[0.4em]">
                    ← THEMES_DIRECTORY
                </Link>

                <div className="border-[3px] border-current p-8 md:p-14 relative bg-white shadow-[20px_20px_0px_0px_rgba(26,26,46,0.05)]">
                    <div className="absolute top-0 left-0 w-full h-2 bg-current opacity-100" />

                    <div className="flex flex-col gap-8">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="text-[10px] font-black opacity-40 tracking-[0.4em] uppercase italic flex items-center gap-2">
                                    <Palette className="w-3.5 h-3.5" />
                                    THEME_TRANSMISSION_PROTOCOL
                                </div>
                                <div className="text-[10px] font-black opacity-100 border border-current px-2 py-0.5">
                                    VERSION: {pack.currentVersion}
                                </div>
                            </div>
                            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter uppercase break-words leading-[0.8] italic">
                                {pack.name}
                            </h1>
                        </div>

                        {pack.description && (
                            <div className="border-l-[3px] border-current pl-6 py-1 opacity-80">
                                <p className="text-sm font-bold italic leading-relaxed uppercase max-w-xl">
                                    {pack.description}
                                </p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 border-y-[2px] border-current/10 py-8 gap-10">
                            <div>
                                <div className="text-[9px] font-black opacity-30 uppercase tracking-[0.3em] mb-2">PREVIEW_CHANNELS</div>
                                <ThemeModePreview
                                    payload={payload}
                                    supportsLight={pack.supportsLight}
                                    supportsDark={pack.supportsDark}
                                    initialMode={resolvedPreviewMode}
                                    syncToQueryParam
                                />
                            </div>
                            <div>
                                <div className="text-[9px] font-black opacity-30 uppercase tracking-[0.3em] mb-2">CREATOR_ID</div>
                                <div className="text-xl font-black truncate italic">
                                    @{pack.username || pack.displayName || 'ANONYMOUS_USER'}
                                </div>
                                <div className="text-[8px] font-black opacity-40 mt-1 uppercase tracking-widest">
                                    INSTALLS {pack.downloadsCount} · APPLIES {pack.appliesCount}
                                </div>
                                <div className="text-[8px] font-black opacity-40 mt-1 uppercase tracking-widest">
                                    RATING {Number(pack.ratingAvg || 0).toFixed(1)} ({pack.ratingCount || 0})
                                </div>
                            </div>
                        </div>

                        {tags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {tags.map((tag) => (
                                    <span key={`${pack.id}:${tag}`} className="text-[8px] px-2 py-0.5 border border-current font-black tracking-tighter uppercase">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="border-t border-current/20 pt-6 space-y-4">
                            <div className="text-[9px] font-black opacity-30 uppercase tracking-[0.3em]">COMMUNITY_COMMENTS</div>
                            {recentReviews.length === 0 ? (
                                <div className="text-[9px] font-black opacity-40 uppercase tracking-[0.2em]">Sin comentarios todavía.</div>
                            ) : (
                                <div className="space-y-3">
                                    {recentReviews.map((entry) => (
                                        <div key={entry.id} className="border border-current/20 p-3">
                                            <div className="flex items-center justify-between gap-3 mb-2">
                                                <div className="text-[9px] font-black uppercase tracking-[0.2em]">
                                                    @{entry.username || entry.displayName || 'user'}
                                                </div>
                                                <div className="text-[9px] font-black opacity-60 uppercase tracking-[0.2em]">
                                                    {entry.rating}/5 · {new Date(entry.updatedAt || new Date()).toLocaleDateString('es-AR')}
                                                </div>
                                            </div>
                                            <p className="text-[11px] font-bold leading-relaxed whitespace-pre-wrap">
                                                {entry.review}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.2em] opacity-60">
                                <span>Page {currentCommentsPage}/{totalCommentsPages}</span>
                                <div className="flex items-center gap-2">
                                    {currentCommentsPage > 1 ? (
                                        <Link
                                            href={buildShareHref(currentCommentsPage - 1, feedbackStatus, currentOwnFeedbackPage, resolvedPreviewMode)}
                                            className="border border-current px-2 py-1 hover:bg-[#1a1a2e] hover:text-[#f5f1e8] transition-all"
                                        >
                                            Prev
                                        </Link>
                                    ) : null}
                                    {currentCommentsPage < totalCommentsPages ? (
                                        <Link
                                            href={buildShareHref(currentCommentsPage + 1, feedbackStatus, currentOwnFeedbackPage, resolvedPreviewMode)}
                                            className="border border-current px-2 py-1 hover:bg-[#1a1a2e] hover:text-[#f5f1e8] transition-all"
                                        >
                                            Next
                                        </Link>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        <ThemeShareActions
                            slug={pack.slug}
                            publicLink={publicLink}
                            exportUrl={exportUrl}
                            defaultMode={resolvedPreviewMode}
                        />

                        <ThemeInteractionsPanel
                            themeId={pack.id}
                            isLoggedIn={!!currentUserId}
                            isOwner={!!currentUserId && currentUserId === pack.ownerId}
                            loginHref="/auth/sign-in"
                            initialRating={typeof userRatingRow?.rating === 'number' ? userRatingRow.rating : null}
                            initialReview={typeof userRatingRow?.review === 'string' ? userRatingRow.review : null}
                            recentOwnFeedback={ownFeedbackItems.map((item) => ({
                                id: item.id,
                                kind: item.kind,
                                message: item.message,
                                status: item.status,
                                updatedAt: item.updatedAt,
                            }))}
                            shareSlug={pack.slug}
                            currentCommentsPage={currentCommentsPage}
                            ownFeedbackStatus={feedbackStatus}
                            ownFeedbackPage={currentOwnFeedbackPage}
                            ownFeedbackTotalPages={totalOwnFeedbackPages}
                        />
                    </div>
                </div>
            </div>

        </div>
    );
}
