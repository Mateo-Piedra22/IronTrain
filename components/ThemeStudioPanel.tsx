import { useTheme } from '@/src/hooks/useTheme';
import { configService } from '@/src/services/ConfigService';
import { MarketplaceThemePackSummary, SocialService } from '@/src/services/SocialService';
import { ThemeFx, withAlpha } from '@/src/theme';
import {
    applyThemeColorPatch,
    getCoreThemeToken,
    isValidHexColor,
    ThemeColorPatch,
    ThemeDraft,
} from '@/src/theme-engine';
import { notify } from '@/src/utils/notify';
import { triggerSensoryFeedback } from '@/src/utils/sensoryFeedback';
import * as Linking from 'expo-linking';
import { Ban, Check, CopyPlus, ExternalLink, Globe, Moon, Palette, Save, Sun, SunMoon, Trash2 } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type EditableColorFieldKey =
    | 'primaryDefault'
    | 'primaryLight'
    | 'primaryDark'
    | 'onPrimary'
    | 'background'
    | 'surface'
    | 'surfaceLighter'
    | 'text'
    | 'textMuted'
    | 'border';

type EditableColorFields = Record<EditableColorFieldKey, string>;
type EditorMode = 'light' | 'dark';
type ApplyOnSave = 'none' | 'light' | 'dark' | 'both';
type StudioTab = 'themes' | 'editor';
type SourceFilter = 'all' | 'core' | 'community';
type ActiveFilter = 'all' | 'active' | 'inactive';
type CatalogOrigin = 'core' | 'local' | 'remote';
type MarketplaceStatusFilter = 'all' | 'approved' | 'pending_review' | 'draft' | 'rejected' | 'suspended';

type LocalThemeMeta = {
    visibility: 'private' | 'friends' | 'public';
    isBanned: boolean;
    commentsCount: number;
};

type CatalogItem = {
    id: string;
    name: string;
    source: 'core' | 'community';
    lightPatch: ThemeColorPatch;
    darkPatch: ThemeColorPatch;
    supportsLight: boolean;
    supportsDark: boolean;
    isCore: boolean;
    isVerified: boolean;
    origin: CatalogOrigin;
    remoteId?: string;
    remoteStatus?: MarketplaceThemePackSummary['status'];
    remoteVisibility?: MarketplaceThemePackSummary['visibility'];
    remoteRatingCount?: number;
    remoteDownloadsCount?: number;
};

const META_STORAGE_KEY = 'theme_studio_meta_v1';
const REMOTE_LINK_STORAGE_KEY = 'theme_studio_remote_links_v1';

const EMPTY_FIELDS: EditableColorFields = {
    primaryDefault: '',
    primaryLight: '',
    primaryDark: '',
    onPrimary: '',
    background: '',
    surface: '',
    surfaceLighter: '',
    text: '',
    textMuted: '',
    border: '',
};

const COLOR_FIELD_META: Array<{ key: EditableColorFieldKey; label: string; description: string }> = [
    { key: 'primaryDefault', label: 'Primario', description: 'Color principal de marca' },
    { key: 'primaryLight', label: 'Primario claro', description: 'Variante clara para estados' },
    { key: 'primaryDark', label: 'Primario oscuro', description: 'Variante oscura para foco' },
    { key: 'onPrimary', label: 'Texto sobre primario', description: 'Color del texto en botones primarios' },
    { key: 'background', label: 'Fondo', description: 'Fondo global de la app' },
    { key: 'surface', label: 'Superficie', description: 'Cards y contenedores principales' },
    { key: 'surfaceLighter', label: 'Superficie secundaria', description: 'Bloques y paneles secundarios' },
    { key: 'text', label: 'Texto principal', description: 'Color del texto principal' },
    { key: 'textMuted', label: 'Texto secundario', description: 'Color del texto auxiliar' },
    { key: 'border', label: 'Bordes', description: 'Divisores y contornos' },
];

function patchToFields(patch: ThemeColorPatch): EditableColorFields {
    return {
        primaryDefault: patch.primary?.DEFAULT ?? '',
        primaryLight: patch.primary?.light ?? '',
        primaryDark: patch.primary?.dark ?? '',
        onPrimary: patch.onPrimary ?? '',
        background: patch.background ?? '',
        surface: patch.surface ?? '',
        surfaceLighter: patch.surfaceLighter ?? '',
        text: patch.text ?? '',
        textMuted: patch.textMuted ?? '',
        border: patch.border ?? '',
    };
}

function fieldsToPatch(fields: EditableColorFields): ThemeColorPatch {
    const patch: ThemeColorPatch = {};

    if (
        isValidHexColor(fields.primaryDefault) ||
        isValidHexColor(fields.primaryLight) ||
        isValidHexColor(fields.primaryDark)
    ) {
        patch.primary = {};
        if (isValidHexColor(fields.primaryDefault)) patch.primary.DEFAULT = fields.primaryDefault;
        if (isValidHexColor(fields.primaryLight)) patch.primary.light = fields.primaryLight;
        if (isValidHexColor(fields.primaryDark)) patch.primary.dark = fields.primaryDark;
    }

    if (isValidHexColor(fields.onPrimary)) patch.onPrimary = fields.onPrimary;
    if (isValidHexColor(fields.background)) patch.background = fields.background;
    if (isValidHexColor(fields.surface)) patch.surface = fields.surface;
    if (isValidHexColor(fields.surfaceLighter)) patch.surfaceLighter = fields.surfaceLighter;
    if (isValidHexColor(fields.text)) patch.text = fields.text;
    if (isValidHexColor(fields.textMuted)) patch.textMuted = fields.textMuted;
    if (isValidHexColor(fields.border)) patch.border = fields.border;

    return patch;
}

function prettifyHexInput(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    return normalized.slice(0, 9).toUpperCase();
}

function clampColorChannel(value: number): number {
    return Math.max(0, Math.min(255, Math.round(value)));
}

function toHexByte(value: number): string {
    return clampColorChannel(value).toString(16).padStart(2, '0').toUpperCase();
}

function rgbToHex(r: number, g: number, b: number): string {
    return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
}

function parseRgbInput(raw: string): { ok: true; hex: string } | { ok: false } {
    const normalized = raw
        .trim()
        .replace(/^rgba?\(/i, '')
        .replace(/\)$/i, '')
        .replace(/\s+/g, '');

    if (!normalized) return { ok: false };

    const parts = normalized.split(',');
    if (parts.length < 3) return { ok: false };

    const r = Number(parts[0]);
    const g = Number(parts[1]);
    const b = Number(parts[2]);

    if ([r, g, b].some((value) => Number.isNaN(value))) return { ok: false };

    return { ok: true, hex: rgbToHex(r, g, b) };
}

function hexToRgbInput(hex: string): string {
    if (!isValidHexColor(hex)) return '';
    const normalized = hex.slice(1);
    if (normalized.length < 6) return '';
    const r = Number.parseInt(normalized.slice(0, 2), 16);
    const g = Number.parseInt(normalized.slice(2, 4), 16);
    const b = Number.parseInt(normalized.slice(4, 6), 16);
    return `${r}, ${g}, ${b}`;
}

