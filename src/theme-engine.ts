import { CoreThemeCatalog, ThemeColors, ThemeMode, ThemeTokens, createColorsForMode } from './theme';

export type ThemeColorPatch = Partial<{
    iron: Partial<ThemeColors['iron']>;
    primary: Partial<ThemeColors['primary']>;
    logoPrimary: string;
    logoAccent: string;
    onPrimary: string;
    white: string;
    black: string;
    blue: string;
    red: string;
    green: string;
    yellow: string;
    background: string;
    surface: string;
    surfaceLighter: string;
    text: string;
    textMuted: string;
    border: string;
}>;

export type ThemeDraft = {
    id: string;
    name: string;
    lightPatch: ThemeColorPatch;
    darkPatch: ThemeColorPatch;
    createdAt: number;
    updatedAt: number;
};

export type AppThemeSelection = {
    mode: ThemeMode;
    activeSubthemeIdLight?: string | null;
    activeSubthemeIdDark?: string | null;
};

const HEX_COLOR_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
export const MAX_THEME_DRAFTS = 24;
export const MAX_THEME_DRAFT_NAME_LENGTH = 48;

export function isValidHexColor(value: string): boolean {
    return HEX_COLOR_RE.test(value);
}

function assertValidHex(value: string): string {
    if (!HEX_COLOR_RE.test(value)) throw new Error(`Invalid color token: ${value}`);
    return value;
}

function sanitizeDraftName(raw: string): string {
    return raw.trim().replace(/\s+/g, ' ').slice(0, MAX_THEME_DRAFT_NAME_LENGTH);
}

function hasAtLeastOnePatchValue(patch: ThemeColorPatch): boolean {
    const scalarKeys: (keyof ThemeColorPatch)[] = ['logoPrimary', 'logoAccent', 'onPrimary', 'white', 'black', 'blue', 'red', 'green', 'yellow', 'background', 'surface', 'surfaceLighter', 'text', 'textMuted', 'border'];
    if (patch.iron && Object.keys(patch.iron).length > 0) return true;
    if (patch.primary && Object.keys(patch.primary).length > 0) return true;
    return scalarKeys.some((key) => typeof patch[key] === 'string');
}

export function validateThemeDraftInput(input: { name: string; lightPatch: ThemeColorPatch; darkPatch: ThemeColorPatch }): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const name = sanitizeDraftName(input.name);

    if (!name) {
        errors.push('El nombre del tema es obligatorio.');
    }

    if (name.length < 3) {
        errors.push('El nombre debe tener al menos 3 caracteres.');
    }

    if (!hasAtLeastOnePatchValue(input.lightPatch) && !hasAtLeastOnePatchValue(input.darkPatch)) {
        errors.push('Debes personalizar al menos un color en Light o Dark.');
    }

    return { isValid: errors.length === 0, errors };
}

function sanitizePatch(patch: ThemeColorPatch): ThemeColorPatch {
    const out: ThemeColorPatch = {};
    if (patch.iron) {
        out.iron = {};
        for (const [key, value] of Object.entries(patch.iron)) {
            if (typeof value === 'string') {
                (out.iron as Record<string, string>)[key] = assertValidHex(value);
            }
        }
    }
    if (patch.primary) {
        out.primary = {};
        for (const [key, value] of Object.entries(patch.primary)) {
            if (typeof value === 'string') {
                (out.primary as Record<string, string>)[key] = assertValidHex(value);
            }
        }
    }
    const scalarKeys: (keyof ThemeColorPatch)[] = ['logoPrimary', 'logoAccent', 'onPrimary', 'white', 'black', 'blue', 'red', 'green', 'yellow', 'background', 'surface', 'surfaceLighter', 'text', 'textMuted', 'border'];
    for (const key of scalarKeys) {
        const value = patch[key];
        if (typeof value === 'string') {
            (out as Record<string, string>)[key] = assertValidHex(value);
        }
    }
    return out;
}

