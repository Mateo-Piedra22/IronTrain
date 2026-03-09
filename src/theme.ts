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
    iron: IronScale;
    primary: PrimaryScale;
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

export const LightThemeTokens: ThemeTokens = {
    id: 'core-light',
    label: 'Core Light',
    mode: 'light',
    variant: 'core',
    colors: {
        iron: {
            50: '#fffcf9',
            100: '#fcfcfc',
            200: '#fafafa',
            300: '#e0e0e0',
            400: '#8d6e63',
            500: '#5d4037',
            600: '#4e342e',
            700: '#efebe9',
            800: '#ffffff',
            900: '#fff7f1',
            950: '#321414',
        },
        primary: {
            DEFAULT: '#5c2e2e',
            light: '#8d6e63',
            dark: '#3e1c1c',
        },
        white: '#ffffff',
        black: '#000000',
        blue: '#3b82f6',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#d97706',
        background: '#fff7f1',
        surface: '#ffffff',
        text: '#321414',
        textMuted: '#8d6e63',
        border: '#efebe9',
    },
};

export const DarkThemeTokens: ThemeTokens = {
    id: 'core-dark',
    label: 'Core Dark',
    mode: 'dark',
    variant: 'core',
    colors: {
        iron: {
            50: '#1a1716',
            100: '#201d1b',
            200: '#2a2522',
            300: '#3a3430',
            400: '#7a6c64',
            500: '#b39f93',
            600: '#d4c4ba',
            700: '#3a312c',
            800: '#241f1c',
            900: '#171311',
            950: '#f8ede6',
        },
        primary: {
            DEFAULT: '#d4a58f',
            light: '#e5b8a3',
            dark: '#9a6c58',
        },
        white: '#ffffff',
        black: '#000000',
        blue: '#60a5fa',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#f59e0b',
        background: '#171311',
        surface: '#241f1c',
        text: '#f8ede6',
        textMuted: '#b39f93',
        border: '#3a312c',
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

