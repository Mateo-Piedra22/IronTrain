import { CoreThemeCatalog, ThemeColors, ThemeMode, ThemeTokens, createColorsForMode } from './theme';

export type ThemeColorPatch = Partial<{
    iron: Partial<ThemeColors['iron']>;
    primary: Partial<ThemeColors['primary']>;
    white: string;
    black: string;
    blue: string;
    red: string;
    green: string;
    yellow: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    border: string;
}>;

export type AppThemeSelection = {
    mode: ThemeMode;
    activeSubthemeIdLight?: string | null;
    activeSubthemeIdDark?: string | null;
};

const HEX_COLOR_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function assertValidHex(value: string): string {
    if (!HEX_COLOR_RE.test(value)) throw new Error(`Invalid color token: ${value}`);
    return value;
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
    const scalarKeys: (keyof ThemeColorPatch)[] = ['white', 'black', 'blue', 'red', 'green', 'yellow', 'background', 'surface', 'text', 'textMuted', 'border'];
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