function hslToHex(h: number, s: number, l: number): string {
    const saturation = s / 100;
    const lightness = l / 100;
    const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const hh = h / 60;
    const x = chroma * (1 - Math.abs((hh % 2) - 1));

    let r = 0;
    let g = 0;
    let b = 0;

    if (hh >= 0 && hh < 1) {
        r = chroma;
        g = x;
    } else if (hh >= 1 && hh < 2) {
        r = x;
        g = chroma;
    } else if (hh >= 2 && hh < 3) {
        g = chroma;
        b = x;
    } else if (hh >= 3 && hh < 4) {
        g = x;
        b = chroma;
    } else if (hh >= 4 && hh < 5) {
        r = x;
        b = chroma;
    } else {
        r = chroma;
        b = x;
    }

    const m = lightness - chroma / 2;
    return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

function normalizeThemeMeta(value: unknown): Record<string, LocalThemeMeta> {
    if (!value || typeof value !== 'object') return {};
    const input = value as Record<string, any>;
    const output: Record<string, LocalThemeMeta> = {};

    for (const [key, raw] of Object.entries(input)) {
        if (!key || typeof raw !== 'object' || !raw) continue;
        const visibility: LocalThemeMeta['visibility'] =
            raw.visibility === 'public' ? 'public' : raw.visibility === 'friends' ? 'friends' : 'private';
        const isBanned = raw.isBanned === true;
        const commentsCount = Number.isFinite(raw.commentsCount) ? Math.max(0, Number(raw.commentsCount)) : 0;
        output[key] = { visibility, isBanned, commentsCount };
    }

    return output;
}

function normalizeRemoteLinkMap(value: unknown): Record<string, string> {
    if (!value || typeof value !== 'object') return {};
    const input = value as Record<string, unknown>;
    const output: Record<string, string> = {};
    for (const [remoteId, localId] of Object.entries(input)) {
        if (typeof remoteId !== 'string' || typeof localId !== 'string') continue;
        if (!remoteId.trim() || !localId.trim()) continue;
        output[remoteId] = localId;
    }
    return output;
}

export function ThemeStudioPanel() {
    const {
        activeTheme,
        effectiveMode,
        themeDrafts,
        activeThemePackIdLight,
        activeThemePackIdDark,
        saveThemeDraft,
        deleteThemeDraft,
        setActiveThemePackId,
    } = useTheme();

    const colors = activeTheme.colors;

    const [selectedThemeId, setSelectedThemeId] = useState<string | null>(themeDrafts[0]?.id ?? null);
    const [name, setName] = useState(themeDrafts[0]?.name ?? '');
    const [editorMode, setEditorMode] = useState<EditorMode>('light');
    const [applyOnSave, setApplyOnSave] = useState<ApplyOnSave>('both');
    const [studioTab, setStudioTab] = useState<StudioTab>('themes');
    const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
    const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
    const [statusFilter, setStatusFilter] = useState<MarketplaceStatusFilter>('all');
    const [themeSearch, setThemeSearch] = useState('');
    const [pickerField, setPickerField] = useState<EditableColorFieldKey | null>(null);
    const [liveFeedback, setLiveFeedback] = useState<{ message: string; tone: 'ok' | 'warn' } | null>(null);
    const [themeMetaMap, setThemeMetaMap] = useState<Record<string, LocalThemeMeta>>({});
    const [remoteThemeLinks, setRemoteThemeLinks] = useState<Record<string, string>>({});
    const [remoteThemes, setRemoteThemes] = useState<MarketplaceThemePackSummary[]>([]);
    const [isLoadingRemoteThemes, setIsLoadingRemoteThemes] = useState(false);
    const [remoteThemeError, setRemoteThemeError] = useState<string | null>(null);
    const [lightFields, setLightFields] = useState<EditableColorFields>(themeDrafts[0] ? patchToFields(themeDrafts[0].lightPatch) : EMPTY_FIELDS);
    const [darkFields, setDarkFields] = useState<EditableColorFields>(themeDrafts[0] ? patchToFields(themeDrafts[0].darkPatch) : EMPTY_FIELDS);

    const liveFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const stored = configService.get(META_STORAGE_KEY as any);
        setThemeMetaMap(normalizeThemeMeta(stored));

        const storedRemoteLinks = configService.get(REMOTE_LINK_STORAGE_KEY as any);
        setRemoteThemeLinks(normalizeRemoteLinkMap(storedRemoteLinks));

        return () => {
            if (liveFeedbackTimeoutRef.current) {
                clearTimeout(liveFeedbackTimeoutRef.current);
            }
        };
    }, []);

    const persistRemoteThemeLinks = async (next: Record<string, string>) => {
        setRemoteThemeLinks(next);
        await configService.set(REMOTE_LINK_STORAGE_KEY as any, next as any);
    };

    const loadRemoteThemes = async (query?: string) => {
        setIsLoadingRemoteThemes(true);
        try {
            const items = await SocialService.listMarketplaceThemes({
                scope: 'owned',
                mode: 'both',
                sort: 'new',
                source: 'all',
                page: 1,
                pageSize: 50,
                q: query?.trim() || undefined,
            });
            setRemoteThemes(items);
            setRemoteThemeError(null);
        } catch {
            setRemoteThemeError('No se pudo sincronizar el catálogo del marketplace.');
        } finally {
            setIsLoadingRemoteThemes(false);
        }
    };

    useEffect(() => {
        void loadRemoteThemes();
    }, []);

    const pushLiveFeedback = (message: string, tone: 'ok' | 'warn' = 'ok') => {
        setLiveFeedback({ message, tone });
        if (liveFeedbackTimeoutRef.current) clearTimeout(liveFeedbackTimeoutRef.current);
        liveFeedbackTimeoutRef.current = setTimeout(() => setLiveFeedback(null), 1800);
    };

    const persistThemeMeta = async (next: Record<string, LocalThemeMeta>) => {
        setThemeMetaMap(next);
        await configService.set(META_STORAGE_KEY as any, next as any);
    };

    const coreThemes: CatalogItem[] = useMemo(() => {
        const coreLight = getCoreThemeToken('light');
        const coreDark = getCoreThemeToken('dark');
        return [
            {
                id: 'core-light',
                name: 'Core Claro',
                source: 'core',
                lightPatch: {},
                darkPatch: {},
                supportsLight: true,
                supportsDark: false,
                isCore: true,
                isVerified: true,
                origin: 'core',
            },
            {
                id: 'core-dark',
                name: 'Core Oscuro',
                source: 'core',
                lightPatch: patchToFields(coreLight.colors as any) ? {} : {},
                darkPatch: patchToFields(coreDark.colors as any) ? {} : {},
                supportsLight: false,
                supportsDark: true,
                isCore: true,
                isVerified: true,
                origin: 'core',
            },
        ];
    }, []);

    const localThemes: CatalogItem[] = useMemo(() => {
        return themeDrafts.map((draft) => ({
            id: draft.id,
            name: draft.name,
            source: 'community' as const,
            lightPatch: draft.lightPatch,
            darkPatch: draft.darkPatch,
            supportsLight: true,
            supportsDark: true,
            isCore: false,
            isVerified: false,
            origin: 'local' as const,
        }));
    }, [themeDrafts]);

    const remoteCatalogThemes: CatalogItem[] = useMemo(() => {
        return remoteThemes.map((item) => ({
            id: `remote:${item.id}`,
            name: item.name,
            source: item.isSystem ? 'core' : 'community',
            lightPatch: {},
            darkPatch: {},
            supportsLight: !!item.supportsLight,
            supportsDark: !!item.supportsDark,
            isCore: !!item.isSystem,
            isVerified: item.status === 'approved',
            origin: 'remote' as const,
            remoteId: item.id,
            remoteStatus: item.status,
            remoteVisibility: item.visibility,
            remoteRatingCount: item.ratingCount,
            remoteDownloadsCount: item.downloadsCount,
        }));
    }, [remoteThemes]);

    const catalog = useMemo(() => [...coreThemes, ...localThemes, ...remoteCatalogThemes], [coreThemes, localThemes, remoteCatalogThemes]);

    const selectedDraft = useMemo(() => themeDrafts.find((draft) => draft.id === selectedThemeId) ?? null, [themeDrafts, selectedThemeId]);

    const activeFields = editorMode === 'light' ? lightFields : darkFields;
    const setActiveFields = (next: EditableColorFields) => {
        if (editorMode === 'light') setLightFields(next);
        else setDarkFields(next);
    };

    const filteredCatalog = useMemo(() => {
        const query = themeSearch.trim().toLowerCase();
        return catalog.filter((item) => {
            const linkedDraftId = item.remoteId ? remoteThemeLinks[item.remoteId] : null;
            const candidateThemeId = linkedDraftId ?? item.id;
            const isActive = item.isCore
                ? (item.id === 'core-light' ? activeThemePackIdLight === null : activeThemePackIdDark === null)
                : activeThemePackIdLight === candidateThemeId || activeThemePackIdDark === candidateThemeId;

            if (sourceFilter === 'core' && item.source !== 'core') return false;
            if (sourceFilter === 'community' && item.source !== 'community') return false;
            if (activeFilter === 'active' && !isActive) return false;
            if (activeFilter === 'inactive' && isActive) return false;
            if (statusFilter !== 'all' && item.origin === 'remote' && item.remoteStatus !== statusFilter) return false;
            if (!query) return true;
            return item.name.toLowerCase().includes(query);
        });
    }, [catalog, sourceFilter, activeFilter, statusFilter, themeSearch, activeThemePackIdLight, activeThemePackIdDark, remoteThemeLinks]);

    const hasInvalidInputs = useMemo(() => {
        const values = [...Object.values(lightFields), ...Object.values(darkFields)];
        return values.some((value) => value.length > 0 && !isValidHexColor(value));
    }, [lightFields, darkFields]);

    const swatchOptions = useMemo(() => {
        const generated = Array.from({ length: 12 }, (_, index) => hslToHex((index * 360) / 12, 78, 52));
        const grayscale = Array.from({ length: 6 }, (_, index) => {
            const channel = Math.round((index / 5) * 255);
            return rgbToHex(channel, channel, channel);
        });

        const themed = [
            colors.primary.DEFAULT,
            colors.primary.light,
            colors.primary.dark,
            colors.background,
            colors.surface,
            colors.surfaceLighter,
            colors.text,
            colors.textMuted,
            colors.border,
            colors.onPrimary,
        ];

        return [...themed, ...generated, ...grayscale].filter((value, index, list) => list.indexOf(value) === index);
    }, [colors]);

    const previewLight = useMemo(() => {
        return applyThemeColorPatch(getCoreThemeToken('light'), fieldsToPatch(lightFields), { id: 'preview-light', label: name || 'Preview Light' });
    }, [lightFields, name]);

    const previewDark = useMemo(() => {
        return applyThemeColorPatch(getCoreThemeToken('dark'), fieldsToPatch(darkFields), { id: 'preview-dark', label: name || 'Preview Dark' });
    }, [darkFields, name]);

    const styles = useMemo(() => StyleSheet.create({
        container: {
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.surfaceLighter,
            padding: 10,
            gap: 10,
        },
        sectionLabel: {
            color: colors.textMuted,
            fontSize: 10,
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
        },
        row: { flexDirection: 'row', gap: 6 },
        grow: { flex: 1 },
        tabBtn: {
            flex: 1,
            borderRadius: 10,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            paddingVertical: 9,
            alignItems: 'center',
            justifyContent: 'center',
        },
        tabBtnActive: {
            borderColor: colors.primary.DEFAULT,
            backgroundColor: withAlpha(colors.primary.DEFAULT, '18'),
        },
        tabBtnText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
        tabBtnTextActive: { color: colors.primary.DEFAULT },
        chip: {
            borderRadius: 999,
            borderWidth: 1.5,
            borderColor: colors.border,
            paddingHorizontal: 9,
            paddingVertical: 6,
            backgroundColor: colors.surface,
        },
        chipActive: {
            borderColor: colors.primary.DEFAULT,
            backgroundColor: withAlpha(colors.primary.DEFAULT, '18'),
        },
        chipText: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
        chipTextActive: { color: colors.primary.DEFAULT },
        compactInput: {
            borderWidth: 1.5,
            borderColor: colors.border,
            borderRadius: 10,
            backgroundColor: colors.surface,
            color: colors.text,
            fontSize: 12,
            fontWeight: '700',
            paddingHorizontal: 10,
            paddingVertical: 8,
        },
        card: {
            borderWidth: 1.5,
            borderColor: colors.border,
            borderRadius: 12,
            backgroundColor: colors.surface,
            padding: 9,
            gap: 6,
        },
        cardTitle: { color: colors.text, fontWeight: '900', fontSize: 13 },
        cardSub: { color: colors.textMuted, fontSize: 11 },
        badge: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 999,
            paddingHorizontal: 7,
            paddingVertical: 3,
            backgroundColor: colors.surfaceLighter,
        },
        badgeText: {
            fontSize: 9,
            fontWeight: '900',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
        },
        actionBtn: {
            borderRadius: 9,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.surfaceLighter,
            paddingVertical: 7,
            paddingHorizontal: 8,
            alignItems: 'center',
            justifyContent: 'center',
        },
        actionBtnPrimary: {
            borderColor: colors.primary.DEFAULT,
            backgroundColor: withAlpha(colors.primary.DEFAULT, '18'),
        },
        actionBtnText: { color: colors.text, fontSize: 10, fontWeight: '800' },
        actionBtnTextPrimary: { color: colors.primary.DEFAULT },
        helperError: { color: colors.red, fontSize: 11, fontWeight: '700' },
        helperOk: { color: colors.green, fontSize: 11, fontWeight: '700' },
        input: {
            borderWidth: 1.5,
            borderColor: colors.border,
            borderRadius: 12,
            backgroundColor: colors.surface,
            color: colors.text,
            fontSize: 14,
            fontWeight: '700',
            paddingHorizontal: 12,
            paddingVertical: 9,
        },
        modeBtn: {
            borderRadius: 10,
            borderWidth: 1.5,
            borderColor: colors.border,
            paddingVertical: 9,
            paddingHorizontal: 10,
            backgroundColor: colors.surface,
            alignItems: 'center',
        },
        modeBtnActive: {
            borderColor: colors.primary.DEFAULT,
            backgroundColor: withAlpha(colors.primary.DEFAULT, '18'),
        },
        modeBtnText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
        modeBtnTextActive: { color: colors.primary.DEFAULT },
        colorRow: {
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: 9,
            gap: 7,
        },
        colorRowTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
        colorRowSub: { color: colors.textMuted, fontSize: 11 },
        swatch: {
            width: 24,
            height: 24,
            borderRadius: 8,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.surfaceLighter,
        },
        pickerWrap: {
            borderRadius: 10,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: 8,
            gap: 6,
        },
        swatchGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 7,
        },
        swatchOption: {
            width: 22,
            height: 22,
            borderRadius: 8,
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        swatchOptionSelected: {
            borderColor: colors.primary.DEFAULT,
            borderWidth: 2,
        },
        previewTitle: { color: colors.text, fontSize: 12, fontWeight: '900', marginBottom: 6 },
        previewCard: {
            borderRadius: 12,
            borderWidth: 1.5,
            padding: 9,
            minHeight: 124,
            justifyContent: 'space-between',
            ...ThemeFx.shadowSm,
        },
        previewBtn: {
            alignSelf: 'flex-start',
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 999,
            borderWidth: 1,
        },
        previewBtnText: { fontSize: 10, fontWeight: '900' },
        statusCard: {
            borderRadius: 11,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: 9,
            gap: 3,
        },
        liveFeedbackBanner: {
            borderRadius: 10,
            borderWidth: 1.5,
            paddingHorizontal: 10,
            paddingVertical: 7,
            backgroundColor: colors.surface,
        },
        liveFeedbackOk: {
            borderColor: withAlpha(colors.green, '66'),
            backgroundColor: withAlpha(colors.green, '14'),
        },
        liveFeedbackWarn: {
            borderColor: withAlpha(colors.yellow, '66'),
            backgroundColor: withAlpha(colors.yellow, '14'),
        },
        liveFeedbackText: {
            fontSize: 11,
            fontWeight: '800',
        },
    }), [colors]);

    const getStatusLabel = (status?: MarketplaceThemePackSummary['status']) => {
        switch (status) {
            case 'approved':
                return 'Aprobado';
            case 'pending_review':
                return 'En revisión';
            case 'rejected':
                return 'Rechazado';
            case 'suspended':
                return 'Suspendido';
            case 'draft':
                return 'Borrador';
            default:
                return 'Sin estado';
        }
    };

    const ensureLocalDraftForItem = async (item: CatalogItem): Promise<ThemeDraft | null> => {
        if (item.origin === 'local') {
            return themeDrafts.find((value) => value.id === item.id) ?? null;
        }

        if (item.origin !== 'remote' || !item.remoteId) return null;

        const linkedDraftId = remoteThemeLinks[item.remoteId];
        if (linkedDraftId) {
            const linked = themeDrafts.find((value) => value.id === linkedDraftId) ?? null;
            if (linked) return linked;
        }

        const detail = await SocialService.getMarketplaceThemeDetail(item.remoteId);
        const lightPatch = (detail.payload?.lightPatch ?? {}) as ThemeColorPatch;
        const darkPatch = (detail.payload?.darkPatch ?? {}) as ThemeColorPatch;
        const result = await saveThemeDraft({
            name: `${detail.name} (Marketplace)`,
            lightPatch,
            darkPatch,
        });

        if (!result.ok) {
            notify.error('No se pudo sincronizar', result.errors.join('\n'));
            return null;
        }

        const nextLinks = {
            ...remoteThemeLinks,
            [item.remoteId]: result.draft.id,
        };
        await persistRemoteThemeLinks(nextLinks);
        return result.draft;
    };

    const selectThemeForEdit = async (item: CatalogItem) => {
        if (item.isCore) {
            setSelectedThemeId(null);
            setName(item.name === 'Core Claro' ? 'Core Claro Remix' : 'Core Oscuro Remix');
            setLightFields(EMPTY_FIELDS);
            setDarkFields(EMPTY_FIELDS);
        } else {
            const draft = await ensureLocalDraftForItem(item);
            if (!draft) return;
            setSelectedThemeId(draft.id);
            setName(draft.name);
            setLightFields(patchToFields(draft.lightPatch));
            setDarkFields(patchToFields(draft.darkPatch));
        }
        setStudioTab('editor');
        pushLiveFeedback(`Tema "${item.name}" listo para editar.`);
        await triggerSensoryFeedback('selection');
    };

    const createBlankTheme = async () => {
        setSelectedThemeId(null);
        setName('');
        setLightFields(EMPTY_FIELDS);
        setDarkFields(EMPTY_FIELDS);
        setApplyOnSave('both');
        setStudioTab('editor');
        pushLiveFeedback('Nuevo tema en blanco listo para crear.', 'warn');
        await triggerSensoryFeedback('selection');
    };

    const duplicateTheme = async () => {
        if (!selectedDraft) {
            notify.info('Sin tema seleccionado', 'Elegí un tema de comunidad para duplicarlo.');
            return;
        }

        setSelectedThemeId(null);
        setName(`${selectedDraft.name} Copy`);
        setLightFields(patchToFields(selectedDraft.lightPatch));
        setDarkFields(patchToFields(selectedDraft.darkPatch));
        setStudioTab('editor');
        pushLiveFeedback(`Copia preparada desde "${selectedDraft.name}".`);
        await triggerSensoryFeedback('selection');
    };

    const removeTheme = async () => {
        if (!selectedDraft) {
            notify.info('Sin tema activo', 'Elegí un tema de comunidad para eliminar.');
            return;
        }

        await deleteThemeDraft(selectedDraft.id);
        setSelectedThemeId(null);
        setName('');
        setLightFields(EMPTY_FIELDS);
        setDarkFields(EMPTY_FIELDS);

        const nextMeta = { ...themeMetaMap };
        delete nextMeta[selectedDraft.id];
        await persistThemeMeta(nextMeta);

        notify.success('Tema eliminado', 'Se eliminó el tema local y se limpiaron asignaciones activas si aplicaba.');
        pushLiveFeedback('Tema eliminado del catálogo local.', 'warn');
        await triggerSensoryFeedback('warning');
    };

    const saveTheme = async () => {
        if (hasInvalidInputs) {
            notify.error('Color inválido', 'Corregí los valores HEX o RGB antes de guardar.');
            pushLiveFeedback('Hay colores inválidos en el editor.', 'warn');
            return;
        }

        const result = await saveThemeDraft({
            id: selectedThemeId ?? undefined,
            name,
            lightPatch: fieldsToPatch(lightFields),
            darkPatch: fieldsToPatch(darkFields),
        });

        if (!result.ok) {
            notify.error('No se pudo guardar', result.errors.join('\n'));
            pushLiveFeedback('No se pudo guardar el tema.', 'warn');
            return;
        }

        setSelectedThemeId(result.draft.id);

        if (!themeMetaMap[result.draft.id]) {
            const nextMeta: Record<string, LocalThemeMeta> = {
                ...themeMetaMap,
                [result.draft.id]: {
                    visibility: 'private',
                    isBanned: false,
                    commentsCount: 0,
                },
            };
            await persistThemeMeta(nextMeta);
        }

        if (applyOnSave === 'light' || applyOnSave === 'both') {
            await setActiveThemePackId('light', result.draft.id);
        }
        if (applyOnSave === 'dark' || applyOnSave === 'both') {
            await setActiveThemePackId('dark', result.draft.id);
        }

        notify.success('Tema guardado', 'El tema quedó listo y aplicado según tu selección.');
        pushLiveFeedback('Tema guardado y aplicado correctamente.');
        await triggerSensoryFeedback('success');
    };

    const assignTheme = async (mode: 'light' | 'dark', item: CatalogItem) => {
        if (item.isCore) {
            await setActiveThemePackId(mode, null);
            notify.success('Tema core activado', `Se activó el tema core para modo ${mode === 'light' ? 'Claro' : 'Oscuro'}.`);
        } else {
            const draft = await ensureLocalDraftForItem(item);
            if (!draft) return;
            await setActiveThemePackId(mode, draft.id);
            notify.success('Tema activado', `Se activó "${item.name}" en modo ${mode === 'light' ? 'Claro' : 'Oscuro'}.`);
        }

        pushLiveFeedback(`Tema aplicado en modo ${mode === 'light' ? 'Claro' : 'Oscuro'}.`);
        await triggerSensoryFeedback('success');
    };

    const toggleVisibility = async (themeId: string) => {
        const current = themeMetaMap[themeId] ?? { visibility: 'private', isBanned: false, commentsCount: 0 };
        const nextVisibility: LocalThemeMeta['visibility'] =
            current.visibility === 'private' ? 'friends' : current.visibility === 'friends' ? 'public' : 'private';
        const next = {
            ...themeMetaMap,
            [themeId]: {
                ...current,
                visibility: nextVisibility,
            },
        };
        await persistThemeMeta(next);
        const visibilityLabel = next[themeId].visibility === 'public' ? 'público' : next[themeId].visibility === 'friends' ? 'amigos' : 'privado';
        pushLiveFeedback(`Visibilidad cambiada a ${visibilityLabel}.`);
        await triggerSensoryFeedback('selection');
    };

    const toggleBanned = async (themeId: string) => {
        const current = themeMetaMap[themeId] ?? { visibility: 'private', isBanned: false, commentsCount: 0 };
        const next = {
            ...themeMetaMap,
            [themeId]: {
                ...current,
                isBanned: !current.isBanned,
            },
        };
        await persistThemeMeta(next);
        pushLiveFeedback(next[themeId].isBanned ? 'Tema marcado como baneado.' : 'Tema restaurado.');
        await triggerSensoryFeedback(next[themeId].isBanned ? 'warning' : 'selection');
    };

    const openMarketplaceForTheme = async (item: CatalogItem) => {
        const target = `https://irontrain.motiona.xyz/feed?view=themes&q=${encodeURIComponent(item.name)}`;
        try {
            await Linking.openURL(target);
            pushLiveFeedback('Marketplace abierto para este tema.');
            await triggerSensoryFeedback('selection');
        } catch {
            notify.error('No se pudo abrir', 'No fue posible abrir el marketplace para este tema.');
            pushLiveFeedback('No se pudo abrir marketplace.', 'warn');
        }
    };

    const updateFieldFromHex = async (fieldKey: EditableColorFieldKey, rawValue: string) => {
        const normalized = prettifyHexInput(rawValue);
        setActiveFields({ ...activeFields, [fieldKey]: normalized });
        if (!normalized) {
            pushLiveFeedback(`${fieldKey} limpiado.`, 'warn');
            await triggerSensoryFeedback('tapLight');
            return;
        }
        if (isValidHexColor(normalized)) {
            pushLiveFeedback(`${fieldKey} actualizado correctamente.`);
            await triggerSensoryFeedback('tapLight');
        }
    };

    const updateFieldFromRgb = async (fieldKey: EditableColorFieldKey, rawValue: string) => {
        if (!rawValue.trim()) {
            setActiveFields({ ...activeFields, [fieldKey]: '' });
            pushLiveFeedback(`${fieldKey} limpiado.`, 'warn');
            await triggerSensoryFeedback('tapLight');
            return;
        }

        const parsed = parseRgbInput(rawValue);
        if (!parsed.ok) {
            pushLiveFeedback('RGB inválido. Usá formato 255, 255, 255.', 'warn');
            return;
        }

        setActiveFields({ ...activeFields, [fieldKey]: parsed.hex });
        pushLiveFeedback(`${fieldKey} actualizado desde RGB.`);
        await triggerSensoryFeedback('tapLight');
    };

    const selectColorFromPicker = async (fieldKey: EditableColorFieldKey, value: string) => {
        setActiveFields({ ...activeFields, [fieldKey]: value });
        pushLiveFeedback(`${fieldKey} seleccionado desde picker.`);
        await triggerSensoryFeedback('selection');
    };

    const renderPreviewCard = (mode: EditorMode, title: string, draftColors: ReturnType<typeof applyThemeColorPatch>['colors']) => {
        return (
            <View style={styles.grow}>
                <Text style={styles.previewTitle}>{title}</Text>
                <View style={[styles.previewCard, { backgroundColor: draftColors.surface, borderColor: draftColors.border }]}> 
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: draftColors.text, fontSize: 13, fontWeight: '900' }}>IronTrain {mode === 'light' ? 'Claro' : 'Oscuro'}</Text>
                        <View style={[styles.previewBtn, { backgroundColor: draftColors.primary.DEFAULT, borderColor: draftColors.primary.dark }]}> 
                            <Text style={[styles.previewBtnText, { color: draftColors.onPrimary }]}>Acción</Text>
                        </View>
                    </View>
                    <View style={{ marginTop: 10, gap: 5 }}>
                        <Text style={{ color: draftColors.text, fontWeight: '800', fontSize: 12 }}>Volumen semanal</Text>
                        <Text style={{ color: draftColors.primary.DEFAULT, fontWeight: '900', fontSize: 17 }}>42,800 kg</Text>
                        <Text style={{ color: draftColors.textMuted, fontSize: 10 }}>+6.2% vs semana anterior</Text>
                    </View>
                </View>
            </View>
        );
    };

    const renderThemeBadges = (item: CatalogItem, isActiveLight: boolean, isActiveDark: boolean) => {
        const localMeta = themeMetaMap[item.id] ?? { visibility: item.isCore ? 'public' : 'private', isBanned: false, commentsCount: 0 };
        const visibility = item.origin === 'remote' ? (item.remoteVisibility ?? 'private') : localMeta.visibility;
        const statusLabel = item.origin === 'remote'
            ? getStatusLabel(item.remoteStatus)
            : item.isVerified
                ? 'Verificado'
                : (localMeta.isBanned ? 'Baneado' : 'Sin verificar');
        const commentsCount = item.origin === 'remote' ? (item.remoteRatingCount ?? 0) : localMeta.commentsCount;

        return (
            <View style={[styles.row, { flexWrap: 'wrap' }]}>
                <View style={styles.badge}><Text style={styles.badgeText}>{item.isCore ? 'Core' : 'Comunidad'}</Text></View>
                <View style={styles.badge}><Text style={styles.badgeText}>{visibility === 'public' ? 'Público' : visibility === 'friends' ? 'Amigos' : 'Privado'}</Text></View>
                <View style={styles.badge}><Text style={styles.badgeText}>{statusLabel}</Text></View>
                {isActiveLight || isActiveDark ? <View style={styles.badge}><Text style={styles.badgeText}>{isActiveLight ? 'Claro' : '-'} · {isActiveDark ? 'Oscuro' : '-'}</Text></View> : null}
                <View style={styles.badge}><Text style={styles.badgeText}>{commentsCount} comentarios</Text></View>
            </View>
        );
    };

    const renderThemesTab = () => (
        <View style={{ gap: 9 }}>
            <View style={styles.statusCard}>
                <Text style={styles.sectionLabel}>Estado</Text>
                <Text style={styles.cardSub}>Tema seleccionado: {selectedDraft?.name ?? 'Nuevo tema sin guardar'}</Text>
                <Text style={styles.cardSub}>Claro activo: {activeThemePackIdLight ? (themeDrafts.find((value) => value.id === activeThemePackIdLight)?.name ?? 'Custom') : 'Core'}</Text>
                <Text style={styles.cardSub}>Oscuro activo: {activeThemePackIdDark ? (themeDrafts.find((value) => value.id === activeThemePackIdDark)?.name ?? 'Custom') : 'Core'}</Text>
                <Text style={styles.cardSub}>Marketplace sincronizado: {isLoadingRemoteThemes ? 'actualizando...' : `${remoteThemes.length} temas`}</Text>
            </View>

            <View style={{ gap: 7 }}>
                <Text style={styles.sectionLabel}>Filtros de catálogo</Text>
                <View style={styles.row}>
                    {([
                        { id: 'all', label: 'Todo' },
                        { id: 'core', label: 'Core' },
                        { id: 'community', label: 'Comunidad' },
                    ] as const).map((option) => (
                        <TouchableOpacity
                            key={option.id}
                            style={[styles.chip, sourceFilter === option.id && styles.chipActive]}
                            activeOpacity={0.85}
                            onPress={() => {
                                setSourceFilter(option.id);
                                void triggerSensoryFeedback('selection');
                            }}
                        >
                            <Text style={[styles.chipText, sourceFilter === option.id && styles.chipTextActive]}>{option.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <View style={styles.row}>
                    {([
                        { id: 'all', label: 'Todos' },
                        { id: 'active', label: 'Activos' },
                        { id: 'inactive', label: 'Inactivos' },
                    ] as const).map((option) => (
                        <TouchableOpacity
                            key={option.id}
                            style={[styles.chip, activeFilter === option.id && styles.chipActive]}
                            activeOpacity={0.85}
                            onPress={() => {
                                setActiveFilter(option.id);
                                void triggerSensoryFeedback('selection');
                            }}
                        >
                            <Text style={[styles.chipText, activeFilter === option.id && styles.chipTextActive]}>{option.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <View style={[styles.row, { flexWrap: 'wrap' }]}>
                    {([
                        { id: 'all', label: 'Estado: todos' },
                        { id: 'approved', label: 'Aprobados' },
                        { id: 'pending_review', label: 'En revisión' },
                        { id: 'draft', label: 'Borrador' },
                        { id: 'suspended', label: 'Suspendido' },
                    ] as const).map((option) => (
                        <TouchableOpacity
                            key={option.id}
                            style={[styles.chip, statusFilter === option.id && styles.chipActive]}
                            activeOpacity={0.85}
                            onPress={() => {
                                setStatusFilter(option.id);
                                void triggerSensoryFeedback('selection');
                            }}
                        >
                            <Text style={[styles.chipText, statusFilter === option.id && styles.chipTextActive]}>{option.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <TextInput
                    value={themeSearch}
                    onChangeText={setThemeSearch}
                    style={styles.compactInput}
                    placeholder="Buscar tema por nombre"
                    placeholderTextColor={colors.textMuted}
                />
                <View style={styles.row}>
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.grow]}
                        activeOpacity={0.85}
                        onPress={() => {
                            void loadRemoteThemes(themeSearch);
                        }}
                    >
                        <Text style={styles.actionBtnText}>{isLoadingRemoteThemes ? 'Sincronizando...' : 'Sincronizar marketplace'}</Text>
                    </TouchableOpacity>
                    {remoteThemeError ? <Text style={[styles.helperError, { flex: 1 }]}>{remoteThemeError}</Text> : null}
                </View>
            </View>

            <View style={{ gap: 7 }}>
                {filteredCatalog.map((item) => {
                    const linkedDraftId = item.remoteId ? remoteThemeLinks[item.remoteId] : null;
                    const candidateThemeId = linkedDraftId ?? item.id;
                    const isActiveLight = item.isCore ? item.id === 'core-light' && activeThemePackIdLight === null : activeThemePackIdLight === candidateThemeId;
                    const isActiveDark = item.isCore ? item.id === 'core-dark' && activeThemePackIdDark === null : activeThemePackIdDark === candidateThemeId;
                    const isSelected = selectedThemeId === item.id || (linkedDraftId ? selectedThemeId === linkedDraftId : false);
                    const meta = themeMetaMap[item.id] ?? { visibility: item.isCore ? 'public' : 'private', isBanned: false, commentsCount: 0 };

                    return (
                        <View key={item.id} style={styles.card}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={styles.cardTitle}>{item.name}</Text>
                                <Text style={styles.cardSub}>{isActiveLight ? 'Claro' : '-'} · {isActiveDark ? 'Oscuro' : '-'}</Text>
                            </View>

                            {renderThemeBadges(item, isActiveLight, isActiveDark)}

                            <View style={styles.row}>
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.grow, isSelected && styles.actionBtnPrimary]}
                                    activeOpacity={0.85}
                                    onPress={() => {
                                        void selectThemeForEdit(item);
                                    }}
                                >
                                    <Text style={[styles.actionBtnText, isSelected && styles.actionBtnTextPrimary]}>Editar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.grow, isActiveLight && styles.actionBtnPrimary]}
                                    activeOpacity={0.85}
                                    onPress={() => {
                                        void assignTheme('light', item);
                                    }}
                                >
                                    <Text style={[styles.actionBtnText, isActiveLight && styles.actionBtnTextPrimary]}>Activar Claro</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.grow, isActiveDark && styles.actionBtnPrimary]}
                                    activeOpacity={0.85}
                                    onPress={() => {
                                        void assignTheme('dark', item);
                                    }}
                                >
                                    <Text style={[styles.actionBtnText, isActiveDark && styles.actionBtnTextPrimary]}>Activar Oscuro</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.row}>
                                <TouchableOpacity
                                    style={styles.actionBtn}
                                    activeOpacity={0.85}
                                    onPress={() => {
                                        void openMarketplaceForTheme(item);
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <ExternalLink size={12} color={colors.textMuted} />
                                        <Text style={styles.actionBtnText}>Marketplace</Text>
                                    </View>
                                </TouchableOpacity>

                                {!item.isCore && item.origin !== 'remote' ? (
                                    <>
                                        <TouchableOpacity
                                            style={styles.actionBtn}
                                            activeOpacity={0.85}
                                            onPress={() => {
                                                void toggleVisibility(item.id);
                                            }}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Globe size={12} color={colors.textMuted} />
                                                <Text style={styles.actionBtnText}>
                                                    {meta.visibility === 'private'
                                                        ? 'Pasar a amigos'
                                                        : meta.visibility === 'friends'
                                                            ? 'Pasar a público'
                                                            : 'Pasar a privado'}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.actionBtn}
                                            activeOpacity={0.85}
                                            onPress={() => {
                                                void toggleBanned(item.id);
                                            }}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Ban size={12} color={colors.textMuted} />
                                                <Text style={styles.actionBtnText}>{meta.isBanned ? 'Quitar baneo' : 'Marcar baneado'}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    </>
                                ) : null}

                                {!item.isCore && item.origin === 'remote' ? (
                                    <View style={{ justifyContent: 'center' }}>
                                        <Text style={styles.colorRowSub}>Estado y visibilidad tomados del backend.</Text>
                                    </View>
                                ) : null}
                            </View>
                        </View>
                    );
                })}
            </View>

            <View style={styles.row}>
                <TouchableOpacity style={[styles.actionBtn, styles.grow]} activeOpacity={0.85} onPress={() => { void createBlankTheme(); }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Palette size={12} color={colors.textMuted} />
                        <Text style={styles.actionBtnText}>Nuevo tema</Text>
                    </View>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.grow]} activeOpacity={0.85} onPress={() => { void duplicateTheme(); }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <CopyPlus size={12} color={colors.textMuted} />
                        <Text style={styles.actionBtnText}>Duplicar tema</Text>
                    </View>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.grow]} activeOpacity={0.85} onPress={() => { void removeTheme(); }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Trash2 size={12} color={colors.red} />
                        <Text style={styles.actionBtnText}>Eliminar tema</Text>
                    </View>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderEditorTab = () => (
        <View style={{ gap: 9 }}>
            <View style={styles.card}>
                <Text style={styles.sectionLabel}>Editor del tema</Text>
                <Text style={styles.cardSub}>Definí nombre, paleta y aplicación automática al guardar.</Text>

                <View style={{ gap: 6 }}>
                    <Text style={styles.colorRowSub}>Selector de tema</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                        <TouchableOpacity
                            style={[styles.chip, selectedThemeId === null && styles.chipActive]}
                            onPress={() => { void createBlankTheme(); }}
                            activeOpacity={0.85}
                        >
                            <Text style={[styles.chipText, selectedThemeId === null && styles.chipTextActive]}>Nuevo</Text>
                        </TouchableOpacity>
                        {themeDrafts.map((draft) => {
                            const selected = selectedThemeId === draft.id;
                            return (
                                <TouchableOpacity
                                    key={draft.id}
                                    style={[styles.chip, selected && styles.chipActive]}
                                    onPress={() => {
                                        const item: CatalogItem = {
                                            id: draft.id,
                                            name: draft.name,
                                            source: 'community',
                                            lightPatch: draft.lightPatch,
                                            darkPatch: draft.darkPatch,
                                            supportsLight: true,
                                            supportsDark: true,
                                            isCore: false,
                                            isVerified: false,
                                            origin: 'local',
                                        };
                                        void selectThemeForEdit(item);
                                    }}
                                    activeOpacity={0.85}
                                >
                                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>{draft.name}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                <TextInput
                    value={name}
                    onChangeText={setName}
                    style={styles.input}
                    placeholder="Nombre del tema"
                    placeholderTextColor={colors.textMuted}
                />

                <View style={styles.row}>
                    <TouchableOpacity
                        style={[styles.modeBtn, styles.grow, editorMode === 'light' && styles.modeBtnActive]}
                        onPress={() => {
                            setEditorMode('light');
                            void triggerSensoryFeedback('selection');
                        }}
                        activeOpacity={0.85}
                    >
                        <Sun size={15} color={editorMode === 'light' ? colors.primary.DEFAULT : colors.textMuted} />
                        <Text style={[styles.modeBtnText, editorMode === 'light' && styles.modeBtnTextActive]}>Modo Claro</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.modeBtn, styles.grow, editorMode === 'dark' && styles.modeBtnActive]}
                        onPress={() => {
                            setEditorMode('dark');
                            void triggerSensoryFeedback('selection');
                        }}
                        activeOpacity={0.85}
                    >
                        <Moon size={15} color={editorMode === 'dark' ? colors.primary.DEFAULT : colors.textMuted} />
                        <Text style={[styles.modeBtnText, editorMode === 'dark' && styles.modeBtnTextActive]}>Modo Oscuro</Text>
                    </TouchableOpacity>
                </View>

                <View style={[styles.statusCard, { marginTop: 2 }]}> 
                    <Text style={styles.cardSub}>Editando ahora: {editorMode === 'light' ? 'Paleta clara' : 'Paleta oscura'}</Text>
                    <Text style={styles.cardSub}>
                        Al guardar: {applyOnSave === 'both' ? 'aplicar en claro + oscuro' : applyOnSave === 'light' ? 'aplicar en claro' : applyOnSave === 'dark' ? 'aplicar en oscuro' : 'solo guardar'}
                    </Text>
                </View>
            </View>

            <View style={{ gap: 7 }}>
                {COLOR_FIELD_META.map((field) => {
                    const value = activeFields[field.key];
                    const valid = !value || isValidHexColor(value);
                    const rgbText = hexToRgbInput(value);
                    const pickerOpen = pickerField === field.key;

                    return (
                        <View key={field.key} style={styles.colorRow}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.colorRowTitle}>{field.label}</Text>
                                    <Text style={styles.colorRowSub}>{field.description}</Text>
                                </View>
                                <TouchableOpacity
                                    style={[styles.swatch, { backgroundColor: valid && value ? value : colors.surfaceLighter }]}
                                    activeOpacity={0.85}
                                    onPress={() => {
                                        setPickerField((current) => (current === field.key ? null : field.key));
                                        void triggerSensoryFeedback('selection');
                                    }}
                                />
                            </View>

                            <View style={styles.row}>
                                <View style={styles.grow}>
                                    <Text style={[styles.colorRowSub, { marginBottom: 4 }]}>HEX</Text>
                                    <TextInput
                                        value={value}
                                        onChangeText={(next) => { void updateFieldFromHex(field.key, next); }}
                                        style={styles.compactInput}
                                        autoCapitalize="characters"
                                        autoCorrect={false}
                                        placeholder="#RRGGBB"
                                        placeholderTextColor={colors.textMuted}
                                    />
                                </View>
                                <View style={styles.grow}>
                                    <Text style={[styles.colorRowSub, { marginBottom: 4 }]}>RGB</Text>
                                    <TextInput
                                        value={rgbText}
                                        onChangeText={(next) => { void updateFieldFromRgb(field.key, next); }}
                                        style={styles.compactInput}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        placeholder="255, 255, 255"
                                        placeholderTextColor={colors.textMuted}
                                    />
                                </View>
                            </View>

                            {pickerOpen ? (
                                <View style={styles.pickerWrap}>
                                    <Text style={styles.colorRowSub}>Picker rápido</Text>
                                    <View style={styles.swatchGrid}>
                                        {swatchOptions.map((swatchValue) => {
                                            const selected = value.toUpperCase() === swatchValue.toUpperCase();
                                            return (
                                                <TouchableOpacity
                                                    key={`${field.key}-${swatchValue}`}
                                                    style={[styles.swatchOption, { backgroundColor: swatchValue }, selected && styles.swatchOptionSelected]}
                                                    activeOpacity={0.8}
                                                    onPress={() => {
                                                        void selectColorFromPicker(field.key, swatchValue);
                                                    }}
                                                />
                                            );
                                        })}
                                    </View>
                                </View>
                            ) : null}

                            <Text style={valid ? styles.helperOk : styles.helperError}>
                                {valid ? 'Formato válido' : 'Formato inválido. Usá #RRGGBB, #RRGGBBAA o RGB'}
                            </Text>
                        </View>
                    );
                })}
            </View>

            <View style={{ gap: 7 }}>
                <Text style={styles.sectionLabel}>Vista previa en vivo</Text>
                <View style={styles.row}>
                    {renderPreviewCard('light', 'Preview Claro', previewLight.colors)}
                    {renderPreviewCard('dark', 'Preview Oscuro', previewDark.colors)}
                </View>
            </View>

            <View style={{ gap: 7 }}>
                <Text style={styles.sectionLabel}>Al guardar</Text>
                <View style={[styles.row, { flexWrap: 'wrap' }]}>
                    {([
                        { id: 'none', label: 'Solo guardar', icon: SunMoon },
                        { id: 'light', label: 'Activar Claro', icon: Sun },
                        { id: 'dark', label: 'Activar Oscuro', icon: Moon },
                        { id: 'both', label: 'Activar ambos', icon: SunMoon },
                    ] as const).map((option) => {
                        const Icon = option.icon;
                        const isActive = applyOnSave === option.id;
                        return (
                            <TouchableOpacity
                                key={option.id}
                                style={[styles.chip, isActive && styles.chipActive]}
                                onPress={() => {
                                    setApplyOnSave(option.id);
                                    void triggerSensoryFeedback('selection');
                                }}
                                activeOpacity={0.85}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Icon size={12} color={isActive ? colors.primary.DEFAULT : colors.textMuted} />
                                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{option.label}</Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            <TouchableOpacity
                onPress={() => { void saveTheme(); }}
                style={{
                    borderRadius: 11,
                    backgroundColor: colors.primary.DEFAULT,
                    borderWidth: 1.5,
                    borderColor: colors.primary.dark,
                    paddingVertical: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 8,
                }}
                activeOpacity={0.86}
            >
                <Save size={15} color={colors.onPrimary} />
                <Text style={{ color: colors.onPrimary, fontWeight: '900', fontSize: 14 }}>Guardar tema</Text>
                <Check size={13} color={colors.onPrimary} />
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            {liveFeedback ? (
                <View style={[styles.liveFeedbackBanner, liveFeedback.tone === 'ok' ? styles.liveFeedbackOk : styles.liveFeedbackWarn]}>
                    <Text style={[styles.liveFeedbackText, { color: liveFeedback.tone === 'ok' ? colors.green : colors.yellow }]}>{liveFeedback.message}</Text>
                </View>
            ) : null}

            <View style={styles.row}>
                <TouchableOpacity
                    style={[styles.tabBtn, studioTab === 'themes' && styles.tabBtnActive]}
                    onPress={() => {
                        setStudioTab('themes');
                        void triggerSensoryFeedback('selection');
                    }}
                    activeOpacity={0.85}
                >
                    <Text style={[styles.tabBtnText, studioTab === 'themes' && styles.tabBtnTextActive]}>Temas</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabBtn, studioTab === 'editor' && styles.tabBtnActive]}
                    onPress={() => {
                        setStudioTab('editor');
                        void triggerSensoryFeedback('selection');
                    }}
                    activeOpacity={0.85}
                >
                    <Text style={[styles.tabBtnText, studioTab === 'editor' && styles.tabBtnTextActive]}>Editor</Text>
                </TouchableOpacity>
            </View>

            {studioTab === 'themes' ? renderThemesTab() : renderEditorTab()}

            <View style={styles.statusCard}>
                <Text style={styles.sectionLabel}>Modo de app actual</Text>
                <Text style={styles.cardSub}>{effectiveMode === 'light' ? 'Claro' : 'Oscuro'}</Text>
                <View style={styles.row}>
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.grow]}
                        activeOpacity={0.85}
                        onPress={() => {
                            const coreLight = {
                                id: 'core-light',
                                name: 'Core Claro',
                                source: 'core' as const,
                                lightPatch: {},
                                darkPatch: {},
                                supportsLight: true,
                                supportsDark: false,
                                isCore: true,
                                isVerified: true,
                                origin: 'core' as const,
                            };
                            void assignTheme('light', coreLight);
                        }}
                    >
                        <Text style={styles.actionBtnText}>Restablecer Claro</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.grow]}
                        activeOpacity={0.85}
                        onPress={() => {
                            const coreDark = {
                                id: 'core-dark',
                                name: 'Core Oscuro',
                                source: 'core' as const,
                                lightPatch: {},
                                darkPatch: {},
                                supportsLight: false,
                                supportsDark: true,
                                isCore: true,
                                isVerified: true,
                                origin: 'core' as const,
                            };
                            void assignTheme('dark', coreDark);
                        }}
                    >
                        <Text style={styles.actionBtnText}>Restablecer Oscuro</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}
