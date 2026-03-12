import { DarkTheme as NavDarkTheme, DefaultTheme as NavLightTheme, Theme as NavTheme } from '@react-navigation/native';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeVariant = 'core' | 'custom';

export type IronScale = {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
    950: string;
};

export type PrimaryScale = {
    DEFAULT: string;
    light: string;
    dark: string;
};

export type ThemeColors = {
    isDark: boolean;
    iron: IronScale;
    primary: PrimaryScale;
    /** Foreground color for content placed on top of a primary-colored background. */
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
};

export type ThemeTokens = {
    id: string;
    label: string;
    mode: 'light' | 'dark';
    variant: ThemeVariant;
    colors: ThemeColors;
};

export type SubthemePack = {
    id: string;
    ownerUserId: string;
    name: string;
    visibility: 'private' | 'friends' | 'public';
    light: ThemeTokens;
    dark: ThemeTokens;
    createdAt: string;
    updatedAt: string;
};

// --- CORE DESIGN SCALES ---

const LIGHT_IRON: IronScale = {
    50: '#f6f7f9',
    100: '#eef1f4',
    200: '#e2e7ed',
    300: '#cfd7e1',
    400: '#aeb9c7',
    500: '#7f8a99',
    600: '#5e6877',
    700: '#404a59',
    800: '#2b3340',
    900: '#1c2430',
    950: '#0f172a',
};

const DARK_IRON: IronScale = {
    50: '#36434c',
    100: '#3b4a54',
    200: '#445560',
    300: '#516471',
    400: '#607686',
    500: '#7a93a3',
    600: '#a0b4c0',
    700: '#c4d0d8',
    800: '#dee6eb',
    900: '#f0f4f6',
    950: '#fffefb',
};

// --- PRESET TOKENS ---

export const LightThemeTokens: ThemeTokens = {
    id: 'core-light',
    label: 'Core Light',
    mode: 'light',
    variant: 'core',
    colors: {
        isDark: false,
        iron: LIGHT_IRON,
        primary: {
            DEFAULT: '#8aa0b8',
            light: '#b7c7d8',
            dark: '#5f768f',
        },
        onPrimary: LIGHT_IRON[950],
        white: '#ffffff',
        black: '#000000',
        blue: '#5b8def',
        red: '#e76a7a',
        green: '#35b585',
        yellow: '#d5a24f',
        background: LIGHT_IRON[50],
        surface: '#ffffff',
        surfaceLighter: LIGHT_IRON[100],
        text: LIGHT_IRON[950],
        textMuted: LIGHT_IRON[600],
        border: LIGHT_IRON[200],
    },
};

export const DarkThemeTokens: ThemeTokens = {
    id: 'core-dark',
    label: 'Core Dark',
    mode: 'dark',
    variant: 'core',
    colors: {
        isDark: true,
        iron: DARK_IRON,
        primary: {
            DEFAULT: '#ff8a80', //#d4ff3e DEFAULT del tema anterior
            light: '#ffb4ad', //#e6ff6b light del tema anterior
            dark: '#e85b54', //#b8e62a dark del tema anterior
        },
        onPrimary: '#000000',
        white: '#ffffff',
        black: '#000000',
        blue: '#60a5fa',
        red: '#fb7185',
        green: '#4ade80',
        yellow: '#fbbf24',
        background: DARK_IRON[50],
        surface: DARK_IRON[100],
        surfaceLighter: DARK_IRON[200],
        text: DARK_IRON[950],
        textMuted: DARK_IRON[600],
        border: DARK_IRON[200],
    },
};

export const CoreThemeCatalog = {
    light: LightThemeTokens,
    dark: DarkThemeTokens,
} as const;

export function resolveThemeTokens(mode: ThemeMode, systemScheme: 'light' | 'dark' = 'light'): ThemeTokens {
    if (mode === 'system') return CoreThemeCatalog[systemScheme];
    return CoreThemeCatalog[mode];
}

export function createLegacyColorsFromTokens(tokens: ThemeTokens): ThemeColors {
    return tokens.colors;
}

export function createColorsForMode(mode: ThemeMode, systemScheme: 'light' | 'dark' = 'light'): ThemeColors {
    return createLegacyColorsFromTokens(resolveThemeTokens(mode, systemScheme));
}

export function withAlpha(hexColor: string, alphaHex: string): string {
    let normalized = hexColor.startsWith('#') ? hexColor.slice(1) : hexColor;

    // Expand 3-digit hex to 6-digit (e.g., fff -> ffffff)
    if (normalized.length === 3) {
        normalized = normalized.split('').map(c => c + c).join('');
    }

    const base = normalized.length === 8 ? normalized.slice(0, 6) : normalized;
    return `#${base}${alphaHex}`;
}

export const ThemeFx = {
    backdrop: 'rgba(0,0,0,0.5)',
    backdropStrong: 'rgba(0,0,0,0.7)',
    backdropSoft: 'rgba(0,0,0,0.35)',
    shadowColor: '#000000',
    shadowOpacityStrong: 0.2,
    successBg: withAlpha('#22c55e', '1A'),
    successBorder: withAlpha('#22c55e', '66'),

    // Premium Shadows
    shadowSm: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    shadowMd: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
    },
    shadowLg: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 8,
    },
} as const;

// --- DYNAMIC INFRASTRUCTURE (PHASE B) ---

let activeColors = LightThemeTokens.colors;

/**
 * Global Colors proxy. Redirects to activeColors.
 * Note: Components should ideally use useColors() hook to ensure 
 * they re-render on theme change, but this proxy allows some 
 * level of consistency for legacy/static usage.
 */
export const Colors = new Proxy({} as ThemeColors, {
    get(_, prop) {
        return activeColors[prop as keyof ThemeColors];
    }
});

/**
 * Updates the global activeColors. Should only be called by ThemeProvider.
 */
export function _setGlobalActiveColors(newColors: ThemeColors) {
    activeColors = newColors;
}

/**
 * Resolves properties for React Navigation ThemeProvider
 */
export function resolveNavigationTheme(tokens: ThemeTokens): NavTheme {
    const isDark = tokens.mode === 'dark';
    const base = isDark ? NavDarkTheme : NavLightTheme;

    return {
        ...base,
        dark: isDark,
        colors: {
            ...base.colors,
            primary: tokens.colors.primary.DEFAULT,
            background: tokens.colors.background,
            card: tokens.colors.surface,
            text: tokens.colors.text,
            border: tokens.colors.border,
            notification: tokens.colors.primary.DEFAULT,
        },
    };
}
