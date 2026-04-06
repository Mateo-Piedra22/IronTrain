'use client';

import { Copy, Download } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

type ThemeShareActionsProps = {
    slug: string;
    publicLink: string;
    exportUrl: string;
    defaultMode: 'light' | 'dark';
};

function resolveMode(rawMode: string | null, fallback: 'light' | 'dark'): 'light' | 'dark' {
    if (rawMode === 'light' || rawMode === 'dark') return rawMode;
    return fallback;
}

export function ThemeShareActions({ slug, publicLink, exportUrl, defaultMode }: ThemeShareActionsProps) {
    const searchParams = useSearchParams();
    const [copied, setCopied] = useState(false);

    const activeMode = resolveMode(searchParams.get('mode'), defaultMode);

    const deepLink = useMemo(() => {
        const qs = new URLSearchParams();
        qs.set('mode', activeMode);
        return `irontrain://share/theme/${slug}?${qs.toString()}`;
    }, [activeMode, slug]);

    const shareablePublicLink = useMemo(() => {
        try {
            const parsed = new URL(publicLink);
            parsed.searchParams.set('mode', activeMode);
            return parsed.toString();
        } catch {
            const qs = new URLSearchParams();
            qs.set('mode', activeMode);
            return `${publicLink}?${qs.toString()}`;
        }
    }, [activeMode, publicLink]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(shareablePublicLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    };

    return (
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
                    onClick={handleCopy}
                    className="border-[2px] border-[#1a1a2e] py-4 px-6 flex items-center justify-center gap-3 hover:bg-[#1a1a2e] hover:text-[#f5f1e8] transition-all text-[10px] font-black uppercase tracking-[0.2em]"
                >
                    <Copy className="w-4 h-4" />
                    {copied ? 'COPIADO ✓' : 'COPY_PUBLIC_LINK'}
                </button>
                <a
                    href={exportUrl}
                    className="border-[2px] border-[#1a1a2e] py-4 px-6 flex items-center justify-center gap-3 hover:bg-[#1a1a2e] hover:text-[#f5f1e8] transition-all text-[10px] font-black uppercase tracking-[0.2em]"
                >
                    DOWNLOAD_THEME_JSON
                </a>
            </div>

            <div className="text-[9px] font-black opacity-30 text-center pt-4 uppercase tracking-[0.3em] leading-loose max-w-xl mx-auto break-all">
                STATUS: PUBLIC_APPROVED_THEME
                <br />
                MODE: {activeMode.toUpperCase()}
                <br />
                LINK: {shareablePublicLink}
            </div>
        </div>
    );
}