export function applyThemeColorPatch(base: ThemeTokens, patch: ThemeColorPatch, meta: { id: string; label: string; variant?: ThemeTokens['variant'] }): ThemeTokens {
    const safePatch = sanitizePatch(patch);
    return {
        ...base,
        id: meta.id,
        label: meta.label,
        variant: meta.variant ?? 'custom',
        colors: {
            ...base.colors,
            ...safePatch,
            iron: {
                ...base.colors.iron,
                ...(safePatch.iron || {}),
            },
            primary: {
                ...base.colors.primary,
                ...(safePatch.primary || {}),
            },
        },
    };
}

export function sanitizeThemeDraft(raw: unknown): ThemeDraft | null {
    if (!raw || typeof raw !== 'object') return null;

    const asRecord = raw as Record<string, unknown>;
    const id = typeof asRecord.id === 'string' ? asRecord.id.trim() : '';
    const name = sanitizeDraftName(typeof asRecord.name === 'string' ? asRecord.name : '');
    const lightPatchRaw = asRecord.lightPatch;
    const darkPatchRaw = asRecord.darkPatch;
    const createdAt = Number(asRecord.createdAt);
    const updatedAt = Number(asRecord.updatedAt);

    if (!id || !name) return null;

    let lightPatch: ThemeColorPatch = {};
    let darkPatch: ThemeColorPatch = {};

    try {
        lightPatch = sanitizePatch((lightPatchRaw && typeof lightPatchRaw === 'object' ? lightPatchRaw : {}) as ThemeColorPatch);
        darkPatch = sanitizePatch((darkPatchRaw && typeof darkPatchRaw === 'object' ? darkPatchRaw : {}) as ThemeColorPatch);
    } catch {
        return null;
    }

    return {
        id,
        name,
        lightPatch,
        darkPatch,
        createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
        updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
    };
}

export function sanitizeThemeDraftList(raw: unknown): ThemeDraft[] {
    if (!Array.isArray(raw)) return [];
    const output: ThemeDraft[] = [];
    const seen = new Set<string>();

    for (const item of raw) {
        const draft = sanitizeThemeDraft(item);
        if (!draft) continue;
        if (seen.has(draft.id)) continue;
        seen.add(draft.id);
        output.push(draft);
        if (output.length >= MAX_THEME_DRAFTS) break;
    }

    return output;
}

function getActiveMode(mode: ThemeMode, systemScheme: 'light' | 'dark'): 'light' | 'dark' {
    if (mode === 'system') return systemScheme;
    return mode;
}

export function resolveThemeTokensFromSelection(selection: AppThemeSelection, systemScheme: 'light' | 'dark', drafts: ThemeDraft[]): ThemeTokens {
    const activeMode = getActiveMode(selection.mode, systemScheme);
    const base = CoreThemeCatalog[activeMode];
    const draftId = activeMode === 'light' ? selection.activeSubthemeIdLight : selection.activeSubthemeIdDark;

    if (!draftId) return base;

    const draft = drafts.find((item) => item.id === draftId);
    if (!draft) return base;

    const patch = activeMode === 'light' ? draft.lightPatch : draft.darkPatch;
    if (!hasAtLeastOnePatchValue(patch)) return base;

    return applyThemeColorPatch(base, patch, {
        id: `draft:${draft.id}:${activeMode}`,
        label: draft.name,
        variant: 'custom',
    });
}

export function resolveActiveThemeColors(selection: AppThemeSelection, systemScheme: 'light' | 'dark'): ThemeColors {
    return createColorsForMode(selection.mode, systemScheme);
}

export function getCoreThemeToken(mode: 'light' | 'dark'): ThemeTokens {
    return CoreThemeCatalog[mode];
}

export function serializeThemePatch(patch: ThemeColorPatch): string {
    return JSON.stringify(sanitizePatch(patch));
}

export function deserializeThemePatch(raw: string): ThemeColorPatch {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return sanitizePatch(parsed as ThemeColorPatch);
}
