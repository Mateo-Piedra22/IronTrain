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

export type ModeFallbackColors = {
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

export type ContrastSeverity = 'blocker' | 'warning' | 'info';

export type ContrastAuditIssue = {
    id: string;
    mode: EditorMode;
    label: string;
    ratio: number;
    minRatio: number;
    severity: ContrastSeverity;
};

export type ContrastAuditReport = {
    mode: EditorMode;
    score: number;
    blockers: number;
    warnings: number;
    infos: number;
    issues: ContrastAuditIssue[];
};

const CONTRAST_REFERENCE_BLACK = '#000000';
const CONTRAST_REFERENCE_WHITE = '#FFFFFF';

type ColorPairRule = {
    id: string;
    label: string;
    fg: keyof EditableColorFields;
    bg: keyof EditableColorFields;
    minRatio: number;
    severity: ContrastSeverity;
};

const CONTRAST_RULES: ColorPairRule[] = [
    { id: 'text-on-background', label: 'Texto principal / Fondo', fg: 'text', bg: 'background', minRatio: 4.5, severity: 'blocker' },
    { id: 'text-on-surface', label: 'Texto principal / Superficie', fg: 'text', bg: 'surface', minRatio: 4.5, severity: 'blocker' },
    { id: 'text-on-surface-lighter', label: 'Texto principal / Superficie secundaria', fg: 'text', bg: 'surfaceLighter', minRatio: 4.5, severity: 'blocker' },
    { id: 'onprimary-on-primary', label: 'Texto en botón / Primario', fg: 'onPrimary', bg: 'primaryDefault', minRatio: 4.5, severity: 'blocker' },
    { id: 'muted-on-background', label: 'Texto secundario / Fondo', fg: 'textMuted', bg: 'background', minRatio: 3, severity: 'warning' },
    { id: 'muted-on-surface', label: 'Texto secundario / Superficie', fg: 'textMuted', bg: 'surface', minRatio: 3, severity: 'warning' },
    { id: 'primary-on-background', label: 'Primario / Fondo', fg: 'primaryDefault', bg: 'background', minRatio: 3, severity: 'warning' },
    { id: 'primary-light-on-background', label: 'Primario claro / Fondo', fg: 'primaryLight', bg: 'background', minRatio: 3, severity: 'info' },
    { id: 'primary-dark-on-background', label: 'Primario oscuro / Fondo', fg: 'primaryDark', bg: 'background', minRatio: 3, severity: 'info' },
    { id: 'border-on-surface', label: 'Borde / Superficie', fg: 'border', bg: 'surface', minRatio: 1.5, severity: 'info' },
];

function normalizeHexForContrast(hex: string): string {
    if (!isHexValid(hex)) return hex;
    const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
    const base = normalized.length >= 6 ? normalized.slice(0, 6) : normalized;
    return `#${base.toUpperCase()}`;
}

export function contrastRatio(foregroundHex: string, backgroundHex: string): number {
    const fg = normalizeHexForContrast(foregroundHex);
    const bg = normalizeHexForContrast(backgroundHex);
    if (!isHexValid(fg) || !isHexValid(bg)) return 1;

    const fgLum = relativeLuminance(fg);
    const bgLum = relativeLuminance(bg);
    const lighter = Math.max(fgLum, bgLum);
    const darker = Math.min(fgLum, bgLum);
    return Number((((lighter + 0.05) / (darker + 0.05))).toFixed(2));
}

function resolveContrastAuditFields(fields: EditableColorFields, mode: EditorMode, fallback: ModeFallbackColors): EditableColorFields {
    return applyEditorSmartDefaults(fields, mode, fallback);
}

function countBySeverity(issues: ContrastAuditIssue[], severity: ContrastSeverity): number {
    return issues.filter((issue) => issue.severity === severity).length;
}

function scoreFromIssues(issues: ContrastAuditIssue[]): number {
    const deductions = issues.reduce((acc, issue) => {
        if (issue.severity === 'blocker') return acc + 22;
        if (issue.severity === 'warning') return acc + 10;
        return acc + 4;
    }, 0);
    return Math.max(0, 100 - deductions);
}

export function evaluateThemeContrastAudit(fields: EditableColorFields, mode: EditorMode, fallback: ModeFallbackColors): ContrastAuditReport {
    const resolved = resolveContrastAuditFields(fields, mode, fallback);

    const issues: ContrastAuditIssue[] = [];
    for (const rule of CONTRAST_RULES) {
        const fg = resolved[rule.fg];
        const bg = resolved[rule.bg];
        if (!isHexValid(fg) || !isHexValid(bg)) continue;

        const ratio = contrastRatio(fg, bg);
        if (ratio < rule.minRatio) {
            issues.push({
                id: rule.id,
                mode,
                label: rule.label,
                ratio,
                minRatio: rule.minRatio,
                severity: rule.severity,
            });
        }
    }

    return {
        mode,
        score: scoreFromIssues(issues),
        blockers: countBySeverity(issues, 'blocker'),
        warnings: countBySeverity(issues, 'warning'),
        infos: countBySeverity(issues, 'info'),
        issues,
    };
}

function channelDistance(hexA: string, hexB: string): number {
    const a = hexToRgbTuple(normalizeHexForContrast(hexA));
    const b = hexToRgbTuple(normalizeHexForContrast(hexB));
    if (!a || !b) return Number.MAX_SAFE_INTEGER;
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

function adjustColorForMinContrast(foregroundHex: string, backgroundHex: string, minRatio: number): string {
    const foreground = normalizeHexForContrast(foregroundHex);
    const background = normalizeHexForContrast(backgroundHex);
    if (!isHexValid(foreground) || !isHexValid(background)) return foregroundHex;

    const currentRatio = contrastRatio(foreground, background);
    if (currentRatio >= minRatio) return foreground;

    let best = foreground;
    let bestRatio = currentRatio;
    let bestDistance = Number.MAX_SAFE_INTEGER;

    const targets = [CONTRAST_REFERENCE_BLACK, CONTRAST_REFERENCE_WHITE];
    for (const target of targets) {
        for (let step = 0; step <= 100; step += 1) {
            const mixed = mixHex(foreground, target, step / 100);
            const ratio = contrastRatio(mixed, background);
            if (ratio < minRatio) continue;

            const distance = channelDistance(foreground, mixed);
            if (distance < bestDistance || (distance === bestDistance && ratio > bestRatio)) {
                best = mixed;
                bestRatio = ratio;
                bestDistance = distance;
            }
            break;
        }
    }

    return best;
}

export function autoFixThemeContrastFields(fields: EditableColorFields, mode: EditorMode, fallback: ModeFallbackColors): EditableColorFields {
    const next = applyEditorSmartDefaults(fields, mode, fallback);

    next.onPrimary = adjustColorForMinContrast(next.onPrimary, next.primaryDefault, 4.5);

    const textCandidate = adjustColorForMinContrast(next.text, next.background, 4.5);
    next.text = adjustColorForMinContrast(textCandidate, next.surface, 4.5);
    next.text = adjustColorForMinContrast(next.text, next.surfaceLighter, 4.5);

    next.textMuted = adjustColorForMinContrast(next.textMuted, next.background, 3);
    next.textMuted = adjustColorForMinContrast(next.textMuted, next.surface, 3);

    next.primaryDefault = adjustColorForMinContrast(next.primaryDefault, next.background, 3);
    next.primaryLight = adjustColorForMinContrast(next.primaryLight, next.background, 3);
    next.primaryDark = adjustColorForMinContrast(next.primaryDark, next.background, 3);
    next.border = adjustColorForMinContrast(next.border, next.surface, 1.5);

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
