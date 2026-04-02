import { isValidHexColor, ThemeColorPatch } from '@/src/theme-engine';
import { EditableColorFields, EditorMode, LocalThemeMeta, ThemesFilterPreferences } from './types';

export function patchToFields(patch: ThemeColorPatch): EditableColorFields {
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

export function fieldsToPatch(fields: EditableColorFields): ThemeColorPatch {
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

export function prettifyHexInput(raw: string): string {
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

export function parseRgbInput(raw: string): { ok: true; hex: string } | { ok: false } {
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

export function hexToRgbInput(hex: string): string {
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

export function hexToHslInput(hex: string): string {
    if (!isValidHexColor(hex)) return '';
    const normalized = hex.slice(1);
    if (normalized.length < 6) return '';

    const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
    const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
    const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    if (delta !== 0) {
        if (max === r) h = ((g - b) / delta) % 6;
        else if (max === g) h = (b - r) / delta + 2;
        else h = (r - g) / delta + 4;
    }

    h = Math.round(h * 60);
    if (h < 0) h += 360;

    const l = (max + min) / 2;
    const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

    return `${Math.round(h)}, ${Math.round(s * 100)}, ${Math.round(l * 100)}`;
}

export function parseHslInput(raw: string): { ok: true; hex: string } | { ok: false } {
    const normalized = raw
        .trim()
        .replace(/^hsla?\(/i, '')
        .replace(/\)$/i, '')
        .replace(/\s+/g, '')
        .replace(/%/g, '');

    if (!normalized) return { ok: false };

    const parts = normalized.split(',');
    if (parts.length < 3) return { ok: false };

    const h = Number(parts[0]);
    const s = Number(parts[1]);
    const l = Number(parts[2]);

    if ([h, s, l].some((value) => Number.isNaN(value))) return { ok: false };
    if (h < 0 || h > 360 || s < 0 || s > 100 || l < 0 || l > 100) return { ok: false };

    return { ok: true, hex: hslToHex(h, s, l) };
}

export function normalizeThemeMeta(value: unknown): Record<string, LocalThemeMeta> {
    if (!value || typeof value !== 'object') return {};
    const input = value as Record<string, any>;
    const output: Record<string, LocalThemeMeta> = {};

    for (const [key, raw] of Object.entries(input)) {
        if (!key || typeof raw !== 'object' || !raw) continue;
        const visibility: LocalThemeMeta['visibility'] =
            raw.visibility === 'public' ? 'public' : raw.visibility === 'friends' ? 'friends' : 'private';
        const isBanned = raw.isBanned === true;
        const commentsCount = Number.isFinite(raw.commentsCount) ? Math.max(0, Number(raw.commentsCount)) : 0;
        const isCoreDerived = raw.isCoreDerived === true;
        output[key] = { visibility: isCoreDerived ? 'private' : visibility, isBanned, commentsCount, isCoreDerived };
    }

    return output;
}

function hexToRgbTuple(hex: string): [number, number, number] | null {
    if (!isValidHexColor(hex)) return null;
    const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
    const base = normalized.length >= 6 ? normalized.slice(0, 6) : '';
    if (base.length !== 6) return null;
    const r = Number.parseInt(base.slice(0, 2), 16);
    const g = Number.parseInt(base.slice(2, 4), 16);
    const b = Number.parseInt(base.slice(4, 6), 16);
    if ([r, g, b].some((value) => Number.isNaN(value))) return null;
    return [r, g, b];
}

function rgbTupleToHex([r, g, b]: [number, number, number]): string {
    const toHex = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0').toUpperCase();
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixHex(from: string, to: string, t: number): string {
    const fromRgb = hexToRgbTuple(from);
    const toRgb = hexToRgbTuple(to);
    if (!fromRgb || !toRgb) return from;
    const amount = Math.max(0, Math.min(1, t));
    const mixed: [number, number, number] = [
        fromRgb[0] + (toRgb[0] - fromRgb[0]) * amount,
        fromRgb[1] + (toRgb[1] - fromRgb[1]) * amount,
        fromRgb[2] + (toRgb[2] - fromRgb[2]) * amount,
    ];
    return rgbTupleToHex(mixed);
}

function relativeLuminance(hex: string): number {
    const rgb = hexToRgbTuple(hex);
    if (!rgb) return 0;
    const channel = (value: number) => {
        const normalized = value / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    const [r, g, b] = rgb;
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function isHexValid(value: string): boolean {
    return !!value && isValidHexColor(value);
}

type ModeFallbackColors = {
    primary: { DEFAULT: string; light: string; dark: string };
    onPrimary: string;
    background: string;
    surface: string;
    surfaceLighter: string;
    text: string;
    textMuted: string;
    border: string;
};

export function applyEditorSmartDefaults(fields: EditableColorFields, mode: EditorMode, fallback: ModeFallbackColors): EditableColorFields {
    const next: EditableColorFields = { ...fields };

    const primaryBase = isHexValid(next.primaryDefault) ? next.primaryDefault : fallback.primary.DEFAULT;
    if (!isHexValid(next.primaryLight)) {
        next.primaryLight = isHexValid(primaryBase) ? mixHex(primaryBase, '#FFFFFF', 0.2) : fallback.primary.light;
    }
    if (!isHexValid(next.primaryDark)) {
        next.primaryDark = isHexValid(primaryBase) ? mixHex(primaryBase, '#000000', 0.18) : fallback.primary.dark;
    }
    if (!isHexValid(next.onPrimary)) {
        next.onPrimary = isHexValid(primaryBase)
            ? (relativeLuminance(primaryBase) > 0.57 ? '#000000' : '#FFFFFF')
            : fallback.onPrimary;
    }

    const surfaceBase = isHexValid(next.surface) ? next.surface : fallback.surface;
    if (!isHexValid(next.surfaceLighter)) {
        next.surfaceLighter = isHexValid(surfaceBase)
            ? (mode === 'dark' ? mixHex(surfaceBase, '#FFFFFF', 0.08) : mixHex(surfaceBase, '#000000', 0.06))
            : fallback.surfaceLighter;
    }

    const textBase = isHexValid(next.text) ? next.text : fallback.text;
    const backgroundBase = isHexValid(next.background) ? next.background : fallback.background;

    if (!isHexValid(next.textMuted)) {
        next.textMuted = isHexValid(textBase) && isHexValid(backgroundBase)
            ? mixHex(textBase, backgroundBase, 0.45)
            : fallback.textMuted;
    }

    if (!isHexValid(next.border)) {
        next.border = isHexValid(backgroundBase) && isHexValid(textBase)
            ? mixHex(backgroundBase, textBase, 0.18)
            : fallback.border;
    }

    return next;
}

export function normalizeRemoteLinkMap(value: unknown): Record<string, string> {
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

export function normalizeThemeFilterPreferences(value: unknown): ThemesFilterPreferences {
    const defaults: ThemesFilterPreferences = {
        sourceFilter: 'all',
        activeFilter: 'all',
        statusFilter: 'all',
        themeSearch: '',
        filtersExpanded: false,
    };

    if (!value || typeof value !== 'object') return defaults;
    const raw = value as Record<string, unknown>;

    return {
        sourceFilter: raw.sourceFilter === 'core' || raw.sourceFilter === 'community' ? raw.sourceFilter : 'all',
        activeFilter: raw.activeFilter === 'active' || raw.activeFilter === 'inactive' ? raw.activeFilter : 'all',
        statusFilter:
            raw.statusFilter === 'approved' ||
            raw.statusFilter === 'pending_review' ||
            raw.statusFilter === 'draft' ||
            raw.statusFilter === 'rejected' ||
            raw.statusFilter === 'suspended'
                ? raw.statusFilter
                : 'all',
        themeSearch: typeof raw.themeSearch === 'string' ? raw.themeSearch : '',
        filtersExpanded: raw.filtersExpanded === true,
    };
}
