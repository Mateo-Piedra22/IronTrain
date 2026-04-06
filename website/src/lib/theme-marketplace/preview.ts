import { ThemePackPayload } from './contracts';

export type ThemePreviewChannels = {
    hero: string;
    surface: string;
    text: string;
};

export type ThemeMode = 'light' | 'dark';

export type ThemePreviewByMode = {
    light: ThemePreviewChannels;
    dark: ThemePreviewChannels;
};

const FALLBACK_PREVIEW: ThemePreviewChannels = {
    hero: '#8AA0B8',
    surface: '#FFFFFF',
    text: '#0F172A',
};

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const asHex = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    if (!HEX_COLOR_REGEX.test(normalized)) return null;
    return normalized.toUpperCase();
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
};

const pickFirstHex = (...values: unknown[]): string | null => {
    for (const value of values) {
        const hex = asHex(value);
        if (hex) return hex;
    }
    return null;
};

export function resolveThemePreview(payloadRaw: unknown): ThemePreviewChannels {
    const payload = (asRecord(payloadRaw) ?? {}) as Partial<ThemePackPayload>;
    const preview = asRecord(payload.preview);
    const lightPatch = asRecord(payload.lightPatch);
    const darkPatch = asRecord(payload.darkPatch);
    const lightPrimary = asRecord(lightPatch?.primary);
    const darkPrimary = asRecord(darkPatch?.primary);

    const hero = pickFirstHex(
        preview?.hero,
        lightPatch?.logoAccent,
        lightPatch?.logoPrimary,
        lightPrimary?.DEFAULT,
        lightPrimary?.light,
        lightPatch?.blue,
        lightPatch?.onPrimary,
        darkPatch?.logoAccent,
        darkPatch?.logoPrimary,
        darkPrimary?.DEFAULT,
        darkPrimary?.dark,
        darkPatch?.blue,
        darkPatch?.onPrimary,
        FALLBACK_PREVIEW.hero,
    ) ?? FALLBACK_PREVIEW.hero;

    const surface = pickFirstHex(
        preview?.surface,
        lightPatch?.surface,
        lightPatch?.surfaceLighter,
        lightPatch?.background,
        darkPatch?.surface,
        darkPatch?.surfaceLighter,
        darkPatch?.background,
        FALLBACK_PREVIEW.surface,
    ) ?? FALLBACK_PREVIEW.surface;

    const text = pickFirstHex(
        preview?.text,
        lightPatch?.text,
        lightPatch?.textMuted,
        darkPatch?.text,
        darkPatch?.textMuted,
        FALLBACK_PREVIEW.text,
    ) ?? FALLBACK_PREVIEW.text;

    return { hero, surface, text };
}

function resolveThemePreviewForMode(payloadRaw: unknown, mode: ThemeMode): ThemePreviewChannels {
    const payload = (asRecord(payloadRaw) ?? {}) as Partial<ThemePackPayload>;
    const preview = asRecord(payload.preview);
    const lightPatch = asRecord(payload.lightPatch);
    const darkPatch = asRecord(payload.darkPatch);
    const preferredPatch = mode === 'light' ? lightPatch : darkPatch;
    const secondaryPatch = mode === 'light' ? darkPatch : lightPatch;
    const preferredPrimary = asRecord(preferredPatch?.primary);
    const secondaryPrimary = asRecord(secondaryPatch?.primary);

    const hero = pickFirstHex(
        preview?.hero,
        preferredPatch?.logoAccent,
        preferredPatch?.logoPrimary,
        preferredPrimary?.DEFAULT,
        preferredPrimary?.light,
        preferredPatch?.blue,
        preferredPatch?.onPrimary,
        secondaryPatch?.logoAccent,
        secondaryPatch?.logoPrimary,
        secondaryPrimary?.DEFAULT,
        secondaryPrimary?.dark,
        secondaryPatch?.blue,
        secondaryPatch?.onPrimary,
        FALLBACK_PREVIEW.hero,
    ) ?? FALLBACK_PREVIEW.hero;

    const surface = pickFirstHex(
        preview?.surface,
        preferredPatch?.surface,
        preferredPatch?.surfaceLighter,
        preferredPatch?.background,
        secondaryPatch?.surface,
        secondaryPatch?.surfaceLighter,
        secondaryPatch?.background,
        FALLBACK_PREVIEW.surface,
    ) ?? FALLBACK_PREVIEW.surface;

    const text = pickFirstHex(
        preview?.text,
        preferredPatch?.text,
        preferredPatch?.textMuted,
        secondaryPatch?.text,
        secondaryPatch?.textMuted,
        FALLBACK_PREVIEW.text,
    ) ?? FALLBACK_PREVIEW.text;

    return { hero, surface, text };
}

export function resolveThemePreviewByMode(payloadRaw: unknown): ThemePreviewByMode {
    return {
        light: resolveThemePreviewForMode(payloadRaw, 'light'),
        dark: resolveThemePreviewForMode(payloadRaw, 'dark'),
    };
}