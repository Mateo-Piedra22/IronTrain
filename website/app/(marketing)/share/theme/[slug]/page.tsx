import { and, eq, isNull } from 'drizzle-orm';
import { Copy, Download, Palette } from 'lucide-react';
import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '../../../../../src/db';
import * as schema from '../../../../../src/db/schema';

interface ThemePageProps {
    params: Promise<{ slug: string }>;
}

async function getThemePackBySlug(slug: string) {
    const rows = await db.select({
        id: schema.themePacks.id,
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

export default async function ThemeSharePage({ params }: ThemePageProps) {
    const { slug } = await params;
    const data = await getThemePackBySlug(slug);

    if (!data) return notFound();

    const { pack, payload } = data;
    const preview = (payload.preview && typeof payload.preview === 'object')
        ? payload.preview as Record<string, string>
        : {};

    const hero = preview.hero || '#8AA0B8';
    const surface = preview.surface || '#FFFFFF';
    const text = preview.text || '#0F172A';

    const deepLink = `irontrain://share/theme/${pack.slug}`;
    const publicLink = `https://irontrain.motiona.xyz/share/theme/${pack.slug}`;
    const exportUrl = `https://irontrain.motiona.xyz/api/share/theme/${pack.slug}`;

    const tags = Array.isArray(pack.tags) ? pack.tags : [];

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
                                <div className="grid grid-cols-3 gap-2 max-w-xs">
                                    <div className="h-12 border border-current/20" style={{ backgroundColor: hero }} />
                                    <div className="h-12 border border-current/20" style={{ backgroundColor: surface }} />
                                    <div className="h-12 border border-current/20" style={{ backgroundColor: text }} />
                                </div>
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

                        <div className="mt-8 pt-10 border-t-[3px] border-current space-y-6">
                            <a
                                href={deepLink}
                                className="w-full bg-[#1a1a2e] text-[#f5f1e8] py-6 px-6 flex items-center justify-center gap-4 hover:invert transition-all font-black uppercase tracking-[0.2em] text-sm"
                            >
                                <Download className="w-5 h-5" />
                                IMPORT_TO_IRONTRAIN_APP
                            </a>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    className="border-[2px] border-[#1a1a2e] py-4 px-6 flex items-center justify-center gap-3 hover:bg-[#1a1a2e] hover:text-[#f5f1e8] transition-all text-[10px] font-black uppercase tracking-[0.2em]"
                                    data-copy={publicLink}
                                >
                                    <Copy className="w-4 h-4" />
                                    COPY_PUBLIC_LINK
                                </button>
                                <a
                                    href={exportUrl}
                                    className="border-[2px] border-[#1a1a2e] py-4 px-6 flex items-center justify-center gap-3 hover:bg-[#1a1a2e] hover:text-[#f5f1e8] transition-all text-[10px] font-black uppercase tracking-[0.2em]"
                                >
                                    DOWNLOAD_THEME_JSON
                                </a>
                            </div>

                            <div className="text-[9px] font-black opacity-30 text-center pt-8 uppercase tracking-[0.3em] leading-loose max-w-md mx-auto">
                                STATUS: PUBLIC_APPROVED_THEME
                                <br />
                                LINK: {publicLink}
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
